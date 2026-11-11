import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { LogOut, MessageSquareX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Fina" },
      { name: "description", content: "Seus dados, preferências e configurações da conta." },
      { property: "og:title", content: "Perfil — Fina" },
      { property: "og:description", content: "Seus dados, preferências e configurações da conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useSuspenseQuery(profileQuery);
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Dados salvos!");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function toggleTips(v: boolean) {
    const { error } = await supabase.from("profiles").update({ tips_enabled: v }).eq("id", profile.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function clearChat() {
    if (!confirm("Apagar todo o histórico da conversa? Suas movimentações e metas continuam salvas.")) return;
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", profile.id);
    if (error) {
      toast.error("Não foi possível limpar.");
      return;
    }
    qc.setQueryData(["messages"], []);
    toast.success("Conversa apagada.");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <PageHeader title="Perfil" subtitle="Seus dados e preferências" />
      <div className="grid gap-4 px-5 md:px-10">
        <section className="surface p-5 md:p-6">
          <h2 className="text-lg font-bold">Seus dados</h2>
          <form onSubmit={saveName} className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="p-name">Nome</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-email">E-mail</Label>
              <Input id="p-email" value={profile.email} disabled />
            </div>
            <Button type="submit" disabled={saving || name.trim() === profile.name} className="justify-self-start">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </section>

        <section className="surface p-5 md:p-6">
          <h2 className="text-lg font-bold">Preferências</h2>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="p-tips" className="text-base">Dicas de educação financeira</Label>
              <p className="text-sm text-muted-foreground">A Fina inclui dicas curtas nas respostas.</p>
            </div>
            <Switch id="p-tips" checked={profile.tips_enabled} onCheckedChange={toggleTips} />
          </div>
        </section>

        <section className="surface p-5 md:p-6">
          <h2 className="text-lg font-bold">Configurações</h2>
          <div className="mt-4 grid gap-3">
            <Button variant="outline" size="lg" className="justify-start" onClick={clearChat}>
              <MessageSquareX /> Limpar histórico da conversa
            </Button>
            <Button variant="outline" size="lg" className="justify-start text-destructive" onClick={signOut}>
              <LogOut /> Sair da conta
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
