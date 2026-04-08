import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "glass shadow-elevated"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-primary/30 transition-shadow duration-300">
            <span className="font-display font-bold text-primary-foreground text-sm">W</span>
          </div>
          <span className="font-display font-bold text-lg text-foreground">Workz</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            { href: "#features", label: "Funcionalidades" },
            { href: "#how-it-works", label: "Como funciona" },
            { href: "#pricing", label: "Planos" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" asChild className="text-sm text-muted-foreground hover:text-foreground">
            <Link to="/register">Sou Empresa</Link>
          </Button>
          <Button variant="ghost" asChild className="text-sm text-muted-foreground hover:text-foreground">
            <Link to="/register">Sou Consultor</Link>
          </Button>
          <Button asChild className="text-sm px-6 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
            <Link to="/login">Entrar</Link>
          </Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border px-4 py-4 space-y-3 overflow-hidden"
          >
            <a href="#features" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Funcionalidades</a>
            <a href="#how-it-works" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Como funciona</a>
            <a href="#pricing" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Planos</a>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="ghost" asChild>
                <Link to="/register">Sou Empresa</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/register">Sou Consultor</Link>
              </Button>
              <Button asChild className="shadow-lg shadow-primary/25">
                <Link to="/login">Entrar</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
