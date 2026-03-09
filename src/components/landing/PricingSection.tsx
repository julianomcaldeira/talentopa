import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Standard",
    price: "Grátis",
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
    price: "R$ 99/mês",
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
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-accent uppercase tracking-wider">Planos para consultores</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-3 mb-4">
            Escolha seu plano
          </h2>
          <p className="text-muted-foreground">Empresas utilizam a plataforma sem assinatura — pagam apenas por projeto.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`rounded-2xl p-8 border transition-all ${
                plan.highlighted
                  ? "bg-card border-primary shadow-card-hover glow-primary"
                  : "bg-card border-border shadow-card"
              }`}
            >
              {plan.highlighted && (
                <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold mb-4">
                  Recomendado
                </span>
              )}
              <h3 className="text-xl font-display font-bold text-foreground">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mt-1 mb-4">{plan.description}</p>
              <p className="text-3xl font-display font-bold text-foreground mb-6">{plan.price}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
                asChild
              >
                <Link to="/register">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
