import { PAGE_GAP, PAGE_MARGIN, PageSize } from "../lib/page-layout";

/**
 * Renders `pageCount` page-sized white sheets stacked with a gap between
 * them — the visual half of "Pages" mode. The content itself (passed as
 * `children`) is positioned on top by the caller; what keeps text from
 * crossing the gaps between sheets is the `Pagination` extension
 * (tiptap/pagination.ts), which inserts real spacer height into the content
 * flow at the same page-boundary math this component uses to size the
 * sheets — `pageCount` comes from that extension, not measured here.
 */
export function PagedCanvas({
  pageCount,
  pageSize,
  children,
}: {
  pageCount: number;
  pageSize: PageSize;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto" style={{ width: pageSize.width }}>
      <div className="flex flex-col" style={{ gap: PAGE_GAP }}>
        {Array.from({ length: pageCount }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 rounded-sm border border-slate-200 bg-white shadow-md"
            style={{ width: pageSize.width, height: pageSize.height }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 top-0" style={{ padding: PAGE_MARGIN }}>
        {children}
      </div>
    </div>
  );
}
