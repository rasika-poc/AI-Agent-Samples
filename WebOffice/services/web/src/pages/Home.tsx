import { FileText, MoreVertical, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ApiError, DocumentOut, listDocuments } from "../api";
import { AppHeader } from "../components/AppHeader";
import { NewDocumentDialog } from "../components/NewDocumentDialog";
import { ShareDialog } from "../components/ShareDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { timeAgo } from "../lib/utils";

export default function Home() {
  const [documents, setDocuments] = useState<DocumentOut[] | null>(null);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [sharingDoc, setSharingDoc] = useState<DocumentOut | null>(null);

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed to load documents"));
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader onNewDocument={() => setNewDocOpen(true)} />

      <main className="mx-auto w-full min-h-0 max-w-5xl flex-1 overflow-auto px-6 py-8">
        <h1 className="mb-5 text-lg font-semibold text-slate-800">Your documents</h1>

        {documents === null && <GridSkeleton />}

        {documents !== null && documents.length === 0 && (
          <EmptyState onNewDocument={() => setNewDocOpen(true)} />
        )}

        {documents !== null && documents.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onShare={() => setSharingDoc(doc)} />
            ))}
          </div>
        )}
      </main>

      <NewDocumentDialog
        open={newDocOpen}
        onOpenChange={setNewDocOpen}
        onCreated={(doc) => setDocuments((prev) => [doc, ...(prev ?? [])])}
      />
      {sharingDoc && (
        <ShareDialog
          document={sharingDoc}
          open={!!sharingDoc}
          onOpenChange={(open) => !open && setSharingDoc(null)}
        />
      )}
    </div>
  );
}

function DocumentCard({ doc, onShare }: { doc: DocumentOut; onShare: () => void }) {
  return (
    <div className="group relative rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <Link to={`/doc/${doc.id}`} className="block">
        <div className="mb-3 flex h-24 items-center justify-center rounded-md bg-slate-50">
          <FileText className="h-8 w-8 text-slate-300" />
        </div>
        <p className="truncate text-sm font-medium text-slate-800">{doc.name}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Edited {timeAgo(doc.updated_at)} · <span className="capitalize">{doc.role}</span>
        </p>
      </Link>
      {doc.role === "owner" && (
        // Always visible on touch devices (no hover to reveal it there); fades in on
        // hover/focus for pointer devices, where it'd otherwise compete with the title.
        <div className="absolute right-3 top-3 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onShare}>
                <Share2 className="h-4 w-4" />
                Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNewDocument }: { onNewDocument: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-20 text-center">
      <FileText className="mb-3 h-10 w-10 text-slate-300" />
      <p className="mb-1 font-medium text-slate-700">No documents yet</p>
      <p className="mb-4 text-sm text-slate-400">Create your first document to get started.</p>
      <button
        onClick={onNewDocument}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        New document
      </button>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 h-24 rounded-md bg-slate-100" />
          <div className="mb-1.5 h-3.5 w-2/3 rounded bg-slate-100" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
