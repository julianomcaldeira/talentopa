import { motion } from "framer-motion";
import { Section } from "@/components/ui/section";
import { FileText, Users, Handshake, FileCheck2, ArrowRight, Building2, Briefcase, Network, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: FileText,
    number: "01",
    phase: "Fase 1",
    title: "Cadastro e publicação",
    description: "Empresa lança a demanda, indica o Coordenador técnico. RMO publica na plataforma e notifica os consultores compatíveis.",
    actors: ["Empresa", "RMO"],
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Users,
    number: "02",
    phase: "Fase 2",
    title: "Candidatura e seleção",
    description: "Consultores se candidatam. RMO monta a shortlist, Coordenador entrevista e emite parecer, RMO faz a aprovação final.",
    actors: ["Consultor", "RMO", "Coordenador"],
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Handshake,
    number: "03",
    phase: "Fase 3",
    title: "Kickoff e execução",
    description: "Reunião de kickoff define marcos por fase. Consultor executa e lança OS diárias. Empresa acompanha em tempo real.",
    actors: ["Consultor", "RMO", "Coordenador"],
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: FileCheck2,
    number: "04",
    phase: "Encerramento",
    title: "Fase entregue e validada",
    description: "Consultor encerra a fase com documento. RMO valida e o Coordenador co-valida. Pagamento liberado por entrega aprovada.",
    actors: ["Consultor", "RMO", "Coordenador"],
    color: "text-accent",
    bg: "bg-accent/10",
  },
];

const HowItWorksSection = () => {
  return (
    <Section id="how-it-works" spacing="md" background="muted" container="none">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            Como funciona
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mt-3 tracking-tight">
            O ciclo completo, com <span className="text-gradient-primary">papéis definidos</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Empresa lança, RMO orquestra, Coordenador valida, Consultor entrega. Cada etapa com responsáveis claros.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto relative">
          <div className="hidden lg:block absolute top-[40px] left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-[2px]">
            <div className="w-full h-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                className="relative text-center lg:text-left"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="relative inline-flex mb-6">
                  <div className={`w-16 h-16 rounded-2xl ${step.bg} flex items-center justify-center relative z-10 shadow-lg`}>
                    <step.icon className={`h-7 w-7 ${step.color}`} />
                  </div>
                  <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full ${step.bg} ${step.color} text-[11px] font-bold flex items-center justify-center z-20 border-2 border-muted/30`}>
                    {i + 1}
                  </span>
                </div>

                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {step.phase}
                </span>
                <h3 className="text-lg font-display font-semibold text-foreground mt-1 mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">{step.description}</p>
                <div className="flex flex-wrap gap-1.5 justify-center lg:justify-start">
                  {step.actors.map((a) => (
                    <span key={a} className="inline-block px-2 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-foreground/70 border border-border/60">
                      {a}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-20 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 max-w-6xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <ProfileCTA icon={Building2} title="Sou Empresa" subtitle="Publicar demanda" to="/register?type=empresa" />
            <ProfileCTA icon={Network} title="Sou Canal (RMO)" subtitle="Gerenciar demandas" to="/register?type=canal" />
            <ProfileCTA icon={UserCheck} title="Sou Coordenador" subtitle="Acessar entrevistas" to="/login" />
            <ProfileCTA icon={Briefcase} title="Sou Consultor" subtitle="Receber projetos" to="/register?type=consultor" />
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </Section>
  );
};

const ProfileCTA = ({ icon: Icon, title, subtitle, to }: { icon: any; title: string; subtitle: string; to: string }) => (
  <Link to={to} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-card hover:shadow-card-hover hover:border-primary/40 transition-all">
    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{title}</p>
      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
    </div>
    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
  </Link>
);

export default HowItWorksSection;
