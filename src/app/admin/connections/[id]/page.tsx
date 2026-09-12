import { notFound } from "next/navigation";
import { getConnectionDetail, recordPayment, updateConnectionStatus } from "@/server/connections";
import { listInventoryItems, allocateToConnection } from "@/server/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUSES = ["PENDING_INSTALL", "IN_PROGRESS", "INSTALLED", "CANCELLED"] as const;

function money(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function ConnectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getConnectionDetail(id);
  if (!detail) notFound();
  const { connection, amountCollected, allocatedCost, profit } = detail;
  const items = await listInventoryItems();

  async function allocateAction(formData: FormData) {
    "use server";
    await allocateToConnection({
      connectionId: id,
      inventoryItemId: String(formData.get("inventoryItemId")),
      quantity: Number(formData.get("quantity")),
    });
  }

  async function recordPaymentAction(formData: FormData) {
    "use server";
    await recordPayment({
      connectionId: id,
      amount: Number(formData.get("amount")),
      note: String(formData.get("note") || "") || undefined,
    });
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    await updateConnectionStatus({
      connectionId: id,
      status: formData.get("status") as (typeof STATUSES)[number],
      assignedInstaller: String(formData.get("assignedInstaller") || "") || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{connection.customerName}</h1>
          <p className="text-sm text-muted-foreground">
            {connection.phone} {connection.address ? `· ${connection.address}` : ""}
          </p>
        </div>
        <Badge>{connection.status.replace("_", " ")}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(amountCollected)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allocated cost</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(allocatedCost)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(profit)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status &amp; installer</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateStatusAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={connection.status}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedInstaller">Assigned installer</Label>
              <Input
                id="assignedInstaller"
                name="assignedInstaller"
                defaultValue={connection.assignedInstaller ?? ""}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit">Update</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Allocate inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={allocateAction} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="inventoryItemId">Item</Label>
                <Select name="inventoryItemId" required>
                  <SelectTrigger id="inventoryItemId">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.runningStock.toString()} {item.unit} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" step="0.01" required />
              </div>
              <div className="flex items-end">
                <Button type="submit">Allocate</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Record customer payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={recordPaymentAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" name="note" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Record payment</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory used</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connection.inventoryTxns
                .filter((t) => t.type === "ALLOCATION")
                .map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.inventoryItem.name}</TableCell>
                    <TableCell>{t.quantity.toString()}</TableCell>
                    <TableCell>{money(Number(t.unitCost ?? 0))}</TableCell>
                  </TableRow>
                ))}
              {connection.inventoryTxns.filter((t) => t.type === "ALLOCATION").length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No inventory allocated yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
