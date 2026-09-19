import Link from "next/link";
import { listConnections } from "@/server/connections";
import { ConnectionStatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/layout/PageHeader";
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
      <PageHeader
        breadcrumbs={[{ label: "Connections" }]}
        title="Connections"
        description="Won leads convert into connections from the lead detail page."
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Customer #</TableHead>
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
                <TableCell className="font-mono text-muted-foreground">#{c.id.slice(-6).toUpperCase()}</TableCell>
                <TableCell className="font-mono">{c.systemSizeKw ? `${c.systemSizeKw} kW` : "—"}</TableCell>
                <TableCell>
                  <ConnectionStatusBadge status={c.status} />
                </TableCell>
                <TableCell className="font-mono">₹{collected.toLocaleString("en-IN")}</TableCell>
              </TableRow>
            );
          })}
          {connections.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No connections yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
