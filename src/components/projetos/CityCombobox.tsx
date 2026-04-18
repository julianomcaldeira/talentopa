import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface CityOption {
  cidade: string;
  estado: string; // UF
}

interface CityComboboxProps {
  value: CityOption | null;
  onChange: (v: CityOption | null) => void;
  placeholder?: string;
  count?: number;
}

interface IBGEMunicipio {
  nome: string;
  microrregiao: { mesorregiao: { UF: { sigla: string } } };
}

let cachedCities: CityOption[] | null = null;

export const CityCombobox = ({ value, onChange, placeholder = "Filtrar por cidade..." }: CityComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<CityOption[]>(cachedCities || []);
  const [loading, setLoading] = useState(!cachedCities);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (cachedCities) return;
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
      .then((r) => r.json())
      .then((data: IBGEMunicipio[]) => {
        const list: CityOption[] = data.map((m) => ({
          cidade: m.nome,
          estado: m.microrregiao?.mesorregiao?.UF?.sigla || "",
        })).filter(c => c.estado);
        cachedCities = list;
        setCities(list);
      })
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
  }, []);

  const normalized = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = query.length < 2
    ? []
    : cities.filter(c => normalized(c.cidade).includes(normalized(query))).slice(0, 50);

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between min-w-[220px]">
            <span className="flex items-center gap-2 truncate">
              <MapPin size={14} className="text-primary" />
              {value ? <span className="truncate">{value.cidade} / {value.estado}</span> : <span className="text-muted-foreground">{placeholder}</span>}
            </span>
            <ChevronsUpDown size={14} className="opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[320px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={loading ? "Carregando municípios..." : "Digite o nome da cidade..."} value={query} onValueChange={setQuery} />
            <CommandList>
              {query.length < 2 ? (
                <CommandEmpty>Digite ao menos 2 letras</CommandEmpty>
              ) : filtered.length === 0 ? (
                <CommandEmpty>Nenhuma cidade encontrada</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filtered.map((c) => {
                    const key = `${c.cidade}-${c.estado}`;
                    const selected = value?.cidade === c.cidade && value?.estado === c.estado;
                    return (
                      <CommandItem key={key} value={key} onSelect={() => { onChange(c); setOpen(false); setQuery(""); }}>
                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                        {c.cidade} <span className="ml-1 text-xs text-muted-foreground">/ {c.estado}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => onChange(null)} title="Limpar cidade">
          <X size={14} />
        </Button>
      )}
    </div>
  );
};
