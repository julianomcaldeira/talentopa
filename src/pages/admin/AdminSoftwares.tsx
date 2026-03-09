const AdminSoftwares = () => (
  <div>
    <h1 className="text-2xl font-display font-bold text-foreground mb-2">Softwares ERP</h1>
    <p className="text-muted-foreground mb-6">Gerencie os sistemas ERP disponíveis na plataforma</p>
    <div className="bg-card rounded-xl p-6 shadow-card border border-border">
      <div className="space-y-3">
        {["TOTVS Protheus", "TOTVS RM", "SAP", "Oracle", "Fluig"].map((sw, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm font-medium text-foreground">{sw}</span>
            <span className="text-xs text-muted-foreground">Editar</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AdminSoftwares;
