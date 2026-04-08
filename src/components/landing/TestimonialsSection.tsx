import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Mendes",
    role: "CTO, Indústria Pharma",
    content: "A Workz transformou como contratamos consultores ERP. O matching inteligente nos economizou semanas de busca.",
    rating: 5,
  },
  {
    name: "Ana Beatriz",
    role: "Consultora SAP Senior",
    content: "Desde que me cadastrei, recebi projetos alinhados com minha expertise. A plataforma é intuitiva e profissional.",
    rating: 5,
  },
  {
    name: "Roberto Silva",
    role: "Diretor de TI, Logística Express",
    content: "Gestão de fases e pagamentos pela plataforma trouxe segurança para ambos os lados. Recomendo fortemente.",
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-28 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground tracking-tight">
            Quem usa, <span className="text-gradient-primary">aprova</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              className="bg-card rounded-2xl p-7 border border-border/50 shadow-card hover:shadow-card-hover transition-all duration-300 relative"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <Quote className="h-8 w-8 text-primary/10 absolute top-6 right-6" />

              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>

              <p className="text-foreground/80 text-sm leading-relaxed mb-6">"{t.content}"</p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-foreground">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
};

export default TestimonialsSection;
