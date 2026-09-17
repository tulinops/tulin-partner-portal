"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EQUIPMENT_TYPES, WARRANTY_TYPES } from "@/lib/installationEquipment";
import { updateWarrantyRecord } from "@/server/connections";
import type { EquipmentType, WarrantyType } from "@/generated/prisma/enums";

export type EditableWarrantyRecord = {
  id: string;
  connectionId: string;
  equipmentType: EquipmentType;
  productName: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  warrantyType: WarrantyType;
  startDate: string; // yyyy-mm-dd
  periodMonths: number;
  terms: string | null;
};

export function EditWarrantyDialog({ record }: { record: EditableWarrantyRecord }) {
  const [open, setOpen] = useState(false);
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(record.equipmentType);
  const [productName, setProductName] = useState(record.productName);
  const [manufacturer, setManufacturer] = useState(record.manufacturer ?? "");
  const [model, setModel] = useState(record.model ?? "");
  const [serialNumber, setSerialNumber] = useState(record.serialNumber ?? "");
  const [warrantyType, setWarrantyType] = useState<WarrantyType>(record.warrantyType);
  const [startDate, setStartDate] = useState(record.startDate);
  const [periodMonths, setPeriodMonths] = useState(String(record.periodMonths));
  const [terms, setTerms] = useState(record.terms ?? "");
  const [pending, setPending] = useState(false);

  function resetFields() {
    setEquipmentType(record.equipmentType);
    setProductName(record.productName);
    setManufacturer(record.manufacturer ?? "");
    setModel(record.model ?? "");
    setSerialNumber(record.serialNumber ?? "");
    setWarrantyType(record.warrantyType);
    setStartDate(record.startDate);
    setPeriodMonths(String(record.periodMonths));
    setTerms(record.terms ?? "");
  }

  const isDirty =
    equipmentType !== record.equipmentType ||
    productName !== record.productName ||
    manufacturer !== (record.manufacturer ?? "") ||
    model !== (record.model ?? "") ||
    serialNumber !== (record.serialNumber ?? "") ||
    warrantyType !== record.warrantyType ||
    startDate !== record.startDate ||
    periodMonths !== String(record.periodMonths) ||
    terms !== (record.terms ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await updateWarrantyRecord({
        id: record.id,
        connectionId: record.connectionId,
        equipmentType,
        productName,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        warrantyType,
        startDate: new Date(startDate),
        periodMonths: Number(periodMonths) || 0,
        terms: terms.trim() || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Warranty record updated");
        setOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetFields();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon-sm" title={`Edit ${record.productName}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>Edit warranty record</DialogTitle>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`equipmentType-${record.id}`}>Equipment type</Label>
            <Select value={equipmentType} onValueChange={(v) => setEquipmentType(v as EquipmentType)}>
              <SelectTrigger id={`equipmentType-${record.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`productName-${record.id}`}>Product name</Label>
            <Input
              id={`productName-${record.id}`}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`manufacturer-${record.id}`}>Manufacturer</Label>
            <Input
              id={`manufacturer-${record.id}`}
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`model-${record.id}`}>Model</Label>
            <Input id={`model-${record.id}`} value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`serialNumber-${record.id}`}>Serial number</Label>
            <Input
              id={`serialNumber-${record.id}`}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`warrantyType-${record.id}`}>Warranty type</Label>
            <Select value={warrantyType} onValueChange={(v) => setWarrantyType(v as WarrantyType)}>
              <SelectTrigger id={`warrantyType-${record.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARRANTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`startDate-${record.id}`}>Start date</Label>
            <Input
              id={`startDate-${record.id}`}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`periodMonths-${record.id}`}>Period (months)</Label>
            <Input
              id={`periodMonths-${record.id}`}
              type="number"
              value={periodMonths}
              onChange={(e) => setPeriodMonths(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`terms-${record.id}`}>Terms</Label>
            <Input id={`terms-${record.id}`} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={!isDirty || pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
