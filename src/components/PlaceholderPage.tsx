const PlaceholderPage = ({ title, description }: { title: string; description: string }) => (
  <div>
    <h1 className="text-2xl font-display font-bold text-foreground mb-2">{title}</h1>
    <p className="text-muted-foreground mb-6">{description}</p>
    <div className="bg-card rounded-xl p-12 shadow-card border border-border text-center">
      <p className="text-muted-foreground">Esta seção será implementada em breve.</p>
    </div>
  </div>
);

export default PlaceholderPage;
