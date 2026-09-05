import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { effectiveStyleId, TextStyleDef } from "../lib/text-styles";
import { cn } from "../lib/utils";
import { StyleEditorDialog } from "./StyleEditorDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

function applyStyle(editor: Editor, def: TextStyleDef) {
  if (def.kind === "heading") {
    editor.chain().focus().setNode("heading", { level: def.level, styleId: def.id }).run();
  } else {
    editor.chain().focus().setNode("paragraph", { styleId: def.id }).run();
  }
}

function makeCustomStyle(label: string): TextStyleDef {
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    kind: "paragraph",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 400,
    marginTop: 0,
    marginBottom: 8,
    custom: true,
  };
}

export function StylesDropdown({
  editor,
  styles,
  onUpdateStyle,
  onAddStyle,
}: {
  editor: Editor;
  styles: TextStyleDef[];
  onUpdateStyle: (id: string, patch: Partial<TextStyleDef>) => void;
  onAddStyle: (def: TextStyleDef) => void;
}) {
  const [editing, setEditing] = useState<{ def: TextStyleDef; mode: "new" | "edit" } | null>(null);

  const currentId = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const node = e.state.selection.$from.parent;
      return effectiveStyleId(node.type.name, { styleId: node.attrs.styleId, level: node.attrs.level });
    },
  });

  const current = styles.find((s) => s.id === currentId) ?? styles.find((s) => s.id === "normal") ?? styles[0];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Matches the Font/Size controls' bordered-field look (FontControls.tsx)
              rather than a plain menu button — all three sit in the same row
              and read as one family of pickers, not two different UI languages. */}
          <button
            type="button"
            className="flex shrink-0 items-center justify-between gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ width: "8rem", height: "2rem" }}
          >
            <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? "Normal text"}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {styles.map((s) => (
            <div key={s.id} className="group flex items-center gap-1">
              <DropdownMenuItem
                className={cn("flex-1", s.id === currentId && "bg-slate-100")}
                onSelect={() => applyStyle(editor, s)}
              >
                {/* Fixed size — some styles (Title, big custom templates) run
                    much larger than others, and scaling the preview to match
                    would make rows uneven and the actual font harder to
                    compare at a glance. Font family/weight/color still come
                    through so each row reads as that style's real typeface. */}
                <span
                  className="truncate text-sm"
                  style={{ fontFamily: s.fontFamily, fontWeight: s.fontWeight, color: s.color }}
                >
                  {s.label}
                </span>
              </DropdownMenuItem>
              <button
                type="button"
                aria-label={`Edit ${s.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing({ def: s, mode: "edit" });
                }}
                className="mr-1 rounded p-1 text-slate-300 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditing({ def: makeCustomStyle("New style"), mode: "new" })}>
            <Plus className="h-3.5 w-3.5" />
            New style
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <StyleEditorDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          initial={editing.def}
          mode={editing.mode}
          onSave={(def) => {
            if (editing.mode === "new") {
              onAddStyle(def);
              applyStyle(editor, def);
            } else {
              onUpdateStyle(def.id, def);
            }
          }}
        />
      )}
    </>
  );
}
