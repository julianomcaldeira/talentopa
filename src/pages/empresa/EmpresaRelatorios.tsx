import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { PresetReportRunner } from "@/components/reports/PresetReportRunner";
import { BenchmarkingSection } from "@/components/reports/BenchmarkingSection";
import { FileSpreadsheet, BarChart3, LayoutTemplate } from "lucide-react";

const EmpresaRelatorios = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
      <p className="text-muted-foreground text-sm mt-1">Acompanhe seus projetos e compare com o mercado.</p>
    </div>
    <Tabs defaultValue="padrao">
      <TabsList>
        <TabsTrigger value="padrao" className="gap-2"><LayoutTemplate size={16} />Relatórios Padrão</TabsTrigger>
        <TabsTrigger value="custom" className="gap-2"><FileSpreadsheet size={16} />Personalizado</TabsTrigger>
        <TabsTrigger value="benchmarking" className="gap-2"><BarChart3 size={16} />Benchmarking</TabsTrigger>
      </TabsList>
      <TabsContent value="padrao" className="mt-4">
        <PresetReportRunner userScope="empresa" />
      </TabsContent>
      <TabsContent value="custom" className="mt-4">
        <ReportBuilder userScope="empresa" />
      </TabsContent>
      <TabsContent value="benchmarking" className="mt-4">
        <BenchmarkingSection userScope="empresa" />
      </TabsContent>
    </Tabs>
  </div>
);

export default EmpresaRelatorios;
