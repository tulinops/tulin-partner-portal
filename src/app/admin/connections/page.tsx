import Link from "next/link";
import { listConnections } from "@/server/connections";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ConnectionsPage() {
  const connections = await listConnections();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Connections</h1>
      <p className="text-sm text-muted-foreground">
        Won leads convert into connections from the lead detail page.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>System size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Collected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {connections.map((c) => {
            const collected = c.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/admin/connections/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                    {c.customerName}
                  </Link>
                </TableCell>
                <TableCell>{c.systemSizeKw ? `${c.systemSizeKw} kW` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.status === "COMPLETED" ? "default" : c.status === "CANCELLED" ? "destructive" : "secondary"}>
                    {c.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>₹{collected.toLocaleString("en-IN")}</TableCell>
              </TableRow>
            );
          })}
          {connections.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No connections yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
