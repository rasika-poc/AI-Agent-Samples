import { PageSize } from "./page-layout";

export interface PendingDocDefaults {
  pageMode: "pages" | "pageless";
  pageSize: PageSize;
}

// Hand-off channel between NewDocumentDialog (which only talks to the REST
// API, before any Yjs doc exists) and DocumentEditor (which owns the Yjs doc
// where pageMode/pageSize actually live). Read once and cleared the first
// time the document's collab session syncs.
function key(documentId: string) {
  return `weboffice:pending-doc-defaults:${documentId}`;
}

export function setPendingDocDefaults(documentId: string, defaults: PendingDocDefaults) {
  try {
    localStorage.setItem(key(documentId), JSON.stringify(defaults));
  } catch {
    // Best-effort — worst case the new document just falls back to Pageless/Letter.
  }
}

export function takePendingDocDefaults(documentId: string): PendingDocDefaults | null {
  try {
    const raw = localStorage.getItem(key(documentId));
    if (!raw) return null;
    localStorage.removeItem(key(documentId));
    const parsed = JSON.parse(raw);
    if (
      (parsed?.pageMode === "pages" || parsed?.pageMode === "pageless") &&
      typeof parsed?.pageSize?.width === "number" &&
      typeof parsed?.pageSize?.height === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
