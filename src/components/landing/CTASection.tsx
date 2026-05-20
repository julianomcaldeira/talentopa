import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import sceneImage from "@/assets/scene-empresa.jpg";

const CTASection = () => {
  return (
    <section className="py-28 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          className="relative max-w-6xl mx-auto rounded-3xl bg-card border border-border/70 shadow-card-hover overflow-hidden"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/[0.07] blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-primary/[0.07] blur-[80px] pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-5 items-stretch">
            <div className="lg:col-span-3 p-10 md:p-14 lg:p-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-semibold mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Comece em menos de 2 minutos
              </span>

              <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground tracking-tight leading-[1.05] mb-5">
                Pronto para transformar
                <br />
                seus <span className="text-primary">projetos ERP</span>?
              </h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-xl mb-9 leading-relaxed">
                Centenas de empresas e consultores já usam a Workz para entregar
                projetos com mais previsibilidade e segurança.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button size="lg" className="text-base px-7 h-12 rounded-xl shadow-lg shadow-primary/20 group" asChild>
                  <Link to="/register?type=empresa">
                    Sou empresa — publicar projeto
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-base px-7 h-12 rounded-xl" asChild>
                  <Link to="/register?type=consultor">Sou consultor — quero projetos</Link>
                </Button>
              </div>

              <p className="mt-9 text-muted-foreground text-xs">
                ✓ Sem cartão · ✓ Cadastro gratuito · ✓ Suporte humano
              </p>
            </div>

            <div className="hidden lg:block lg:col-span-2 relative min-h-[440px] overflow-hidden">
              <motion.img
                src={sceneImage}
                alt=""
                aria-hidden
                loading="lazy"
                width={1280}
                height={1024}
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.05 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-card/10 to-card pointer-events-none" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
