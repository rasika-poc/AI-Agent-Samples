// Shared page geometry, matching Google Docs' web view at 96dpi. Margin and
// inter-page gap are fixed regardless of paper size; width/height vary per
// document (chosen at creation, stored in the doc's Yjs meta) so both the
// visual page canvas (PagedCanvas) and the pagination engine
// (tiptap/pagination.ts) size themselves off the same PageSize value.
export const PAGE_MARGIN = 96;
export const PAGE_GAP = 28;

export interface PageSize {
  width: number;
  height: number;
}

export const PAGE_SIZE_PRESETS: Record<"letter" | "a4", { label: string } & PageSize> = {
  letter: { label: "Letter", width: 816, height: 1056 },
  a4: { label: "A4", width: 794, height: 1123 },
};

export type PageSizeId = keyof typeof PAGE_SIZE_PRESETS | "custom";

export const DEFAULT_PAGE_SIZE: PageSize = PAGE_SIZE_PRESETS.letter;

// Custom size bounds, in inches — generous enough for anything from an index
// card to a poster while keeping the layout math sane.
export const CUSTOM_SIZE_MIN_INCHES = 2;
export const CUSTOM_SIZE_MAX_INCHES = 48;
export const PX_PER_INCH = 96;

export function pageContentHeight(size: PageSize): number {
  return size.height - PAGE_MARGIN * 2;
}

// How much extra vertical space a page-break spacer needs to insert into the
// document flow: the current page's bottom margin, the visual gap between
// sheets, and the next page's top margin. Independent of paper size, since
// margin/gap don't vary with it.
export const PAGE_BREAK_SPACER_HEIGHT = PAGE_GAP + PAGE_MARGIN * 2;
