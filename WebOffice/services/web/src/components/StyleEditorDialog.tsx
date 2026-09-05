import { useEffect, useState } from "react";

import { FONT_FAMILIES, FONT_SIZES, TextStyleDef } from "../lib/text-styles";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input, Label } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/**
 * Create-or-edit form for one paragraph style. Editing a built-in (Title,
 * Heading 2, ...) changes its shared definition in place — every block
 * using that style updates immediately, everywhere (see DocStyleSheet).
 * Creating a new one always makes a paragraph-kind style: headings stay
 * tied 1:1 to their outline level, so user templates sit alongside Normal
 * text/Title/Subtitle instead of competing with H1-H6.
 */
export function StyleEditorDialog({
  open,
  onOpenChange,
  initial,
  mode,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TextStyleDef;
  mode: "new" | "edit";
  onSave: (def: TextStyleDef) => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [fontFamily, setFontFamily] = useState(initial.fontFamily);
  const [fontSize, setFontSize] = useState(initial.fontSize);
  const [bold, setBold] = useState(initial.fontWeight >= 600);

  useEffect(() => {
    if (!open) return;
    setLabel(initial.label);
    setFontFamily(initial.fontFamily);
    setFontSize(initial.fontSize);
    setBold(initial.fontWeight >= 600);
    // Only re-seed the form when a *different* style is opened for editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.id]);

  const nameEditable = mode === "new" || initial.custom;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    onSave({
      ...initial,
      label: label.trim(),
      fontFamily,
      fontSize,
      fontWeight: bold ? 700 : 400,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "New style" : `Edit "${initial.label}"`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="style-name">Name</Label>
            <Input
              id="style-name"
              value={label}
              disabled={!nameEditable}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus={mode === "new"}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label>Font</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((f) => (
                    <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Label>Size</Label>
              <Select value={String(fontSize)} onValueChange={(v) => setFontSize(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={bold}
              onChange={(e) => setBold(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            Bold
          </label>

          <div
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4"
            style={{ fontFamily, fontSize, fontWeight: bold ? 700 : 400, color: initial.color }}
          >
            {label.trim() || "Preview"}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!label.trim()}>
              {mode === "new" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
