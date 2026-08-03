import { cn } from "@/lib/utils";

export type ReturnRangePoint = {
  /** Month number, 1-based. */
  month: number;
  min: number;
  max: number;
};

export type ReturnRangeChartProps = {
  points: ReturnRangePoint[];
  /** Accessible description; the chart itself is decorative to a screen reader. */
  ariaLabel: string;
  className?: string;
};

/*
 * Geometry, in viewBox units. The SVG scales to its container, so these are
 * proportions rather than pixels.
 */
const WIDTH = 320;
const HEIGHT = 120;
const PADDING_Y = 6;

/**
 * Accumulated return over time, drawn as a BAND between a low and a high
 * scenario rather than a single line.
 *
 * The shape is the message: a filled area with two edges reads as "somewhere in
 * here", where one line would read as a forecast. Nothing in this chart should
 * suggest a specific figure will be reached — see the disclaimer that travels
 * with the calculator.
 *
 * Hand-rolled SVG, like CapitalDonutChart: the project's charts are drawn this
 * way, and a two-series area needs no plotting library.
 */
export function ReturnRangeChart({
  points,
  ariaLabel,
  className,
}: ReturnRangeChartProps) {
  if (points.length < 2) return null;

  // The band is scaled to its own maximum, so the curve always fills the box
  // whatever the amount — the reader compares shape, not absolute height.
  const ceiling = Math.max(...points.map((point) => point.max));
  if (ceiling <= 0) return null;

  const x = (index: number) => (index / (points.length - 1)) * WIDTH;
  const y = (value: number) =>
    HEIGHT - PADDING_Y - (value / ceiling) * (HEIGHT - PADDING_Y * 2);

  const maxLine = points.map((point, i) => `${x(i)},${y(point.max)}`);
  const minLine = points.map((point, i) => `${x(i)},${y(point.min)}`);
  // Down the high edge, back along the low one: that closed loop IS the band.
  const band = [...maxLine, ...[...minLine].reverse()].join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className={cn("h-28 w-full", className)}
    >
      <polygon points={band} className="fill-slate-950/15" />
      <polyline
        points={maxLine.join(" ")}
        className="fill-none stroke-slate-950"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={minLine.join(" ")}
        className="fill-none stroke-slate-950/50"
        strokeWidth={2}
        strokeDasharray="4 3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
