import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PageHeader, DataCard, EmptyState, LoadingState,
} from "@/components/dashboard/DashboardComponents";
import { Users, Search, Mail, Phone } from "lucide-react";

type UserRole = "admin" | "consultor" | "empresa" | "canal";

interface ProfileRow {
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  avatar_url: string | null;
  created_at: string;
  status: string | null;
}

interface UsuarioLinha extends ProfileRow {
  role: UserRole | null;
  sub_papel: string; // ex: "RMO", "Coordenador", "Empresa (principal)", "Canal (principal)", "Consultor do canal X"
  vinculo: string; // ex: nome da empresa/canal ao qual está ligado
}

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  consultor: "Consultor",
  empresa: "Empresa",
  canal: "Canal",
};

const roleBadge: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  consultor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  empresa: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  canal: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
};

const AdminTodosUsuarios = () => {
  const [rows, setRows] = useState<UsuarioLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [subFilter, setSubFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, empUsrRes, empPerfilRes, canaisRes, canalConsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, nome, email, telefone, avatar_url, created_at, status").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("empresa_usuarios").select("user_id, papel, empresa_user_id"),
      supabase.from("empresa_perfil").select("user_id, razao_social, nome_fantasia"),
      supabase.from("canais").select("user_id, nome"),
      supabase.from("canal_consultores").select("consultor_user_id, canal_id, status"),
    ]);

    const profiles = (profilesRes.data || []) as ProfileRow[];
    const roles = (rolesRes.data || []) as { user_id: string; role: UserRole }[];
    const empUsr = (empUsrRes.data || []) as { user_id: string; papel: string; empresa_user_id: string }[];
    const empPerfil = (empPerfilRes.data || []) as { user_id: string; razao_social: string | null; nome_fantasia: string | null }[];
    const canais = (canaisRes.data || []) as { user_id: string; nome: string }[];
    const canalCons = (canalConsRes.data || []) as { consultor_user_id: string; canal_id: string; status: string }[];

    const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));
    const empUsrMap = new Map(empUsr.map((e) => [e.user_id, e]));
    const empPerfilById = new Map<string, { nome: string; user_id: string }>();
    const empPerfilByUser = new Map<string, { nome: string; user_id: string }>();
    for (const e of empPerfil) {
      const nome = e.nome_fantasia || e.razao_social || "Empresa";
      empPerfilByUser.set(e.user_id, { nome, user_id: e.user_id });
    }
    // empresa_usuarios.empresa_user_id references empresa's profile user_id (owner)
    const canalByUser = new Map(canais.map((c) => [c.user_id, c.nome]));
    // Look up canal name by canal_id: need canais.id -> nome; but we only have user_id. Fetch canais id too:
    // We'll do a light second query below to map canal_id -> nome.
    const canalIdSet = new Set(canalCons.map((c) => c.canal_id));
    let canalIdToNome = new Map<string, string>();
    if (canalIdSet.size > 0) {
      const { data: canaisFull } = await supabase.from("canais").select("id, nome").in("id", Array.from(canalIdSet));
      canalIdToNome = new Map(((canaisFull as any[]) || []).map((c) => [c.id, c.nome]));
    }
    const consultorCanal = new Map<string, string>(); // user_id -> canal nome (ativo)
    for (const cc of canalCons) {
      if (cc.status === "ativo" || cc.status === "aceito") {
        consultorCanal.set(cc.consultor_user_id, canalIdToNome.get(cc.canal_id) || "Canal");
      }
    }

    const result: UsuarioLinha[] = profiles.map((p) => {
      const role = roleMap.get(p.user_id) || null;
      let sub_papel = "";
      let vinculo = "";

      if (role === "admin") {
        sub_papel = "Administrador central";
      } else if (role === "empresa") {
        // pode ser dono da empresa OU sub-usuário (coordenador/RMO/etc)
        const sub = empUsrMap.get(p.user_id);
        if (sub) {
          const papelLabelMap: Record<string, string> = {
            coordenador: "Coordenador",
            rmo: "RMO",
            responsavel: "Responsável",
            financeiro: "Financeiro",
            operacional: "Operacional",
          };
          sub_papel = papelLabelMap[sub.papel] || sub.papel;
          const empOwner = empPerfilByUser.get(sub.empresa_user_id);
          vinculo = empOwner?.nome || "";
        } else if (empPerfilByUser.has(p.user_id)) {
          sub_papel = "Empresa (titular)";
          vinculo = empPerfilByUser.get(p.user_id)!.nome;
        } else {
          sub_papel = "Empresa";
        }
      } else if (role === "canal") {
        sub_papel = "Canal (titular)";
        vinculo = canalByUser.get(p.user_id) || "";
      } else if (role === "consultor") {
        const canalNome = consultorCanal.get(p.user_id);
        if (canalNome) {
          sub_papel = "Consultor de canal";
          vinculo = canalNome;
        } else {
          sub_papel = "Consultor autônomo";
        }
      }

      return { ...p, role, sub_papel, vinculo };
    });

    setRows(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const subOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.sub_papel && s.add(r.sub_papel));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (subFilter !== "all" && r.sub_papel !== subFilter) return false;
      if (!q) return true;
      return (
        r.nome?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.vinculo?.toLowerCase().includes(q)
      );
    });
  }, [rows, search, roleFilter, subFilter]);

  const counts = useMemo(() => {
    const c = { total: rows.length, admin: 0, consultor: 0, empresa: 0, canal: 0 };
    rows.forEach((r) => { if (r.role) (c as any)[r.role]++; });
    return c;
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Visão geral de todas as pessoas com acesso à plataforma e seus vínculos."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Total", value: counts.total, cls: "bg-muted text-foreground" },
          { label: "Administradores", value: counts.admin, cls: roleBadge.admin },
          { label: "Consultores", value: counts.consultor, cls: roleBadge.consultor },
          { label: "Empresas", value: counts.empresa, cls: roleBadge.empresa },
          { label: "Canais", value: counts.canal, cls: roleBadge.canal },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-display font-bold mt-1">{k.value}</p>
            <span className={`inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${k.cls}`}>{k.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou vínculo..." className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="md:w-52"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="consultor">Consultores</SelectItem>
            <SelectItem value="empresa">Empresas</SelectItem>
            <SelectItem value="canal">Canais</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subFilter} onValueChange={setSubFilter}>
          <SelectTrigger className="md:w-56"><SelectValue placeholder="Sub-papel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os sub-papéis</SelectItem>
            {subOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataCard noPadding>
        {loading ? (
          <div className="p-6"><LoadingState /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message="Nenhum usuário encontrado." icon={Users} />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((u) => {
              const initials = (u.nome || u.email || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={u.user_id} className="flex items-center gap-4 p-4">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-display font-bold text-sm shadow shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.nome} className="w-full h-full object-cover" />
                    ) : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{u.nome || "—"}</p>
                      {u.role && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${roleBadge[u.role]}`}>
                          {roleLabel[u.role]}
                        </span>
                      )}
                      {u.sub_papel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
                          {u.sub_papel}
                        </span>
                      )}
                      {u.status && u.status !== "ativo" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-destructive/10 text-destructive uppercase">{u.status}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Mail size={12} />{u.email}</span>
                      {u.telefone && <span className="flex items-center gap-1"><Phone size={12} />{u.telefone}</span>}
                      {u.vinculo && <span className="italic">Vínculo: {u.vinculo}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:block">
                    Desde {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default AdminTodosUsuarios;
