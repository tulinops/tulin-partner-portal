import { getDashboardTotals } from "@/server/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const LEAD_STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "QUOTED", "WON", "LOST"] as const;

export default async function DashboardPage() {
  const totals = await getDashboardTotals();
  const stageCounts = LEAD_STAGES.map((stage) => ({ stage, count: totals.leadsByStage[stage] ?? 0 }));
  const maxCount = Math.max(1, ...stageCounts.map((s) => s.count));

  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={[{ label: "Dashboard" }]} title="Dashboard" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              New leads (30d)
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-bold">{totals.newLeadsLast30Days}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Active connections
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-bold">{totals.activeConnections}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Total collected
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-bold text-primary">
            {formatMoney(totals.totalCollected)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Net profit
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-bold text-primary">
            {formatMoney(totals.netProfit)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stageCounts.map(({ stage, count }) => (
              <div key={stage} className="grid grid-cols-[100px_1fr_2ch] items-center gap-3 text-sm">
                <span className="font-semibold text-muted-foreground">{stage.replace("_", " ")}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-right font-mono text-muted-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totals.activity.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            )}
            {totals.activity.map((item, i) => (
              <div key={i} className="flex gap-2.5 border-b border-border pb-3 last:border-0 last:pb-0">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div className="text-sm">
                  <p>
                    <span className="font-semibold">{item.headline}</span> — {item.detail}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.at.toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock levels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {totals.stockLevels.length === 0 && (
            <p className="text-sm text-muted-foreground">No inventory items yet.</p>
          )}
          {totals.stockLevels.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.name}</span>
              <span className="font-mono font-medium">
                {item.runningStock.toString()} {item.unit}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
