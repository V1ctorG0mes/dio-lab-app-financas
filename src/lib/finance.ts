// Pure finance helpers shared by the dashboard, goals page and tests.

export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Outros",
] as const;

export const INCOME_CATEGORIES = ["Salário", "Outros"] as const;

export const ALL_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Salário",
  "Outros",
] as const;

export type Category = (typeof ALL_CATEGORIES)[number];
export type TxType = "income" | "expense";

export interface Tx {
  id: string;
  type: TxType;
  category: string;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
}

export interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(value: number): string {
  return brl.format(value);
}

/** "2026-11" for a YYYY-MM-DD date string. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [y = 0, m = 1] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function monthLabel(key: string): string {
  const [, m = 1] = key.split("-").map(Number);
  return MONTHS_SHORT[m - 1] ?? "";
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
  byCategory: { category: string; amount: number }[];
}

export function summarizeMonth(txs: Tx[], month: string): MonthSummary {
  let income = 0;
  let expense = 0;
  const cats = new Map<string, number>();
  for (const t of txs) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === "income") income += t.amount;
    else {
      expense += t.amount;
      cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
    }
  }
  const byCategory = [...cats.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);
  return { income: round2(income), expense: round2(expense), net: round2(income - expense), byCategory };
}

/** All-time balance: every income minus every expense. */
export function balance(txs: Tx[]): number {
  return round2(txs.reduce((acc, t) => acc + (t.type === "income" ? t.amount : -t.amount), 0));
}

export function monthlySeries(txs: Tx[], endMonth: string, months = 6) {
  const out: { month: string; label: string; income: number; expense: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonth(endMonth, -i);
    const s = summarizeMonth(txs, key);
    out.push({ month: key, label: monthLabel(key), income: s.income, expense: s.expense });
  }
  return out;
}

export function goalProgress(goal: Pick<Goal, "target_amount" | "current_amount">): number {
  if (goal.target_amount <= 0) return 0;
  return Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
}

export type InsightTone = "alert" | "good" | "tip";
export interface Insight {
  tone: InsightTone;
  text: string;
}

/** Threshold for "spending went up" alerts, in percent. */
export const INCREASE_ALERT_PCT = 20;

export function buildInsights(txs: Tx[], month: string): Insight[] {
  const insights: Insight[] = [];
  const cur = summarizeMonth(txs, month);
  const prev = summarizeMonth(txs, shiftMonth(month, -1));

  if (txs.length === 0) {
    return [
      {
        tone: "tip",
        text: "Comece contando um gasto no chat, por exemplo: “Gastei R$ 30 no almoço”.",
      },
    ];
  }

  if (cur.income > 0 && cur.expense > cur.income) {
    insights.push({
      tone: "alert",
      text: `Você gastou ${formatBRL(cur.expense - cur.income)} a mais do que recebeu neste mês.`,
    });
  }

  const prevMap = new Map(prev.byCategory.map((c) => [c.category, c.amount]));
  for (const c of cur.byCategory) {
    const before = prevMap.get(c.category) ?? 0;
    if (before <= 0) continue;
    const pct = Math.round(((c.amount - before) / before) * 100);
    if (pct >= INCREASE_ALERT_PCT) {
      insights.push({
        tone: "alert",
        text: `Seus gastos com ${c.category} aumentaram ${pct}% em relação ao mês passado.`,
      });
    }
  }

  if (cur.expense > 0 && cur.byCategory.length > 1) {
    const top = cur.byCategory[0];
    if (top) {
      const share = Math.round((top.amount / cur.expense) * 100);
      if (share >= 40) {
        insights.push({
          tone: "tip",
          text: `${top.category} representa ${share}% dos seus gastos do mês. Vale olhar com carinho.`,
        });
      }
    }
  }

  if (cur.income > 0) {
    const savedPct = Math.round(((cur.income - cur.expense) / cur.income) * 100);
    if (savedPct >= 20) {
      insights.push({
        tone: "good",
        text: `Ótimo! Você guardou ${savedPct}% do que recebeu neste mês.`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      tone: "tip",
      text: "Dica: tente guardar pelo menos 10% de tudo que entrar. Pequenos valores viram grandes reservas.",
    });
  }
  return insights;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
