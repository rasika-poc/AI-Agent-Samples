// A "paragraph style" (Google Docs' Title/Subtitle/Heading N/Normal text)
// is a named, reusable formatting template: blocks reference a style by id
// (see tiptap/style-id.ts) rather than carrying their own font/size, so
// redefining a style here — built-in or user-added — is reflected by every
// block using it, everywhere, for every collaborator. The definitions
// themselves live in the document's Yjs `styles` map (synced/persisted the
// same way as pageMode/pageSize); this module only supplies the initial
// seed and the fixed choices offered when editing one.
export type StyleKind = "paragraph" | "heading";
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface TextStyleDef {
  id: string;
  label: string;
  kind: StyleKind;
  level?: HeadingLevel; // only for kind "heading"
  fontFamily: string;
  fontSize: number; // px
  fontWeight: number;
  color?: string;
  marginTop: number;
  marginBottom: number;
  custom?: boolean; // user-added — built-ins can be edited but not deleted
}

const BASE_FONT = "Inter, sans-serif";

export const DEFAULT_TEXT_STYLES: TextStyleDef[] = [
  { id: "normal", label: "Normal text", kind: "paragraph", fontFamily: BASE_FONT, fontSize: 11, fontWeight: 400, marginTop: 0, marginBottom: 8 },
  { id: "title", label: "Title", kind: "paragraph", fontFamily: BASE_FONT, fontSize: 26, fontWeight: 700, marginTop: 0, marginBottom: 4 },
  { id: "subtitle", label: "Subtitle", kind: "paragraph", fontFamily: BASE_FONT, fontSize: 15, fontWeight: 400, color: "#6b7280", marginTop: 0, marginBottom: 16 },
  { id: "heading1", label: "Heading 1", kind: "heading", level: 1, fontFamily: BASE_FONT, fontSize: 20, fontWeight: 700, marginTop: 20, marginBottom: 6 },
  { id: "heading2", label: "Heading 2", kind: "heading", level: 2, fontFamily: BASE_FONT, fontSize: 17, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  { id: "heading3", label: "Heading 3", kind: "heading", level: 3, fontFamily: BASE_FONT, fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 4 },
  { id: "heading4", label: "Heading 4", kind: "heading", level: 4, fontFamily: BASE_FONT, fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 4 },
  { id: "heading5", label: "Heading 5", kind: "heading", level: 5, fontFamily: BASE_FONT, fontSize: 11, fontWeight: 700, marginTop: 12, marginBottom: 4 },
  { id: "heading6", label: "Heading 6", kind: "heading", level: 6, fontFamily: BASE_FONT, fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 12, marginBottom: 4 },
];

export const BUILT_IN_STYLE_IDS = new Set(DEFAULT_TEXT_STYLES.map((s) => s.id));

export function effectiveStyleId(nodeType: string, attrs: { styleId?: string | null; level?: number }): string {
  if (attrs.styleId) return attrs.styleId;
  return nodeType === "heading" ? `heading${attrs.level}` : "normal";
}

export const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
];

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
