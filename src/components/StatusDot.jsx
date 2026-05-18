import { useTheme } from '../lib/theme';

// Tiny colored dot for at-a-glance status. Paired with a text label, the dot
// carries the semantic color so the label can stay text.primary — keeps color
// from dominating Achromatic surfaces while still surfacing severity.
// Status values map to design-system status tokens.
export default function StatusDot({ status, size = 6 }) {
  const { theme } = useTheme();
  const color =
    status === 'success' ? theme.status.success :
    status === 'warning' ? theme.status.warning :
    status === 'danger'  ? theme.status.danger  :
                           theme.text.muted;
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
