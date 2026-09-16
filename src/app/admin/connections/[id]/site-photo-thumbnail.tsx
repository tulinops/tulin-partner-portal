"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteSitePhoto } from "@/server/connections";

export function SitePhotoThumbnail({
  id,
  connectionId,
  filePath,
  originalName,
}: {
  id: string;
  connectionId: string;
  filePath: string;
  originalName: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete this photo${originalName ? ` (${originalName})` : ""}? This can't be undone.`)) {
      return;
    }
    setPending(true);
    try {
      await deleteSitePhoto({ id, connectionId });
      toast.success("Photo deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setPending(false);
    }
  }

  return (
    <div className="group relative">
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" title={originalName}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Vercel Blob URL, not an optimizable remote asset */}
            <img src={filePath} alt={originalName} className="h-16 w-16 rounded border object-cover" />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle className="truncate">{originalName}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- Vercel Blob URL, not an optimizable remote asset */}
          <img src={filePath} alt={originalName} className="max-h-[75vh] w-full rounded object-contain" />
          <a
            href={filePath}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            Open in new tab
          </a>
        </DialogContent>
      </Dialog>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Delete photo"
        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
