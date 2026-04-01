import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { invoke } from "@tauri-apps/api/core";
import { useLoreStore } from "@/stores/loreStore";
import { LORE_ENHANCE_PROMPT } from "@/lib/lorePrompts";
import { tiptapToPlainText, plainTextToTiptap } from "@/lib/loreRelations";
import { MentionList, type MentionListRef } from "./MentionList";

interface LoreEditorProps {
  value: string;
  onCommit: (json: string) => void;
  placeholder?: string;
  /** System prompt for generating text from scratch. */
  generateSystemPrompt?: string;
  /** User prompt for generation. */
  generateUserPrompt?: string;
  /** Extra context appended to the user prompt. */
  context?: string;
}

// ─── Toolbar button ─────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      aria-label={title}
      className={`rounded px-2 py-1 text-xs transition-colors ${
        active
          ? "bg-accent/20 text-accent"
          : "text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Toolbar ────────────────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border-muted px-2 py-1">
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        H3
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border-muted" />
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border-muted" />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        &bull; List
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        1. List
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        &ldquo; Quote
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border-muted" />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        &mdash;
      </ToolbarButton>
    </div>
  );
}

// ─── Main editor ────────────────────────────────────────────────────

export function LoreEditor({
  value,
  onCommit,
  placeholder: placeholderText,
  generateSystemPrompt,
  generateUserPrompt,
  context,
}: LoreEditorProps) {
  const [loading, setLoading] = useState<"generate" | "enhance" | "continue" | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // Migrate plain text to Tiptap JSON on first render
  const initialContent = useRef(() => {
    if (!value) return undefined;
    if (value.startsWith("{")) {
      try { return JSON.parse(value); } catch { /* fall through */ }
    }
    // Plain text: wrap in Tiptap doc
    const json = plainTextToTiptap(value);
    return JSON.parse(json);
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-accent underline" },
      }),
      Placeholder.configure({
        placeholder: placeholderText ?? "Write here...",
        emptyEditorClass: "is-editor-empty",
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            const articles = useLoreStore.getState().lore?.articles ?? {};
            const q = query.toLowerCase();
            return Object.values(articles)
              .filter((a) => a.title.toLowerCase().includes(q))
              .slice(0, 8)
              .map((a) => ({ id: a.id, label: a.title }));
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          render: (): any => {
            let component: ReactRenderer<MentionListRef> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor as Editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onUpdate: (props: any) => {
                component?.updateProps(props);
                if (popup?.[0] && props.clientRect) {
                  popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                }
              },

              onKeyDown: (props: { event: KeyboardEvent }) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: initialContent.current(),
    editorProps: {
      attributes: {
        class: "lore-editor-content prose prose-sm prose-invert max-w-none px-3 py-2 outline-none min-h-[8rem]",
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = JSON.stringify(e.getJSON());
      commitRef.current(json);
    },
  });

  // Sync external value changes (e.g., from LLM generation)
  const lastExternalValue = useRef(value);
  useEffect(() => {
    if (!editor || value === lastExternalValue.current) return;
    lastExternalValue.current = value;

    // Avoid re-setting if the editor's own content matches
    const currentJson = JSON.stringify(editor.getJSON());
    if (currentJson === value) return;

    if (value && value.startsWith("{")) {
      try {
        editor.commands.setContent(JSON.parse(value));
        return;
      } catch { /* fall through */ }
    }
    // Plain text
    if (value) {
      editor.commands.setContent(JSON.parse(plainTextToTiptap(value)));
    } else {
      editor.commands.clearContent();
    }
  }, [editor, value]);

  // ─── LLM actions ─────────────────────────────────────────────────

  const plainText = editor ? tiptapToPlainText(JSON.stringify(editor.getJSON())) : "";
  const isEmpty = !plainText.trim();

  const handleGenerate = useCallback(async () => {
    if (!generateSystemPrompt || !generateUserPrompt) return;
    setLoading("generate");
    try {
      const parts = [generateUserPrompt];
      if (context) parts.push(`\nWorld context: ${context}`);
      const result = await invoke<string>("llm_complete", {
        systemPrompt: generateSystemPrompt,
        userPrompt: parts.join("\n"),
      });
      const trimmed = result.trim();
      const json = plainTextToTiptap(trimmed);
      lastExternalValue.current = json;
      editor?.commands.setContent(JSON.parse(json));
      commitRef.current(json);
    } catch {
      // Silent fail
    } finally {
      setLoading(null);
    }
  }, [editor, generateSystemPrompt, generateUserPrompt, context]);

  const handleEnhance = useCallback(async () => {
    if (!plainText) return;
    setLoading("enhance");
    try {
      const parts = [plainText];
      if (context) parts.push(`\nWorld context: ${context}`);
      const result = await invoke<string>("llm_complete", {
        systemPrompt: LORE_ENHANCE_PROMPT,
        userPrompt: parts.join("\n"),
      });
      const trimmed = result.trim();
      const json = plainTextToTiptap(trimmed);
      lastExternalValue.current = json;
      editor?.commands.setContent(JSON.parse(json));
      commitRef.current(json);
    } catch {
      // Silent fail
    } finally {
      setLoading(null);
    }
  }, [editor, plainText, context]);

  const handleContinue = useCallback(async () => {
    if (!plainText) return;
    setLoading("continue");
    try {
      const parts = [
        "Continue writing from where the author left off. Maintain the same voice, tone, and style. Do not repeat what was already written. Output only the new continuation text.\n",
        `Existing text:\n${plainText}`,
      ];
      if (context) parts.push(`\nWorld context: ${context}`);
      const result = await invoke<string>("llm_complete", {
        systemPrompt: "You are a world-building writer for a fantasy MUD game. Continue the author's text seamlessly. Match their voice and style. Output only the new paragraphs — do not repeat existing content.",
        userPrompt: parts.join("\n"),
      });
      // Append the continuation to existing content
      const continuation = result.trim();
      if (continuation && editor) {
        editor.commands.focus("end");
        editor.commands.insertContent(`<p></p><p>${continuation.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")}</p>`);
        const json = JSON.stringify(editor.getJSON());
        lastExternalValue.current = json;
        commitRef.current(json);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(null);
    }
  }, [editor, plainText, context]);

  const showGenerate = generateSystemPrompt && generateUserPrompt && isEmpty;
  const showEnhance = !isEmpty;
  const showContinue = !isEmpty;

  return (
    <div className="rounded-lg border border-border-default bg-bg-primary">
      {editor && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
      {(showGenerate || showEnhance || showContinue) && (
        <div className="flex gap-2 border-t border-border-muted px-2 py-1">
          {showGenerate && (
            <button
              onClick={handleGenerate}
              disabled={loading !== null}
              title="Generate content from scratch using AI"
              className="rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              {loading === "generate" ? "Generating..." : "Generate"}
            </button>
          )}
          {showContinue && (
            <button
              onClick={handleContinue}
              disabled={loading !== null}
              title="Continue writing from where you left off"
              className="rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              {loading === "continue" ? "Writing..." : "Continue"}
            </button>
          )}
          {showEnhance && (
            <button
              onClick={handleEnhance}
              disabled={loading !== null}
              title="Expand and enrich the existing text"
              className="rounded px-2 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              {loading === "enhance" ? "Enhancing..." : "Enhance"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
