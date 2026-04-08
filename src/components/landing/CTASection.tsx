import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          className="relative max-w-4xl mx-auto rounded-3xl bg-hero p-12 md:p-16 text-center overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          {/* Decorative orbs */}
          <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-accent/10 blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-primary-foreground tracking-tight mb-5">
              Pronto para transformar
              <br />
              seus projetos ERP?
            </h2>
            <p className="text-primary-foreground/50 text-lg max-w-xl mx-auto mb-10">
              Junte-se a centenas de empresas e consultores que já estão usando a Workz.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="text-base px-10 py-7 rounded-xl shadow-xl shadow-primary/25 group"
                asChild
              >
                <Link to="/register">
                  Começar agora
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-base px-10 py-7 rounded-xl border border-primary-foreground/10 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/[0.06] hover:border-primary-foreground/20 backdrop-blur-sm"
                asChild
              >
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
