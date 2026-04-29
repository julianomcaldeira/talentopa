import { ArrowRight, Building2, CheckCircle2, Crown, FolderKanban, Shield, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const states = [
  { label: "Criado", status: "publicado", description: "Projeto publicado pela empresa e disponível para candidaturas ou convites." },
  { label: "Pré-aprovado", status: "pre_aprovada", description: "Consultor/proposta escolhido para alinhamento; comunicação liberada antes da decisão final." },
  { label: "Aprovado final", status: "aguardando_consultor", description: "Empresa confirmou a proposta e aguarda aceite do consultor para iniciar a execução." },
  { label: "Concluído", status: "concluido", description: "Entrega final encerrada, com histórico preservado para avaliação, métricas e portfólio." },
];

const transitions = [
  { from: "Criado", to: "Pré-aprovado", trigger: "Empresa pré-aprova proposta recebida ou consultor indicado por match.", owner: "Empresa" },
  { from: "Pré-aprovado", to: "Aprovado final", trigger: "Empresa aprova formalmente a proposta após alinhamento no chat.", owner: "Empresa" },
  { from: "Aprovado final", to: "Em andamento", trigger: "Consultor aceita o início do projeto.", owner: "Consultor" },
  { from: "Em andamento", to: "Concluído", trigger: "Empresa conclui o projeto após execução, entregas e validações.", owner: "Empresa" },
];

const permissions = [
  {
    state: "Criado",
    empresa: "Publica, edita dados, convida consultores, analisa candidaturas e define prazo de retorno.",
    consultor: "Visualiza projetos abertos, consulta detalhes e envia proposta dentro do prazo.",
    admin: "Audita, acompanha métricas, modera conteúdo e pode consultar todos os projetos.",
  },
  {
    state: "Pré-aprovado",
    empresa: "Libera comunicação, negocia ajustes, mantém edição do projeto e decide aprovação final.",
    consultor: "Acessa comunicação com a empresa e ajusta entendimento antes da aprovação final.",
    admin: "Monitora mensagens, auditoria e conformidade da etapa de seleção.",
  },
  {
    state: "Aprovado final",
    empresa: "Aguarda aceite do consultor e acompanha confirmação para abertura da gestão compartilhada.",
    consultor: "Aceita o projeto para iniciar execução ou acompanha pendência nas propostas.",
    admin: "Acompanha aceite, notificações e geração dos registros financeiros/operacionais.",
  },
  {
    state: "Concluído",
    empresa: "Pode editar dados históricos, avaliar o consultor e consultar entregas, horas e aprendizados.",
    consultor: "Consulta histórico, avaliações e cases gerados para portfólio quando aplicável.",
    admin: "Audita encerramento, métricas, pagamentos, comissões, aprendizado e portfólio automático.",
  },
];

const ProjectStateReference = () => (
  <div>
    <PageHeader
      title="Estados do Projeto"
      description="Fluxo operacional com transições e permissões por perfil"
    />

    <DataCard className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <FolderKanban size={16} className="text-primary" />
        <h3 className="font-display font-semibold text-foreground">Diagrama do ciclo de vida</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {states.map((state, index) => (
          <div key={state.label} className="relative rounded-xl border border-border bg-muted/20 p-4 min-h-[150px]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <Badge variant="outline" className="border-primary/30 text-primary">{state.label}</Badge>
              <span className="text-[10px] font-semibold text-muted-foreground bg-background border border-border rounded-md px-2 py-0.5">
                {state.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{state.description}</p>
            {index < states.length - 1 && (
              <div className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-background text-primary shadow-sm">
                <ArrowRight size={15} />
              </div>
            )}
          </div>
        ))}
      </div>
    </DataCard>

    <DataCard className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 size={16} className="text-primary" />
        <h3 className="font-display font-semibold text-foreground">Transições permitidas</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {transitions.map((item) => (
          <div key={`${item.from}-${item.to}`} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary">{item.from}</Badge>
              <ArrowRight size={13} className="text-muted-foreground" />
              <Badge variant="outline" className="border-primary/30 text-primary">{item.to}</Badge>
            </div>
            <p className="text-xs text-foreground/80 mb-2">{item.trigger}</p>
            <p className="text-[11px] text-muted-foreground">Responsável: <span className="font-semibold text-foreground">{item.owner}</span></p>
          </div>
        ))}
      </div>
    </DataCard>

    <DataCard>
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-primary" />
        <h3 className="font-display font-semibold text-foreground">Permissões por perfil</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Estado</TableHead>
            <TableHead><span className="inline-flex items-center gap-1.5"><Building2 size={13} /> Empresa</span></TableHead>
            <TableHead><span className="inline-flex items-center gap-1.5"><UserCheck size={13} /> Consultor</span></TableHead>
            <TableHead><span className="inline-flex items-center gap-1.5"><Crown size={13} /> Administrador</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permissions.map((row) => (
            <TableRow key={row.state}>
              <TableCell className="font-semibold text-foreground whitespace-nowrap">{row.state}</TableCell>
              <TableCell className="text-xs text-muted-foreground leading-relaxed min-w-[220px]">{row.empresa}</TableCell>
              <TableCell className="text-xs text-muted-foreground leading-relaxed min-w-[220px]">{row.consultor}</TableCell>
              <TableCell className="text-xs text-muted-foreground leading-relaxed min-w-[220px]">{row.admin}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  </div>
);

export default ProjectStateReference;