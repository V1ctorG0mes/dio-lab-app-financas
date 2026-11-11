import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, OrDivider } from "@/components/auth/auth-layout";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Fina" },
      { name: "description", content: "Crie sua conta grátis e comece a organizar suas finanças conversando." },
      { property: "og:title", content: "Criar conta — Fina" },
      { property: "og:description", content: "Crie sua conta grátis e comece a organizar suas finanças conversando." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/login` },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("registered")
          ? "Este e-mail já tem uma conta. Tente entrar."
          : "Não foi possível criar a conta. Verifique os dados e tente novamente.",
      );
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthLayout title="Confira seu e-mail" footer={<Link to="/login" className="font-semibold text-primary hover:underline">Voltar para entrar</Link>}>
        <div className="surface flex flex-col items-center gap-4 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
            <MailCheck className="size-7" />
          </span>
          <p>
            Enviamos um link de confirmação para <strong>{sentTo}</strong>. Clique nele para ativar sua conta e
            começar.
          </p>
          <p className="text-sm text-muted-foreground">Não chegou? Olhe a caixa de spam.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Leva menos de um minuto. Depois é só conversar."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-sm text-muted-foreground">Mínimo de 6 caracteres.</p>
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </Button>
      </form>
      <OrDivider />
      <SocialButtons />
    </AuthLayout>
  );
}
