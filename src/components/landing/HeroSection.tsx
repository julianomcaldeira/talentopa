import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import portraitWoman from "@/assets/editorial-woman-1.jpg";
import portraitMan from "@/assets/editorial-man-1.jpg";
import portraitWoman2 from "@/assets/editorial-woman-2.jpg";

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
    <section className="relative min-h-screen flex items-center overflow-hidden bg-hero pt-20">
      {/* Soft ambient wash */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, hsl(217, 91%, 60%, 0.10) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -right-20 w-[480px] h-[480px] rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, hsl(217, 91%, 70%, 0.10) 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(222 47% 11%) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="container mx-auto px-4 py-20 lg:py-24 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left — copy */}
          <div className="lg:col-span-7">
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
              Consultores
              <br />
              especialistas em{" "}
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
              className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              <Button size="lg" className="text-base h-13 px-7 rounded-xl shadow-lg shadow-primary/20 group" asChild>
                <Link to="/register">
                  Publicar um projeto
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base h-13 px-7 rounded-xl border-border bg-card/60 backdrop-blur-sm hover:bg-card"
                asChild
              >
                <Link to="/register">Sou consultor</Link>
              </Button>
            </motion.div>

            <motion.div
              className="mt-10 flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="flex -space-x-2">
                {[portraitMan, portraitWoman, portraitWoman2].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    aria-hidden
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-background"
                  />
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">+500 consultores</span> ativos no Brasil
              </div>
            </motion.div>
          </div>

          {/* Right — editorial portrait stack */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] max-w-md mx-auto">
              <motion.img
                src={portraitWoman}
                alt="Consultora especialista em ERP"
                width={1024}
                height={1280}
                className="absolute inset-0 w-full h-full object-cover rounded-3xl shadow-card-hover"
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              />

              <motion.div
                className="absolute -left-6 bottom-12 w-44 rounded-2xl bg-card shadow-card-hover border border-border/60 p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Match encontrado
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  Ana Beatriz · Senior SAP
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Compatibilidade 96%</p>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: "96%" }}
                    transition={{ duration: 1.2, delay: 0.9, ease: "easeOut" }}
                  />
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-4 top-10 rounded-2xl bg-card shadow-card-hover border border-border/60 px-4 py-3 flex items-center gap-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.55 }}
              >
                <img src={portraitMan} alt="" aria-hidden className="w-9 h-9 rounded-full object-cover" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Proposta enviada</p>
                  <p className="text-[11px] text-muted-foreground">há 2 min</p>
                </div>
              </motion.div>
            </div>
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
