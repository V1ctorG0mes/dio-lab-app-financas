import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, OrDivider } from "@/components/auth/auth-layout";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Fina" },
      { name: "description", content: "Entre na sua conta Fina e continue organizando seu dinheiro." },
      { property: "og:title", content: "Entrar — Fina" },
      { property: "og:description", content: "Entre na sua conta Fina e continue organizando seu dinheiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Already signed in (or returning from Google / e-mail confirmation): go to the chat.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/chat", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("Email not confirmed")
          ? "Confirme seu e-mail antes de entrar. Veja sua caixa de entrada."
          : "E-mail ou senha incorretos.",
      );
      return;
    }
    navigate({ to: "/chat", replace: true });
  }

  return (
    <AuthLayout
      title="Que bom te ver!"
      subtitle="Entre para continuar cuidando do seu dinheiro."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-semibold text-primary underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-medium text-primary hover:underline">
              Esqueci a senha
            </button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to="/cadastro">Criar conta</Link>
        </Button>
      </form>
      <OrDivider />
      <div className="grid gap-3">
        <SocialButtons />
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full font-medium"
          onClick={() => {
            localStorage.setItem("fina_dev_guest", "true");
            navigate({ to: "/chat", replace: true });
          }}
        >
          Entrar como visitante
        </Button>
      </div>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={email} />
    </AuthLayout>
  );
}

function ForgotPasswordDialog({ open, onOpenChange, defaultEmail }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmail: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (open) setEmail(defaultEmail);
  }, [open, defaultEmail]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }
    toast.success("Enviamos um link para você criar uma nova senha.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Recuperar senha</DialogTitle>
          <DialogDescription>Informe seu e-mail e enviaremos um link para criar uma nova senha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="E-mail" />
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? "Enviando..." : "Enviar link"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
