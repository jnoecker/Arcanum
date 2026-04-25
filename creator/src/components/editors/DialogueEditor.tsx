import { memo, useCallback, useState } from "react";
import type {
  WorldFile,
  DialogueNodeFile,
  DialogueChoiceFile,
} from "@/types/world";
import { updateMob } from "@/lib/zoneEdits";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

interface DialogueEditorProps {
  mobId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}

export function DialogueEditor({
  mobId,
  world,
  onWorldChange,
}: DialogueEditorProps) {
  const mob = world.mobs?.[mobId];
  if (!mob) return null;

  const dialogue = mob.dialogue ?? {};
  const nodeIds = Object.keys(dialogue);

  const patchDialogue = useCallback(
    (next: Record<string, DialogueNodeFile> | undefined) => {
      onWorldChange(updateMob(world, mobId, { dialogue: next }));
    },
    [world, mobId, onWorldChange],
  );

  // ─── Node CRUD ──────────────────────────────────────────────────
  const handleAddNode = useCallback(
    (nodeId: string) => {
      if (!nodeId || dialogue[nodeId]) return;
      patchDialogue({ ...dialogue, [nodeId]: { text: "" } });
    },
    [dialogue, patchDialogue],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === "root") return; // never delete root
      const next: Record<string, DialogueNodeFile> = {};
      for (const [id, node] of Object.entries(dialogue)) {
        if (id === nodeId) continue;
        // Deep-copy choices to avoid mutating the original
        if (node.choices?.some((c) => c.next === nodeId)) {
          next[id] = {
            ...node,
            choices: node.choices.map((c) =>
              c.next === nodeId ? { ...c, next: undefined } : c,
            ),
          };
        } else {
          next[id] = node;
        }
      }
      patchDialogue(Object.keys(next).length > 0 ? next : undefined);
    },
    [dialogue, patchDialogue],
  );

  const handleRenameNode = useCallback(
    (oldId: string, newId: string) => {
      if (!newId || newId === oldId || dialogue[newId]) return;
      const next: Record<string, DialogueNodeFile> = {};
      for (const [id, node] of Object.entries(dialogue)) {
        // Deep-copy choices to avoid mutating the original
        const updated =
          node.choices?.some((c) => c.next === oldId)
            ? {
                ...node,
                choices: node.choices!.map((c) =>
                  c.next === oldId ? { ...c, next: newId } : c,
                ),
              }
            : node;
        next[id === oldId ? newId : id] = updated;
      }
      patchDialogue(next);
    },
    [dialogue, patchDialogue],
  );

  const handleUpdateNodeText = useCallback(
    (nodeId: string, text: string) => {
      patchDialogue({
        ...dialogue,
        [nodeId]: { ...dialogue[nodeId], text },
      });
    },
    [dialogue, patchDialogue],
  );

  // ─── Choice CRUD ────────────────────────────────────────────────
  const handleAddChoice = useCallback(
    (nodeId: string) => {
      const node = dialogue[nodeId];
      if (!node) return;
      const choices: DialogueChoiceFile[] = [
        ...(node.choices ?? []),
        { text: "" },
      ];
      patchDialogue({
        ...dialogue,
        [nodeId]: { ...node, choices },
      });
    },
    [dialogue, patchDialogue],
  );

  const handleUpdateChoice = useCallback(
    (
      nodeId: string,
      index: number,
      patch: Partial<DialogueChoiceFile>,
    ) => {
      const node = dialogue[nodeId];
      if (!node?.choices) return;
      const choices = [...node.choices];
      choices[index] = { ...choices[index], ...patch } as DialogueChoiceFile;
      patchDialogue({
        ...dialogue,
        [nodeId]: { ...node, choices },
      });
    },
    [dialogue, patchDialogue],
  );

  const handleDeleteChoice = useCallback(
    (nodeId: string, index: number) => {
      const node = dialogue[nodeId];
      if (!node?.choices) return;
      const choices = node.choices.filter((_, i) => i !== index);
      patchDialogue({
        ...dialogue,
        [nodeId]: {
          ...node,
          choices: choices.length > 0 ? choices : undefined,
        },
      });
    },
    [dialogue, patchDialogue],
  );

  // ─── Create root if needed ──────────────────────────────────────
  const hasDialogue = nodeIds.length > 0;

  if (!hasDialogue) {
    return (
      <Section title="Dialogue">
        <button
          onClick={() => handleAddNode("root")}
          className="w-full rounded border border-border-default px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          + Create Dialogue Tree
        </button>
      </Section>
    );
  }

  // Sort: root first, then alphabetical
  const sortedIds = [...nodeIds].sort((a, b) => {
    if (a === "root") return -1;
    if (b === "root") return 1;
    return a.localeCompare(b);
  });

  return (
    <Section
      title={`Dialogue (${nodeIds.length})`}
      actions={<AddNodeButton existingIds={nodeIds} onAdd={handleAddNode} />}
    >
      <div className="flex flex-col gap-2">
        {sortedIds.map((nodeId) => (
          <DialogueNodeCard
            key={nodeId}
            nodeId={nodeId}
            node={dialogue[nodeId]!}
            allNodeIds={nodeIds}
            onUpdateText={(text) => handleUpdateNodeText(nodeId, text)}
            onRename={(newId) => handleRenameNode(nodeId, newId)}
            onDelete={() => handleDeleteNode(nodeId)}
            onAddChoice={() => handleAddChoice(nodeId)}
            onUpdateChoice={(i, p) => handleUpdateChoice(nodeId, i, p)}
            onDeleteChoice={(i) => handleDeleteChoice(nodeId, i)}
          />
        ))}
      </div>

      {/* Clear all dialogue */}
      <button
        onClick={() => patchDialogue(undefined)}
        className="mt-3 w-full rounded border border-status-danger/30 px-2 py-1 text-2xs text-status-danger/70 transition-colors hover:bg-status-danger/10 hover:text-status-danger"
      >
        Remove All Dialogue
      </button>
    </Section>
  );
}

// ─── Dialogue Node Card ─────────────────────────────────────────────

interface DialogueNodeCardProps {
  nodeId: string;
  node: DialogueNodeFile;
  allNodeIds: string[];
  onUpdateText: (text: string) => void;
  onRename: (newId: string) => void;
  onDelete: () => void;
  onAddChoice: () => void;
  onUpdateChoice: (index: number, patch: Partial<DialogueChoiceFile>) => void;
  onDeleteChoice: (index: number) => void;
}

function DialogueNodeCard({
  nodeId,
  node,
  allNodeIds,
  onUpdateText,
  onRename,
  onDelete,
  onAddChoice,
  onUpdateChoice,
  onDeleteChoice,
}: DialogueNodeCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isRoot = nodeId === "root";
  const choices = node.choices ?? [];

  // Build "next" options: all node IDs except current
  const nextOptions = allNodeIds
    .filter((id) => id !== nodeId)
    .map((id) => ({ value: id, label: id }));

  return (
    <div className="rounded border border-border-muted bg-bg-primary">
      {/* Node header */}
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-4 w-4 shrink-0 text-2xs text-text-muted transition-colors hover:text-text-primary"
          aria-expanded={!collapsed}
        >
          {collapsed ? "\u25B6" : "\u25BC"}
        </button>
        {isRoot ? (
          <span className="text-xs font-semibold text-accent">root</span>
        ) : (
          <NodeIdLabel nodeId={nodeId} onRename={onRename} />
        )}
        <span className="ml-auto text-2xs text-text-muted">
          {choices.length} choice{choices.length !== 1 ? "s" : ""}
        </span>
        {!isRoot && (
          <IconButton onClick={onDelete} title="Delete node" danger>
            &times;
          </IconButton>
        )}
      </div>

      {/* Node body */}
      {!collapsed && (
        <div className="border-t border-border-muted px-2 py-1.5">
          {/* Node text */}
          <div className="mb-1.5">
            <label className="mb-0.5 block text-2xs text-text-muted">
              NPC text
            </label>
            <NodeTextArea
              value={node.text}
              onCommit={onUpdateText}
            />
          </div>

          {/* Choices */}
          <div className="flex flex-col gap-1.5">
            {choices.map((choice, i) => (
              <ChoiceRow
                key={i}
                choice={choice}
                nextOptions={nextOptions}
                onUpdate={(p) => onUpdateChoice(i, p)}
                onDelete={() => onDeleteChoice(i)}
              />
            ))}
          </div>

          <button
            onClick={onAddChoice}
            className="mt-1.5 rounded border border-border-default px-2 py-0.5 text-2xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            + Add Choice
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Node Text Area (commit-on-blur) ────────────────────────────────

function NodeTextArea({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== value) {
    setDraft(value);
  }

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <textarea
      className="w-full resize-y rounded border border-border-default bg-bg-secondary px-1.5 py-1 text-xs leading-relaxed text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
      rows={2}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      placeholder="What the NPC says..."
    />
  );
}

// ─── Choice Row ─────────────────────────────────────────────────────

interface ChoiceRowProps {
  choice: DialogueChoiceFile;
  nextOptions: { value: string; label: string }[];
  onUpdate: (patch: Partial<DialogueChoiceFile>) => void;
  onDelete: () => void;
}

const ChoiceRow = memo(function ChoiceRow({ choice, nextOptions, onUpdate, onDelete }: ChoiceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasConditions =
    choice.minLevel != null ||
    choice.requiredClass != null ||
    choice.action != null;

  return (
    <div className="rounded border border-border-muted bg-bg-secondary px-1.5 py-1">
      <div className="flex items-start gap-1">
        <span className="mt-0.5 shrink-0 text-2xs text-text-muted">
          &rsaquo;
        </span>
        <div className="min-w-0 flex-1">
          <TextInput
            value={choice.text}
            onCommit={(v) => onUpdate({ text: v })}
            placeholder="Player says..."
          />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`mt-0.5 h-4 shrink-0 rounded px-1 text-3xs transition-colors ${
            hasConditions
              ? "text-accent hover:bg-accent/10"
              : "text-text-muted hover:text-text-primary"
          }`}
          title="Toggle conditions"
          aria-expanded={expanded}
        >
          &#x2699;
        </button>
        <IconButton onClick={onDelete} title="Remove choice" danger>
          &times;
        </IconButton>
      </div>

      {/* Next node link */}
      <div className="mt-1 pl-3">
        <FieldRow label="Goes to">
          <SelectInput
            value={choice.next ?? ""}
            options={nextOptions}
            onCommit={(v) => onUpdate({ next: v || undefined })}
            allowEmpty
            placeholder="— end —"
          />
        </FieldRow>
      </div>

      {/* Expanded conditions */}
      {expanded && (
        <div className="mt-1 flex flex-col gap-1 border-t border-border-muted pl-3 pt-1">
          <FieldRow label="Min Level">
            <NumberInput
              value={choice.minLevel}
              onCommit={(v) => onUpdate({ minLevel: v })}
              placeholder="Any"
              min={1}
            />
          </FieldRow>
          <FieldRow label="Req. Class">
            <TextInput
              value={choice.requiredClass ?? ""}
              onCommit={(v) => onUpdate({ requiredClass: v || undefined })}
              placeholder="Any"
            />
          </FieldRow>
          <FieldRow
            label="Action"
            hint="Trigger when chosen. Common: `unlock_flag:<name>` (sets a global flag — quests can gate on it via Requires dialogue flag), `accept_quest:<id>` (offers a quest)."
          >
            <TextInput
              value={choice.action ?? ""}
              onCommit={(v) => onUpdate({ action: v || undefined })}
              placeholder="None"
            />
          </FieldRow>
        </div>
      )}
    </div>
  );
});

// ─── Inline node ID label (click to rename) ─────────────────────────

function NodeIdLabel({
  nodeId,
  onRename,
}: {
  nodeId: string;
  onRename: (newId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nodeId);

  const commit = () => {
    const id = draft.trim().replace(/\s+/g, "_");
    if (id && id !== nodeId) {
      onRename(id);
    } else {
      setDraft(nodeId);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="h-4 w-24 rounded border border-accent/50 bg-bg-primary px-1 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(nodeId);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(nodeId);
        setEditing(true);
      }}
      className="rounded px-0.5 text-xs font-medium text-text-primary hover:bg-bg-tertiary"
      title="Click to rename"
    >
      {nodeId}
    </button>
  );
}

// ─── Add Node Button ────────────────────────────────────────────────

function AddNodeButton({
  existingIds,
  onAdd,
}: {
  existingIds: string[];
  onAdd: (nodeId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const id = value.trim().replace(/\s+/g, "_");
    if (id && !existingIds.includes(id)) {
      onAdd(id);
    }
    setValue("");
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="node_id"
          className="h-5 w-20 rounded border border-border-default bg-bg-primary px-1 text-2xs text-text-primary outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
          onBlur={handleSubmit}
        />
        <button
          type="button"
          onClick={() => {
            setValue("");
            setEditing(false);
          }}
          className="text-2xs text-text-muted hover:text-text-primary"
        >
          &times;
        </button>
      </form>
    );
  }

  return (
    <IconButton onClick={() => setEditing(true)} title="Add dialogue node">
      +
    </IconButton>
  );
}
