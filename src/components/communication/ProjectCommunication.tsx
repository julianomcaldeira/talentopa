import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectChat } from "./ProjectChat";
import { ProjectQuestions } from "./ProjectQuestions";
import { ProjectInternalChat } from "./ProjectInternalChat";
import { MessageSquare, ClipboardList, Building2 } from "lucide-react";

interface ProjectCommunicationProps {
  projetoId: string;
  projetoNome: string;
  isEmpresa: boolean;
  empresaUserId?: string;
}

export const ProjectCommunication = ({ projetoId, projetoNome, isEmpresa, empresaUserId }: ProjectCommunicationProps) => {
  const showInternal = isEmpresa && !!empresaUserId;
  const defaultTab = showInternal ? "interno" : "chat";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`w-full rounded-none border-b border-border bg-muted/30 h-11`}>
          {showInternal && (
            <TabsTrigger value="interno" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-background">
              <Building2 size={14} /> Equipe interna
            </TabsTrigger>
          )}
          <TabsTrigger value="chat" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-background">
            <MessageSquare size={14} /> {isEmpresa ? "Chat com consultor" : "Chat"}
          </TabsTrigger>
          <TabsTrigger value="formulario" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-background">
            <ClipboardList size={14} /> Formulário
          </TabsTrigger>
        </TabsList>
        {showInternal && (
          <TabsContent value="interno" className="mt-0">
            <ProjectInternalChat projetoId={projetoId} projetoNome={projetoNome} empresaUserId={empresaUserId!} />
          </TabsContent>
        )}
        <TabsContent value="chat" className="mt-0">
          <ProjectChat projetoId={projetoId} projetoNome={projetoNome} />
        </TabsContent>
        <TabsContent value="formulario" className="mt-0 p-4">
          <ProjectQuestions projetoId={projetoId} isEmpresa={isEmpresa} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
