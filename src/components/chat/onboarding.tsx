import { useState } from "react";
import { MessageCircle, PieChart, Target } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FinaMark } from "@/components/brand";

const STEPS = [
  {
    icon: MessageCircle,
    title: "Converse como no WhatsApp",
    text: "Conte seus gastos e ganhos do seu jeito: “Gastei R$ 50 no almoço” ou “Recebi R$ 2.500 de salário”. Eu anoto tudo.",
  },
  {
    icon: PieChart,
    title: "Veja para onde vai o dinheiro",
    text: "No Painel você vê seu saldo, gastos por categoria e como seus meses estão evoluindo.",
  },
  {
    icon: Target,
    title: "Realize seus planos",
    text: "Crie metas como uma viagem ou uma reserva de emergência e acompanhe o progresso.",
  },
];

export function OnboardingDialog({ open, name, onDone }: { open: boolean; name: string; onDone: () => void }) {
  const [step, setStep] = useState(-1);
  const isIntro = step === -1;
  const current = step >= 0 ? STEPS[step] : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDone()}>
      <DialogContent className="max-w-md rounded-3xl p-8">
        {isIntro || !current ? (
          <div className="flex flex-col items-center text-center">
            <FinaMark className="size-20" />
            <DialogTitle className="mt-5 font-display text-2xl">Oi{name ? `, ${name.split(" ")[0]}` : ""}! Eu sou a Fina.</DialogTitle>
            <DialogDescription className="mt-2 text-base">
              Vou te ajudar a organizar seu dinheiro sem planilhas e sem complicação.
            </DialogDescription>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <current.icon className="size-8" />
            </span>
            <DialogTitle className="mt-5 font-display text-2xl">{current.title}</DialogTitle>
            <DialogDescription className="mt-2 text-base">{current.text}</DialogDescription>
          </div>
        )}
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {[-1, 0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-border"}`} />
          ))}
        </div>
        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : onDone())}
        >
          {isIntro ? "Vamos começar" : step < STEPS.length - 1 ? "Próximo" : "Fazer meu primeiro registro"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
