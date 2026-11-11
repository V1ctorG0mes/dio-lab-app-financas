import { describe, expect, it } from "vitest";
import { balance, buildInsights, goalProgress, summarizeMonth, type Tx } from "@/lib/finance";

const tx = (p: Partial<Tx>): Tx => ({
  id: Math.random().toString(),
  type: "expense",
  category: "Outros",
  amount: 0,
  description: "",
  date: "2026-11-05",
  ...p,
});

describe("finance rules", () => {
  it("balance is total income minus total expense", () => {
    const txs = [tx({ type: "income", amount: 2500 }), tx({ amount: 50 }), tx({ amount: 40, date: "2026-10-01" })];
    expect(balance(txs)).toBe(2410);
  });

  it("month summary only counts that month and groups expenses by category", () => {
    const txs = [
      tx({ type: "income", amount: 2500, category: "Salário" }),
      tx({ amount: 50, category: "Alimentação" }),
      tx({ amount: 30, category: "Alimentação" }),
      tx({ amount: 99, category: "Lazer", date: "2026-10-20" }),
    ];
    const s = summarizeMonth(txs, "2026-11");
    expect(s.income).toBe(2500);
    expect(s.expense).toBe(80);
    expect(s.byCategory).toEqual([{ category: "Alimentação", amount: 80 }]);
  });

  it("goal progress is current over target, capped at 100%", () => {
    expect(goalProgress({ target_amount: 1000, current_amount: 250 })).toBe(25);
    expect(goalProgress({ target_amount: 1000, current_amount: 1500 })).toBe(100);
  });

  it("alerts when a category grows 20% or more versus last month", () => {
    const txs = [
      tx({ amount: 100, category: "Alimentação", date: "2026-10-10" }),
      tx({ amount: 120, category: "Alimentação", date: "2026-11-10" }),
    ];
    const texts = buildInsights(txs, "2026-11").map((i) => i.text);
    expect(texts).toContain("Seus gastos com Alimentação aumentaram 20% em relação ao mês passado.");
  });

  it("does not alert when growth is below 20%", () => {
    const txs = [
      tx({ amount: 100, category: "Alimentação", date: "2026-10-10" }),
      tx({ amount: 119, category: "Alimentação", date: "2026-11-10" }),
    ];
    const texts = buildInsights(txs, "2026-11").map((i) => i.text);
    expect(texts.some((t) => t.includes("aumentaram"))).toBe(false);
  });

  it("alerts when expenses exceed income in the month", () => {
    const txs = [tx({ type: "income", amount: 1000 }), tx({ amount: 1200 })];
    const insights = buildInsights(txs, "2026-11");
    expect(insights[0]).toEqual({ tone: "alert", text: expect.stringContaining("a mais do que recebeu") });
  });
});
