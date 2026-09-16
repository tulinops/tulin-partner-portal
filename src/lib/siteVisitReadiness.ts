import type { SiteInspectionDetails } from "@/server/connections";
import type { SitePhotoCategory } from "@/generated/prisma/enums";

// Fields that must all be filled, and photo categories that must all have at
// least one photo, before a site visit can be marked COMPLETED — shared
// between src/server/connections.ts's server-side gate and page.tsx's
// display-only completion check, so the two can't drift apart. Plain
// (non-async) functions, so this can't live in connections.ts itself — that
// file is "use server", where every export must be an async Server Action.
const REQUIRED_INSPECTION_FIELDS: (keyof SiteInspectionDetails)[] = [
  "roofType",
  "roofCondition",
  "roofAreaSqft",
  "shadowObstruction",
  "orientation",
  "roofAccess",
  "electricalConnectionDetails",
  "meterInformation",
  "otherRequirements",
];

export function isInspectionComplete(details: SiteInspectionDetails | null): boolean {
  if (!details) return false;
  return REQUIRED_INSPECTION_FIELDS.every((key) => {
    const value = details[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

export const REQUIRED_SITE_PHOTO_CATEGORIES: SitePhotoCategory[] = ["ROOF", "METER", "INSTALL_AREA"];

export function areRequiredSitePhotosComplete(photos: { category: SitePhotoCategory }[]): boolean {
  return REQUIRED_SITE_PHOTO_CATEGORIES.every((category) => photos.some((p) => p.category === category));
}

// Also plain, so it lives here rather than as a `const` export from
// connections.ts's "use server" module.
export const MAX_PHOTOS_PER_CATEGORY = 3;
