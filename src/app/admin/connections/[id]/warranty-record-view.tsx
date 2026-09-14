"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function WarrantyRecordView({
  record,
}: {
  record: {
    productName: string;
    equipmentType: string;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    warrantyType: string;
    periodMonths: number;
    startDate: string;
    expiryDate: string;
    terms: string | null;
  };
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{record.productName}</DialogTitle>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Equipment type:</span>{" "}
            {record.equipmentType.replace(/_/g, " ")}
          </p>
          <p>
            <span className="text-muted-foreground">Manufacturer / Model / Serial:</span>{" "}
            {[record.manufacturer, record.model, record.serialNumber].filter(Boolean).join(" · ") || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Warranty:</span> {record.warrantyType.replace(/_/g, " ")} ·{" "}
            {record.periodMonths} months
          </p>
          <p>
            <span className="text-muted-foreground">Start date:</span> {record.startDate}
          </p>
          <p>
            <span className="text-muted-foreground">Expires:</span> {record.expiryDate}
          </p>
          {record.terms && (
            <div>
              <p className="text-muted-foreground">Terms</p>
              <p className="whitespace-pre-line">{record.terms}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
