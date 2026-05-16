import { useTheme } from '../lib/theme';
import { spacing, typography } from '../design-system';

export default function TabBar({ tabs, active, onChange, style }) {
  const { theme } = useTheme();
  return (
    <div style={{
      display: 'flex',
      borderBottom: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      ...style,
    }}>
      {tabs.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            borderBottom: active === value
              ? `2px solid ${theme.accent.default}`
              : '2px solid transparent',
            marginBottom: -1,
            padding: `${spacing.xs}px 0 ${spacing.sm}px`,
            fontSize: typography.body,
            fontWeight: active === value ? typography.semibold : typography.regular,
            color: active === value ? theme.text.primary : theme.text.secondary,
            cursor: 'pointer',
            textAlign: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
