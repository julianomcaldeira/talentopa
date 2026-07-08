import { motion } from "framer-motion";
import { Section } from "@/components/ui/section";
import { ArrowRight, Building2, Briefcase, Network, UserCheck, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import empresaImg from "@/assets/scene-empresa.jpg";
import consultorImg from "@/assets/scene-consultor.jpg";

const cards = [
  {
    image: empresaImg,
    badge: "Empresa",
    icon: Building2,
    title: "Lança a demanda e acompanha o projeto",
    bullets: [
      "Publica escopo, fases, prazos e premissas",
      "Indica o Coordenador técnico da operação",
      "Acompanha vínculos, candidaturas e contratos",
    ],
    cta: "Publicar demanda",
    to: "/register?type=empresa",
    accent: "primary" as const,
  },
  {
    image: consultorImg,
    badge: "Canal · RMO",
    icon: Network,
    title: "Orquestra o ciclo do projeto ponta a ponta",
    bullets: [
      "Publica a demanda e define o Coordenador",
      "Monta shortlist e conduz a aprovação final",
      "Valida o encerramento de cada fase entregue",
    ],
    cta: "Cadastrar meu canal",
    to: "/register?type=canal",
    accent: "primary" as const,
  },
  {
    image: empresaImg,
    badge: "Coordenador",
    icon: UserCheck,
    title: "Responsável técnico da empresa no projeto",
    bullets: [
      "Recebe a shortlist e realiza as entrevistas",
      "Emite parecer técnico dos candidatos",
      "Co-valida o encerramento das fases entregues",
    ],
    cta: "Sou coordenador",
    to: "/login",
    accent: "accent" as const,
  },
  {
    image: consultorImg,
    badge: "Consultor",
    icon: Briefcase,
    title: "Executa o projeto com previsibilidade",
    bullets: [
      "Perfil técnico, certificações e agenda visíveis",
      "Candidata-se a demandas compatíveis",
      "Encerra fases com documento e recebe pela plataforma",
    ],
    cta: "Cadastrar como consultor",
    to: "/register?type=consultor",
    accent: "accent" as const,
  },
];

const ForWhomSection = () => {
  return (
    <Section spacing="md" background="default" container="none">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            Quatro papéis, um fluxo
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground tracking-tight">
            <span className="text-gradient-primary">Empresa</span>,{" "}
            <span className="text-gradient-primary">RMO</span>,{" "}
            <span className="text-gradient-primary">Coordenador</span> e{" "}
            <span className="text-gradient-primary">Consultor</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Cada papel com responsabilidades claras — do lançamento da demanda ao encerramento formal de cada fase.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {cards.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group relative rounded-3xl overflow-hidden bg-card border border-border/60 shadow-card hover:shadow-card-hover transition-all duration-500"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <div className="absolute top-4 left-4">
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

              <div className="p-6">
                <h3 className="text-lg font-display font-bold text-foreground mb-4 leading-tight min-h-[3.5rem]">
                  {c.title}
                </h3>
                <ul className="space-y-2.5 mb-6">
                  {c.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-foreground/80">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          c.accent === "primary" ? "text-primary" : "text-accent"
                        }`}
                      />
                      <span className="leading-snug">{b}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="sm"
                  className={`w-full rounded-xl h-10 group/btn ${
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
    </Section>
  );
};

export default ForWhomSection;
