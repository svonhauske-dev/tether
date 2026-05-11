import { useState } from 'react';
import { Home, List, Settings } from 'lucide-react';
import { spacing, typography } from '../design-system';
import { useTheme } from '../lib/theme';

function SidebarNavItem({ icon: Icon, label, active, onClick }) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.md}px`,
        background: active || hovered ? theme.surface.cardSubtle : 'transparent',
        border: 'none',
        borderRadius: theme.radius.surface,
        color: active ? theme.text.primary : theme.text.secondary,
        cursor: 'pointer',
        fontFamily: typography.fontBody,
        fontSize: typography.body,
        fontWeight: active ? typography.semibold : typography.regular,
        textAlign: 'left',
        width: '100%',
        transition: 'background 150ms ease, color 150ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

export function AccountAvatar({ displayName, small }) {
  const { theme } = useTheme();
  const size = small ? 28 : 36;
  const initial = ((displayName || '').charAt(0) || 'Y').toUpperCase();
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: theme.surface.cardSubtle,
      border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: typography.fontBody,
      fontSize: small ? typography.label : typography.body,
      color: theme.text.primary,
      fontWeight: typography.medium,
      flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

export default function Sidebar({ pushScreen, displayName }) {
  const { theme } = useTheme();
  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      height: '100dvh',
      overflowY: 'auto',
      background: theme.surface.card,
      borderRight: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      display: 'flex',
      flexDirection: 'column',
      padding: spacing.lg,
      gap: spacing.md,
      boxSizing: 'border-box',
    }}>

      {/* Brand wordmark */}
      <div style={{
        fontFamily: typography.fontHeading,
        fontSize: typography.title,
        fontWeight: typography.semibold,
        color: theme.text.primary,
        letterSpacing: typography.headingLetterSpacing,
        marginBottom: spacing.xs,
      }}>
        Origin
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <SidebarNavItem icon={Home} label="Home" active onClick={() => {}} />
        <SidebarNavItem icon={List} label="Protocol" onClick={() => pushScreen('manage_protocol')} />
      </nav>

      {/* Spacer pushes settings + account to bottom */}
      <div style={{ flex: 1 }} />

      {/* Settings */}
      <SidebarNavItem icon={Settings} label="Settings" onClick={() => pushScreen('settings')} />

      {/* Account row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        paddingTop: spacing.md,
        borderTop: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      }}>
        <AccountAvatar displayName={displayName} small />
        <span style={{
          fontSize: typography.body,
          color: theme.text.primary,
          fontFamily: typography.fontBody,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayName || 'You'}
        </span>
      </div>
    </aside>
  );
}
