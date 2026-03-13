import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Only admins can create users");

    const { email, password, nome, tipo_usuario, extra } = await req.json();

    if (!email || !password || !nome || !tipo_usuario) {
      throw new Error("Missing required fields: email, password, nome, tipo_usuario");
    }

    // Create auth user with auto-confirm
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, tipo_usuario },
    });

    if (createError) throw createError;

    // The trigger handle_new_user will create profile and role automatically.
    // If extra data provided for empresa, update empresa_perfil
    if (tipo_usuario === "empresa" && extra) {
      const { cnpj, nome_fantasia, segmento, endereco, numero_funcionarios } = extra;
      await adminClient
        .from("empresa_perfil")
        .update({
          cnpj: cnpj || null,
          nome_fantasia: nome_fantasia || null,
          segmento: segmento || null,
          endereco: endereco || null,
          numero_funcionarios: numero_funcionarios || null,
        })
        .eq("user_id", newUser.user!.id);
    }

    // If extra data for consultor
    if (tipo_usuario === "consultor" && extra) {
      const { telefone, cidade, estado } = extra;
      if (telefone || cidade || estado) {
        await adminClient
          .from("profiles")
          .update({
            telefone: telefone || null,
            cidade: cidade || null,
            estado: estado || null,
          })
          .eq("user_id", newUser.user!.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user!.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
