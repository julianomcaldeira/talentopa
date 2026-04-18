import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConsultorPrivateChat } from "@/components/communication/ConsultorPrivateChat";
import {
  MapPin, Award, Star, Trophy, Linkedin, Briefcase,
  CheckCircle2, MessageSquare, BookOpen, BarChart3, Lock
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultor: {
    user_id: string;
    nome: string;
    cidade: string | null;
    estado: string | null;
    avatar_url: string | null;
    bio_profissional: string | null;
    linkedin: string | null;
    score: number;
  } | null;
  projetoId: string;
  projetoNome: string;
}

interface Habilidade {
  id: string;
  nivel: string;
  valor_hora: number | null;
  software: { nome: string } | null;
  modulo: { nome: string } | null;
  funcionalidade: { nome: string } | null;
}

interface PortfolioCase {
  id: string;
  titulo: string;
  descricao: string | null;
  software_nome: string | null;
  modulos_implementados: string[] | null;
  horas_trabalhadas: number | null;
  nota_recebida: number | null;
  depoimento_empresa: string | null;
}

interface PerfStats {
  notaMedia: number;
  totalAvaliacoes: number;
  projetosConcluidos: number;
  recomendacaoPct: number;
}

const nivelLabel: Record<string, string> = {
  junior: "Júnior", pleno: "Pleno", senior: "Sênior", especialista: "Especialista",
};

const nivelColor: Record<string, string> = {
  junior: "bg-muted text-foreground",
  pleno: "bg-info/10 text-info",
  senior: "bg-primary/10 text-primary",
  especialista: "bg-success/10 text-success",
};

export const ConsultorDetailDialog = ({ open, onOpenChange, consultor, projetoId, projetoNome }: Props) => {
  const [habilidades, setHabilidades] = useState<Habilidade[]>([]);
  const [cases, setCases] = useState<PortfolioCase[]>([]);
  const [stats, setStats] = useState<PerfStats>({ notaMedia: 0, totalAvaliacoes: 0, projetosConcluidos: 0, recomendacaoPct: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !consultor) return;
    const fetchAll = async () => {
      setLoading(true);
      const userId = consultor.user_id;
      const [habRes, casesRes, avalRes, propRes] = await Promise.all([
        supabase
          .from("consultor_habilidades")
          .select("id, nivel, valor_hora, software_id, modulo_id, funcionalidade_id")
          .eq("user_id", userId),
        supabase
          .from("portfolio_cases")
          .select("id, titulo, descricao, software_nome, modulos_implementados, horas_trabalhadas, nota_recebida, depoimento_empresa")
          .eq("consultor_user_id", userId)
          .eq("publicado", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("avaliacoes")
          .select("nota, recomendacao")
          .eq("avaliado_user_id", userId),
        supabase
          .from("propostas")
          .select("id, projeto_id, status, projetos!inner(status)")
          .eq("consultor_user_id", userId)
          .eq("status", "aceita"),
      ]);

      const habs = habRes.data || [];
      // Lookup names for software/modulo/funcionalidade
      const swIds = [...new Set(habs.map((h: any) => h.software_id).filter(Boolean))];
      const mdIds = [...new Set(habs.map((h: any) => h.modulo_id).filter(Boolean))];
      const fnIds = [...new Set(habs.map((h: any) => h.funcionalidade_id).filter(Boolean))];
      const [swRes, mdRes, fnRes] = await Promise.all([
        swIds.length ? supabase.from("softwares").select("id, nome").in("id", swIds) : Promise.resolve({ data: [] as any[] }),
        mdIds.length ? supabase.from("modulos").select("id, nome").in("id", mdIds) : Promise.resolve({ data: [] as any[] }),
        fnIds.length ? supabase.from("funcionalidades").select("id, nome").in("id", fnIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const swMap = new Map((swRes.data || []).map((x: any) => [x.id, x]));
      const mdMap = new Map((mdRes.data || []).map((x: any) => [x.id, x]));
      const fnMap = new Map((fnRes.data || []).map((x: any) => [x.id, x]));
      setHabilidades(habs.map((h: any) => ({
        id: h.id,
        nivel: h.nivel,
        valor_hora: h.valor_hora,
        software: h.software_id ? (swMap.get(h.software_id) as any) : null,
        modulo: h.modulo_id ? (mdMap.get(h.modulo_id) as any) : null,
        funcionalidade: h.funcionalidade_id ? (fnMap.get(h.funcionalidade_id) as any) : null,
      })));

      setCases((casesRes.data as any) || []);

      const av = avalRes.data || [];
      const notas = av.map((x: any) => Number(x.nota || 0)).filter(n => n > 0);
      const recs = av.filter((x: any) => x.recomendacao === true).length;
      const concluidos = (propRes.data || []).filter((x: any) => x.projetos?.status === "concluido").length;
      setStats({
        notaMedia: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : 0,
        totalAvaliacoes: av.length,
        projetosConcluidos: concluidos,
        recomendacaoPct: av.length ? Math.round((recs / av.length) * 100) : 0,
      });

      setLoading(false);
    };
    fetchAll();
  }, [open, consultor?.user_id]);

  if (!consultor) return null;

  // Group habilidades by software
  const habsBySoftware = new Map<string, Habilidade[]>();
  habilidades.forEach(h => {
    const sw = h.software?.nome || "Outros";
    const arr = habsBySoftware.get(sw) || [];
    arr.push(h);
    habsBySoftware.set(sw, arr);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground font-display font-bold text-lg shrink-0 overflow-hidden">
              {consultor.avatar_url ? (
                <img src={consultor.avatar_url} alt={consultor.nome} className="w-full h-full object-cover" />
              ) : consultor.nome.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-display text-lg flex items-center gap-3">
                {consultor.nome}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 text-success text-xs font-bold">
                  <Star size={11} /> {consultor.score}% match
                </span>
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                {consultor.cidade && (
                  <span className="flex items-center gap-1"><MapPin size={11} /> {consultor.cidade}{consultor.estado && `, ${consultor.estado}`}</span>
                )}
                {consultor.linkedin && (
                  <a
                    href={consultor.linkedin.startsWith("http") ? consultor.linkedin : `https://${consultor.linkedin}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Linkedin size={11} /> LinkedIn
                  </a>
                )}
                <a
                  href={`/consultor/portfolio/${consultor.user_id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Trophy size={11} /> Portfólio público
                </a>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="resumo" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-4 h-9">
            <TabsTrigger value="resumo" className="text-xs"><BarChart3 size={13} className="mr-1.5" />Resumo</TabsTrigger>
            <TabsTrigger value="habilidades" className="text-xs"><Briefcase size={13} className="mr-1.5" />Habilidades</TabsTrigger>
            <TabsTrigger value="portfolio" className="text-xs"><BookOpen size={13} className="mr-1.5" />Portfólio</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs"><MessageSquare size={13} className="mr-1.5" />Conversar</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            <TabsContent value="resumo" className="mt-0 space-y-4">
              {consultor.bio_profissional ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Bio profissional</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{consultor.bio_profissional}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Bio não preenchida pelo consultor.</p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox icon={Star} label="Nota média" value={stats.notaMedia > 0 ? stats.notaMedia.toFixed(1) : "—"} hint={`${stats.totalAvaliacoes} avaliação(ões)`} color="text-warning" bg="bg-warning/10" />
                <StatBox icon={CheckCircle2} label="Projetos concluídos" value={stats.projetosConcluidos.toString()} color="text-success" bg="bg-success/10" />
                <StatBox icon={Trophy} label="Recomendação" value={stats.totalAvaliacoes ? `${stats.recomendacaoPct}%` : "—"} hint="empresas que recomendam" color="text-primary" bg="bg-primary/10" />
                <StatBox icon={Briefcase} label="Cases publicados" value={cases.length.toString()} color="text-info" bg="bg-info/10" />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-start gap-2.5">
                <Lock size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Por segurança da plataforma, contatos diretos (telefone/e-mail) ficam ocultos. Use a aba <strong>Conversar</strong> para iniciar uma conversa privada e moderada com o consultor.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="habilidades" className="mt-0 space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : habilidades.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Consultor ainda não cadastrou habilidades.</p>
              ) : (
                Array.from(habsBySoftware.entries()).map(([sw, hs]) => {
                  const valoresHora = hs.map(h => h.valor_hora).filter((v): v is number => v != null && v > 0);
                  const minVH = valoresHora.length ? Math.min(...valoresHora) : null;
                  const maxVH = valoresHora.length ? Math.max(...valoresHora) : null;
                  return (
                    <div key={sw} className="rounded-xl border border-border/60 bg-card p-4">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/50">
                        <h4 className="font-display font-semibold text-sm text-foreground">{sw}</h4>
                        {minVH != null && (
                          <span className="text-[11px] text-muted-foreground">
                            R$ {minVH.toFixed(0)}{maxVH !== minVH ? `–${maxVH!.toFixed(0)}` : ""}/h
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {hs.map(h => (
                          <Badge key={h.id} variant="outline" className={`text-[10px] gap-1 ${nivelColor[h.nivel] || ""}`}>
                            <Award size={10} />
                            {h.funcionalidade?.nome || h.modulo?.nome || sw}
                            <span className="opacity-70">· {nivelLabel[h.nivel] || h.nivel}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="portfolio" className="mt-0 space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : cases.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Consultor ainda não tem cases publicados.</p>
              ) : (
                cases.map(c => (
                  <div key={c.id} className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-display font-semibold text-sm text-foreground">{c.titulo}</h4>
                      {c.nota_recebida != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/10 text-warning text-xs font-semibold shrink-0">
                          <Star size={11} /> {Number(c.nota_recebida).toFixed(1)}
                        </span>
                      )}
                    </div>
                    {c.descricao && <p className="text-xs text-muted-foreground leading-relaxed mb-2 whitespace-pre-wrap">{c.descricao}</p>}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {c.software_nome && (
                        <Badge variant="secondary" className="text-[10px]">{c.software_nome}</Badge>
                      )}
                      {(c.modulos_implementados || []).map((m, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                      {c.horas_trabalhadas != null && c.horas_trabalhadas > 0 && (
                        <Badge variant="outline" className="text-[10px]">{c.horas_trabalhadas}h</Badge>
                      )}
                    </div>
                    {c.depoimento_empresa && (
                      <div className="mt-2 rounded-lg bg-muted/40 p-2.5 border-l-2 border-primary/40">
                        <p className="text-xs text-foreground italic">"{c.depoimento_empresa}"</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="chat" className="mt-0">
              <ConsultorPrivateChat
                projetoId={projetoId}
                projetoNome={projetoNome}
                consultorUserId={consultor.user_id}
                consultorNome={consultor.nome}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const StatBox = ({ icon: Icon, label, value, hint, color, bg }: any) => (
  <div className="rounded-xl border border-border/60 bg-card p-3">
    <div className={`icon-container icon-container-sm ${bg} mb-2`}>
      <Icon size={14} className={color} />
    </div>
    <p className="text-lg font-display font-bold text-foreground leading-none">{value}</p>
    <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
  </div>
);
