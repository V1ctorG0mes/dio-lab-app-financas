import {
  GatewayError,
  PaymentRequiredError,
  RateLimitError,
  streamResponse,
  type ResponsesInputItem,
} from "@lovable.dev/ai-gateway";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ChatAction, ChatStreamEvent } from "@/lib/chat-types";
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  balance,
  buildInsights,
  formatBRL,
  goalProgress,
  monthKey,
  shiftMonth,
  summarizeMonth,
  type Tx,
} from "@/lib/finance";

type DB = SupabaseClient<Database>;
type Emit = (event: ChatStreamEvent) => void;

const MODEL = "openai/gpt-6-astra" as const;
const MAX_STEPS = 6;
const HISTORY_LIMIT = 30;

/** Builds a Supabase client that acts as the signed-in user (RLS applies). */
export async function authenticate(authHeader: string | null) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend not configured");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (token.split(".").length !== 3) return null;

  const supabase = createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string };
}

const tools = [
  {
    type: "function" as const,
    name: "registrar_movimentacao",
    description:
      "Registra uma receita (dinheiro que entrou) ou despesa (dinheiro que saiu) do usuário. Use sempre que o usuário contar um gasto ou um recebimento com valor.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["tipo", "valor", "categoria", "descricao", "data"],
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"] },
        valor: { type: "number", description: "Valor positivo em reais, ex.: 50.9" },
        categoria: {
          type: "string",
          enum: [...ALL_CATEGORIES],
          description:
            "Para despesas use Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras ou Outros. Para receitas use Salário ou Outros.",
        },
        descricao: { type: "string", description: "Descrição curta, ex.: 'Almoço'" },
        data: { type: "string", description: "Data no formato AAAA-MM-DD" },
      },
    },
  },
  {
    type: "function" as const,
    name: "criar_meta",
    description: "Cria uma meta financeira (ex.: reserva de emergência, viagem, computador, curso).",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["titulo", "valor_alvo", "valor_atual", "prazo"],
      properties: {
        titulo: { type: "string" },
        valor_alvo: { type: "number" },
        valor_atual: { type: "number", description: "Quanto já tem guardado. Use 0 se não souber." },
        prazo: { type: ["string", "null"], description: "Data limite AAAA-MM-DD ou null" },
      },
    },
  },
  {
    type: "function" as const,
    name: "atualizar_meta",
    description:
      "Adiciona (valor positivo) ou retira (valor negativo) dinheiro guardado em uma meta existente, buscando pelo nome.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["titulo_meta", "valor"],
      properties: {
        titulo_meta: { type: "string" },
        valor: { type: "number" },
      },
    },
  },
  {
    type: "function" as const,
    name: "consultar_resumo",
    description:
      "Consulta saldo, receitas e despesas do mês atual e do anterior, gastos por categoria, metas e as últimas movimentações (com id). Use para responder perguntas, achar padrões e dar dicas.",
    strict: true,
    parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
  },
  {
    type: "function" as const,
    name: "apagar_movimentacao",
    description:
      "Apaga uma movimentação pelo id (obtenha o id com consultar_resumo). Use quando o usuário pedir para desfazer ou corrigir um registro.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
];

async function loadTxs(db: DB): Promise<Tx[]> {
  const { data, error } = await db
    .from("transactions")
    .select("id,type,category,amount,description,date")
    .order("date", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount), type: t.type as Tx["type"] }));
}

async function runTool(
  db: DB,
  userId: string,
  today: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "registrar_movimentacao": {
      const valor = Number(args["valor"]);
      if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor inválido");
      const type = args["tipo"] === "receita" ? "income" : "expense";
      let category = String(args["categoria"] ?? "Outros");
      if (!(ALL_CATEGORIES as readonly string[]).includes(category)) category = "Outros";
      if (type === "expense" && !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) category = "Outros";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args["data"])) ? String(args["data"]) : today;
      const { data, error } = await db
        .from("transactions")
        .insert({
          user_id: userId,
          type,
          category,
          amount: Math.round(valor * 100) / 100,
          description: String(args["descricao"] ?? "").slice(0, 200),
          date,
        })
        .select("id,type,category,amount,description,date")
        .single();
      if (error) throw new Error(error.message);
      const txs = await loadTxs(db);
      return {
        registrado: { ...data, amount: Number(data.amount) },
        primeira_movimentacao: txs.length === 1,
        saldo_atual: formatBRL(balance(txs)),
      };
    }
    case "criar_meta": {
      const alvo = Number(args["valor_alvo"]);
      if (!Number.isFinite(alvo) || alvo <= 0) throw new Error("Valor da meta inválido");
      const atual = Math.max(0, Number(args["valor_atual"]) || 0);
      const prazo = typeof args["prazo"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args["prazo"]) ? args["prazo"] : null;
      const { data, error } = await db
        .from("goals")
        .insert({
          user_id: userId,
          title: String(args["titulo"] ?? "Meta").slice(0, 80),
          target_amount: alvo,
          current_amount: atual,
          deadline: prazo,
        })
        .select("id,title,target_amount,current_amount,deadline")
        .single();
      if (error) throw new Error(error.message);
      return { meta: data, progresso: `${goalProgress({ target_amount: alvo, current_amount: atual })}%` };
    }
    case "atualizar_meta": {
      const valor = Number(args["valor"]);
      if (!Number.isFinite(valor) || valor === 0) throw new Error("Valor inválido");
      const { data: goals, error } = await db.from("goals").select("id,title,target_amount,current_amount");
      if (error) throw new Error(error.message);
      const q = String(args["titulo_meta"] ?? "").toLowerCase();
      const goal =
        goals?.find((g) => g.title.toLowerCase() === q) ??
        goals?.find((g) => g.title.toLowerCase().includes(q) || q.includes(g.title.toLowerCase()));
      if (!goal) return { erro: "Meta não encontrada", metas_existentes: goals?.map((g) => g.title) ?? [] };
      const next = Math.max(0, Number(goal.current_amount) + valor);
      const { error: upErr } = await db.from("goals").update({ current_amount: next }).eq("id", goal.id);
      if (upErr) throw new Error(upErr.message);
      return {
        meta: goal.title,
        valor_atual: formatBRL(next),
        valor_alvo: formatBRL(Number(goal.target_amount)),
        progresso: `${goalProgress({ target_amount: Number(goal.target_amount), current_amount: next })}%`,
      };
    }
    case "consultar_resumo": {
      const txs = await loadTxs(db);
      const month = monthKey(today);
      const { data: goals } = await db.from("goals").select("title,target_amount,current_amount,deadline");
      return {
        saldo_total: balance(txs),
        mes_atual: summarizeMonth(txs, month),
        mes_anterior: summarizeMonth(txs, shiftMonth(month, -1)),
        insights: buildInsights(txs, month).map((i) => i.text),
        metas: (goals ?? []).map((g) => ({
          ...g,
          progresso: `${goalProgress({ target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) })}%`,
        })),
        ultimas_movimentacoes: txs.slice(0, 10),
      };
    }
    case "apagar_movimentacao": {
      const id = String(args["id"] ?? "");
      const { data, error } = await db.from("transactions").delete().eq("id", id).select("id,description,amount");
      if (error) throw new Error(error.message);
      if (!data?.length) return { erro: "Movimentação não encontrada" };
      return { apagado: data[0] };
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

function buildInstructions(name: string, today: string, tips: boolean) {
  return `Você é a Fina, uma assistente de finanças pessoais simpática, paciente e direta, que conversa em português do Brasil.
Usuário: ${name || "usuário"}. Hoje é ${today} (use para "hoje", "ontem", etc.). Moeda: reais (R$).

Seu papel:
- Quando o usuário contar um gasto ou recebimento com valor, registre com registrar_movimentacao (identifique tipo, valor, categoria e data). Não peça confirmação; registre e confirme em uma frase curta, ex.: "Anotado: R$ 50,00 em Alimentação (almoço)."
- Se faltar o valor, pergunte de forma simples. Nunca invente valores.
- Se a mensagem tiver várias movimentações, registre todas.
- Para perguntas sobre saldo, gastos, padrões ou metas, use consultar_resumo antes de responder.
- Metas: crie com criar_meta e atualize com atualizar_meta quando o usuário guardar ou retirar dinheiro.
- Para desfazer/corrigir, use consultar_resumo para achar o id e apagar_movimentacao (e registre de novo se for correção).
- Quando o resultado indicar primeira_movimentacao = true, comemore e dê o primeiro insight ou dica curta.
${tips ? "- Ensine educação financeira de forma leve: quando fizer sentido, inclua uma dica curta (1 frase) ou alerte sobre excessos (ex.: 'Seus gastos com Lazer subiram 20% neste mês')." : "- O usuário desativou dicas educativas: só dê dicas se ele pedir, mas ainda alerte sobre excessos importantes."}

Estilo: linguagem simples, sem jargões, frases curtas, no máximo 3 parágrafos curtos. Use **negrito** para valores importantes. Formate valores como R$ 1.234,56. Não use tabelas grandes. Não fale sobre investimentos complexos, bancos ou cartões; foque em organização do dia a dia.`;
}

function friendlyError(err: unknown): string {
  if (err instanceof PaymentRequiredError) return "O assistente está sem créditos no momento. Tente novamente mais tarde.";
  if (err instanceof RateLimitError) return "Muitas mensagens em pouco tempo. Espere alguns segundos e tente de novo.";
  if (err instanceof GatewayError) return "Não consegui falar com o assistente agora. Tente novamente em instantes.";
  return "Algo deu errado ao processar sua mensagem. Tente novamente.";
}

export async function runFinanceAgent(opts: {
  supabase: DB;
  userId: string;
  message: string;
  today: string;
  emit: Emit;
  signal?: AbortSignal;
}) {
  const { supabase: db, userId, message, today, emit, signal } = opts;

  const [{ data: profile }, { data: history, error: histErr }] = await Promise.all([
    db.from("profiles").select("name,tips_enabled").eq("id", userId).maybeSingle(),
    db
      .from("chat_messages")
      .select("role,content")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  if (histErr) throw new Error(histErr.message);

  const { error: insErr } = await db
    .from("chat_messages")
    .insert({ user_id: userId, role: "user", content: message });
  if (insErr) throw new Error(insErr.message);

  const input: ResponsesInputItem[] = [
    ...(history ?? [])
      .reverse()
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  const instructions = buildInstructions(profile?.name ?? "", today, profile?.tips_enabled ?? true);
  const actions: ChatAction[] = [];
  let content = "";

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const stream = await streamResponse(
        { model: MODEL, instructions, input, tools, reasoning: { effort: "low" } },
        signal ? { signal } : undefined,
      );
      const calls: { call_id: string; name: string; arguments: string }[] = [];
      let stepStarted = false;
      for await (const ev of stream) {
        if (ev.type === "response.output_text.delta") {
          let delta = ev.delta;
          if (!stepStarted && content.length > 0) delta = "\n\n" + delta;
          stepStarted = true;
          content += delta;
          emit({ type: "text", delta });
        } else if (ev.type === "response.output_item.done" && ev.item.type === "function_call") {
          calls.push({ call_id: ev.item.call_id, name: ev.item.name, arguments: ev.item.arguments });
        }
      }
      if (calls.length === 0) break;

      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          args = {};
        }
        emit({ type: "tool-start", id: call.call_id, name: call.name, input: args });
        const action: ChatAction = { id: call.call_id, name: call.name, input: args, state: "input-available" };
        let output: unknown;
        try {
          output = await runTool(db, userId, today, call.name, args);
          action.output = output;
          action.state = "output-available";
          emit({ type: "tool-end", id: call.call_id, output });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro";
          output = { erro: msg };
          action.error = msg;
          action.state = "output-error";
          emit({ type: "tool-end", id: call.call_id, error: msg });
        }
        actions.push(action);
        input.push({ type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments });
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
      }
    }
  } catch (err) {
    if (err instanceof GatewayError) console.error("[finance-agent] gateway error", (err as any).code, (err as any).ids);
    else console.error("[finance-agent]", err);
    emit({ type: "error", message: friendlyError(err) });
    if (!content && actions.length === 0) return;
  }

  if (!content.trim()) content = actions.length ? "Pronto! Já atualizei suas informações." : "Desculpe, não entendi. Pode repetir?";

  const { data: saved, error: saveErr } = await db
    .from("chat_messages")
    .insert({ user_id: userId, role: "assistant", content, actions: actions as unknown as Json })
    .select("id,created_at")
    .single();
  if (saveErr) {
    console.error("[finance-agent] save failed", saveErr.message);
    emit({ type: "error", message: "Não consegui salvar a resposta no histórico." });
    return;
  }
  emit({
    type: "done",
    message: { id: saved.id, role: "assistant", content, actions, created_at: saved.created_at },
  });
}
