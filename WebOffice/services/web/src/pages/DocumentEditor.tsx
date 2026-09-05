import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as Y from "yjs";

import { ApiError, DocumentOut, getDocument } from "../api";
import { decodeToken, getToken } from "../auth";
import { DocStyleSheet } from "../components/DocStyleSheet";
import { PagedCanvas } from "../components/PagedCanvas";
import { PresenceBar } from "../components/PresenceBar";
import { Toolbar } from "../components/Toolbar";
import { UserMenu } from "../components/UserMenu";
import { useCurrentUser } from "../context/UserContext";
import { DEFAULT_PAGE_SIZE, PageSize, pageContentHeight } from "../lib/page-layout";
import { takePendingDocDefaults } from "../lib/pending-doc-defaults";
import { DEFAULT_TEXT_STYLES, TextStyleDef } from "../lib/text-styles";
import { cn, colorForId } from "../lib/utils";
import { Pagination } from "../tiptap/pagination";
import { StyleId } from "../tiptap/style-id";

type PageMode = "pages" | "pageless";
type MetaValue = PageMode | PageSize;

const COLLAB_URL = import.meta.env.VITE_COLLAB_WS_URL ?? "ws://localhost:48736";

type Status = "connecting" | "connected" | "disconnected";

const STATUS_STYLES: Record<Status, string> = {
  connecting: "bg-amber-100 text-amber-700",
  connected: "bg-emerald-100 text-emerald-700",
  disconnected: "bg-red-100 text-red-700",
};

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useCurrentUser();
  const [doc, setDoc] = useState<DocumentOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    if (!id) return;
    getDocument(id)
      .then(setDoc)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load document"));
  }, [id]);

  const ydoc = useMemo(() => new Y.Doc(), [id]);

  const provider = useMemo(() => {
    // Gated on `doc` (the api-files metadata fetch) so a user with no access
    // gets api-files' friendlier 404 instead of racing it against the
    // collab-server's websocket rejection.
    if (!id || !doc) return null;
    const token = getToken();
    if (!token) return null;
    const { tenant_id } = decodeToken(token);

    return new HocuspocusProvider({
      url: COLLAB_URL,
      name: `${tenant_id}:${id}`,
      document: ydoc,
      token,
      onAuthenticationFailed: ({ reason }) => setError(`Access denied: ${reason}`),
      onStatus: ({ status: s }) => setStatus(s === "connected" ? "connected" : "disconnected"),
      // Seed the pageMode/pageSize chosen in NewDocumentDialog the first time
      // this document's collab session syncs — the Yjs doc (where they
      // actually live) doesn't exist until now, so the dialog hands the
      // choice off via localStorage instead. Guarded per-key so a reconnect,
      // or a collaborator racing the same sync, never clobbers a real value
      // once one is set.
      onSynced: () => {
        const meta = ydoc.getMap<MetaValue>("meta");
        const pending = takePendingDocDefaults(id);
        if (pending) {
          if (!meta.get("pageMode")) meta.set("pageMode", pending.pageMode);
          if (!meta.get("pageSize")) meta.set("pageSize", pending.pageSize);
        }
        // Seed the paragraph-style registry (Title/Subtitle/Heading N/Normal
        // text) the first time any document — new or pre-existing — opens
        // after this feature shipped. Guarded on size rather than a pending
        // flag: unlike pageMode/pageSize this isn't a creation-time choice,
        // every document needs a registry for its styleId references to
        // resolve against.
        const stylesMap = ydoc.getMap<TextStyleDef>("styles");
        if (stylesMap.size === 0) {
          DEFAULT_TEXT_STYLES.forEach((s) => stylesMap.set(s.id, s));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ydoc, doc]);

  useEffect(() => () => provider?.destroy(), [provider]);

  // Page layout (pages-with-breaks vs. one continuous surface) is a document
  // property, not a per-viewer preference — stored in the shared Yjs doc
  // (synced to every collaborator, persisted in the same snapshot as the
  // content) rather than in Postgres, so it needed no schema/API change.
  const meta = useMemo(() => ydoc.getMap<MetaValue>("meta"), [ydoc]);
  const [pageMode, setPageModeState] = useState<PageMode>("pageless");
  const [pageSize, setPageSizeState] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    const sync = () => {
      setPageModeState(meta.get("pageMode") === "pages" ? "pages" : "pageless");
      const size = meta.get("pageSize") as PageSize | undefined;
      setPageSizeState(size && size.width && size.height ? size : DEFAULT_PAGE_SIZE);
    };
    sync();
    meta.observe(sync);
    return () => meta.unobserve(sync);
  }, [meta]);

  function setPageMode(mode: PageMode) {
    meta.set("pageMode", mode);
  }

  // The paragraph-style registry (see lib/text-styles.ts) — blocks only
  // carry a styleId pointer (tiptap/style-id.ts), so redefining a style here
  // re-renders every block using it via DocStyleSheet, for every
  // collaborator, without touching the document content itself.
  const stylesMap = useMemo(() => ydoc.getMap<TextStyleDef>("styles"), [ydoc]);
  const [styles, setStyles] = useState<TextStyleDef[]>(DEFAULT_TEXT_STYLES);

  useEffect(() => {
    const sync = () => {
      const values = Array.from(stylesMap.values());
      setStyles(values.length > 0 ? values : DEFAULT_TEXT_STYLES);
    };
    sync();
    stylesMap.observe(sync);
    return () => stylesMap.unobserve(sync);
  }, [stylesMap]);

  function updateStyle(id: string, patch: Partial<TextStyleDef>) {
    const existing = stylesMap.get(id);
    if (existing) stylesMap.set(id, { ...existing, ...patch });
  }

  function addStyle(def: TextStyleDef) {
    stylesMap.set(def.id, def);
  }

  const [pageCount, setPageCount] = useState(1);
  // Avoid flashing a stale count from the previous "pages" session while the
  // freshly (re)created editor's Pagination extension recomputes.
  useEffect(() => {
    if (pageMode === "pages") setPageCount(1);
  }, [pageMode]);

  const isReadOnly = doc?.role === "viewer" || doc?.role === "commenter";

  const editor = useEditor(
    {
      extensions: provider
        ? [
            StarterKit.configure({ undoRedo: false }),
            Collaboration.configure({ document: ydoc }),
            CollaborationCaret.configure({
              provider,
              user: {
                name: currentUser?.display_name ?? "Anonymous",
                color: colorForId(currentUser?.id ?? "anonymous"),
              },
            }),
            StyleId,
            TextStyle,
            FontFamily,
            FontSize,
            ...(pageMode === "pages"
              ? [
                  Pagination.configure({
                    onPageCountChange: setPageCount,
                    pageContentHeight: pageContentHeight(pageSize),
                  }),
                ]
              : []),
          ]
        : [StarterKit, StyleId, TextStyle, FontFamily, FontSize],
      editable: !isReadOnly,
      editorProps: {
        attributes: {
          class: cn(
            "prose prose-slate max-w-none focus:outline-none",
            pageMode === "pageless" && "min-h-[60vh]",
          ),
        },
      },
    },
    [provider, isReadOnly, currentUser, pageMode, pageSize],
  );

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
          Back to documents
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <DocStyleSheet styles={styles} />
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link to="/" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 truncate font-medium text-slate-800">{doc?.name ?? "Loading…"}</h1>

        <div className="flex items-center gap-3">
          {/* <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", STATUS_STYLES[status])}> */}
            {/* {status}
          </span> */}
          {provider && <PresenceBar provider={provider} />}
          <div className="h-6 w-px bg-slate-200" />
          <UserMenu />
        </div>
      </header>

      {isReadOnly && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <Eye className="h-4 w-4" />
          You have {doc?.role} access — changes won't be saved.
        </div>
      )}

      {editor && !isReadOnly && (
        <Toolbar
          editor={editor}
          pageMode={pageMode}
          onPageModeChange={setPageMode}
          styles={styles}
          onUpdateStyle={updateStyle}
          onAddStyle={addStyle}
        />
      )}

      <main className="min-h-0 flex-1 overflow-auto px-0 py-0 sm:px-4 sm:py-8">
        {pageMode === "pages" ? (
          <PagedCanvas pageCount={pageCount} pageSize={pageSize}>
            <EditorContent editor={editor} />
          </PagedCanvas>
        ) : (
          <div className="mx-auto max-w-3xl rounded-none border-0 bg-white px-6 py-8 shadow-none sm:rounded-lg sm:border sm:border-slate-200 sm:px-12 sm:py-10 sm:shadow-sm">
            <EditorContent editor={editor} />
          </div>
        )}
      </main>
    </div>
  );
}
