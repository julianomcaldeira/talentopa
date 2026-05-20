import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import heroImage from "@/assets/hero-cinematic.jpg";

const words = ["TOTVS", "SAP", "Oracle", "Protheus", "S/4HANA"];

const HeroSection = () => {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden bg-background pt-20">
      <div className="container mx-auto px-4 lg:px-8 py-10 lg:py-14 relative z-10">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left — copy */}
          <div className="lg:col-span-8">
            <motion.span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/[0.08] border border-primary/15 text-primary text-xs font-semibold tracking-wide"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Marketplace de consultores ERP
            </motion.span>

            <motion.h1
              className="mt-8 text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.02] text-foreground"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              Consultores especialistas em{" "}
              <span className="relative inline-block">
                <motion.span
                  key={wordIndex}
                  className="text-primary"
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
                  transition={{ duration: 0.5 }}
                >
                  {words[wordIndex]}
                </motion.span>
              </span>
            </motion.h1>

            <motion.p
              className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
            >
              Conectamos empresas que precisam implementar ERP aos consultores certos —
              com matching técnico, gestão de projeto integrada e pagamento por entrega.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              <Button size="lg" className="text-base h-12 px-7 rounded-full shadow-lg shadow-primary/20 group" asChild>
                <Link to="/register?type=empresa">
                  Publicar um projeto
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-base h-12 px-7 rounded-full text-foreground hover:bg-muted"
                asChild
              >
                <Link to="/register?type=consultor">Quero ser consultor</Link>
              </Button>
            </motion.div>

            <motion.div
              className="mt-12 grid grid-cols-3 gap-8 max-w-md border-t border-border/60 pt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div>
                <div className="text-2xl md:text-3xl font-display font-bold text-foreground">+500</div>
                <div className="text-xs text-muted-foreground mt-1">Consultores ativos</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-display font-bold text-foreground">96%</div>
                <div className="text-xs text-muted-foreground mt-1">Match preciso</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-display font-bold text-foreground">24h</div>
                <div className="text-xs text-muted-foreground mt-1">Para 1ª proposta</div>
              </div>
            </motion.div>
          </div>

          {/* Right — compact portrait, TOTVS-style restraint */}
          <div className="lg:col-span-4 relative">
            <motion.div
              className="relative aspect-square w-full max-w-[380px] mx-auto lg:mr-0 rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              <img
                src={heroImage}
                alt="Consultora especialista em ERP em escritório corporativo"
                width={1280}
                height={1280}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/25 via-transparent to-transparent pointer-events-none" />

              <motion.div
                className="absolute bottom-4 left-4 right-4 rounded-xl bg-background/90 backdrop-blur-md border border-border/60 px-3.5 py-3 shadow-elevated"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.6 }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Match encontrado
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-foreground leading-tight">
                  Senior SAP S/4HANA · 96% compatível
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
