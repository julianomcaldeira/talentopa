import { ReactNode } from "react";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import { Construction } from "lucide-react";

const PlaceholderPage = ({ title, description }: { title: string; description: string }) => (
  <div>
    <PageHeader title={title} description={description} />
    <DataCard>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="icon-container icon-container-lg bg-muted mb-4">
          <Construction className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium text-sm">Esta seção será implementada em breve</p>
        <p className="text-muted-foreground/60 text-xs mt-1">Funcionalidade em desenvolvimento</p>
      </div>
    </DataCard>
  </div>
);

export default PlaceholderPage;
