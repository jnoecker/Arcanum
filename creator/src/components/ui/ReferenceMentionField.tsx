import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReferenceStore } from "@/stores/referenceStore";
import { detectMention, type MentionQuery } from "@/lib/referenceTokens";
import { REFERENCE_CATEGORIES, type ReferenceCategory, type ReferenceSubject } from "@/types/reference";

const CATEGORY_GLYPH: Record<ReferenceCategory, string> = Object.fromEntries(
  REFERENCE_CATEGORIES.map((c) => [c.id, c.glyph]),
) as Record<ReferenceCategory, string>;

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export interface ReferenceMentionFieldProps {
  value: string;
  /** Commit-on-blur (and Enter, single-line). */
  onCommit?: (value: string) => void;
  /** Live change on every keystroke (controlled mode). */
  onChange?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  dense?: boolean;
  className?: string;
  /** Skip the built-in ornate-input styling; use only `className`. */
  unstyled?: boolean;
  ariaLabel?: string;
  /** Forwarded for keys the mention dropdown doesn't consume (e.g. ⌘↵). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement & HTMLInputElement>) => void;
}

/**
 * Text field with `@reference` autocomplete. Drop-in for TextInput /
 * EditableTextArea: pass `onCommit` for blur-commit fields, or `onChange` for a
 * live-controlled field. Suggestions are drawn from the Reference Canon.
 */
export function ReferenceMentionField({
  value,
  onCommit,
  onChange,
  placeholder,
  multiline = false,
  rows = 4,
  dense = false,
  className,
  unstyled = false,
  ariaLabel,
  onKeyDown,
}: ReferenceMentionFieldProps) {
  const subjects = useReferenceStore((s) => s.subjects);
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  if (!focused && draft !== value) setDraft(value);

  const matches = useMemo(() => {
    if (!mention || subjects.length === 0) return [];
    const q = mention.query.toLowerCase();
    const pool = q
      ? subjects.filter((s) => s.token.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q))
      : subjects;
    return [...pool].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
  }, [mention, subjects]);

  useEffect(() => setActiveIndex(0), [mention?.start, mention?.query]);

  // Restore the caret after a programmatic insert.
  useLayoutEffect(() => {
    if (pendingCaret.current == null || !fieldRef.current) return;
    const pos = pendingCaret.current;
    pendingCaret.current = null;
    fieldRef.current.focus();
    fieldRef.current.setSelectionRange(pos, pos);
  }, [draft]);

  const open = mention != null && (matches.length > 0 || mention.query.length > 0) && subjects.length > 0;

  const syncMention = (el: HTMLTextAreaElement | HTMLInputElement) => {
    setMention(detectMention(el.value, el.selectionStart ?? el.value.length));
  };

  const emit = (next: string) => {
    setDraft(next);
    onChange?.(next);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    emit(e.target.value);
    syncMention(e.target);
  };

  const select = (subject: ReferenceSubject) => {
    const el = fieldRef.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? draft.length;
    const replacement = `@${subject.token} `;
    const next = draft.slice(0, mention.start) + replacement + draft.slice(caret);
    pendingCaret.current = mention.start + replacement.length;
    emit(next);
    setMention(null);
  };

  const commit = () => {
    if (onCommit && draft !== value) onCommit(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement & HTMLInputElement>) => {
    if (open && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        select(matches[activeIndex] ?? matches[0]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (!multiline && e.key === "Enter" && !open) commit();
    onKeyDown?.(e);
  };

  const inputClass = unstyled
    ? cx(multiline ? "resize-y" : "", className)
    : cx(
        "ornate-input w-full text-text-primary",
        multiline ? "resize-y leading-relaxed" : "",
        dense ? "min-h-9 px-2 py-1 text-xs" : "min-h-11 px-3 py-2 text-xs",
        className,
      );

  const sharedProps = {
    ref: fieldRef,
    value: draft,
    placeholder,
    "aria-label": ariaLabel,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onFocus: () => setFocused(true),
    onClick: (e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      syncMention(e.currentTarget),
    onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) syncMention(e.currentTarget);
    },
    onBlur: () => {
      setFocused(false);
      setMention(null);
      commit();
    },
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea {...sharedProps} rows={rows} className={inputClass} />
      ) : (
        <input {...sharedProps} type="text" className={inputClass} />
      )}

      {open && (
        <div
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border-default bg-[var(--chrome-fill)] p-1 shadow-lg"
          role="listbox"
        >
          {matches.length === 0 ? (
            <div className="px-2.5 py-2 text-2xs text-text-muted">
              No reference matches “@{mention?.query}”.
            </div>
          ) : (
            matches.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                // Keep focus in the field so blur-commit doesn't fire on click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cx(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs",
                  i === activeIndex ? "bg-accent/15 text-accent" : "text-text-secondary",
                )}
              >
                <span aria-hidden>{CATEGORY_GLYPH[s.category] ?? "✧"}</span>
                <span className="min-w-0 flex-1 truncate font-display tracking-wide-ui">{s.name}</span>
                <span className="shrink-0 font-mono text-2xs text-text-muted">@{s.token}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
