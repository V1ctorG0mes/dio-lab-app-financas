import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChatAction, ChatMessage } from "@/lib/chat-types";
import type { Goal, Tx } from "@/lib/finance";

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    if (localStorage.getItem("fina_dev_guest") === "true") {
      return {
        id: "dev-guest-user",
        name: "Visitante",
        email: "visitante@fina.app",
        onboarded: true,
        tips_enabled: true,
      };
    }
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("Sem sessão");
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (data) return { ...data, email: user.email ?? "" };
    // Profile row is created on signup; recreate it if missing (e.g. older accounts).
    const name = (user.user_metadata?.["name"] as string) ?? (user.user_metadata?.["full_name"] as string) ?? "";
    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({ id: user.id, name })
      .select("*")
      .single();
    if (insErr) throw insErr;
    return { ...created, email: user.email ?? "" };
  },
});

export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async (): Promise<Tx[]> => {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,type,category,amount,description,date")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount), type: t.type as Tx["type"] }));
  },
});

export const goalsQuery = queryOptions({
  queryKey: ["goals"],
  queryFn: async (): Promise<Goal[]> => {
    const { data, error } = await supabase
      .from("goals")
      .select("id,title,target_amount,current_amount,deadline")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((g) => ({
      ...g,
      target_amount: Number(g.target_amount),
      current_amount: Number(g.current_amount),
    }));
  },
});

export const messagesQuery = queryOptions({
  queryKey: ["messages"],
  queryFn: async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,role,content,actions,created_at")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((m) => ({
      id: m.id,
      role: m.role as ChatMessage["role"],
      content: m.content,
      actions: (Array.isArray(m.actions) ? m.actions : []) as unknown as ChatAction[],
      created_at: m.created_at,
    }));
  },
});
