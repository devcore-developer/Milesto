"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Bot, MessageSquarePlus, Send, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useAIStatus,
  useAssistantAsk,
  useAssistantConversation,
  useAssistantConversations,
  useDeleteAssistantConversation,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Project assistant (Phase A6) — grounded Q&A with persisted threads. */
export function ProjectAssistant({ projectId }: { projectId: string }) {
  const { t, lang } = useI18n();
  const ai = useAIStatus();
  const conversations = useAssistantConversations(projectId);
  const ask = useAssistantAsk();
  const deleteConversation = useDeleteAssistantConversation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [localMessages, setLocalMessages] = useState<
    { role: "USER" | "ASSISTANT"; content: string }[]
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const thread = useAssistantConversation(activeId);

  // Open the newest thread by default once loaded.
  useEffect(() => {
    if (!activeId && !conversations.isLoading) {
      setActiveId(conversations.data?.conversations[0]?.id ?? null);
    }
  }, [conversations.data, activeId]);

  // Local view = server thread + optimistic pending exchange.
  useEffect(() => {
    if (thread.data) {
      setLocalMessages(
        thread.data.messages.map((m) => ({ role: m.role, content: m.content })),
      );
    }
  }, [thread.data?.conversation.id, thread.data?.messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [localMessages.length]);

  function send() {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setQuestion("");
    setLocalMessages((m) => [...m, { role: "USER", content: q }]);
    ask.mutate(
      { projectId, question: q, conversationId: activeId ?? undefined, language: lang },
      {
        onSuccess: (res) => {
          setActiveId(res.conversationId);
          setLocalMessages((m) => [
            ...m,
            { role: "ASSISTANT", content: res.answer },
          ]);
        },
        onError: () => {
          setLocalMessages((m) => m.slice(0, -1));
          setQuestion(q);
        },
      },
    );
  }

  const aiReady = Boolean(ai.data?.configured);
  const messages = thread.isLoading && !localMessages.length ? [] : localMessages;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4.5 text-primary" />
          {t("assistant.sectionTitle")}
        </CardTitle>
        <CardDescription>{t("assistant.sectionDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!aiReady && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
            {t("assistant.notConfigured")}
          </p>
        )}

        {/* Threads */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setActiveId(null);
              setLocalMessages([]);
            }}
          >
            <MessageSquarePlus className="size-3.5" />
            {t("assistant.newConversation")}
          </Button>
          {activeId && (
            <>
              <span className="max-w-56 truncate text-xs text-slate-500" dir="auto">
                {thread.data?.conversation.title ??
                  conversations.data?.conversations.find((c) => c.id === activeId)?.title}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-red-500"
                aria-label={t("assistant.deleteConversation")}
                onClick={() =>
                  deleteConversation.mutate(
                    { conversationId: activeId, projectId },
                    {
                      onSuccess: () => {
                        setActiveId(null);
                        setLocalMessages([]);
                      },
                    },
                  )
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
          {(conversations.data?.conversations.length ?? 0) > 1 && (
            <select
              value={activeId ?? ""}
              onChange={(e) => {
                setActiveId(e.target.value || null);
                setLocalMessages([]);
              }}
              className="max-w-48 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              {conversations.data?.conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.messageCount})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Messages */}
        <div className="max-h-72 space-y-2.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          {messages.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              {t("assistant.empty")}
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2",
                m.role === "USER" ? "flex-row-reverse" : "",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  m.role === "USER" ? "bg-slate-200" : "bg-primary/10",
                )}
              >
                {m.role === "USER" ? (
                  <UserRound className="size-3.5 text-slate-500" />
                ) : (
                  <Bot className="size-3.5 text-primary" />
                )}
              </span>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-1.5 text-sm",
                  m.role === "USER"
                    ? "bg-primary text-primary-foreground"
                    : "border border-slate-200 bg-white text-slate-700",
                )}
              >
                {m.role === "ASSISTANT" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1">
                    <Markdown>{m.content}</Markdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap" dir="auto">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {ask.isPending && (
            <p className="text-xs text-slate-400">{t("assistant.thinking")}</p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Ask */}
        <div className="flex items-center gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t("assistant.placeholder")}
            disabled={!aiReady || ask.isPending}
          />
          <Button onClick={send} disabled={!aiReady || ask.isPending || !question.trim()}>
            {ask.isPending ? (
              <Bot className="size-4 animate-pulse" />
            ) : (
              <Send className="size-4 rtl:rotate-180" />
            )}
            {t("assistant.ask")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}