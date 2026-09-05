import { Extension } from "@tiptap/core";

/**
 * Attaches a `styleId` attribute to paragraph and heading nodes, rendered as
 * `data-style-id` — the pointer a block uses to reference a named paragraph
 * style (Title/Subtitle/Heading N/Normal text/custom) instead of carrying
 * its own font/size. The definitions those ids resolve to live in the
 * document's Yjs `styles` map and are rendered as CSS by StyleSheet.tsx, so
 * this extension only needs to guarantee every block *has* the attribute in
 * its rendered HTML — never a hardcoded look.
 *
 * `styleId` defaults to null (no explicit override) rather than a real id so
 * documents authored before this feature existed don't need a migration:
 * the fallback below computes the same default a fresh block would get.
 */
export const StyleId = Extension.create({
  name: "styleId",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          styleId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-style-id"),
            renderHTML: (attributes) => ({ "data-style-id": attributes.styleId ?? "normal" }),
          },
        },
      },
      {
        types: ["heading"],
        attributes: {
          styleId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-style-id"),
            renderHTML: (attributes) => ({
              "data-style-id": attributes.styleId ?? `heading${attributes.level}`,
            }),
          },
        },
      },
    ];
  },
});
