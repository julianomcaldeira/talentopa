import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";


type UserRole = "admin" | "consultor" | "empresa" | "canal";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  avatar_url: string | null;
  status: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  empresaPapel: string | null;
  /** Empresa (dono) à qual o usuário pertence: ele mesmo, se for a empresa, ou a empresa que o vinculou (RMO, coordenador, etc.) */
  empresaUserId: string | null;
  
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [empresaPapel, setEmpresaPapel] = useState<string | null>(null);
  const [empresaUserId, setEmpresaUserId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      // tentar com ativo=true, fallback sem coluna se migration ainda não aplicou
      let empUsr: any = null;
      const profPromise = supabase.from("profiles").select("*").eq("user_id", userId).single();
      const rolePromise = supabase.from("user_roles").select("role").eq("user_id", userId);
      const empPromise = supabase.from("empresa_usuarios").select("papel, empresa_user_id").eq("user_id", userId).eq("ativo", true).maybeSingle();
      const [{ data: profileData, error: profErr }, empRes, { data: roleRows }] = await Promise.all([profPromise, empPromise, rolePromise]);
      if ((empRes as any)?.error && (empRes as any).error.message?.includes("column") && (empRes as any).error.message?.includes("ativo")) {
        const { data: fallback } = await supabase.from("empresa_usuarios").select("papel, empresa_user_id").eq("user_id", userId).maybeSingle();
        empUsr = fallback;
      } else {
        empUsr = (empRes as any)?.data;
      }
      // verificar se é dono (tem empresa_perfil) para não confundir ex-RMO com empresa
      const { data: empresaPerfil } = await supabase.from("empresa_perfil").select("user_id").eq("user_id", userId).maybeSingle();
      const isEmpresaDono = !!empresaPerfil;

      if (profErr) {
        // profile pode não existir se trigger falhou — não trava, continua para resolver role
        console.warn("fetchProfile profiles error", profErr.message);
      }
      if (profileData) setProfile(profileData as Profile);
      else setProfile(null);

      const papelEmpresa = (empUsr?.papel as string) || null;
      setEmpresaPapel(papelEmpresa);

      // empresaUserId inicial (vínculo); se for dono sem vínculo, corrige depois
      setEmpresaUserId((empUsr?.empresa_user_id as string) || null);

      let resolvedRole: UserRole | null = null;
      if (roleRows && roleRows.length) {
        const roles = roleRows.map((r: any) => r.role as UserRole);
        if (roles.includes("admin")) resolvedRole = "admin";
        else if (papelEmpresa && roles.includes("empresa")) resolvedRole = "empresa";
        else if (papelEmpresa && roles.includes("consultor")) {
          resolvedRole = "empresa";
        } else if (roles.includes("empresa") && (papelEmpresa || isEmpresaDono)) {
          // só mantém empresa se tem vínculo ativo ou é dono (evita ex-RMO órfão virar empresa dona)
          resolvedRole = "empresa";
        } else if (roles.includes("canal")) resolvedRole = "canal";
        else if (roles.includes("consultor")) resolvedRole = "consultor";
        else resolvedRole = roles[0] as UserRole;
      }
      // se tem papel mas role foi revogada (ex-RMO), não inventar role
      if (resolvedRole) setRole(resolvedRole);
      else if (papelEmpresa) {
        // vínculo ativo mas sem role — trata como empresa (aguardando backfill)
        setRole("empresa");
        resolvedRole = "empresa";
      } else setRole(null);

      if (!empUsr?.empresa_user_id && resolvedRole === "empresa" && isEmpresaDono) {
        setEmpresaUserId(userId);
      } else if (!empUsr?.empresa_user_id && resolvedRole === "empresa" && !isEmpresaDono) {
        // ex-RMO com role órfã e sem vínculo/dono — não é empresa, força consultor ou null
        const roles = (roleRows || []).map((r: any) => r.role as string);
        if (roles.includes("consultor")) {
          setRole("consultor");
        } else {
          setRole(null);
        }
        setEmpresaUserId(null);
        // limpar role órfã em background (não bloqueia)
        if (roles.includes("empresa")) {
          supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "empresa").then(() => {});
        }
        return;
      }
    } catch (e) {
      console.error("fetchProfile failed", e);
      setRole(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // evita deadlock do Supabase: deferir, mas aguardar fetch antes de liberar loading
          setTimeout(async () => {
            if (cancelled) return;
            await fetchProfile(session.user.id);
            if (!cancelled) setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setEmpresaPapel(null);
          setEmpresaUserId(null);
          if (!cancelled) setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Reage a alterações do perfil de acesso feitas pelo admin em tempo real:
  // ao detectar mudança em user_roles do usuário logado, recarrega e redireciona
  // para o dashboard do novo papel.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-role-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          const eventType = payload.eventType as string;
          // DELETE: payload.old contém role removida
          if (eventType === "DELETE") {
            const oldRole = (payload.old?.role as UserRole) || null;
            if (oldRole === role) {
              // role revogada — refaz fetch para cair no fallback consultor/empresa
              await fetchProfile(user.id);
              window.location.replace("/login");
            }
            return;
          }
          const newRole = (payload.new?.role as UserRole) || null;
          const oldRole = role;
          if (newRole && newRole !== oldRole) {
            setRole(newRole);
            const map: Record<UserRole, string> = {
              admin: "/admin",
              consultor: "/consultor",
              empresa: "/empresa",
              canal: "/canal",
            };
            window.location.replace(map[newRole] || "/");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, role]);

  // Se empresa inativar/remover vínculo do usuário, forçar refetch/logout
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`empresa-vinculo-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "empresa_usuarios", filter: `user_id=eq.${user.id}` }, async (payload: any) => {
        const isInactive = payload.eventType === "UPDATE" && payload.new?.ativo === false;
        const isDelete = payload.eventType === "DELETE";
        if (isInactive || isDelete) {
          await fetchProfile(user.id);
          setTimeout(() => window.location.replace("/login"), 500);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, metadata: Record<string, string>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setEmpresaPapel(null);
    setEmpresaUserId(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, empresaPapel, empresaUserId, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
