import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, target_user_id } = body;
    if (!target_user_id || !action) throw new Error("target_user_id e action são obrigatórios");

    // Verifica permissão via RPC (admin ou criador original)
    const { data: canManage, error: permErr } = await admin.rpc("can_manage_user", {
      _target: target_user_id,
      _actor: caller.id,
    });
    if (permErr) throw permErr;
    if (!canManage) throw new Error("Sem permissão para gerenciar este usuário");

    // Dados do ator para auditoria
    const [{ data: actorProfile }, { data: actorRoleRow }] = await Promise.all([
      admin.from("profiles").select("nome").eq("user_id", caller.id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle(),
    ]);
    const actorNome = (actorProfile as any)?.nome || caller.email || "Usuário";
    const actorRole = (actorRoleRow as any)?.role || "desconhecido";

    let acao = "";
    let descricao = "";
    let dadosNovos: Record<string, unknown> = {};
    let severidade: "info" | "warning" = "info";

    if (action === "reset_password") {
      const { new_password } = body;
      if (!new_password || String(new_password).length < 6) {
        throw new Error("Nova senha deve ter ao menos 6 caracteres");
      }
      const { error } = await admin.auth.admin.updateUserById(target_user_id, { password: new_password });
      if (error) throw error;
      acao = "reset_senha";
      descricao = `Senha redefinida por ${actorNome}`;
      severidade = "warning";
    } else if (action === "set_status") {
      const { status } = body;
      if (!["ativo", "inativo"].includes(status)) throw new Error("Status inválido");
      await admin.from("profiles").update({ status }).eq("user_id", target_user_id);
      const banDuration = status === "inativo" ? "876000h" : "none";
      const { error } = await admin.auth.admin.updateUserById(target_user_id, { ban_duration: banDuration } as any);
      if (error) throw error;
      acao = status === "inativo" ? "desativacao" : "reativacao";
      descricao = `Usuário ${status === "inativo" ? "desativado" : "reativado"} por ${actorNome}`;
      dadosNovos = { status };
      severidade = status === "inativo" ? "warning" : "info";
    } else if (action === "change_email") {
      const { new_email } = body;
      if (!new_email) throw new Error("Novo e-mail é obrigatório");
      const { error } = await admin.auth.admin.updateUserById(target_user_id, {
        email: new_email,
        email_confirm: true,
      });
      if (error) throw error;
      await admin.from("profiles").update({ email: new_email }).eq("user_id", target_user_id);
      acao = "mudanca_email";
      descricao = `E-mail alterado para ${new_email} por ${actorNome}`;
      dadosNovos = { email: new_email };
      severidade = "warning";
    } else if (action === "force_signout") {
      const { error } = await admin.auth.admin.signOut(target_user_id, "global" as any);
      if (error) throw error;
      acao = "logout_forcado";
      descricao = `Sessões encerradas por ${actorNome}`;
    } else {
      throw new Error(`Ação não suportada: ${action}`);
    }

    // Grava auditoria diretamente (service role) — auth.uid() não existe aqui
    await admin.from("audit_logs").insert({
      actor_user_id: caller.id,
      actor_role: actorRole,
      actor_nome: actorNome,
      categoria: "usuario",
      acao,
      entidade: "profiles",
      entidade_id: target_user_id,
      descricao,
      dados_novos: dadosNovos,
      severidade,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
