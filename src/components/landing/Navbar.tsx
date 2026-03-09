import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="font-display font-bold text-primary-foreground text-sm">TO</span>
          </div>
          <span className="font-display font-bold text-lg text-foreground">TalentOps</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Como funciona</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Começar agora</Link>
          </Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden glass border-t border-border px-4 py-4 space-y-3">
          <a href="#features" className="block text-sm text-muted-foreground">Funcionalidades</a>
          <a href="#how-it-works" className="block text-sm text-muted-foreground">Como funciona</a>
          <a href="#pricing" className="block text-sm text-muted-foreground">Planos</a>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" asChild className="flex-1">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/register">Começar agora</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
