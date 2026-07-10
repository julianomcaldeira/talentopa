export type ProjetoSortKey =
  | "recent"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "prazo_asc"
  | "prazo_desc"
  | "value_desc"
  | "value_asc"
  | "status";

export const PROJETO_SORT_OPTIONS: { value: ProjetoSortKey; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name_asc", label: "Nome (A-Z)" },
  { value: "name_desc", label: "Nome (Z-A)" },
  { value: "prazo_asc", label: "Prazo (mais próximo)" },
  { value: "prazo_desc", label: "Prazo (mais distante)" },
  { value: "value_desc", label: "Maior valor" },
  { value: "value_asc", label: "Menor valor" },
  { value: "status", label: "Status" },
];

const getPrazo = (p: any) =>
  p?.prazo_propostas || p?.prazo_estimado || p?.prazo || null;

const getValor = (p: any): number => {
  if (typeof p?.valor_total === "number") return p.valor_total;
  if (typeof p?.valor === "number") return p.valor;
  if (typeof p?.orcamento === "number") return p.orcamento;
  if (Array.isArray(p?.projeto_fases)) {
    return p.projeto_fases.reduce((s: number, f: any) => s + (Number(f.valor) || 0), 0);
  }
  return 0;
};

export function sortProjetos<T extends Record<string, any>>(list: T[], key: ProjetoSortKey): T[] {
  const arr = [...list];
  const nameOf = (p: any) => (p?.nome || "").toString().toLowerCase();
  const dateOf = (p: any) => (p?.created_at ? new Date(p.created_at).getTime() : 0);
  const prazoOf = (p: any) => {
    const d = getPrazo(p);
    return d ? new Date(d).getTime() : null;
  };

  switch (key) {
    case "recent":
      return arr.sort((a, b) => dateOf(b) - dateOf(a));
    case "oldest":
      return arr.sort((a, b) => dateOf(a) - dateOf(b));
    case "name_asc":
      return arr.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "pt-BR"));
    case "name_desc":
      return arr.sort((a, b) => nameOf(b).localeCompare(nameOf(a), "pt-BR"));
    case "prazo_asc":
      return arr.sort((a, b) => {
        const pa = prazoOf(a), pb = prazoOf(b);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
    case "prazo_desc":
      return arr.sort((a, b) => {
        const pa = prazoOf(a), pb = prazoOf(b);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pb - pa;
      });
    case "value_desc":
      return arr.sort((a, b) => getValor(b) - getValor(a));
    case "value_asc":
      return arr.sort((a, b) => getValor(a) - getValor(b));
    case "status":
      return arr.sort((a, b) => (a?.status || "").localeCompare(b?.status || ""));
    default:
      return arr;
  }
}
