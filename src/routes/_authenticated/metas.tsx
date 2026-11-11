import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { CalendarDays, Minus, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { goalsQuery } from "@/lib/queries";
import { formatBRL, goalProgress, type Goal } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Fina" },
      { name: "description", content: "Crie metas financeiras e acompanhe quanto falta para realizá-las." },
      { property: "og:title", content: "Metas — Fina" },
      { property: "og:description", content: "Crie metas financeiras e acompanhe quanto falta para realizá-las." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(goalsQuery),
  component: GoalsPage,
});

const IDEAS = ["Reserva de emergência", "Viagem", "Novo computador", "Curso"];

function parseMoney(v: string): number {
  return Number(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function GoalsPage() {
  const { data: goals } = useSuspenseQuery(goalsQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<{ goal: Goal; mode: "add" | "remove" } | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <PageHeader
        title="Metas"
        subtitle="Seus sonhos, um passo de cada vez."
        action={
          <Button onClick={() => setCreateOpen(true)} size="lg" className="hidden sm:inline-flex">
            <Plus /> Nova meta
          </Button>
        }
      />
      <div className="grid gap-4 px-5 md:px-10">
        <Button onClick={() => setCreateOpen(true)} size="xl" className="w-full sm:hidden">
          <Plus /> Nova meta
        </Button>

        {goals.length === 0 ? (
          <div className="surface flex flex-col items-center px-6 py-12 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Target className="size-8" />
            </span>
            <h2 className="mt-5 text-xl font-bold">Qual é o seu próximo objetivo?</h2>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Crie uma meta aqui ou peça no chat: “Quero juntar R$ 5.000 para uma reserva de emergência”.
            </p>
          </div>
        ) : (
          goals.map((g) => <GoalCard key={g.id} goal={g} onAdjust={(mode) => setAdjusting({ goal: g, mode })} />)
        )}
      </div>
      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AdjustDialog state={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}

function GoalCard({ goal, onAdjust }: { goal: Goal; onAdjust: (m: "add" | "remove") => void }) {
  const qc = useQueryClient();
  const pct = goalProgress(goal);
  const missing = Math.max(0, goal.target_amount - goal.current_amount);

  async function remove() {
    if (!confirm(`Apagar a meta "${goal.title}"?`)) return;
    const { error } = await supabase.from("goals").delete().eq("id", goal.id);
    if (error) {
      toast.error("Não foi possível apagar.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["goals"] });
  }

  return (
    <article className="surface p-5 md:p-6 animate-rise">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{goal.title}</h2>
          {goal.deadline && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" /> até {goal.deadline.split("-").reverse().join("/")}
            </p>
          )}
        </div>
        <span className="font-display text-3xl font-bold text-primary tabular">{pct}%</span>
      </div>
      <Progress value={pct} className="mt-4 h-3" aria-label={`${pct}% concluído`} />
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <strong className="tabular">{formatBRL(goal.current_amount)}</strong>
          <span className="text-muted-foreground"> de {formatBRL(goal.target_amount)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {missing > 0 ? `Faltam ${formatBRL(missing)}` : "Meta alcançada! 🎉"}
        </p>
      </div>
      <div className="mt-5 flex gap-2">
        <Button className="flex-1" onClick={() => onAdjust("add")}>
          <Plus /> Guardar
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => onAdjust("remove")} disabled={goal.current_amount <= 0}>
          <Minus /> Retirar
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Apagar meta ${goal.title}`} onClick={remove}>
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}

function CreateGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const target_amount = parseMoney(target);
    if (!title.trim() || target_amount <= 0) {
      toast.error("Informe um nome e um valor maior que zero.");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("goals").insert({
      user_id: u.user!.id,
      title: title.trim(),
      target_amount,
      current_amount: Math.max(0, parseMoney(current)),
      deadline: deadline || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível criar a meta.");
      return;
    }
    toast.success("Meta criada!");
    qc.invalidateQueries({ queryKey: ["goals"] });
    setTitle("");
    setTarget("");
    setCurrent("");
    setDeadline("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nova meta</DialogTitle>
          <DialogDescription>Dê um nome, defina o valor e acompanhe seu progresso.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="g-title">Nome da meta</Label>
            <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Viagem" required />
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((i) => (
                <button key={i} type="button" onClick={() => setTitle(i)} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-secondary">
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="g-target">Valor alvo (R$)</Label>
              <Input id="g-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="3000" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="g-current">Já tenho (R$)</Label>
              <Input id="g-current" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="g-deadline">Prazo (opcional)</Label>
            <Input id="g-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Salvando..." : "Criar meta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ state, onClose }: { state: { goal: Goal; mode: "add" | "remove" } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const isAdd = state?.mode === "add";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state) return;
    const v = parseMoney(value);
    if (v <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    const next = Math.max(0, state.goal.current_amount + (isAdd ? v : -v));
    const { error } = await supabase.from("goals").update({ current_amount: next }).eq("id", state.goal.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    toast.success(isAdd ? "Valor guardado!" : "Valor retirado.");
    qc.invalidateQueries({ queryKey: ["goals"] });
    setValue("");
    onClose();
  }

  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isAdd ? "Guardar dinheiro" : "Retirar dinheiro"}</DialogTitle>
          <DialogDescription>{state?.goal.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="adj">Valor (R$)</Label>
            <Input id="adj" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="100" required />
          </div>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Salvando..." : isAdd ? "Guardar" : "Retirar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
