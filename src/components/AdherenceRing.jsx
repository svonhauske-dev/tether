import { useTheme } from '../lib/theme';
import { typography } from '../design-system';

export default function AdherenceRing({ percentage, size = 56 }) {
  const { theme } = useTheme();
  const r = Math.floor(size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const dash = circ * (percentage / 100);
  const cx = size / 2;
  const textSize = size <= 56 ? typography.label : typography.caption;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={theme.accent.track} strokeWidth="5" />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={percentage === 100 ? theme.status.success : theme.accent.default}
        strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={circ - dash}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x={cx} y={cx}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.text.primary}
        fontSize={textSize}
        fontWeight={typography.bold}
        fontFamily={typography.fontHeading}
      >
        {percentage}%
      </text>
    </svg>
  );
}
