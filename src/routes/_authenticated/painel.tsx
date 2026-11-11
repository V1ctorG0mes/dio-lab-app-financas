import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Lightbulb, MessageCircle, PartyPopper, Trash2, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { transactionsQuery } from "@/lib/queries";
import { balance, buildInsights, formatBRL, monthKey, monthlySeries, summarizeMonth, todayISO, type Insight } from "@/lib/finance";
import { categoryStyle } from "@/lib/category-style";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Fina" },
      { name: "description", content: "Seu saldo, receitas, despesas e gastos por categoria em um só lugar." },
      { property: "og:title", content: "Painel — Fina" },
      { property: "og:description", content: "Seu saldo, receitas, despesas e gastos por categoria em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(transactionsQuery),
  component: DashboardPage,
});

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function DashboardPage() {
  const qc = useQueryClient();
  const { data: txs } = useSuspenseQuery(transactionsQuery);
  const month = monthKey(todayISO());
  const monthName = MONTH_NAMES[Number(month.slice(5)) - 1];

  const { summary, total, series, insights } = useMemo(
    () => ({
      summary: summarizeMonth(txs, month),
      total: balance(txs),
      series: monthlySeries(txs, month, 6),
      insights: buildInsights(txs, month),
    }),
    [txs, month],
  );

  async function remove(id: string) {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar.");
      return;
    }
    toast.success("Movimentação apagada.");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-10">
      <PageHeader title="Painel" subtitle={`Resumo de ${monthName}`} />

      <div className="grid gap-4 px-5 md:px-10">
        {/* Balance */}
        <section className="surface relative overflow-hidden bg-primary p-6 text-primary-foreground md:p-8 animate-rise" aria-label="Saldo atual">
          <div className="flex items-center gap-2 opacity-90">
            <Wallet className="size-5" />
            <span className="font-medium">Saldo atual</span>
          </div>
          <p className="mt-3 font-display text-4xl font-bold tabular md:text-5xl">{formatBRL(total)}</p>
          <p className="mt-2 opacity-85">
            {summary.net >= 0 ? "Sobrou " : "Faltou "}
            <strong className="tabular">{formatBRL(Math.abs(summary.net))}</strong> neste mês
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Receitas do mês" value={summary.income} tone="income" />
          <StatCard label="Despesas do mês" value={summary.expense} tone="expense" />
        </div>

        {/* Insights */}
        <section className="surface p-5 md:p-6" aria-label="Insights financeiros">
          <h2 className="text-lg font-bold">O que a Fina percebeu</h2>
          <ul className="mt-4 grid gap-3">
            {insights.map((i) => (
              <InsightRow key={i.text} insight={i} />
            ))}
          </ul>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Category chart */}
          <section className="surface p-5 md:p-6" aria-label="Gastos por categoria">
            <h2 className="text-lg font-bold">Gastos por categoria</h2>
            {summary.byCategory.length === 0 ? (
              <EmptyChart text="Nenhum gasto registrado neste mês ainda." />
            ) : (
              <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
                <div className="size-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summary.byCategory} dataKey="amount" nameKey="category" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                        {summary.byCategory.map((c) => (
                          <Cell key={c.category} fill={categoryStyle(c.category).color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="grid w-full gap-2.5">
                  {summary.byCategory.map((c) => {
                    const pct = Math.round((c.amount / summary.expense) * 100);
                    const { icon: Icon, color } = categoryStyle(c.category);
                    return (
                      <li key={c.category} className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-lg bg-secondary" style={{ color }}>
                          <Icon className="size-4" />
                        </span>
                        <span className="flex-1 font-medium">{c.category}</span>
                        <span className="text-sm text-muted-foreground tabular">{pct}%</span>
                        <span className="w-24 text-right font-semibold tabular">{formatBRL(c.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Monthly chart */}
          <section className="surface p-5 md:p-6" aria-label="Evolução mensal">
            <h2 className="text-lg font-bold">Evolução mensal</h2>
            <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-income" /> Receitas</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-expense" /> Despesas</span>
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} barGap={4}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 13 }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} cursor={{ fill: "var(--secondary)" }} contentStyle={tooltipStyle} />
                  <Bar dataKey="income" name="Receitas" fill="var(--income)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expense" name="Despesas" fill="var(--expense)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Recent */}
        <section className="surface p-5 md:p-6" aria-label="Últimas movimentações">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Últimas movimentações</h2>
          </div>
          {txs.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-muted-foreground">Você ainda não registrou nada.</p>
              <Button asChild>
                <Link to="/chat"><MessageCircle /> Registrar no chat</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-3 divide-y">
              {txs.slice(0, 12).map((t) => {
                const { icon: Icon, color } = categoryStyle(t.category);
                return (
                  <li key={t.id} className="group flex items-center gap-3 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary" style={{ color }}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.description || t.category}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.category} · {t.date.split("-").reverse().slice(0, 2).join("/")}
                      </p>
                    </div>
                    <span className={cn("font-semibold tabular", t.type === "income" ? "text-income" : "text-foreground")}>
                      {t.type === "income" ? "+" : "−"} {formatBRL(t.amount)}
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Apagar ${t.description}`} onClick={() => remove(t.id)} className="text-muted-foreground">
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "var(--shadow-soft)",
  color: "var(--foreground)",
};

function StatCard({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  const Icon = tone === "income" ? ArrowDownLeft : ArrowUpRight;
  return (
    <section className="surface p-4 md:p-6" aria-label={label}>
      <span className={cn("grid size-9 place-items-center rounded-xl", tone === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense")}>
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular md:text-2xl">{formatBRL(value)}</p>
    </section>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const map = {
    alert: { icon: AlertTriangle, cls: "bg-expense-soft text-expense" },
    good: { icon: PartyPopper, cls: "bg-income-soft text-income" },
    tip: { icon: Lightbulb, cls: "bg-gold-soft text-foreground" },
  } as const;
  const { icon: Icon, cls } = map[insight.tone];
  return (
    <li className="flex items-start gap-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", cls)}>
        <Icon className="size-5" />
      </span>
      <p className="pt-1.5 leading-snug">{insight.text}</p>
    </li>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <p className="py-10 text-center text-muted-foreground">{text}</p>;
}
