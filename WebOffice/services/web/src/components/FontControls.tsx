import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useEffect, useState } from "react";

import { effectiveStyleId, FONT_FAMILIES, TextStyleDef } from "../lib/text-styles";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/**
 * Direct font-family/size overrides on the selection, layered on top of
 * whatever paragraph style is active — the same relationship Google Docs'
 * toolbar has to its Styles dropdown. When the selection has no override,
 * these show (and let you start from) the active style's own font/size
 * rather than a blank field.
 */
export function FontControls({ editor, styles }: { editor: Editor; styles: TextStyleDef[] }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const node = e.state.selection.$from.parent;
      const styleId = effectiveStyleId(node.type.name, { styleId: node.attrs.styleId, level: node.attrs.level });
      const marks = e.getAttributes("textStyle") as { fontFamily?: string; fontSize?: string };
      return { styleId, fontFamily: marks.fontFamily ?? null, fontSize: marks.fontSize ?? null };
    },
  });

  const activeStyle = styles.find((s) => s.id === state.styleId);
  const fontFamily = state.fontFamily ?? activeStyle?.fontFamily ?? FONT_FAMILIES[0].value;
  const fontLabel = FONT_FAMILIES.find((f) => f.value === fontFamily)?.label ?? fontFamily;
  const fontSizePx = state.fontSize ? parseInt(state.fontSize, 10) : (activeStyle?.fontSize ?? 11);

  const [sizeInput, setSizeInput] = useState(String(fontSizePx));
  useEffect(() => setSizeInput(String(fontSizePx)), [fontSizePx]);

  function commitSize() {
    const n = Number(sizeInput);
    if (Number.isFinite(n) && n >= 6 && n <= 96) {
      editor.chain().focus().setFontSize(`${n}px`).run();
    } else {
      setSizeInput(String(fontSizePx));
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={fontFamily} onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
        {/* Tailwind's generated rule order isn't guaranteed to put a later
            utility ahead of the base component's `h-9`/`w-full` at equal
            specificity (it seems to sort same-property utilities by scale
            value, not source order, so a fixed size here has to be inline
            to reliably win). Radix's `Select.Value` also doesn't forward
            className/style onto the span it renders when left to derive its
            own label — passing our own label as children instead makes it a
            plain passthrough, so our own span actually lands on the DOM.
            That span still isn't a *direct* flex child of the trigger
            though (Radix wraps it in its own unstyleable span first), so
            `flex-1`/`min-w-0` on it were no-ops — a long name like "Times
            New Roman" rendered at its full natural width and pushed the
            chevron out past the trigger's right edge. A plain max-width
            fixes it regardless of that extra wrapper. */}
        <SelectTrigger className="shrink-0" style={{ width: "9rem", height: "2rem" }}>
          <SelectValue>
            <span
              style={{
                display: "inline-block",
                maxWidth: "6rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                verticalAlign: "middle",
              }}
            >
              {fontLabel}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="number"
        min={6}
        max={96}
        value={sizeInput}
        onChange={(e) => setSizeInput(e.target.value)}
        onBlur={commitSize}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="shrink-0 appearance-none text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={{ width: "4rem", height: "2rem" }}
      />
    </div>
  );
}
