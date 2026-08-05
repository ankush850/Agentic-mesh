import { useMemo, useState } from "react";
import { Images } from "lucide-react";
import type { RunDetail } from "../../../../shared/contracts";
import { PixelDiff, ScreenshotCompare } from "../../components/ScreenshotCompare";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Select } from "../../components/ui/Field";
import { EmptyState } from "../../components/ui/States";
import { artifactUrl } from "../../lib/api";

export function VisualTab({ detail }: { detail: RunDetail }) {
  const pairs = useMemo(
    () =>
      detail.repairs
        .filter((repair) => repair.beforeScreenshot || repair.afterScreenshot)
        .map((repair) => ({
          id: repair.repairId,
          label: `${repair.stepDescription} — step ${repair.stepIndex + 1}`,
          before: repair.beforeScreenshot,
          after: repair.afterScreenshot,
        })),
    [detail.repairs],
  );

  const [selected, setSelected] = useState(pairs[0]?.id ?? "");
  const active = pairs.find((pair) => pair.id === selected) ?? pairs[0];
  const screenshots = detail.tests.filter((test) => Boolean(test.screenshotPath));

  if (pairs.length === 0 && screenshots.length === 0) {
    return (
      <EmptyState
        title="No visual evidence"
        description="Screenshots are captured when a step fails or a locator is healed."
        icon={<Images className="h-5 w-5" aria-hidden />}
      />
    );
  }

  return (
    <div className="space-y-5">
      {pairs.length > 0 ? (
        <Card>
          <CardHeader
            title="Healing evidence"
            description="Drag the slider to reveal the page before and after the repair."
            actions={
              <Select
                value={active?.id ?? ""}
                onChange={(event) => setSelected(event.target.value)}
                aria-label="Select a repair to compare"
                className="w-64"
              >
                {pairs.map((pair) => (
                  <option key={pair.id} value={pair.id}>
                    {pair.label}
                  </option>
                ))}
              </Select>
            }
          />
          <CardBody className="space-y-5">
            {active ? (
              <>
                <ScreenshotCompare
                  before={active.before}
                  after={active.after}
                  beforeLabel="Before heal"
                  afterLabel="After heal"
                />
                <div>
                  <h3 className="mb-2 text-xs font-medium text-fg">Pixel diff</h3>
                  <PixelDiff before={active.before} after={active.after} />
                </div>
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {screenshots.length > 0 ? (
        <Card>
          <CardHeader title="Captured screenshots" description="Every test that produced a frame" />
          <CardBody>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {screenshots.map((test) => {
                const url = artifactUrl(test.screenshotPath);
                return (
                  <li key={test.testId} className="overflow-hidden rounded-lg border border-line">
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={url}
                          alt={`Screenshot for ${test.title}`}
                          className="h-36 w-full object-cover object-top transition-transform hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </a>
                    ) : null}
                    <p className="border-t border-line bg-surface px-2 py-1.5 text-[11px] text-muted">
                      {test.title}
                    </p>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
