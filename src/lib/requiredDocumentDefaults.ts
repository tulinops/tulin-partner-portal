// Seeded onto every new tenant so the Documents tab has something to verify
// from day one — without this, a fresh tenant's Documents tab is completely
// empty (no way to add ad-hoc documents; the checklist is driven entirely by
// this tenant-configurable list) until someone thinks to visit Business
// Profile and add types manually.
export const DEFAULT_REQUIRED_DOCUMENT_TYPES = [
  { name: "Identity document (Aadhaar / PAN)" },
  { name: "Electricity bill (latest)" },
  { name: "Electricity connection details" },
  { name: "Bank account details" },
  { name: "Property ownership document" },
];
