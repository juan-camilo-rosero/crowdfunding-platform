import { segmentColor } from "@/lib/charts/segment-colors";
import { cn } from "@/lib/utils";

export type DonutSegment = {
  id: string;
  label: string;
  /** Raw value; shares are computed from the total of all segments. */
  value: number;
};

export type CapitalDonutChartProps = {
  segments: DonutSegment[];
  /** Big figure in the middle, already formatted. */
  centerValue: string;
  /** Caption under the figure. */
  centerLabel: string;
  /** Rendered instead of the chart when there are no segments. */
  emptyState?: React.ReactNode;
  className?: string;
};

/*
 * Geometry. Segments are drawn as STROKED arcs rather than filled ring slices:
 * a stroke takes `stroke-linecap="round"`, which is what rounds both ends of
 * every partition. The stroke is thin so the ring reads light.
 */
const RADIUS = 88;
const STROKE = 9;
/**
 * The viewBox hugs the ring exactly — width is the arc's own span, not a
 * rounder number — so no dead space is padded around the chart and the legend
 * beside it gets that width back.
 */
const VIEWBOX_WIDTH = 2 * (RADIUS + STROKE / 2);
const VIEWBOX_HEIGHT = RADIUS + STROKE;
const CENTER_X = VIEWBOX_WIDTH / 2;
const CENTER_Y = VIEWBOX_HEIGHT - STROKE / 2;

/**
 * Separation between partitions. A round cap spills half the stroke width past
 * each end, so the gap has to clear both caps or neighbours would touch.
 */
const CAP_DEGREES = ((STROKE / 2) / RADIUS) * (180 / Math.PI);
const GAP_DEGREES = CAP_DEGREES * 2 + 4;

function polarPoint(degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: +(CENTER_X + RADIUS * Math.cos(radians)).toFixed(3),
    y: +(CENTER_Y + RADIUS * Math.sin(radians)).toFixed(3),
  };
}

/** Centre-line arc between two angles. 180deg is left, 270deg top, 360deg right. */
function arcPath(startDegrees: number, endDegrees: number) {
  const start = polarPoint(startDegrees);
  const end = polarPoint(endDegrees);
  const largeArc = endDegrees - startDegrees > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * Half-donut breakdown with its legend beside it.
 *
 * Plain SVG rather than a charting library: the chart is static, so this stays
 * a Server Component — nothing to hydrate, no mismatch risk, no extra
 * dependency. Colours come from lib/charts/segment-colors (see that file for
 * how a colour is assigned).
 *
 * The legend sits to the RIGHT from `md` up so the card stays short; it drops
 * underneath on narrow screens, where there is no width to share.
 */
export function CapitalDonutChart({
  segments,
  centerValue,
  centerLabel,
  emptyState,
  className,
}: CapitalDonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (segments.length === 0 || total <= 0) {
    return <div className={className}>{emptyState}</div>;
  }

  // Deterministic order: biggest share first, ties broken by id. This is what
  // makes the colour assignment stable across renders.
  const ordered = [...segments].sort(
    (a, b) => b.value - a.value || a.id.localeCompare(b.id)
  );

  // A single segment sweeps the whole half with no gap carved out of it.
  const hasGaps = ordered.length > 1;
  const usableDegrees = 180 - (hasGaps ? GAP_DEGREES * ordered.length : 0);

  // Offsets are derived from the preceding segments rather than carried in a
  // mutable cursor, so the whole computation stays pure.
  const slices = ordered.map((segment, index) => {
    const precedingValue = ordered
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.value, 0);

    const share = segment.value / total;
    const gapsBefore = hasGaps ? GAP_DEGREES * index : 0;
    const start =
      180 + (precedingValue / total) * usableDegrees + gapsBefore +
      (hasGaps ? GAP_DEGREES / 2 : 0);
    const end = start + share * usableDegrees;

    return {
      ...segment,
      share,
      color: segmentColor(index),
      path: arcPath(start, end),
    };
  });

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-7",
        className
      )}
    >
      <div
        className="relative w-full shrink-0 md:w-(--donut-width)"
        style={{ "--donut-width": `${VIEWBOX_WIDTH}px` } as React.CSSProperties}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={centerLabel}
        >
          {slices.map((slice) => (
            <path
              key={slice.id}
              d={slice.path}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Figure sits inside the ring; HTML rather than <text> so it can use
            the same type scale as the rest of the app. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5">
          <p className="text-3xl font-medium text-stone-900">{centerValue}</p>
          <p className="text-xs font-medium text-neutral-400">{centerLabel}</p>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-1 flex-col gap-3">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3.5 w-1.25 shrink-0 rounded-[10px]"
              style={{ backgroundColor: slice.color }}
            />
            <span className="truncate text-xs font-medium text-zinc-600">
              {(slice.share * 100).toFixed(1)}% - {slice.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
