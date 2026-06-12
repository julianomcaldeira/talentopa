import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UF {
  sigla: string;
  nome: string;
}

let cachedUfs: UF[] | null = null;
let inflight: Promise<UF[]> | null = null;

const loadUfs = (): Promise<UF[]> => {
  if (cachedUfs) return Promise.resolve(cachedUfs);
  if (inflight) return inflight;
  inflight = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
    .then((r) => r.json())
    .then((data: UF[]) => {
      cachedUfs = data.map((u) => ({ sigla: u.sigla, nome: u.nome }));
      return cachedUfs;
    })
    .catch(() => {
      cachedUfs = [];
      return cachedUfs;
    })
    .finally(() => { inflight = null; });
  return inflight;
};

interface EstadoSelectProps {
  value: string;
  onChange: (uf: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const EstadoSelect = ({ value, onChange, id, placeholder = "Selecione o estado", disabled, className }: EstadoSelectProps) => {
  const [ufs, setUfs] = useState<UF[]>(cachedUfs || []);
  const [loading, setLoading] = useState(!cachedUfs);

  useEffect(() => {
    if (cachedUfs) return;
    loadUfs().then((list) => {
      setUfs(list);
      setLoading(false);
    });
  }, []);

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={loading ? "Carregando estados..." : placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {ufs.map((uf) => (
          <SelectItem key={uf.sigla} value={uf.sigla}>
            {uf.sigla} — {uf.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default EstadoSelect;
