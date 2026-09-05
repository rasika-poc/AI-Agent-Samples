import { useEditorState, type Editor } from "@tiptap/react";
import { Bold, Code, Italic, List, ListOrdered, Quote, Strikethrough } from "lucide-react";

import { TextStyleDef } from "../lib/text-styles";
import { cn } from "../lib/utils";
import { FontControls } from "./FontControls";
import { StylesDropdown } from "./StylesDropdown";
import { Tooltip } from "./ui/tooltip";

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded transition-colors",
          active ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

interface ToolbarProps {
  editor: Editor;
  pageMode: "pages" | "pageless";
  onPageModeChange: (mode: "pages" | "pageless") => void;
  styles: TextStyleDef[];
  onUpdateStyle: (id: string, patch: Partial<TextStyleDef>) => void;
  onAddStyle: (def: TextStyleDef) => void;
}

export function Toolbar({
  editor,
  pageMode,
  onPageModeChange,
  styles,
  onUpdateStyle,
  onAddStyle,
}: ToolbarProps) {
  // `useEditor` (Tiptap v3) no longer forces this component to re-render on
  // every transaction, so reading `editor.isActive(...)` directly in render
  // showed stale state — the buttons never updated as the selection moved.
  // `useEditorState` subscribes to exactly the derived flags below and
  // re-renders only when one of them actually changes.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
    }),
  });

  return (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-slate-200 bg-white px-3 py-1.5">
      <StylesDropdown editor={editor} styles={styles} onUpdateStyle={onUpdateStyle} onAddStyle={onAddStyle} />

      <div className="mx-1.5 h-5 w-px bg-slate-200" />

      <FontControls editor={editor} styles={styles} />

      <div className="mx-1.5 h-5 w-px bg-slate-200" />

      <ToolbarButton label="Bold" active={active.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={active.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1.5 h-5 w-px bg-slate-200" />

      <ToolbarButton
        label="Bullet list"
        active={active.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={active.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={active.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={active.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <div className="ml-auto flex items-center rounded-md bg-slate-100 p-0.5 text-xs font-medium">
        {(["pages", "pageless"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onPageModeChange(mode)}
            className={cn(
              "rounded px-2.5 py-1 capitalize transition-colors",
              pageMode === mode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
