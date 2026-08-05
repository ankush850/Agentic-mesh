import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  FileCode2,
  FlaskConical,
  Radio,
  RefreshCw,
  ShieldQuestion,
  TestTube2,
  Wrench,
} from "lucide-react";
import { useRun } from "../hooks/useRuns";
import { api } from "../lib/api";
import { formatDateTime, formatDuration, targetLabel } from "../lib/format";
import { isTerminalRunStatus } from "../lib/status";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { ErrorState, SkeletonCard } from "../components/ui/States";
import { StatusBadge } from "../components/StatusBadge";
import { Tabs } from "../components/ui/Tabs";
import { OverviewTab } from "./report/OverviewTab";
import { TestsTab } from "./report/TestsTab";
import { RepairsTab } from "./report/RepairsTab";
import { FlakyTab } from "./report/FlakyTab";
import { VisualTab } from "./report/VisualTab";
import { ExportTab } from "./report/ExportTab";

type TabId = "overview" | "tests" | "repairs" | "flaky" | "visual" | "export";

export default function RunReport() {
  const { runId } = useParams<{ runId: string }>();
  const detail = useRun(runId);
  const [tab, setTab] = useState<TabId>("overview");

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard rows={3} />
        <SkeletonCard rows={6} />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <ErrorState
        title="Could not load this run"
        message={(detail.error as Error).message}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  if (!detail.data) return null;

  const { summary, ticket, repairs } = detail.data;
  const live = !isTerminalRunStatus(summary.status);
  const pendingRepairs = repairs.filter((repair) => !repair.review).length;

  return (
    <div className="space-y-5">
      <Link
        to="/runs"
        className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All runs
      </Link>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={summary.status} size="md" />
                {summary.mock ? <Badge tone="flaky">mock run</Badge> : null}
                <Badge tone="queued">{summary.appVersion}</Badge>
                {summary.repeat > 1 ? (
                  <Badge tone="running">×{summary.repeat} repeats</Badge>
                ) : null}
              </div>
              <h2 className="truncate text-lg font-semibold tracking-tight text-fg">
                {ticket ? `${ticket.key} — ${ticket.title}` : "Ad-hoc test run"}
              </h2>
              <p className="mt-1 font-mono text-[11px] text-muted">{summary.runId}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {live ? (
                <Link to={`/runs/${summary.runId}/live`}>
                  <Button variant="secondary" size="sm">
                    <Radio className="h-3.5 w-3.5" aria-hidden />
                    Live view
                  </Button>
                </Link>
              ) : null}
              <a href={api.exportUrl(summary.runId, "html")} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  <FileCode2 className="h-3.5 w-3.5" aria-hidden />
                  Engine report
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </Button>
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void detail.refetch()}
                loading={detail.isFetching}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Refresh
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 text-xs sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Target", value: targetLabel(summary.baseUrl) },
              { label: "Tests", value: `${summary.total}` },
              { label: "Green", value: `${summary.passed + summary.healed}` },
              { label: "Healed", value: `${summary.healed}` },
              { label: "Duration", value: formatDuration(summary.durationMs) },
              { label: "Started", value: formatDateTime(summary.startedAt ?? summary.createdAt) },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[10px] uppercase tracking-wider text-muted">{item.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-fg">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as TabId)}
        items={[
          {
            id: "overview",
            label: "Overview",
            icon: <ShieldQuestion className="h-3.5 w-3.5" aria-hidden />,
          },
          {
            id: "tests",
            label: "Tests",
            count: summary.total,
            icon: <TestTube2 className="h-3.5 w-3.5" aria-hidden />,
          },
          {
            id: "repairs",
            label: "Repairs",
            count: pendingRepairs,
            icon: <Wrench className="h-3.5 w-3.5" aria-hidden />,
          },
          {
            id: "flaky",
            label: "Flaky",
            count: summary.flaky,
            icon: <FlaskConical className="h-3.5 w-3.5" aria-hidden />,
          },
          { id: "visual", label: "Visual" },
          { id: "export", label: "Export" },
        ]}
      />

      <div role="tabpanel" aria-label={tab}>
        {tab === "overview" ? <OverviewTab detail={detail.data} /> : null}
        {tab === "tests" ? <TestsTab detail={detail.data} /> : null}
        {tab === "repairs" ? <RepairsTab detail={detail.data} /> : null}
        {tab === "flaky" ? <FlakyTab detail={detail.data} /> : null}
        {tab === "visual" ? <VisualTab detail={detail.data} /> : null}
        {tab === "export" ? <ExportTab detail={detail.data} /> : null}
      </div>
    </div>
  );
}
