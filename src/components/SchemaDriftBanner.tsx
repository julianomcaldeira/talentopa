import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "workz.schemaDrift.dismissed";

type Faltante = { onda: string; tipo: string; objeto: string; descricao: string };

type ChecaSchema = {
  ok: boolean;
  manifesto_versao: string;
  total: number;
  faltando: Faltante[];
  checado_em: string;
};

type ChecaSchemaRpc = (
  fn: string
) => Promise<{ data: ChecaSchema | null; error: { code?: string; message?: string } | null }>;

const SchemaDriftBanner = () => {
  const { user, role, empresaUserId } = useAuth();
  const [faltando, setFaltando] = useState<Faltante[] | null>(null);
  const [rpcAusente, setRpcAusente] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [dispensado, setDispensado] = useState(true);

  const elegivel = role === "admin" || (role === "empresa" && !!user?.id && empresaUserId === user.id);

  useEffect(() => {
    if (!elegivel) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.rpc as unknown as ChecaSchemaRpc)("checar_schema");
      if (cancelled) return;
      if (error) {
        const ausente = error.code === "PGRST202" || /could not find the function/i.test(error.message || "");
        setRpcAusente(ausente);
        setFaltando(ausente ? [] : null);
      } else if (data && data.ok === false) {
        setFaltando((data.faltando as Faltante[]) || []);
      } else {
        setFaltando([]);
      }
      setCarregando(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [elegivel]);

  const fingerprint = useMemo(() => {
    if (rpcAusente) return "rpc-ausente";
    if (!faltando || faltando.length === 0) return "";
    return [...faltando].map((f) => f.objeto).sort().join("|");
  }, [faltando, rpcAusente]);

  useEffect(() => {
    if (carregando) return;
    if (!fingerprint) {
      setDispensado(true);
      return;
    }
    setDispensado(localStorage.getItem(DISMISS_KEY) === fingerprint);
  }, [fingerprint, carregando]);

  if (!elegivel || carregando) return null;

  const temProblema = rpcAusente || (faltando?.length ?? 0) > 0;
  if (!temProblema || dispensado) return null;

  const dismiss = () => {
    if (fingerprint) localStorage.setItem(DISMISS_KEY, fingerprint);
    setDispensado(true);
  };

  return (
    <div className="border-b border-amber-300/60 bg-amber-50 text-amber-900">
      <div className="flex items-center gap-2 px-4 md:px-6 py-2 text-[12.5px]">
        <AlertTriangle size={15} className="shrink-0 text-amber-600" />
        <span className="font-medium whitespace-nowrap">Banco desatualizado</span>
        <span className="hidden sm:inline text-amber-800/90 truncate">
          {rpcAusente
            ? "Não foi possível verificar o schema (função de checagem ausente). Aplique as migrations pendentes."
            : `Faltam ${faltando!.length} objeto(s) previsto(s). Rode supabase/checks/verificar_schema.sql no SQL editor.`}
        </span>
        <div className="flex-1" />
        {!rpcAusente && (
          <button
            onClick={() => setAberto((v) => !v)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[12px] text-amber-800 hover:bg-amber-100 transition-colors"
          >
            {aberto ? "Ocultar" : "Detalhes"}
            <ChevronDown size={13} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dispensar aviso"
          className="rounded p-1 text-amber-700/70 hover:bg-amber-100 hover:text-amber-900 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      {aberto && !rpcAusente && (
        <ul className="px-6 pb-2 space-y-0.5 text-[11.5px] font-mono text-amber-900/90 max-h-48 overflow-auto">
          {faltando!.map((f) => (
            <li key={f.tipo + f.objeto}>[{f.onda}] {f.tipo}: {f.objeto}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SchemaDriftBanner;
