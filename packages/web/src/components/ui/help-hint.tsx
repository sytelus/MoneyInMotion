import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent } from './dialog.js';

/** Click/tap/keyboard help, not a hover-only tooltip inaccessible on phones. */
export function HelpHint({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Explain ${title}`}
        title={`Explain ${title}`}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title}>
          <div className="space-y-3 text-sm leading-relaxed">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
