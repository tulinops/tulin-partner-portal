"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { uploadSitePhoto } from "@/server/connections";

// Click-anywhere dropzone: browsing and uploading are one interaction
// instead of "Choose file" + a separate "Upload" click.
export function SitePhotoUpload({
  connectionId,
  category,
  className,
  disabled,
}: {
  connectionId: string;
  category: string;
  className?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("connectionId", connectionId);
      formData.set("category", category);
      formData.set("file", file);
      await uploadSitePhoto(formData);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={pending || disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <Upload className="h-4 w-4" />
      {pending ? "Uploading…" : disabled ? "Limit reached" : "Click to browse & upload a photo"}
    </button>
  );
}
