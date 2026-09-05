import { useState } from "react";
import { toast } from "sonner";

import { ApiError, createDocument, DocumentOut } from "../api";
import {
  CUSTOM_SIZE_MAX_INCHES,
  CUSTOM_SIZE_MIN_INCHES,
  PAGE_SIZE_PRESETS,
  PX_PER_INCH,
  PageSizeId,
} from "../lib/page-layout";
import { setPendingDocDefaults } from "../lib/pending-doc-defaults";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input, Label } from "./ui/input";

const SIZE_OPTIONS: { id: PageSizeId; label: string }[] = [
  { id: "letter", label: PAGE_SIZE_PRESETS.letter.label },
  { id: "a4", label: PAGE_SIZE_PRESETS.a4.label },
  { id: "custom", label: "Custom" },
];

export function NewDocumentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (doc: DocumentOut) => void;
}) {
  const [name, setName] = useState("");
  const [sizeId, setSizeId] = useState<PageSizeId>("letter");
  const [customWidth, setCustomWidth] = useState("8.5");
  const [customHeight, setCustomHeight] = useState("11");
  const [submitting, setSubmitting] = useState(false);

  const customWidthNum = Number(customWidth);
  const customHeightNum = Number(customHeight);
  const customValid =
    Number.isFinite(customWidthNum) &&
    Number.isFinite(customHeightNum) &&
    customWidthNum >= CUSTOM_SIZE_MIN_INCHES &&
    customWidthNum <= CUSTOM_SIZE_MAX_INCHES &&
    customHeightNum >= CUSTOM_SIZE_MIN_INCHES &&
    customHeightNum <= CUSTOM_SIZE_MAX_INCHES;

  function reset() {
    setName("");
    setSizeId("letter");
    setCustomWidth("8.5");
    setCustomHeight("11");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || (sizeId === "custom" && !customValid)) return;
    setSubmitting(true);
    try {
      const doc = await createDocument(name.trim());
      const pageSize =
        sizeId === "custom"
          ? { width: Math.round(customWidthNum * PX_PER_INCH), height: Math.round(customHeightNum * PX_PER_INCH) }
          : PAGE_SIZE_PRESETS[sizeId];
      // The document's Yjs doc (where pageMode/pageSize actually live)
      // doesn't exist yet — it's only created once DocumentEditor opens a
      // collab connection. Hand the choice off so the editor can seed it the
      // first time this document is opened. New documents default to Pages
      // mode (Google Docs' default), unlike documents that were never given
      // an explicit mode before this feature existed.
      setPendingDocDefaults(doc.id, { pageMode: "pages", pageSize });
      onCreated(doc);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="doc-name">Name</Label>
            <Input
              id="doc-name"
              autoFocus
              placeholder="Untitled document"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Page size</Label>
            <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-sm font-medium">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSizeId(opt.id)}
                  className={cn(
                    "flex-1 rounded px-2.5 py-1.5 transition-colors",
                    sizeId === opt.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {sizeId === "custom" && (
              <div className="flex items-end gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="doc-width">Width (in)</Label>
                  <Input
                    id="doc-width"
                    type="number"
                    step="0.1"
                    min={CUSTOM_SIZE_MIN_INCHES}
                    max={CUSTOM_SIZE_MAX_INCHES}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="w-24"
                  />
                </div>
                <span className="pb-2 text-slate-400">×</span>
                <div className="space-y-1">
                  <Label htmlFor="doc-height">Height (in)</Label>
                  <Input
                    id="doc-height"
                    type="number"
                    step="0.1"
                    min={CUSTOM_SIZE_MIN_INCHES}
                    max={CUSTOM_SIZE_MAX_INCHES}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    className="w-24"
                  />
                </div>
                {!customValid && (
                  <span className="pb-2 text-xs text-red-600">
                    {CUSTOM_SIZE_MIN_INCHES}–{CUSTOM_SIZE_MAX_INCHES} in
                  </span>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !name.trim() || (sizeId === "custom" && !customValid)}
            >
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
