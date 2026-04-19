import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { panelTab } from "@/lib/panelRegistry";
import { buildLoreChatPrompt, parseChatSegments, type LoreChatTurn } from "@/lib/loreChatContext";
import type { ChatMessage } from "@/types/lore";
import { Spinner } from "@/components/ui/FormWidgets";

interface LoreChatPanelProps {
  onClose: () => void;
}

const SUGGESTION_PROMPTS = [
  "Summarise the major factions in a paragraph.",
  "What gaps would you fill in next?",
  "Who are the most important characters and how are they connected?",
  "What tensions could drive new stories?",
];

function messageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function LoreChatPanel({ onClose }: LoreChatPanelProps) {
  const lore = useLoreStore((s) => s.lore);
  const articles = useLoreStore(selectArticles);
  const appendChatMessage = useLoreStore((s) => s.appendChatMessage);
  const clearChatSession = useLoreStore((s) => s.clearChatSession);
  const selectArticleInStore = useLoreStore((s) => s.selectArticle);
  const openTab = useProjectStore((s) => s.openTab);
  const project = useProjectStore((s) => s.project);

  const messages = lore?.chatSession?.messages ?? [];
  const articleCount = Object.keys(articles).length;

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.clearTimeout(t);
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => onClose(), 180);
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    };
    panel.addEventListener("keydown", onKey);
    return () => panel.removeEventListener("keydown", onKey);
  }, [handleClose]);

  useEffect(() => {
    const s = scrollRef.current;
    if (s) s.scrollTop = s.scrollHeight;
  }, [messages.length, busy]);

  const worldName = useMemo(() => {
    const setting = articles.world_setting;
    const fields = setting?.fields as { name?: unknown } | undefined;
    if (typeof fields?.name === "string" && fields.name.trim()) return fields.name.trim();
    if (setting?.title) return setting.title;
    return project?.name || "your world";
  }, [articles, project]);

  const handleCitation = useCallback(
    (articleId: string) => {
      selectArticleInStore(articleId);
      openTab(panelTab("lore"));
    },
    [selectArticleInStore, openTab],
  );

  const send = useCallback(
    async (prompt?: string) => {
      const q = (prompt ?? input).trim();
      if (!q || busy || !lore) return;

      const userMsg: ChatMessage = {
        id: messageId("u"),
        role: "user",
        content: q,
        createdAt: new Date().toISOString(),
      };
      appendChatMessage(userMsg);
      setInput("");
      setBusy(true);

      try {
        const history: LoreChatTurn[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const built = buildLoreChatPrompt(lore, q, history, { worldName });
        const response = await invoke<string>("llm_complete", {
          systemPrompt: built.systemPrompt,
          userPrompt: built.userPrompt,
          maxTokens: 1500,
        });
        appendChatMessage({
          id: messageId("a"),
          role: "assistant",
          content: response.trim(),
          createdAt: new Date().toISOString(),
          articlesReferenced: built.articlesUsed,
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        appendChatMessage({
          id: messageId("err"),
          role: "assistant",
          content: detail || "The archivist is silent — check your AI settings and try again.",
          createdAt: new Date().toISOString(),
          error: true,
        });
      } finally {
        setBusy(false);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [input, busy, lore, messages, appendChatMessage, worldName],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const bodyEmpty = messages.length === 0;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Lore chat assistant"
      className="fixed bottom-5 right-5 z-[75] flex flex-col rounded-2xl border border-[var(--chrome-stroke)] bg-bg-primary shadow-[var(--shadow-dialog)]"
      style={{
        width: "min(26rem, calc(100vw - 2.5rem))",
        height: "min(38rem, calc(100vh - 6rem))",
        transform: visible ? "translateY(0)" : "translateY(16px)",
        opacity: visible ? 1 : 0,
        transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease",
      }}
    >
      {/* Ember glow accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.14),transparent_70%)] blur-2xl"
      />

      {/* Header */}
      <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-[var(--chrome-stroke)] px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="font-display text-2xs uppercase tracking-ui text-accent">The Archivist</p>
          <h2 className="mt-0.5 truncate font-display text-base tracking-wide text-text-primary">
            Ask {worldName}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => clearChatSession()}
              className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-3xs text-text-muted transition hover:border-accent/40 hover:text-accent"
              aria-label="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="focus-ring rounded-full p-1.5 text-text-muted transition hover:text-text-primary"
            aria-label="Close lore chat"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body — messages */}
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {!lore ? (
          <EmptyState
            title="No world is open"
            body="Open a project to start a conversation with its archivist."
          />
        ) : articleCount === 0 ? (
          <EmptyState
            title="The archive is empty"
            body="Write an article or two before asking — there's nothing to recall yet."
          />
        ) : bodyEmpty ? (
          <SuggestionList onPick={(q) => void send(q)} />
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                articles={articles}
                onCitation={handleCitation}
              />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-2xs text-text-muted">
                <Spinner />
                <span>Consulting the archive…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--chrome-stroke)] px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={articleCount === 0 ? "Write some lore first…" : "Ask about a character, place, faction…"}
            disabled={busy || !lore || articleCount === 0}
            aria-label="Ask a question"
            className="ornate-input min-h-11 flex-1 resize-none px-3 py-2 text-xs text-text-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !input.trim() || !lore || articleCount === 0}
            aria-label="Send question"
            className="focus-ring flex h-11 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 px-3 text-xs font-display uppercase tracking-label text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Spinner /> : "Ask"}
          </button>
        </div>
        <p className="mt-2 text-3xs text-text-muted">
          Enter to send · Shift+Enter for a new line · Esc to close
        </p>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="font-display text-sm text-text-secondary">{title}</p>
      <p className="max-w-[18rem] text-2xs leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}

function SuggestionList({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <p className="px-1 text-2xs text-text-muted">
        The archivist answers from your lore. Try one of these, or ask your own:
      </p>
      <div className="flex flex-col gap-2">
        {SUGGESTION_PROMPTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="focus-ring rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]/40 px-3 py-2.5 text-left text-2xs leading-relaxed text-text-secondary transition hover:border-accent/40 hover:bg-[var(--chrome-fill)]/70 hover:text-text-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  articles,
  onCitation,
}: {
  message: ChatMessage;
  articles: Record<string, import("@/types/lore").Article>;
  onCitation: (articleId: string) => void;
}) {
  const isUser = message.role === "user";
  const isError = !!message.error;

  const segments = useMemo(
    () => (isUser ? null : parseChatSegments(message.content, articles)),
    [isUser, message.content, articles],
  );

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-text-primary"
            : isError
            ? "max-w-[90%] rounded-2xl rounded-bl-sm border border-status-error/40 bg-status-error/5 px-3 py-2 text-xs leading-relaxed text-status-error"
            : "max-w-[90%] rounded-2xl rounded-bl-sm border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]/60 px-3 py-2 text-xs leading-relaxed text-text-primary"
        }
      >
        {isUser
          ? message.content.split(/\n+/).map((line, i) => (
              <p key={i} className={i > 0 ? "mt-1" : undefined}>{line}</p>
            ))
          : renderAssistantBody(segments!, onCitation)}
      </div>
    </div>
  );
}

function renderAssistantBody(
  segments: ReturnType<typeof parseChatSegments>,
  onCitation: (articleId: string) => void,
) {
  const paragraphs: Array<Array<{ k: string; node: React.ReactNode }>> = [[]];
  let keyCounter = 0;
  for (const seg of segments) {
    if (seg.kind === "text") {
      const pieces = seg.text.split(/\n{2,}/);
      pieces.forEach((piece, i) => {
        if (i > 0) paragraphs.push([]);
        const current = paragraphs[paragraphs.length - 1]!;
        // Preserve single newlines as <br/>
        const lines = piece.split(/\n/);
        lines.forEach((line, j) => {
          if (j > 0) current.push({ k: `br-${keyCounter++}`, node: <br /> });
          if (line) current.push({ k: `t-${keyCounter++}`, node: line });
        });
      });
    } else {
      const current = paragraphs[paragraphs.length - 1]!;
      current.push({
        k: `cite-${keyCounter++}`,
        node: seg.articleId ? (
          <button
            type="button"
            onClick={() => onCitation(seg.articleId!)}
            className="focus-ring rounded px-0.5 font-medium text-accent underline decoration-accent/40 decoration-dotted underline-offset-2 transition hover:bg-accent/10 hover:decoration-accent"
          >
            {seg.text}
          </button>
        ) : (
          <span>[{seg.text}]</span>
        ),
      });
    }
  }
  return paragraphs.map((parts, i) => (
    <p key={i} className={i > 0 ? "mt-2" : undefined}>
      {parts.map((p) => (
        <span key={p.k}>{p.node}</span>
      ))}
    </p>
  ));
}

export default LoreChatPanel;
