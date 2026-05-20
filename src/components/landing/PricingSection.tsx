import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Standard",
    price: "Grátis",
    period: "",
    description: "Para consultores que estão começando",
    features: [
      "Acesso a projetos publicados",
      "Perfil de consultor completo",
      "Sistema de propostas",
      "Gestão de projetos básica",
      "Recebimento via plataforma",
    ],
    cta: "Criar conta gratuita",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "R$ 99",
    period: "/mês",
    description: "Para consultores que querem crescer",
    features: [
      "Tudo do plano Standard",
      "Acesso a demandas de sustentação",
      "Acesso a treinamentos",
      "Maior visibilidade na plataforma",
      "Badge Premium no perfil",
      "Suporte prioritário",
    ],
    cta: "Assinar Premium",
    highlighted: true,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-28 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider mb-4">
            Planos para consultores
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mt-3 mb-5 tracking-tight">
            Escolha seu <span className="text-gradient-primary">plano</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Empresas utilizam a plataforma sem assinatura — pagam apenas por projeto.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              className={`relative rounded-2xl p-8 border transition-all duration-300 ${
                plan.highlighted
                  ? "bg-card border-primary/30 shadow-xl shadow-primary/10"
                  : "bg-card border-border shadow-card hover:shadow-card-hover"
              }`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-semibold shadow-lg">
                    <Sparkles className="h-3 w-3" />
                    Recomendado
                  </span>
                </div>
              )}

              <h3 className="text-xl font-display font-bold text-foreground">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mt-1 mb-6">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-display font-bold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-foreground">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${plan.highlighted ? "bg-primary/10" : "bg-accent/10"}`}>
                      <Check className={`h-3 w-3 ${plan.highlighted ? "text-primary" : "text-accent"}`} />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full rounded-xl py-6 ${
                  plan.highlighted ? "shadow-lg shadow-primary/20 hover:shadow-primary/30" : ""
                }`}
                variant={plan.highlighted ? "default" : "outline"}
                asChild
              >
                <Link to="/register?type=consultor">{plan.cta}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
