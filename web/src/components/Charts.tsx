import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FlakyInfo, Stats } from "../../../shared/contracts";
import { cn } from "../lib/cn";
import { formatDateTime } from "../lib/format";
import { tones } from "../lib/status";

const AXIS = { stroke: "var(--muted)", fontSize: 10 };
const GRID = "var(--line)";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--fg)",
} as const;

/** Pass-rate trend over the most recent runs. */
export function PassRateTrend({
  data,
  height = 220,
}: {
  data: Stats["passRateTrend"];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-xs text-muted">
        No runs yet — the trend appears after the first run.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="passRateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--passed)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--passed)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        {/* The category is createdAt, not `label`: the server builds `label` by
            slicing the run id down to its raw stamp ("20261031222"), which is not
            a readable date and collides for runs started in the same window. Both
            the axis and the tooltip run it through formatDateTime so a tick and
            its tooltip can never disagree about 12h vs 24h. */}
        <XAxis
          dataKey="createdAt"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatDateTime}
        />
        <YAxis domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value}%`, "Pass rate"]}
          labelFormatter={(label: string) => `Run ${formatDateTime(label)}`}
        />
        <Area
          type="monotone"
          dataKey="passRate"
          stroke="var(--passed)"
          strokeWidth={2}
          fill="url(#passRateFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface OutcomeDonutProps {
  passed: number;
  failed: number;
  healed: number;
  flaky: number;
  height?: number;
}

/** Outcome split for a single run. */
export function OutcomeDonut({ passed, failed, healed, flaky, height = 200 }: OutcomeDonutProps) {
  const data = [
    { name: "Passed", value: passed, color: tones.passed.color },
    { name: "Healed", value: healed, color: tones.healed.color },
    { name: "Failed", value: failed, color: tones.failed.color },
    { name: "Flaky", value: flaky, color: tones.flaky.color },
  ].filter((entry) => entry.value > 0);

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (total === 0) {
    return <p className="px-2 py-10 text-center text-xs text-muted">No results yet.</p>;
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [`${value}`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold text-fg">{total}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted">tests</span>
      </div>
    </div>
  );
}

/** Repairs per model — shows which provider does the healing. */
export function RepairsByModelChart({ data }: { data: Array<{ model: string; count: number }> }) {
  if (data.length === 0) {
    return <p className="px-2 py-10 text-center text-xs text-muted">No repairs recorded yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="model"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value}`, "repairs"]}
        />
        <Bar
          dataKey="count"
          radius={[0, 6, 6, 0]}
          fill={tones.healed.color}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

const HEAT_TONE: Record<string, string> = {
  passed: tones.passed.color,
  healed: tones.healed.color,
  failed: tones.failed.color,
  flaky: tones.flaky.color,
};

/** Pass/fail history grid — one column per attempt, purple when unstable. */
export function FlakyHeatmap({ items }: { items: FlakyInfo[] }) {
  if (items.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-xs text-muted">
        Run a test more than once to see stability history.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.testId} className="flex flex-wrap items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs text-fg" title={item.title}>
            {item.title}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {item.history.map((status, index) => (
              <span
                key={index}
                title={`Attempt ${index + 1}: ${String(status)}`}
                className="h-4 w-4 rounded-sm border border-black/10"
                style={{ background: HEAT_TONE[String(status)] ?? "var(--line-strong)" }}
              />
            ))}
          </div>
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
              item.score >= 0.5 ? "bg-flaky/15 text-flaky" : "bg-surface-3 text-muted",
            )}
          >
            {(item.score * 100).toFixed(0)}% unstable
          </span>
        </li>
      ))}
    </ul>
  );
}
