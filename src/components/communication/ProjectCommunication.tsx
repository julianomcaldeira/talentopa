import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectChat } from "./ProjectChat";
import { ProjectQuestions } from "./ProjectQuestions";
import { MessageSquare, ClipboardList } from "lucide-react";

interface ProjectCommunicationProps {
  projetoId: string;
  projetoNome: string;
  isEmpresa: boolean;
}

export const ProjectCommunication = ({ projetoId, projetoNome, isEmpresa }: ProjectCommunicationProps) => {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="w-full rounded-none border-b border-border bg-muted/30 h-11">
          <TabsTrigger value="chat" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-background">
            <MessageSquare size={14} /> Chat
          </TabsTrigger>
          <TabsTrigger value="formulario" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-background">
            <ClipboardList size={14} /> Formulário
          </TabsTrigger>
        </TabsList>
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
