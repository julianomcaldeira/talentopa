// Project Health Score & Risk Detection Engine

export interface FaseData {
  id: string;
  nome: string;
  status: string;
  prazo: string | null;
  ordem: number;
  horas_estimadas?: number;
  horas_executadas?: number;
  valor?: number;
}

export interface ProjetoHealth {
  score: number; // 0–100
  label: string;
  color: string;
  risks: RiskItem[];
  metrics: {
    progressPercent: number;
    hoursRatio: number; // executed/planned
    onTimePercent: number;
    overdueCount: number;
    totalFases: number;
    completedFases: number;
  };
}

export interface RiskItem {
  tipo: string;
  severidade: "alta" | "media" | "baixa";
  titulo: string;
  descricao: string;
  recomendacao: string;
}

export function calculateHealthScore(
  fases: FaseData[],
  prazoEstimado: string | null,
  status: string
): ProjetoHealth {
  if (fases.length === 0 || ["rascunho", "cancelado"].includes(status)) {
    return {
      score: status === "concluido" ? 100 : 50,
      label: status === "concluido" ? "Concluído" : "Sem dados",
      color: status === "concluido" ? "text-success" : "text-muted-foreground",
      risks: [],
      metrics: { progressPercent: 0, hoursRatio: 0, onTimePercent: 100, overdueCount: 0, totalFases: 0, completedFases: 0 },
    };
  }

  const now = new Date();
  const totalFases = fases.length;
  const completedFases = fases.filter(f => f.status === "aprovada").length;
  const inProgressFases = fases.filter(f => f.status === "em_andamento").length;

  // 1. Progress score (40% weight)
  const progressPercent = totalFases > 0 ? (completedFases / totalFases) * 100 : 0;
  const progressScore = progressPercent;

  // 2. Hours ratio score (25% weight)
  const totalHorasEstimadas = fases.reduce((s, f) => s + (f.horas_estimadas || 0), 0);
  const totalHorasExecutadas = fases.reduce((s, f) => s + (f.horas_executadas || 0), 0);
  let hoursRatio = totalHorasEstimadas > 0 ? totalHorasExecutadas / totalHorasEstimadas : 0;
  
  // For completed phases, ideal ratio = 1.0; for in-progress, compare proportionally
  let hoursScore = 100;
  if (totalHorasEstimadas > 0) {
    const expectedRatio = completedFases / Math.max(totalFases, 1);
    if (hoursRatio > expectedRatio * 1.3) {
      // Consuming too many hours vs progress
      hoursScore = Math.max(0, 100 - (hoursRatio - expectedRatio) * 150);
    } else {
      hoursScore = 100;
    }
  }

  // 3. Deadline compliance score (25% weight)
  const overdueFases = fases.filter(f => {
    if (f.status === "aprovada") return false;
    if (!f.prazo) return false;
    return new Date(f.prazo) < now;
  });
  const overdueCount = overdueFases.length;
  const activeFases = fases.filter(f => f.status !== "aprovada").length;
  const onTimePercent = activeFases > 0 ? ((activeFases - overdueCount) / activeFases) * 100 : 100;
  const deadlineScore = onTimePercent;

  // 4. Overall deadline risk (10% weight)
  let overallDeadlineScore = 100;
  if (prazoEstimado) {
    const deadline = new Date(prazoEstimado);
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const remainingFases = totalFases - completedFases;
    if (daysRemaining < 0 && remainingFases > 0) {
      overallDeadlineScore = Math.max(0, 30 - Math.abs(daysRemaining));
    } else if (daysRemaining < 7 && remainingFases > 1) {
      overallDeadlineScore = 60;
    }
  }

  // Weighted score
  const score = Math.round(
    progressScore * 0.4 +
    hoursScore * 0.25 +
    deadlineScore * 0.25 +
    overallDeadlineScore * 0.1
  );

  // Detect risks
  const risks: RiskItem[] = [];

  if (overdueCount > 0) {
    risks.push({
      tipo: "prazo",
      severidade: overdueCount >= 3 ? "alta" : overdueCount >= 2 ? "media" : "baixa",
      titulo: `${overdueCount} fase${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}`,
      descricao: `As fases ${overdueFases.map(f => f.nome).join(", ")} estão com prazo vencido.`,
      recomendacao: "Revise os prazos e redistribua as atividades. Considere alocar mais recursos.",
    });
  }

  if (totalHorasEstimadas > 0 && hoursRatio > 0.8 && progressPercent < 70) {
    risks.push({
      tipo: "horas",
      severidade: hoursRatio > 1.2 ? "alta" : "media",
      titulo: "Consumo excessivo de horas",
      descricao: `${Math.round(hoursRatio * 100)}% das horas planejadas já foram consumidas, mas apenas ${Math.round(progressPercent)}% do projeto foi concluído.`,
      recomendacao: "Reavalie a estimativa de horas ou investigue gargalos nas fases em andamento.",
    });
  }

  if (prazoEstimado) {
    const deadline = new Date(prazoEstimado);
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0 && completedFases < totalFases) {
      risks.push({
        tipo: "prazo_final",
        severidade: "alta",
        titulo: "Prazo final comprometido",
        descricao: `O prazo final do projeto venceu há ${Math.abs(daysRemaining)} dias e ainda restam ${totalFases - completedFases} fases.`,
        recomendacao: "Negocie uma extensão de prazo com o cliente ou priorize as fases críticas.",
      });
    } else if (daysRemaining > 0 && daysRemaining < 14 && completedFases < totalFases * 0.7) {
      risks.push({
        tipo: "prazo_final",
        severidade: "media",
        titulo: "Prazo final em risco",
        descricao: `Restam ${daysRemaining} dias para o prazo final e apenas ${Math.round(progressPercent)}% do projeto está concluído.`,
        recomendacao: "Aumente o ritmo de entrega ou renegocie o escopo do projeto.",
      });
    }
  }

  const label = score >= 80 ? "Saudável" : score >= 60 ? "Atenção" : score >= 40 ? "Em risco" : "Crítico";
  const color = score >= 80 ? "text-success" : score >= 60 ? "text-warning" : score >= 40 ? "text-orange-500" : "text-destructive";

  return {
    score,
    label,
    color,
    risks,
    metrics: {
      progressPercent,
      hoursRatio,
      onTimePercent,
      overdueCount,
      totalFases,
      completedFases,
    },
  };
}

// Suggest a cronograma based on estimated hours and number of phases
export interface CronogramaSuggestion {
  fase: string;
  inicio: Date;
  fim: Date;
  duracao_dias: number;
  horas_sugeridas: number;
}

export function suggestCronograma(
  fases: { nome: string; horas_estimadas?: number; ordem: number }[],
  startDate: Date = new Date(),
  hoursPerDay: number = 6
): CronogramaSuggestion[] {
  if (fases.length === 0) return [];

  const sorted = [...fases].sort((a, b) => a.ordem - b.ordem);
  const totalHoras = sorted.reduce((s, f) => s + (f.horas_estimadas || 40), 0);
  
  let currentDate = new Date(startDate);
  
  return sorted.map((fase) => {
    const horas = fase.horas_estimadas || Math.round(totalHoras / fases.length);
    const duracaoDias = Math.max(1, Math.ceil(horas / hoursPerDay));
    const inicio = new Date(currentDate);
    
    // Skip weekends
    let diasUteis = 0;
    const fim = new Date(currentDate);
    while (diasUteis < duracaoDias) {
      fim.setDate(fim.getDate() + 1);
      if (fim.getDay() !== 0 && fim.getDay() !== 6) {
        diasUteis++;
      }
    }
    
    currentDate = new Date(fim);
    currentDate.setDate(currentDate.getDate() + 1);
    
    return {
      fase: fase.nome,
      inicio,
      fim,
      duracao_dias: duracaoDias,
      horas_sugeridas: horas,
    };
  });
}

// Get score color for tailwind classes
export function getScoreColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 80) return { bg: "bg-success/10", text: "text-success", ring: "ring-success/30" };
  if (score >= 60) return { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/30" };
  if (score >= 40) return { bg: "bg-orange-500/10", text: "text-orange-500", ring: "ring-orange-500/30" };
  return { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/30" };
}
