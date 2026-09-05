import { FileText, Plus } from "lucide-react";

import { UserMenu } from "./UserMenu";
import { Button } from "./ui/button";

export function AppHeader({ onNewDocument }: { onNewDocument: () => void }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-slate-900">
        <FileText className="h-5 w-5 text-blue-600" />
        <span className="font-semibold">WebOffice</span>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={onNewDocument}>
          <Plus className="h-4 w-4" />
          New document
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
