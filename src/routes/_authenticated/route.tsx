import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { MessageCircle, PieChart, Target, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const isDev = localStorage.getItem("fina_dev_guest") === "true";
    if (isDev) {
      return { user: { id: "dev-guest-user", email: "visitante@fina.app" } };
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AppShell,
});

const NAV = [
  { to: "/chat", label: "Conversa", icon: MessageCircle },
  { to: "/painel", label: "Painel", icon: PieChart },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/perfil", label: "Perfil", icon: UserRound },
] as const;

function useLiveFinanceUpdates() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`finance-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () =>
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () =>
        qc.invalidateQueries({ queryKey: ["goals"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

function AppShell() {
  useLiveFinanceUpdates();
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop side nav */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-4 py-6 md:flex">
        <Link to="/chat" className="mb-8 px-2">
          <Brand />
        </Link>
        <nav className="grid gap-1" aria-label="Principal">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex h-12 items-center gap-3 rounded-xl px-3 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-accent !text-accent-foreground" }}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex h-[4.5rem] flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground",
                )}
                activeProps={{ className: "!text-primary" }}
              >
                <Icon className="size-6" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
