import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Users, Briefcase, Zap, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import workzSymbol from "@/assets/workz-symbol-blue.jpg";

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
    <section className="relative min-h-screen flex items-center overflow-hidden bg-hero">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full opacity-[0.10] pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(222, 70%, 52%) 0%, transparent 70%)",
            left: "-10%",
            top: "-20%",
          }}
          animate={{ x: [0, 100, 0], y: [0, 60, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.10] pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(176, 83%, 45%) 0%, transparent 70%)",
            right: "-5%",
            bottom: "0%",
          }}
          animate={{ x: [0, -80, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(180, 73%, 55%) 0%, transparent 70%)",
            left: "40%",
            top: "30%",
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(180, 73%, 75%) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top streak */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[1px] opacity-30"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(222, 70%, 52%) 30%, hsl(176, 83%, 45%) 70%, transparent 100%)",
        }}
        animate={{ opacity: [0.1, 0.4, 0.1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      <div className="container mx-auto px-4 pt-28 pb-24 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Brand badge — necessidade ✓ solução ✓ */}
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7 }}
            className="flex items-center justify-center gap-2"
          >
            <span className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.04] text-primary-foreground/70 text-sm font-medium backdrop-blur-md">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-[5px] border border-primary-foreground/40 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-accent" strokeWidth={3} />
                </span>
                necessidade
              </span>
              <span className="text-primary-foreground/30">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-[5px] border border-primary-foreground/40 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-accent" strokeWidth={3} />
                </span>
                solução
              </span>
            </span>
          </motion.div>

          {/* Heading */}
          <motion.div
            className="mt-10 mb-6"
            initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight leading-[1.02] lowercase">
              <span className="text-primary-foreground">consultores</span>
              <br />
              <span className="text-gradient-primary">especialistas em</span>
              <br />
              <span className="relative inline-block">
                <motion.span
                  key={wordIndex}
                  className="text-primary-foreground"
                  initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -30, filter: "blur(8px)" }}
                  transition={{ duration: 0.5 }}
                >
                  {words[wordIndex]}
                </motion.span>
                <motion.span
                  className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                />
              </span>
            </h1>
          </motion.div>

          {/* Brand tagline */}
          <motion.p
            className="text-base md:text-lg text-accent/90 font-medium tracking-wide mb-6 lowercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            especialistas · oportunidades · negócios
          </motion.p>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-primary-foreground/55 max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Conectamos empresas que precisam implementar ERP aos consultores ideais — com matching
            inteligente, gestão completa e pagamentos seguros.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-24"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
          >
            <Button
              size="lg"
              className="text-base px-12 h-14 rounded-2xl shadow-[0_0_40px_hsl(222,70%,40%,0.4)] hover:shadow-[0_0_60px_hsl(176,83%,40%,0.5)] transition-all duration-500 group"
              asChild
            >
              <Link to="/register">
                <span className="flex items-center">
                  Publicar um projeto
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-base px-12 h-14 rounded-2xl border border-primary-foreground/15 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/[0.06] hover:border-primary-foreground/30 backdrop-blur-sm transition-all duration-300"
              asChild
            >
              <Link to="/register">Sou consultor</Link>
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.7 }}
          >
            {[
              { icon: Users, label: "500+", desc: "Consultores ativos" },
              { icon: Briefcase, label: "1.200+", desc: "Projetos realizados" },
              { icon: Zap, label: "98%", desc: "Taxa de matching" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="group flex items-center gap-4 bg-primary-foreground/[0.04] rounded-2xl p-6 border border-primary-foreground/[0.08] backdrop-blur-md hover:border-accent/40 transition-all duration-500"
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                  <stat.icon className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-display font-bold text-primary-foreground">{stat.label}</p>
                  <p className="text-xs text-primary-foreground/50">{stat.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Brand W watermark */}
      <motion.img
        src={workzSymbol}
        alt=""
        aria-hidden
        className="hidden lg:block absolute right-[-80px] bottom-[-60px] w-[420px] opacity-[0.08] mix-blend-screen pointer-events-none rounded-3xl"
        initial={{ opacity: 0, rotate: -8 }}
        animate={{ opacity: 0.08, rotate: -6 }}
        transition={{ duration: 1.2, delay: 0.4 }}
      />

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="h-6 w-6 text-primary-foreground/30" />
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
