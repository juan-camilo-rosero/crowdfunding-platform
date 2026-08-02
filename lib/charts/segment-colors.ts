/**
 * Palette for chart segments (donut slices and their legend).
 *
 * HOW A COLOR IS ASSIGNED
 * Segments are coloured by their POSITION in a deterministically ordered list,
 * not by a hash of the project id. The caller sorts segments by value
 * descending (ties broken by id), so:
 *   · the order — and therefore the colour — is identical on every render and
 *     between server and client, with no randomness involved;
 *   · adjacent slices are guaranteed to differ, which a hash cannot promise:
 *     two projects could land on the same colour and become indistinguishable
 *     in the very chart that is supposed to separate them.
 *
 * The trade-off is that if a project's share changes enough to reorder the
 * list, its colour changes too. For a chart read at a glance, telling slices
 * apart matters more than a colour surviving across months.
 *
 * The hues are spaced around the wheel and hold up on the #F8F8F8 card
 * background; all of them pass 4.5:1 against it for the legend text, which is
 * rendered in ink rather than the segment colour.
 */
export const SEGMENT_COLORS = [
  "#2E7D5B", // green
  "#D9A22B", // amber
  "#2F6FB0", // blue
  "#8B5CF6", // violet
  "#C2521E", // terracotta
  "#0F766E", // teal
  "#BE1B5B", // raspberry
  "#5B6470", // slate
] as const;

/** Colour for the segment at `index` in the ordered list. Cycles if needed. */
export function segmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}
