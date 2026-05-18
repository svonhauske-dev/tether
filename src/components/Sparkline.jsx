import { useTheme } from '../lib/theme';

// Single-color sparkline. Renders a 0-100 value array as an SVG polyline.
// Values may be null for missing days; the line breaks across them.
// Designed for dense list rows — small (default 60×12) with no axes.
export default function Sparkline({
  values,
  width = 60,
  height = 12,
  strokeWidth = 1.25,
  baseline = false,   // hairline at the bottom (off by default — keep data minimal)
  endpoint = true,    // small dot at the last non-null value
  color,              // override (defaults to theme.text.primary)
  ariaLabel,
}) {
  const { theme } = useTheme();
  if (!values || values.length === 0) return null;

  const stroke = color || theme.text.primary;
  const n = values.length;

  // Map each value (0-100) to {x, y, defined}
  const points = values.map((v, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
    const defined = v != null;
    const safe = defined ? Math.max(0, Math.min(100, v)) : 0;
    const y = height - (safe / 100) * (height - strokeWidth) - strokeWidth / 2;
    return { x, y, defined };
  });

  // Build path string that breaks across null values.
  let d = '';
  let penDown = false;
  for (const p of points) {
    if (!p.defined) { penDown = false; continue; }
    d += `${penDown ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    penDown = true;
  }

  // Last defined point — used for the optional endpoint dot.
  let lastDefined = null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].defined) { lastDefined = points[i]; break; }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
    >
      {baseline && (
        <line
          x1="0" y1={height - 0.5}
          x2={width} y2={height - 0.5}
          stroke={theme.border.subtle}
          strokeWidth="1"
        />
      )}
      <path
        d={d.trim()}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {endpoint && lastDefined && (
        <circle cx={lastDefined.x} cy={lastDefined.y} r={1.25} fill={stroke} />
      )}
    </svg>
  );
}
