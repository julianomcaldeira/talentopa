import { motion } from "framer-motion";
import { FileText, Bell, Handshake, CheckCircle2, ArrowRight, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: FileText,
    number: "01",
    title: "Publique seu projeto",
    description: "Defina escopo, escolha o ERP, módulos e funcionalidades. Use templates prontos ou personalize.",
    color: "text-primary",
    bg: "bg-primary/10",
    glow: "shadow-primary/10",
  },
  {
    icon: Bell,
    number: "02",
    title: "Receba propostas",
    description: "Consultores qualificados são notificados e enviam suas propostas técnicas automaticamente.",
    color: "text-accent",
    bg: "bg-accent/10",
    glow: "shadow-accent/10",
  },
  {
    icon: Handshake,
    number: "03",
    title: "Escolha e contrate",
    description: "Compare perfis, avaliações e valores. Contrate com contrato digital e cronograma automático.",
    color: "text-primary",
    bg: "bg-primary/10",
    glow: "shadow-primary/10",
  },
  {
    icon: CheckCircle2,
    number: "04",
    title: "Acompanhe e aprove",
    description: "Gerencie fases, aprove entregas e libere pagamentos de forma segura pela plataforma.",
    color: "text-accent",
    bg: "bg-accent/10",
    glow: "shadow-accent/10",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-28 bg-muted/30 relative overflow-hidden">
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
            Simples, rápido e <span className="text-gradient-primary">eficiente</span>
          </h2>
        </motion.div>

        <div className="max-w-5xl mx-auto relative">
          {/* Connection line */}
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
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                {/* Icon */}
                <div className="relative inline-flex mb-6">
                  <div className={`w-16 h-16 rounded-2xl ${step.bg} flex items-center justify-center relative z-10 shadow-lg ${step.glow}`}>
                    <step.icon className={`h-7 w-7 ${step.color}`} />
                  </div>
                  <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full ${step.bg} ${step.color} text-[11px] font-bold flex items-center justify-center z-20 border-2 border-muted/30`}>
                    {i + 1}
                  </span>
                </div>

                <h3 className="text-lg font-display font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Dual-profile CTA strip */}
          <motion.div
            className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/70 shadow-card">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">É da sua empresa?</p>
                <p className="text-xs text-muted-foreground">Publique seu projeto em 2 minutos.</p>
              </div>
              <Button size="sm" asChild className="shrink-0">
                <Link to="/register?type=empresa">
                  Começar <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/70 shadow-card">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">É consultor ERP?</p>
                <p className="text-xs text-muted-foreground">Receba projetos compatíveis com seu perfil.</p>
              </div>
              <Button size="sm" variant="outline" asChild className="shrink-0">
                <Link to="/register?type=consultor">
                  Cadastrar <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
};

export default HowItWorksSection;
