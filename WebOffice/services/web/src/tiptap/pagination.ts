import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { PAGE_BREAK_SPACER_HEIGHT } from "../lib/page-layout";

const SPACER_ATTR = "data-pagination-spacer";
const paginationKey = new PluginKey("pagination");

export interface PaginationOptions {
  onPageCountChange?: (count: number) => void;
  // Usable content height of one page (page height minus top+bottom margin)
  // for the document's chosen paper size — passed in rather than imported as
  // a constant since it varies per document (Letter/A4/Custom).
  pageContentHeight: number;
}

/**
 * Makes "Pages" mode structurally real instead of a visual overlay: measures
 * each top-level block after every update and, whenever one would cross a
 * page boundary, inserts a widget decoration before it — actual DOM height,
 * not styling — that pushes it down to the next page's usable area. A block
 * taller than one full page still can't be split mid-block (that needs real
 * text reflow, out of scope here); it's simply left to overflow past that
 * page's edge rather than forced onto an equally-too-small next page.
 */
export const Pagination = Extension.create<PaginationOptions>({
  name: "pagination",

  addOptions() {
    return { onPageCountChange: undefined, pageContentHeight: 864 };
  },

  addProseMirrorPlugins() {
    const { onPageCountChange, pageContentHeight } = this.options;

    return [
      new Plugin({
        key: paginationKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const next = tr.getMeta(paginationKey);
            return next ?? old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return paginationKey.getState(state);
          },
        },
        view(editorView) {
          let rafId: number | null = null;
          let lastSignature = "";

          function recompute() {
            rafId = null;

            // `posAtDOM(el, 0)` resolves to a position *inside* el's content,
            // not the position before it as a sibling — a widget decoration
            // there nests inside the block instead of sitting between blocks,
            // inflating that block's own rendered height. doc.forEach's
            // offsets are exactly the "before this top-level node" positions
            // a block-level widget needs, so top-level nodes are matched to
            // their DOM elements by shared iteration order instead.
            const nodePositions: number[] = [];
            editorView.state.doc.forEach((_node, offset) => nodePositions.push(offset));

            // Real rendered rects, not offsetHeight + own margins — adjacent
            // paragraphs collapse their touching margins into one gap, so
            // summing each block's margin-top *and* margin-bottom independently
            // double-counts that gap and fires breaks well before the page is
            // actually full. getBoundingClientRect naturally reflects the true
            // (collapsed) layout instead.
            const containerTop = editorView.dom.getBoundingClientRect().top;
            let spacerOffset = 0;
            let pageStartY: number | null = null;
            const breakPositions: number[] = [];
            let nodeIndex = 0;

            for (const el of Array.from(editorView.dom.children) as HTMLElement[]) {
              if (el.hasAttribute(SPACER_ATTR)) {
                spacerOffset += el.getBoundingClientRect().height;
                continue;
              }
              const pos = nodePositions[nodeIndex++];
              const rect = el.getBoundingClientRect();
              const top = rect.top - containerTop - spacerOffset;
              const bottom = rect.bottom - containerTop - spacerOffset;

              if (pageStartY === null) {
                pageStartY = top;
              } else if (bottom - pageStartY > pageContentHeight && top > pageStartY) {
                breakPositions.push(pos);
                pageStartY = top;
              }
            }

            const signature = breakPositions.join(",");
            if (signature === lastSignature) return;
            lastSignature = signature;

            onPageCountChange?.(breakPositions.length + 1);

            const decorations = breakPositions.map((pos) =>
              Decoration.widget(
                pos,
                () => {
                  const spacer = document.createElement("div");
                  spacer.setAttribute(SPACER_ATTR, "true");
                  spacer.style.height = `${PAGE_BREAK_SPACER_HEIGHT}px`;
                  spacer.contentEditable = "false";
                  return spacer;
                },
                { side: -1 },
              ),
            );
            editorView.dispatch(
              editorView.state.tr.setMeta(paginationKey, DecorationSet.create(editorView.state.doc, decorations)),
            );
          }

          function schedule() {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(recompute);
          }

          schedule();

          return {
            update: schedule,
            destroy() {
              if (rafId !== null) cancelAnimationFrame(rafId);
            },
          };
        },
      }),
    ];
  },
});
