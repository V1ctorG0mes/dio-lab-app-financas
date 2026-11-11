import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ActionCard } from "@/components/chat/action-card";
import { OnboardingDialog } from "@/components/chat/onboarding";
import { FinaMark } from "@/components/brand";
import { messagesQuery, profileQuery } from "@/lib/queries";
import type { ChatMessage, ChatStreamEvent } from "@/lib/chat-types";
import { todayISO } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Conversa — Fina" },
      { name: "description", content: "Converse com a Fina para registrar gastos, receitas e metas." },
      { property: "og:title", content: "Conversa — Fina" },
      { property: "og:description", content: "Converse com a Fina para registrar gastos, receitas e metas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(messagesQuery),
      context.queryClient.ensureQueryData(profileQuery),
    ]),
  component: ChatPage,
});

const SUGGESTIONS = [
  "Gastei R$ 50 no almoço",
  "Recebi R$ 2500 de salário",
  "Quanto gastei este mês?",
  "Quero juntar R$ 3000 para uma viagem",
  "Me dá uma dica para economizar",
];

type Status = "ready" | "submitted" | "streaming" | "error";

function ChatPage() {
  const qc = useQueryClient();
  const { data: initial } = useSuspenseQuery(messagesQuery);
  const { data: profile } = useSuspenseQuery(profileQuery);
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [status, setStatus] = useState<Status>("ready");
  const [onboardingOpen, setOnboardingOpen] = useState(!profile.onboarded);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!onboardingOpen) focusInput();
  }, [onboardingOpen, focusInput]);

  async function finishOnboarding() {
    setOnboardingOpen(false);
    await supabase.from("profiles").update({ onboarded: true }).eq("id", profile.id);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        toast.error("Sua sessão expirou. Entre novamente.");
        return;
      }

      const now = new Date().toISOString();
      const userMsg: ChatMessage = { id: `local-u-${now}`, role: "user", content: text, actions: [], created_at: now };
      const draftId = `local-a-${now}`;
      const draft: ChatMessage = { id: draftId, role: "assistant", content: "", actions: [], created_at: now };
      setMessages((m) => [...m, userMsg]);
      setStatus("submitted");
      focusInput();

      const controller = new AbortController();
      abortRef.current = controller;
      let started = false;
      const patchDraft = (fn: (d: ChatMessage) => ChatMessage) => {
        setMessages((m) => {
          if (!started) {
            started = true;
            return [...m, fn(draft)];
          }
          return m.map((x) => (x.id === draftId ? fn(x) : x));
        });
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: text, today: todayISO() }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        setStatus("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as ChatStreamEvent;
            if (ev.type === "text") patchDraft((d) => ({ ...d, content: d.content + ev.delta }));
            else if (ev.type === "tool-start")
              patchDraft((d) => ({
                ...d,
                actions: [...d.actions, { id: ev.id, name: ev.name, input: ev.input, state: "input-available" }],
              }));
            else if (ev.type === "tool-end") {
              patchDraft((d) => ({
                ...d,
                actions: d.actions.map((a) => {
                  if (a.id !== ev.id) return a;
                  const updated = {
                    ...a,
                    output: ev.output,
                    state: ev.error ? ("output-error" as const) : ("output-available" as const),
                  };
                  if (ev.error) Object.assign(updated, { error: ev.error });
                  return updated;
                }),
              }));
              qc.invalidateQueries({ queryKey: ["transactions"] });
              qc.invalidateQueries({ queryKey: ["goals"] });
            } else if (ev.type === "done") {
              finished = true;
              setMessages((m) => {
                const next = started ? m.map((x) => (x.id === draftId ? ev.message : x)) : [...m, ev.message];
                qc.setQueryData(messagesQuery.queryKey, next);
                return next;
              });
              started = true;
            } else if (ev.type === "error") {
              toast.error(ev.message);
            }
          }
        }
        setStatus(finished ? "ready" : "error");
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus("ready");
        } else {
          console.error(err);
          toast.error("Não consegui enviar sua mensagem. Verifique a internet e tente de novo.");
          setStatus("error");
        }
      } finally {
        abortRef.current = null;
        focusInput();
      }
    },
    [busy, qc, focusInput],
  );

  function onSubmit(msg: PromptInputMessage) {
    // Throwing keeps the typed text in the box (the input only clears on success).
    if (busy || !msg.text.trim()) throw new Error("not-ready");
    void send(msg.text);
  }

  const showTyping = status === "submitted" || (status === "streaming" && messages[messages.length - 1]?.role === "user");

  return (
    <div className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col md:h-dvh">
      <header className="flex items-center gap-3 border-b bg-card/80 px-5 py-3 backdrop-blur md:px-8">
        <FinaMark className="size-10" />
        <div>
          <p className="font-display text-lg leading-tight font-bold">Fina</p>
          <p className="text-sm text-muted-foreground">Sua assistente financeira</p>
        </div>
      </header>

      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:px-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center px-2 pt-6 text-center animate-rise">
              <FinaMark className="size-20" />
              <h1 className="mt-5 text-2xl font-bold md:text-3xl">
                Oi{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}! Como foi seu dia com o dinheiro?
              </h1>
              <p className="mt-2 max-w-md text-muted-foreground">
                Me conte um gasto ou um ganho do jeito que você falaria com um amigo. Eu organizo o resto.
              </p>
              <div className="mt-6 grid w-full max-w-md gap-2">
                {SUGGESTIONS.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="surface px-4 py-3.5 text-left font-medium transition-colors hover:bg-secondary"
                  >
                    “{s}”
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              {m.role === "assistant" && m.actions.length > 0 && (
                <div className="grid gap-2">
                  {m.actions.map((a) => (
                    <ActionCard key={a.id} action={a} />
                  ))}
                </div>
              )}
              {m.content && (
                <MessageContent>
                  {m.role === "assistant" ? (
                    <MessageResponse>{m.content}</MessageResponse>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </MessageContent>
              )}
            </Message>
          ))}

          {showTyping && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Fina está pensando...</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-background/95 px-4 pt-3 pb-4 backdrop-blur md:px-8">
        <div className="mx-auto grid w-full max-w-3xl gap-3">
          <Suggestions>
            {SUGGESTIONS.map((s) => (
              <Suggestion key={s} suggestion={s} onClick={send} disabled={busy} className="h-10 bg-card text-sm" />
            ))}
          </Suggestions>
          <PromptInputProvider>
          <PromptInput onSubmit={onSubmit} className="rounded-2xl bg-card shadow-soft">
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Ex.: Gastei R$ 40 com remédios"
              className="min-h-14 px-4 text-base"
              aria-label="Mensagem para a Fina"
            />
            <PromptInputFooter className="justify-end px-2 pb-2">
              <PromptInputSubmit
                {...(status === "streaming" || status === "submitted" ? { status } : {})}
                {...(busy ? { onStop: () => abortRef.current?.abort() } : {})}
                className="size-10 rounded-xl"
                aria-label={busy ? "Parar" : "Enviar"}
              />
            </PromptInputFooter>
          </PromptInput>
          </PromptInputProvider>
        </div>
      </div>

      <OnboardingDialog open={onboardingOpen} name={profile.name} onDone={finishOnboarding} />
    </div>
  );
}
