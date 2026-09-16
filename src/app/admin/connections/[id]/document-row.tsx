"use client";

import { useEffect, useMemo, useState, forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { FileText } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updateDocumentStatus, uploadConnectionDocument } from "@/server/documents";
import type { DocumentStatus } from "@/generated/prisma/enums";

const DOCUMENT_STATUSES = [
  "NOT_UPLOADED",
  "UPLOADED",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "REUPLOAD_REQUIRED",
] as const;

const DOCUMENT_STATUS_BADGE_VARIANT: Record<
  (typeof DOCUMENT_STATUSES)[number],
  "default" | "secondary" | "destructive" | "outline"
> = {
  NOT_UPLOADED: "outline",
  UPLOADED: "secondary",
  UNDER_REVIEW: "secondary",
  VERIFIED: "default",
  REJECTED: "destructive",
  REUPLOAD_REQUIRED: "destructive",
};

function isImageFile(path: string) {
  return /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(path);
}

// Popup preview for a document file — images render inline, PDFs render in
// an iframe, both with an "Open in new tab" fallback for anything the
// iframe can't handle (e.g. a browser configured to download PDFs).
function FilePreviewDialog({
  url,
  name,
  isImage,
  children,
}: {
  url: string;
  name?: string | null;
  isImage: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{name ?? "Document preview"}</DialogTitle>
        </DialogHeader>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- previewing an arbitrary uploaded/local file URL
          <img src={url} alt={name ?? "Document preview"} className="max-h-[75vh] w-full rounded object-contain" />
        ) : (
          <iframe src={url} title={name ?? "Document preview"} className="h-[75vh] w-full rounded border" />
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          Open in new tab
        </a>
      </DialogContent>
    </Dialog>
  );
}

// Clickable chip used as a FilePreviewDialog trigger — a thumbnail (or a
// file icon for PDFs, so non-images still get a consistent preview
// affordance) plus a caption. `size="lg"` stacks the caption under a bigger
// thumbnail for the primary header preview; `size="sm"` stays a compact
// inline row for the tighter upload-row preview.
//
// Forwards ref + spreads incoming props (onClick, aria-*, etc.) because this
// is rendered via FilePreviewDialog's <DialogTrigger asChild> — Radix's Slot
// clones this element to inject its own click handler and ref, and without
// forwarding them here they'd never reach the actual <button>, so clicking
// would silently do nothing.
const FileThumb = forwardRef<
  HTMLButtonElement,
  {
    url: string;
    fileName?: string | null;
    isImage: boolean;
    label?: string;
    size?: "sm" | "lg";
  } & Omit<ComponentPropsWithoutRef<"button">, "name">
>(function FileThumb({ url, fileName, isImage, label = "Preview", size = "sm", className, ...props }, ref) {
  const caption = (
    <span className={size === "lg" ? "max-w-[7rem] truncate text-center text-xs" : "max-w-[12rem] truncate"}>
      {label}
      {fileName ? ` · ${fileName}` : ""}
    </span>
  );
  const thumb = isImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- local/remote file thumbnail
    <img
      src={url}
      alt={fileName ?? "Document preview"}
      className={
        size === "lg"
          ? "h-16 w-auto max-w-[7rem] rounded object-contain"
          : "h-10 w-10 rounded bg-muted object-contain"
      }
    />
  ) : (
    <span
      className={cn(
        "flex items-center justify-center rounded bg-muted",
        size === "lg" ? "h-16 w-14" : "h-10 w-10",
      )}
    >
      <FileText className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} />
    </span>
  );

  return (
    <button
      ref={ref}
      type="button"
      title={fileName ? `${label}: ${fileName}` : label}
      className={cn(
        size === "lg"
          ? "flex w-fit flex-col items-center gap-1 rounded-lg border p-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          : "flex items-center gap-2 rounded-md border p-1 pr-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
        className,
      )}
      {...props}
    >
      {thumb}
      {caption}
    </button>
  );
});

export type DocumentRowDoc = {
  id: string;
  status: DocumentStatus;
  remarks: string | null;
  filePath: string | null;
  originalName: string | null;
  requiredDocumentType: { name: string };
};

// Without a file, only "Not uploaded" makes sense — every other status
// (including Rejected/Reupload required) implies a file was reviewed.
function isStatusDisabled(s: DocumentStatus, hasFile: boolean) {
  return hasFile ? s === "NOT_UPLOADED" : s !== "NOT_UPLOADED";
}

// Callers must render this keyed by `doc.id` (stable and unique — do NOT key
// by updatedAt: ensureConnectionDocuments creates a connection's documents
// in one createMany call, so several docs can share the exact same
// timestamp, which would collide as React keys).
//
// status/remarks are "derived with override": they track doc.status/
// doc.remarks directly and only diverge once the admin edits them locally,
// so a status change from elsewhere (e.g. upload auto-setting UPLOADED)
// is picked up immediately instead of needing a remount.
export function DocumentRow({ doc }: { doc: DocumentRowDoc }) {
  const [statusOverride, setStatusOverride] = useState<DocumentStatus | null>(null);
  const [remarksOverride, setRemarksOverride] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPending, setUploadPending] = useState(false);

  // Drop any local override once the server value moves out from under it
  // (a save, an upload's auto status change, or another admin's edit).
  // Adjusted during render rather than in an effect — React's documented
  // pattern for resetting state derived from props without an extra paint.
  const [syncedStatus, setSyncedStatus] = useState(doc.status);
  const [syncedRemarks, setSyncedRemarks] = useState(doc.remarks);
  if (doc.status !== syncedStatus || doc.remarks !== syncedRemarks) {
    setSyncedStatus(doc.status);
    setSyncedRemarks(doc.remarks);
    setStatusOverride(null);
    setRemarksOverride(null);
  }

  const status = statusOverride ?? doc.status;
  const remarks = remarksOverride ?? doc.remarks ?? "";

  // Selected-but-not-yet-uploaded file preview, revoked whenever it changes/unmounts.
  const selectedPreviewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );
  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl);
    };
  }, [selectedPreviewUrl]);

  const isDirty = status !== doc.status || remarks !== (doc.remarks ?? "");

  async function handleSave() {
    setSavePending(true);
    try {
      await updateDocumentStatus({
        connectionDocumentId: doc.id,
        status,
        remarks: remarks.trim() ? remarks : undefined,
      });
    } finally {
      setSavePending(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploadPending(true);
    try {
      const formData = new FormData();
      formData.set("connectionDocumentId", doc.id);
      formData.set("file", selectedFile);
      await uploadConnectionDocument(formData);
      setSelectedFile(null);
    } finally {
      setUploadPending(false);
    }
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="font-normal">{doc.requiredDocumentType.name}</Label>
            <Badge variant={DOCUMENT_STATUS_BADGE_VARIANT[doc.status]}>
              {doc.status.replace(/_/g, " ")}
            </Badge>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Select
              value={status}
              onValueChange={(v) => setStatusOverride(v as DocumentStatus)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_STATUSES.map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    disabled={isStatusDisabled(s, !!doc.filePath)}
                  >
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Remarks"
              value={remarks}
              onChange={(e) => setRemarksOverride(e.target.value)}
              className="w-48"
            />
            <Button
              size="sm"
              disabled={!isDirty || savePending}
              onClick={handleSave}
            >
              {savePending ? "Saving…" : "Save"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept="image/*,application/pdf"
              className="max-w-xs"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedFile || uploadPending}
              onClick={handleUpload}
            >
              {uploadPending
                ? "Uploading…"
                : doc.filePath
                  ? "Replace file"
                  : "Upload file"}
            </Button>
            {selectedFile && selectedPreviewUrl && (
              <FilePreviewDialog
                url={selectedPreviewUrl}
                name={selectedFile.name}
                isImage={selectedFile.type.startsWith("image/")}
              >
                <FileThumb
                  url={selectedPreviewUrl}
                  fileName={selectedFile.name}
                  isImage={selectedFile.type.startsWith("image/")}
                  label="New file"
                />
              </FilePreviewDialog>
            )}
          </div>
        </div>

        {doc.filePath && (
          <FilePreviewDialog
            url={doc.filePath}
            name={doc.originalName}
            isImage={isImageFile(doc.filePath)}
          >
            <FileThumb
              url={doc.filePath}
              fileName={doc.originalName}
              isImage={isImageFile(doc.filePath)}
              size="lg"
            />
          </FilePreviewDialog>
        )}
      </div>
    </div>
  );
}
