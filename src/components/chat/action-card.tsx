import { ArrowDownLeft, ArrowUpRight, PiggyBank, Search, Target, Trash2 } from "lucide-react";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import type { ChatAction } from "@/lib/chat-types";
import { TOOL_LABELS } from "@/lib/chat-types";
import { formatBRL } from "@/lib/finance";

function titleFor(a: ChatAction): string {
  const i = a.input;
  if (a.state === "output-error") return `${TOOL_LABELS[a.name] ?? a.name} — não foi possível`;
  switch (a.name) {
    case "registrar_movimentacao":
      return `${i["tipo"] === "receita" ? "Receita" : "Despesa"} · ${String(i["categoria"] ?? "Outros")} · ${formatBRL(Number(i["valor"]) || 0)}`;
    case "criar_meta":
      return `Nova meta · ${String(i["titulo"] ?? "")} · ${formatBRL(Number(i["valor_alvo"]) || 0)}`;
    case "atualizar_meta":
      return `Meta ${String(i["titulo_meta"] ?? "")} · ${Number(i["valor"]) >= 0 ? "+" : ""}${formatBRL(Number(i["valor"]) || 0)}`;
    default:
      return TOOL_LABELS[a.name] ?? a.name;
  }
}

function IconFor({ a }: { a: ChatAction }) {
  const cls = "size-4 shrink-0";
  switch (a.name) {
    case "registrar_movimentacao":
      return a.input["tipo"] === "receita" ? (
        <ArrowDownLeft className={`${cls} text-income`} />
      ) : (
        <ArrowUpRight className={`${cls} text-expense`} />
      );
    case "criar_meta":
      return <Target className={`${cls} text-primary`} />;
    case "atualizar_meta":
      return <PiggyBank className={`${cls} text-primary`} />;
    case "apagar_movimentacao":
      return <Trash2 className={`${cls} text-muted-foreground`} />;
    default:
      return <Search className={`${cls} text-muted-foreground`} />;
  }
}

export function ActionCard({ action }: { action: ChatAction }) {
  return (
    <Tool defaultOpen={false}>
      <div className="flex items-center pl-3">
        <IconFor a={action} />
        <ToolHeader
          className="py-2.5 pl-2"
          type="dynamic-tool"
          toolName={action.name}
          state={action.state}
          title={titleFor(action)}
        />
      </div>
      <ToolContent>
        <ToolInput input={action.input} />
        <ToolOutput output={action.output} errorText={action.error} />
      </ToolContent>
    </Tool>
  );
}
