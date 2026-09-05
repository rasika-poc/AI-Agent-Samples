import { useMemo } from "react";

import { TextStyleDef } from "../lib/text-styles";

/**
 * Renders the document's paragraph-style registry as CSS, one rule per
 * style id. This is the other half of the "edit once, applies everywhere"
 * mechanic: blocks only carry a `data-style-id` pointer (tiptap/style-id.ts)
 * — the actual font/size/weight/color/spacing lives here, recomputed from
 * the live (Yjs-synced) registry on every change, so redefining "Heading 2"
 * re-styles every Heading 2 in the doc, for every collaborator, instantly.
 */
export function DocStyleSheet({ styles }: { styles: TextStyleDef[] }) {
  const css = useMemo(
    () =>
      styles
        .map(
          (s) => `.ProseMirror [data-style-id="${s.id}"] {
  font-family: ${s.fontFamily};
  font-size: ${s.fontSize}px;
  font-weight: ${s.fontWeight};
  ${s.color ? `color: ${s.color};` : ""}
  margin-top: ${s.marginTop}px;
  margin-bottom: ${s.marginBottom}px;
}`,
        )
        .join("\n"),
    [styles],
  );

  return <style>{css}</style>;
}
