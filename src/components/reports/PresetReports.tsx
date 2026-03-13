import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  FileText,
  Star,
  AlertTriangle,
  Users,
  Briefcase,
  XCircle,
  Send,
  Layers,
} from "lucide-react";
import { type ReportFiltersState } from "./ReportFilters";

type UserScope = "admin" | "consultor" | "empresa";

export interface PresetReport {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  table: string;
  columns: string[];
  filters: ReportFiltersState;
  scope: UserScope[];
}

const PRESET_REPORTS: PresetReport[] = [
  {
    id: "projetos-andamento",
    label: "Projetos em Andamento",
    description: "Todos os projetos atualmente em execução",
    icon: <FolderKanban size={20} />,
    table: "projetos",
    columns: ["nome", "protocolo", "status", "prazo_estimado", "objetivo", "created_at"],
    filters: { status: "em_andamento" },
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "projetos-concluidos",
    label: "Projetos Concluídos",
    description: "Histórico de projetos finalizados",
    icon: <CheckCircle2 size={20} />,
    table: "projetos",
    columns: ["nome", "protocolo", "status", "prazo_estimado", "descricao", "created_at", "updated_at"],
    filters: { status: "concluido" },
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "projetos-publicados",
    label: "Projetos Publicados",
    description: "Projetos disponíveis para propostas",
    icon: <Send size={20} />,
    table: "projetos",
    columns: ["nome", "protocolo", "status", "prazo_estimado", "objetivo", "problema_atual", "created_at"],
    filters: { status: "publicado" },
    scope: ["admin", "consultor"],
  },
  {
    id: "propostas-aceitas",
    label: "Propostas Aceitas",
    description: "Propostas aprovadas pelos clientes",
    icon: <CheckCircle2 size={20} />,
    table: "propostas",
    columns: ["status", "valor_proposta", "estimativa_horas", "comentarios", "created_at"],
    filters: { status: "aceita" },
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "propostas-enviadas",
    label: "Propostas Enviadas",
    description: "Propostas aguardando análise",
    icon: <Clock size={20} />,
    table: "propostas",
    columns: ["status", "valor_proposta", "estimativa_horas", "comentarios", "created_at"],
    filters: { status: "enviada" },
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "propostas-recusadas",
    label: "Propostas Recusadas",
    description: "Propostas que não foram aprovadas",
    icon: <XCircle size={20} />,
    table: "propostas",
    columns: ["status", "valor_proposta", "estimativa_horas", "comentarios", "created_at", "updated_at"],
    filters: { status: "recusada" },
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "avaliacoes-recebidas",
    label: "Avaliações Recebidas",
    description: "Notas e comentários recebidos nos projetos",
    icon: <Star size={20} />,
    table: "avaliacoes",
    columns: ["nota", "comentario", "recomendacao", "created_at"],
    filters: {},
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "fases-pendentes",
    label: "Fases Pendentes",
    description: "Fases de projeto que ainda não iniciaram",
    icon: <Layers size={20} />,
    table: "projeto_fases",
    columns: ["nome", "descricao", "status", "prazo", "horas_estimadas", "valor"],
    filters: { status: "pendente" },
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "fases-em-andamento",
    label: "Fases em Andamento",
    description: "Fases atualmente em execução",
    icon: <Clock size={20} />,
    table: "projeto_fases",
    columns: ["nome", "descricao", "status", "prazo", "horas_estimadas", "horas_executadas", "valor"],
    filters: { status: "em_andamento" },
    scope: ["admin", "consultor", "empresa"],
  },
  {
    id: "alertas-abertos",
    label: "Alertas Abertos",
    description: "Alertas não resolvidos nos projetos",
    icon: <AlertTriangle size={20} />,
    table: "projeto_alertas",
    columns: ["titulo", "descricao", "tipo", "severidade", "resolvido", "created_at"],
    filters: {},
    scope: ["admin", "empresa"],
  },
  {
    id: "portfolio-publicado",
    label: "Portfólio Publicado",
    description: "Cases de sucesso publicados",
    icon: <Briefcase size={20} />,
    table: "portfolio_cases",
    columns: ["titulo", "descricao", "software_nome", "modulos_implementados", "horas_trabalhadas", "nota_recebida", "publicado"],
    filters: {},
    scope: ["admin", "consultor"],
  },
  {
    id: "perfis-usuarios",
    label: "Perfis de Usuários",
    description: "Lista completa de perfis cadastrados",
    icon: <Users size={20} />,
    table: "profiles",
    columns: ["nome", "email", "telefone", "cidade", "estado", "status", "created_at"],
    filters: {},
    scope: ["admin"],
  },
  {
    id: "habilidades-consultores",
    label: "Habilidades dos Consultores",
    description: "Habilidades técnicas e valores/hora",
    icon: <FileText size={20} />,
    table: "consultor_habilidades",
    columns: ["nivel", "valor_hora", "created_at"],
    filters: {},
    scope: ["admin", "consultor"],
  },
];

interface PresetReportsProps {
  userScope: UserScope;
  onSelectPreset: (preset: PresetReport) => void;
}

export const PresetReports = ({ userScope, onSelectPreset }: PresetReportsProps) => {
  const available = PRESET_REPORTS.filter((r) => r.scope.includes(userScope));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Relatórios Rápidos</h3>
        <p className="text-xs text-muted-foreground">Clique para gerar automaticamente</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {available.map((preset, i) => (
          <motion.div
            key={preset.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card
              className="border-border/50 bg-card/80 backdrop-blur-sm cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
              onClick={() => onSelectPreset(preset)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
                  {preset.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{preset.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{preset.description}</p>
                  <Badge variant="outline" className="text-[10px] mt-2 capitalize">
                    {preset.table.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
