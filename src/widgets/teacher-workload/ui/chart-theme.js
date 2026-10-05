// Colours for the workload charts, from the validated data-viz palette:
// two categorical slots for weekday and weekend, a single-hue blue ramp for
// the heatmap, and the fixed status colours (always shown with an icon and
// a label, never alone).

export const SERIES = {
  weekday: { color: "#2a78d6", label: "Weekday (Mon–Fri)" },
  weekend: { color: "#eb6834", label: "Weekend (Sat–Sun)" },
};

export const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  baseline: "#c3c2b7",
  gridline: "#e1e0d9",
  surface: "#fcfcfb",
  empty: "#f0efec",
};

// Light to dark; the darker half carries white text.
export const HEAT_RAMP = [
  "#b7d3f6",
  "#86b6ef",
  "#5598e7",
  "#2a78d6",
  "#1c5cab",
  "#104281",
];

export const STATUS_COLORS = {
  OVER: "#d03b3b",
  BALANCED: "#0ca30c",
  UNDER: "#fab219",
  NONE: "#898781",
};

export const formatHours = (hours) =>
  Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
