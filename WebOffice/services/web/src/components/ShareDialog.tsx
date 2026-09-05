import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ApiError, DocumentOut, listPermissions, PermissionOut, shareDocument } from "../api";
import { PersonAvatar } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input, Label } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const ROLE_LABELS: Record<string, string> = {
  viewer: "Viewer — can view only",
  commenter: "Commenter — can view and comment",
  editor: "Editor — can view and edit",
};

export function ShareDialog({
  document: doc,
  open,
  onOpenChange,
}: {
  document: DocumentOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [people, setPeople] = useState<PermissionOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listPermissions(doc.id)
      .then(setPeople)
      .catch(() => toast.error("Failed to load sharing settings"))
      .finally(() => setLoading(false));
  }, [open, doc.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const grant = await shareDocument(doc.id, email.trim(), role);
      setPeople((prev) => [...prev.filter((p) => p.subject_id !== grant.subject_id), grant]);
      setEmail("");
      toast.success(`Shared with ${email.trim()}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to share document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share "{doc.name}"</DialogTitle>
          <DialogDescription>Invite someone who already has a WebOffice account.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="share-email">Email</Label>
              <Input
                id="share-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 sm:w-36">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="commenter">Commenter</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={submitting} className="self-end">
            {submitting ? "Sharing…" : "Share"}
          </Button>
        </form>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">People with access</p>
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {!loading && people.length === 0 && (
            <p className="text-sm text-slate-400">Only you have access right now.</p>
          )}
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded px-1 py-1.5">
                <PersonAvatar id={p.subject_id} name={p.subject_display_name ?? p.subject_email ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {p.subject_display_name ?? "Unknown user"}
                  </p>
                  <p className="truncate text-xs text-slate-400">{p.subject_email}</p>
                </div>
                <span className="shrink-0 text-xs font-medium capitalize text-slate-500">
                  {ROLE_LABELS[p.role]?.split(" —")[0] ?? p.role}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
