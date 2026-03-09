import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-hero py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="font-display font-bold text-primary-foreground text-sm">TO</span>
              </div>
              <span className="font-display font-bold text-lg text-primary-foreground">TalentOps</span>
            </div>
            <p className="text-primary-foreground/50 text-sm">
              Marketplace de consultoria ERP. Conectamos empresas aos melhores consultores do mercado.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4">Plataforma</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/50">
              <li><a href="#features" className="hover:text-primary-foreground/80 transition-colors">Funcionalidades</a></li>
              <li><a href="#how-it-works" className="hover:text-primary-foreground/80 transition-colors">Como funciona</a></li>
              <li><a href="#pricing" className="hover:text-primary-foreground/80 transition-colors">Preços</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4">Para Consultores</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/50">
              <li><Link to="/register" className="hover:text-primary-foreground/80 transition-colors">Cadastre-se</Link></li>
              <li><a href="#" className="hover:text-primary-foreground/80 transition-colors">Projetos disponíveis</a></li>
              <li><a href="#" className="hover:text-primary-foreground/80 transition-colors">Planos</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4">Para Empresas</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/50">
              <li><Link to="/register" className="hover:text-primary-foreground/80 transition-colors">Publicar projeto</Link></li>
              <li><a href="#" className="hover:text-primary-foreground/80 transition-colors">Sustentação</a></li>
              <li><a href="#" className="hover:text-primary-foreground/80 transition-colors">Suporte</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10 pt-8 text-center text-sm text-primary-foreground/40">
          © 2026 TalentOps. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
