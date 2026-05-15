import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import consultantImg from "@/assets/landing-consultant-woman.jpg";
import handshakeImg from "@/assets/landing-handshake.jpg";

const CTASection = () => {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          className="relative max-w-6xl mx-auto rounded-3xl bg-hero overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-primary/15 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-accent/15 blur-[90px] pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-0 items-stretch">
            {/* Copy */}
            <div className="lg:col-span-3 p-10 md:p-14 lg:p-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/15 text-primary-foreground/80 text-xs font-semibold mb-6 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                Comece em menos de 2 minutos
              </span>

              <h2 className="text-3xl md:text-5xl font-display font-bold text-primary-foreground tracking-tight leading-[1.05] mb-5">
                Pronto para transformar
                <br />
                seus <span className="text-gradient-primary">projetos ERP</span>?
              </h2>
              <p className="text-primary-foreground/60 text-base md:text-lg max-w-xl mb-9 leading-relaxed">
                Junte-se a centenas de empresas e consultores que já estão usando a Workz para
                entregar projetos com mais segurança, rapidez e previsibilidade.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  size="lg"
                  className="text-base px-8 h-14 rounded-2xl shadow-xl shadow-primary/30 group"
                  asChild
                >
                  <Link to="/register">
                    Publicar um projeto
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-base px-8 h-14 rounded-2xl border border-primary-foreground/15 text-primary-foreground/85 hover:text-primary-foreground hover:bg-primary-foreground/[0.08] hover:border-primary-foreground/30 backdrop-blur-sm"
                  asChild
                >
                  <Link to="/register">Sou consultor</Link>
                </Button>
              </div>

              <p className="mt-9 text-primary-foreground/55 text-xs">
                ✓ Sem cartão · ✓ Cadastro gratuito · ✓ Suporte humano
              </p>
            </div>

            {/* Image collage */}
            <div className="hidden lg:block lg:col-span-2 relative min-h-[440px]">
              <motion.img
                src={consultantImg}
                alt=""
                aria-hidden
                loading="lazy"
                width={1024}
                height={1280}
                className="absolute right-10 top-10 w-56 h-72 object-cover rounded-2xl shadow-2xl shadow-primary/40 ring-1 ring-primary-foreground/10"
                initial={{ opacity: 0, y: 20, rotate: -4 }}
                whileInView={{ opacity: 1, y: 0, rotate: -3 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.2 }}
              />
              <motion.img
                src={handshakeImg}
                alt=""
                aria-hidden
                loading="lazy"
                width={1024}
                height={1024}
                className="absolute right-44 bottom-10 w-48 h-56 object-cover rounded-2xl shadow-2xl shadow-accent/40 ring-1 ring-primary-foreground/10"
                initial={{ opacity: 0, y: 20, rotate: 6 }}
                whileInView={{ opacity: 1, y: 0, rotate: 4 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.35 }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
