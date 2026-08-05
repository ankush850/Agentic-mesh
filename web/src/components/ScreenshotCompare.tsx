import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ImageOff } from "lucide-react";
import { cn } from "../lib/cn";
import { artifactUrl } from "../lib/api";

interface ScreenshotCompareProps {
  before?: string;
  after?: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

function Frame({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const url = artifactUrl(src);
  if (!url) {
    return (
      <div className="flex h-44 items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 text-xs text-muted">
        <ImageOff className="h-4 w-4" aria-hidden />
        No screenshot
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={cn("h-44 w-full object-cover object-top", className)}
      loading="lazy"
    />
  );
}

/** Before/after screenshots with a draggable reveal slider. */
export function ScreenshotCompare({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: ScreenshotCompareProps) {
  const [position, setPosition] = useState(50);
  const afterUrl = artifactUrl(after);
  const beforeUrl = artifactUrl(before);

  if (!beforeUrl && !afterUrl) {
    return <Frame alt={beforeLabel} className={className} />;
  }

  if (!beforeUrl || !afterUrl) {
    return (
      <div className={cn("space-y-2", className)}>
        <figure className="overflow-hidden rounded-lg border border-line bg-surface-2">
          <Frame src={beforeUrl ?? afterUrl} alt={beforeUrl ? beforeLabel : afterLabel} />
        </figure>
        <p className="text-[11px] text-muted">{beforeUrl ? beforeLabel : afterLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative overflow-hidden rounded-lg border border-line bg-surface-2">
        <img
          src={afterUrl}
          alt={afterLabel}
          className="h-44 w-full object-cover object-top"
          loading="lazy"
        />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
          <img
            src={beforeUrl}
            alt={beforeLabel}
            className="h-44 w-full object-cover object-top"
            style={{ width: `${(100 / Math.max(position, 1)) * 100}%`, maxWidth: "none" }}
            loading="lazy"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-accent"
          style={{ left: `${position}%` }}
        />
        <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {beforeLabel}
        </span>
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {afterLabel}
        </span>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted">
        <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Reveal before screenshot</span>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="h-1 w-full cursor-ew-resize accent-[var(--accent)]"
          aria-label="Before/after reveal position"
        />
      </label>
    </div>
  );
}

interface PixelDiffProps {
  before?: string;
  after?: string;
  className?: string;
}

/**
 * Canvas pixel comparison. Only rendered inside the Visual tab, so the cost of
 * decoding two images is paid on demand.
 */
export function PixelDiff({ before, after, className }: PixelDiffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<{ changed: number; ratio: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const beforeUrl = artifactUrl(before);
  const afterUrl = artifactUrl(after);

  useEffect(() => {
    if (!beforeUrl || !afterUrl) return;
    let cancelled = false;
    setStats(null);
    setError(null);

    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load ${src}`));
        image.src = src;
      });

    Promise.all([load(beforeUrl), load(afterUrl)])
      .then(([a, b]) => {
        if (cancelled) return;
        const width = Math.min(a.naturalWidth, b.naturalWidth, 900);
        const height = Math.round(
          (Math.min(a.naturalHeight, b.naturalHeight) / Math.min(a.naturalWidth, b.naturalWidth)) *
            width,
        );
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return;

        const buffer = (image: HTMLImageElement) => {
          const scratch = document.createElement("canvas");
          scratch.width = width;
          scratch.height = height;
          const scratchContext = scratch.getContext("2d");
          scratchContext?.drawImage(image, 0, 0, width, height);
          return scratchContext?.getImageData(0, 0, width, height).data ?? new Uint8ClampedArray();
        };

        const left = buffer(a);
        const right = buffer(b);
        const output = context.createImageData(width, height);
        let changed = 0;
        const total = width * height;

        for (let index = 0; index < left.length; index += 4) {
          const delta =
            Math.abs(left[index] - right[index]) +
            Math.abs(left[index + 1] - right[index + 1]) +
            Math.abs(left[index + 2] - right[index + 2]);
          if (delta > 30) {
            changed += 1;
            output.data[index] = 239;
            output.data[index + 1] = 68;
            output.data[index + 2] = 68;
            output.data[index + 3] = 255;
          } else {
            // Faded greyscale of the "after" frame so changes stand out.
            const grey = 0.3 * right[index] + 0.59 * right[index + 1] + 0.11 * right[index + 2];
            output.data[index] = grey * 0.45;
            output.data[index + 1] = grey * 0.5;
            output.data[index + 2] = grey * 0.6;
            output.data[index + 3] = 160;
          }
        }

        context.putImageData(output, 0, 0);
        setStats({ changed, ratio: changed / total });
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });

    return () => {
      cancelled = true;
    };
  }, [beforeUrl, afterUrl]);

  if (!beforeUrl || !afterUrl) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface-2 px-4 py-6 text-center text-xs text-muted">
        Both a before and an after screenshot are required for a visual diff.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-line bg-surface-2"
        aria-label="Pixel diff"
      />
      {error ? (
        <p role="alert" className="text-xs text-failed">
          {error}
        </p>
      ) : stats ? (
        <p className="text-[11px] text-muted">
          {(stats.ratio * 100).toFixed(2)}% of pixels changed ({stats.changed.toLocaleString()} px)
          — red marks the delta.
        </p>
      ) : (
        <p className="text-[11px] text-muted">Computing pixel diff…</p>
      )}
    </div>
  );
}
