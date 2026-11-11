// Shared (client-safe) types for the finance chat stream.

export type ChatActionState = "input-available" | "output-available" | "output-error";

export interface ChatAction {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  state: ChatActionState;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: ChatAction[];
  created_at: string;
}

export type ChatStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool-start"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool-end"; id: string; output?: unknown; error?: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string };

export const TOOL_LABELS: Record<string, string> = {
  registrar_movimentacao: "Movimentação registrada",
  criar_meta: "Meta criada",
  atualizar_meta: "Meta atualizada",
  consultar_resumo: "Consultei suas finanças",
  apagar_movimentacao: "Movimentação apagada",
};
