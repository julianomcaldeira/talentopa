import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { BenchmarkingSection } from "@/components/reports/BenchmarkingSection";
import { FileSpreadsheet, BarChart3 } from "lucide-react";

const ConsultorRelatorios = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
      <p className="text-muted-foreground text-sm mt-1">Acompanhe seus dados e compare com o mercado.</p>
    </div>
    <Tabs defaultValue="relatorios">
      <TabsList>
        <TabsTrigger value="relatorios" className="gap-2"><FileSpreadsheet size={16} />Meus Relatórios</TabsTrigger>
        <TabsTrigger value="benchmarking" className="gap-2"><BarChart3 size={16} />Benchmarking</TabsTrigger>
      </TabsList>
      <TabsContent value="relatorios" className="mt-4">
        <ReportBuilder userScope="consultor" />
      </TabsContent>
      <TabsContent value="benchmarking" className="mt-4">
        <BenchmarkingSection userScope="consultor" />
      </TabsContent>
    </Tabs>
  </div>
);

export default ConsultorRelatorios;
