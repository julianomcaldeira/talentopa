import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Publique seu projeto",
    description: "Defina escopo, escolha o ERP, módulos e funcionalidades. Use templates prontos ou personalize.",
    color: "text-primary",
  },
  {
    number: "02",
    title: "Receba propostas",
    description: "Consultores qualificados são notificados automaticamente e enviam suas propostas técnicas.",
    color: "text-accent",
  },
  {
    number: "03",
    title: "Escolha e contrate",
    description: "Compare perfis, avaliações e valores. Contrate com contrato digital e cronograma automático.",
    color: "text-primary",
  },
  {
    number: "04",
    title: "Acompanhe e aprove",
    description: "Gerencie fases, aprove entregas e libere pagamentos de forma segura pela plataforma.",
    color: "text-accent",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-accent uppercase tracking-wider">Como funciona</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-3">
            Simples e eficiente
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <span className={`text-5xl font-display font-bold ${step.color} opacity-20`}>{step.number}</span>
              <h3 className="text-lg font-display font-semibold text-foreground mt-2 mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 -right-4 w-8 border-t-2 border-dashed border-border" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
