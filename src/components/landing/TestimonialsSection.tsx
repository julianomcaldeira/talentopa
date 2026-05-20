import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import avatarCarlos from "@/assets/editorial-man-1.jpg";
import avatarAna from "@/assets/editorial-woman-1.jpg";
import avatarRoberto from "@/assets/editorial-man-2.jpg";
import teamImg from "@/assets/editorial-woman-2.jpg";

const testimonials = [
  {
    name: "Carlos Mendes",
    role: "CTO, Indústria Pharma",
    avatar: avatarCarlos,
    content:
      "A Workz transformou como contratamos consultores ERP. O matching inteligente nos economizou semanas de busca.",
    rating: 5,
  },
  {
    name: "Ana Beatriz",
    role: "Consultora SAP Senior",
    avatar: avatarAna,
    content:
      "Desde que me cadastrei, recebi projetos alinhados com minha expertise. A plataforma é intuitiva e profissional.",
    rating: 5,
  },
  {
    name: "Roberto Silva",
    role: "Diretor de TI, Logística Express",
    avatar: avatarRoberto,
    content:
      "Gestão de fases e pagamentos pela plataforma trouxe segurança para ambos os lados. Recomendo fortemente.",
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-16 lg:py-20 bg-muted/30 relative overflow-hidden">
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
          {/* Featured image card */}
          <motion.div
            className="lg:col-span-2 relative rounded-2xl overflow-hidden min-h-[320px] lg:min-h-full shadow-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={teamImg}
              alt="Equipe colaborando em projeto ERP"
              loading="lazy"
              width={1280}
              height={896}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" />
            <div className="relative z-10 h-full flex flex-col justify-end p-8">
              <span className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full bg-primary-foreground/15 backdrop-blur-md text-primary-foreground text-xs font-semibold mb-4">
                4.9 ★ avaliação média
              </span>
              <p className="text-2xl font-display font-bold text-primary-foreground leading-tight">
                Centenas de times confiam na Workz para entregar seus projetos ERP.
              </p>
            </div>
          </motion.div>

          {/* Testimonial cards */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                className={`bg-card rounded-2xl p-6 border border-border/50 shadow-card hover:shadow-card-hover transition-all duration-300 relative ${
                  i === 0 ? "sm:col-span-2" : ""
                }`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <Quote className="h-7 w-7 text-primary/15 absolute top-5 right-5" />

                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-accent text-accent" />
                  ))}
                </div>

                <p className="text-foreground/85 text-sm leading-relaxed mb-5">"{t.content}"</p>

                <div className="flex items-center gap-3">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-background shadow-sm"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
};

export default TestimonialsSection;
