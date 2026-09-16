import { MAX_PHOTOS_PER_CATEGORY } from "@/lib/siteVisitReadiness";
import { SitePhotoUpload } from "./site-photo-upload";
import { SitePhotoThumbnail } from "./site-photo-thumbnail";

// ROOF/METER/INSTALL_AREA are required before a site visit can be marked
// complete — see REQUIRED_SITE_PHOTO_CATEGORIES in src/server/connections.ts,
// which this list must stay in sync with.
const CATEGORIES = [
  { value: "ROOF", label: "Roof photos", required: true },
  { value: "METER", label: "Electrical meter", required: true },
  { value: "INSTALL_AREA", label: "Installation area", required: true },
  { value: "DB_PANEL", label: "DB / panel", required: false },
  { value: "OTHER", label: "Other", required: false },
] as const;

type Photo = { id: string; category: string; filePath: string; originalName: string };

export function SitePhotos({ connectionId, photos }: { connectionId: string; photos: Photo[] }) {
  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORIES.map((cat) => {
        const catPhotos = photos.filter((p) => p.category === cat.value);
        return (
          <div key={cat.value} className="flex h-full flex-col space-y-2 rounded-md border p-3">
            <p className="text-sm font-semibold">
              {cat.label}
              {cat.required && <span className="text-destructive"> *</span>}{" "}
              <span className="text-muted-foreground">
                ({catPhotos.length}/{MAX_PHOTOS_PER_CATEGORY})
              </span>
            </p>
            {catPhotos.length > 0 && (
              <div className="flex flex-1 flex-wrap gap-2">
                {catPhotos.map((p) => (
                  <SitePhotoThumbnail
                    key={p.id}
                    id={p.id}
                    connectionId={connectionId}
                    filePath={p.filePath}
                    originalName={p.originalName}
                  />
                ))}
              </div>
            )}
            <SitePhotoUpload
              connectionId={connectionId}
              category={cat.value}
              className="mt-auto"
              disabled={catPhotos.length >= MAX_PHOTOS_PER_CATEGORY}
            />
          </div>
        );
      })}
    </div>
  );
}
