import { LayoutList, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "kanban";

export const ViewToggle = ({ value, onChange, className }: { value: ViewMode; onChange: (v: ViewMode) => void; className?: string }) => (
  <div className={cn("inline-flex items-center bg-muted/60 border border-border/60 rounded-lg p-0.5", className)}>
    <button
      type="button"
      onClick={() => onChange("list")}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
        value === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <LayoutList size={12} /> Lista
    </button>
    <button
      type="button"
      onClick={() => onChange("kanban")}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
        value === "kanban" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <LayoutGrid size={12} /> Kanban
    </button>
  </div>
);
