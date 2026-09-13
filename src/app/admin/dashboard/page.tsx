import { getDashboardTotals } from "@/server/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <h1 className="font-heading text-2xl font-extrabold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Total invested (inventory)
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-bold">{formatMoney(totals.totalInvested)}</CardContent>
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
    </div>
  );
}
