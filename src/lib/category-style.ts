import {
  Banknote,
  BookOpen,
  Bus,
  HeartPulse,
  Home,
  Popcorn,
  ShoppingBag,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_STYLE: Record<string, { color: string; icon: LucideIcon }> = {
  Alimentação: { color: "var(--chart-2)", icon: UtensilsCrossed },
  Transporte: { color: "var(--chart-4)", icon: Bus },
  Moradia: { color: "var(--chart-1)", icon: Home },
  Saúde: { color: "var(--chart-3)", icon: HeartPulse },
  Educação: { color: "var(--chart-6)", icon: BookOpen },
  Lazer: { color: "var(--chart-5)", icon: Popcorn },
  Compras: { color: "var(--chart-7)", icon: ShoppingBag },
  Salário: { color: "var(--income)", icon: Banknote },
  Outros: { color: "var(--chart-8)", icon: Tag },
};

export function categoryStyle(c: string): { color: string; icon: LucideIcon } {
  return (CATEGORY_STYLE[c] ?? CATEGORY_STYLE["Outros"])!;
}
