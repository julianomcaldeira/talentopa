import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-hero py-16 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <span className="font-display font-bold text-primary-foreground text-sm">W</span>
              </div>
              <span className="font-display font-bold text-lg text-primary-foreground">Workz</span>
            </div>
            <p className="text-primary-foreground/40 text-sm leading-relaxed">
              Marketplace de consultoria ERP. Conectamos empresas aos melhores consultores do mercado.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4 text-sm">Plataforma</h4>
            <ul className="space-y-2.5 text-sm text-primary-foreground/40">
              <li><a href="#features" className="hover:text-primary-foreground/70 transition-colors">Funcionalidades</a></li>
              <li><a href="#how-it-works" className="hover:text-primary-foreground/70 transition-colors">Como funciona</a></li>
              <li><a href="#pricing" className="hover:text-primary-foreground/70 transition-colors">Preços</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4 text-sm">Para Consultores</h4>
            <ul className="space-y-2.5 text-sm text-primary-foreground/40">
              <li><Link to="/register" className="hover:text-primary-foreground/70 transition-colors">Cadastre-se</Link></li>
              <li><a href="#" className="hover:text-primary-foreground/70 transition-colors">Projetos disponíveis</a></li>
              <li><a href="#" className="hover:text-primary-foreground/70 transition-colors">Planos</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4 text-sm">Para Empresas</h4>
            <ul className="space-y-2.5 text-sm text-primary-foreground/40">
              <li><Link to="/register" className="hover:text-primary-foreground/70 transition-colors">Publicar projeto</Link></li>
              <li><a href="#" className="hover:text-primary-foreground/70 transition-colors">Sustentação</a></li>
              <li><a href="#" className="hover:text-primary-foreground/70 transition-colors">Suporte</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/[0.06] pt-8 text-center text-sm text-primary-foreground/30">
          © 2026 Workz. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
