import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Users, Briefcase, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const floatingOrbs = [
  { size: 400, x: "10%", y: "20%", color: "hsl(228, 76%, 52%)", delay: 0 },
  { size: 300, x: "70%", y: "60%", color: "hsl(168, 62%, 44%)", delay: 2 },
  { size: 200, x: "80%", y: "10%", color: "hsl(228, 76%, 52%)", delay: 4 },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-hero">
      {/* Animated floating orbs */}
      {floatingOrbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[120px] opacity-[0.07] pointer-events-none"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: orb.color,
          }}
          animate={{
            y: [0, -30, 0, 30, 0],
            x: [0, 20, 0, -20, 0],
            scale: [1, 1.1, 1, 0.9, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            delay: orb.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(228, 76%, 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(228, 76%, 60%) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_hsl(228,42%,8%)_70%)]" />

      <div className="container mx-auto px-4 pt-28 pb-20 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary-foreground/70 text-sm font-medium backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-accent" />
              Marketplace inteligente de Consultoria ERP
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-display font-bold tracking-tight mt-8 mb-8 leading-[1.05]"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <span className="text-primary-foreground">O futuro da</span>
            <br />
            <span className="text-gradient-primary">consultoria ERP</span>
            <br />
            <span className="text-primary-foreground">começa aqui</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-primary-foreground/50 max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Publique projetos, encontre consultores especializados em TOTVS, SAP e Oracle
            com matching inteligente, e gerencie tudo em um só lugar.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Button
              size="lg"
              className="text-base px-10 py-7 rounded-xl shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 group"
              asChild
            >
              <Link to="/register">
                Publicar um projeto
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-10 py-7 rounded-xl border-primary-foreground/15 text-primary-foreground/80 hover:bg-primary-foreground/5 hover:border-primary-foreground/25 transition-all"
              asChild
            >
              <Link to="/register">Sou consultor</Link>
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65 }}
          >
            {[
              { icon: Users, label: "500+", desc: "Consultores especializados", gradient: "from-primary/20 to-primary/5" },
              { icon: Briefcase, label: "1.200+", desc: "Projetos realizados", gradient: "from-accent/20 to-accent/5" },
              { icon: Zap, label: "98%", desc: "Taxa de satisfação", gradient: "from-primary/20 to-accent/5" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className={`group flex items-center gap-4 justify-center md:justify-start bg-gradient-to-br ${stat.gradient} rounded-2xl p-5 border border-primary-foreground/[0.06] backdrop-blur-sm hover:border-primary-foreground/[0.12] transition-all duration-300`}
                whileHover={{ y: -2 }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/5 flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-display font-bold text-primary-foreground">{stat.label}</p>
                  <p className="text-xs text-primary-foreground/40">{stat.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
