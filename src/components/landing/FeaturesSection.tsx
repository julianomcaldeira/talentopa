import { motion } from "framer-motion";
import { Search, Shield, CreditCard, BarChart3, Clock, Star } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Matching Inteligente",
    description: "Nosso algoritmo identifica automaticamente consultores com o perfil ideal para seu projeto ERP.",
  },
  {
    icon: Shield,
    title: "Pagamentos Seguros",
    description: "Pagamento por fases com retenção garantida. Liberação somente após aprovação da empresa.",
  },
  {
    icon: BarChart3,
    title: "Gestão de Projetos",
    description: "Acompanhe fases, entregas e cronogramas em tempo real com dashboards completos.",
  },
  {
    icon: Clock,
    title: "Templates Prontos",
    description: "Inicie projetos rapidamente com templates de implementação pré-configurados pelo admin.",
  },
  {
    icon: CreditCard,
    title: "Faturamento Integrado",
    description: "Sistema completo de cobrança, notas fiscais e comissionamento automático.",
  },
  {
    icon: Star,
    title: "Sistema de Avaliação",
    description: "Avaliações mútuas entre consultores e empresas garantem qualidade e transparência.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-accent uppercase tracking-wider">Funcionalidades</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-3 mb-4">
            Tudo que você precisa em um só lugar
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Desde a publicação do projeto até a avaliação final, a Workz cuida de cada etapa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="group bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border hover:border-primary/30"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
