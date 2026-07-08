import { motion } from "framer-motion";
import { Users, ClipboardCheck, FileSignature, Calendar, Layers, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Section } from "@/components/ui/section";

const features = [
  {
    icon: Search,
    title: "Matching Inteligente",
    description: "Algoritmo que identifica automaticamente consultores com o perfil ideal para seu projeto ERP.",
    gradient: "from-primary/10 to-primary/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: Shield,
    title: "Pagamentos Seguros",
    description: "Pagamento por fases com retenção garantida. Liberação somente após aprovação.",
    gradient: "from-accent/10 to-accent/5",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
  },
  {
    icon: BarChart3,
    title: "Gestão de Projetos",
    description: "Acompanhe fases, entregas e cronogramas em tempo real com dashboards completos.",
    gradient: "from-primary/10 to-accent/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: Clock,
    title: "Templates Prontos",
    description: "Inicie projetos rapidamente com templates de implementação pré-configurados.",
    gradient: "from-accent/10 to-primary/5",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
  },
  {
    icon: CreditCard,
    title: "Faturamento Integrado",
    description: "Sistema completo de cobrança, notas fiscais e comissionamento automático.",
    gradient: "from-primary/10 to-primary/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: Star,
    title: "Sistema de Avaliação",
    description: "Avaliações mútuas entre consultores e empresas garantem qualidade e transparência.",
    gradient: "from-accent/10 to-accent/5",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
  },
];

const FeaturesSection = () => {
  return (
    <Section id="features" spacing="md" background="default">
      {/* Subtle background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.02] blur-[100px] pointer-events-none" />


        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider mb-4">
            Funcionalidades
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mt-3 mb-5 tracking-tight">
            Tudo que você precisa
            <br />
            <span className="text-gradient-primary">em um só lugar</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Desde a publicação do projeto até a avaliação final, a Workz cuida de cada etapa.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className={`group relative bg-gradient-to-br ${feature.gradient} rounded-2xl p-7 border border-border/50 hover:border-primary/20 transition-all duration-500 cursor-default`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between mb-5">
                <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary/60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
    </Section>
  );
};

export default FeaturesSection;
