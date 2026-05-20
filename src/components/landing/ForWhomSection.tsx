import { motion } from "framer-motion";
import { ArrowRight, Building2, Briefcase, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import empresaImg from "@/assets/editorial-woman-2.jpg";
import consultorImg from "@/assets/editorial-man-1.jpg";

const cards = [
  {
    image: empresaImg,
    badge: "Para Empresas",
    icon: Building2,
    title: "Encontre o consultor certo para seu projeto ERP",
    bullets: [
      "Publique seu projeto em minutos",
      "Receba propostas qualificadas",
      "Pague somente por entregas aprovadas",
    ],
    cta: "Publicar meu projeto",
    to: "/register?type=empresa",
    accent: "primary" as const,
  },
  {
    image: consultorImg,
    badge: "Para Consultores",
    icon: Briefcase,
    title: "Trabalhe nos melhores projetos ERP do Brasil",
    bullets: [
      "Acesso a oportunidades qualificadas",
      "Recebimento garantido pela plataforma",
      "Construa um portfólio público real",
    ],
    cta: "Cadastrar como consultor",
    to: "/register?type=consultor",
    accent: "accent" as const,
  },
];

const ForWhomSection = () => {
  return (
    <section className="py-28 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            Dois lados, uma plataforma
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground tracking-tight">
            Feita para <span className="text-gradient-primary">empresas</span> e{" "}
            <span className="text-gradient-primary">consultores</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {cards.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              whileHover={{ y: -6 }}
              className="group relative rounded-3xl overflow-hidden bg-card border border-border/60 shadow-card hover:shadow-card-hover transition-all duration-500"
            >
              <div className="relative h-72 overflow-hidden">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  width={1024}
                  height={1280}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <div className="absolute top-5 left-5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border ${
                      c.accent === "primary"
                        ? "bg-primary/90 text-primary-foreground border-primary/40"
                        : "bg-accent/90 text-accent-foreground border-accent/40"
                    }`}
                  >
                    <c.icon className="h-3.5 w-3.5" />
                    {c.badge}
                  </span>
                </div>
              </div>

              <div className="p-8">
                <h3 className="text-2xl font-display font-bold text-foreground mb-5 leading-tight">
                  {c.title}
                </h3>
                <ul className="space-y-3 mb-7">
                  {c.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-foreground/80">
                      <CheckCircle2
                        className={`h-5 w-5 shrink-0 mt-0.5 ${
                          c.accent === "primary" ? "text-primary" : "text-accent"
                        }`}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full rounded-xl h-12 group/btn ${
                    c.accent === "accent"
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : ""
                  }`}
                >
                  <Link to={c.to}>
                    {c.cta}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ForWhomSection;
