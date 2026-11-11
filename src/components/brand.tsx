import logo from "@/assets/fina-logo.png";
import { cn } from "@/lib/utils";

export function FinaMark({ className }: { className?: string }) {
  return <img src={logo} alt="" aria-hidden width={256} height={256} className={cn("size-9 shrink-0", className)} />;
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <FinaMark />
      <span className="font-display text-xl font-bold tracking-tight">Fina</span>
    </span>
  );
}
