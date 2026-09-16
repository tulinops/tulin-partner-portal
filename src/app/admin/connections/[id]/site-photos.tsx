import { uploadSitePhoto } from "@/server/connections";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/action-form";

const CATEGORIES = [
  { value: "ROOF", label: "Roof photos" },
  { value: "METER", label: "Electrical meter" },
  { value: "INSTALL_AREA", label: "Installation area" },
  { value: "DB_PANEL", label: "DB / panel" },
  { value: "OTHER", label: "Other" },
] as const;

type Photo = { category: string; filePath: string; originalName: string };

export function SitePhotos({ connectionId, photos }: { connectionId: string; photos: Photo[] }) {
  async function uploadAction(formData: FormData) {
    "use server";
    await uploadSitePhoto(formData);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORIES.map((cat) => {
        const catPhotos = photos.filter((p) => p.category === cat.value);
        return (
          <div key={cat.value} className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-semibold">
              {cat.label} <span className="text-muted-foreground">({catPhotos.length})</span>
            </p>
            {catPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {catPhotos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element -- Vercel Blob URL, not an optimizable remote asset
                  <img
                    key={p.filePath}
                    src={p.filePath}
                    alt={p.originalName}
                    className="h-16 w-16 rounded object-cover"
                  />
                ))}
              </div>
            )}
            <ActionForm action={uploadAction} successMessage="Photo uploaded" className="flex items-center gap-2">
              <input type="hidden" name="connectionId" value={connectionId} />
              <input type="hidden" name="category" value={cat.value} />
              <input type="file" name="file" accept="image/*" required className="text-xs" />
              <Button type="submit" size="sm" variant="outline">
                Upload
              </Button>
            </ActionForm>
          </div>
        );
      })}
    </div>
  );
}
