import type { RunDetail } from "../../../../shared/contracts";
import { FlakyHeatmap } from "../../components/Charts";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { statusLabel } from "../../lib/format";

export function FlakyTab({ detail }: { detail: RunDetail }) {
  const unstable = detail.flaky.filter((item) => item.score > 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Stability history"
          description="One square per attempt. Any mix of colours means the test is flaky."
          actions={
            <span className="text-xs text-muted">{detail.summary.repeat} attempts per test</span>
          }
        />
        <CardBody>
          <FlakyHeatmap items={detail.flaky} />
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["passed", "healed", "failed", "flaky"] as const).map((tone) => (
          <div
            key={tone}
            className="surface-card flex items-center gap-2 px-4 py-3 text-xs text-muted"
          >
            <span
              aria-hidden
              className="h-3 w-3 rounded-sm"
              style={{ background: `var(--${tone})` }}
            />
            {tone === "flaky" ? "Inconsistent" : statusLabel(tone)}
          </div>
        ))}
      </div>

      {unstable.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-xs text-muted">
          Every test produced the same outcome on all attempts — no flakiness detected in this run.
        </p>
      ) : (
        <p className="rounded-lg border border-flaky/30 bg-flaky/10 px-4 py-3 text-xs text-flaky">
          {unstable.length} test{unstable.length === 1 ? "" : "s"} changed outcome between attempts.
          Increase the repeat count on the next run to gather more signal.
        </p>
      )}
    </div>
  );
}
