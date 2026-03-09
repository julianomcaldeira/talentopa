import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Users, Briefcase, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative bg-hero min-h-[90vh] flex items-center overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(hsl(220, 70%, 55%, 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(220, 70%, 55%, 0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary-foreground/80 text-sm font-medium mb-6">
              Marketplace de Consultoria ERP
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <span className="text-primary-foreground">Conecte sua empresa aos</span>
            <br />
            <span className="text-gradient-primary">melhores consultores ERP</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-primary-foreground/60 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            Publique projetos de implementação ERP e encontre consultores especializados em TOTVS, SAP, Oracle e mais. 
            Matching inteligente, pagamentos seguros e gestão completa.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button size="lg" className="text-base px-8 py-6 glow-primary" asChild>
              <Link to="/register">
                Publicar um projeto <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-6 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/register">Sou consultor</Link>
            </Button>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
          >
            {[
              { icon: Users, label: "500+", desc: "Consultores especializados" },
              { icon: Briefcase, label: "1.200+", desc: "Projetos realizados" },
              { icon: Zap, label: "98%", desc: "Taxa de satisfação" },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-3 justify-center md:justify-start bg-primary-foreground/5 rounded-xl p-4 border border-primary-foreground/10">
                <stat.icon className="h-8 w-8 text-accent" />
                <div className="text-left">
                  <p className="text-2xl font-display font-bold text-primary-foreground">{stat.label}</p>
                  <p className="text-sm text-primary-foreground/50">{stat.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
