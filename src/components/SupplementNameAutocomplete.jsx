import { useState, useEffect, useRef, useCallback } from 'react';
import { spacing, typography, shadows } from '../design-system';
import { useTheme } from '../lib/theme';
import { SUPPLEMENTS_DATABASE } from '../data/supplements-database';
import Input from './Input';

export default function SupplementNameAutocomplete({ value, onChange, history = [], onBlur, ...rest }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const blurTimerRef = useRef(null);

  const computeSuggestions = useCallback((text) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const lower = text.toLowerCase();
    const seen = new Set();
    const results = [];

    for (const name of history) {
      if (name.toLowerCase().includes(lower) && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        results.push(name);
        if (results.length >= 8) break;
      }
    }

    for (const name of SUPPLEMENTS_DATABASE) {
      if (results.length >= 8) break;
      if (name.toLowerCase().includes(lower) && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        results.push(name);
      }
    }

    setSuggestions(results);
    setOpen(results.length > 0);
  }, [history]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => computeSuggestions(value), 200);
    return () => clearTimeout(debounceRef.current);
  }, [value, computeSuggestions]);

  const handleSelect = (name) => {
    onChange({ target: { value: name } });
    setOpen(false);
    setSuggestions([]);
  };

  const handleFocus = () => {
    clearTimeout(blurTimerRef.current);
    if (suggestions.length > 0) setOpen(true);
  };

  const handleBlur = (e) => {
    blurTimerRef.current = setTimeout(() => setOpen(false), 200);
    onBlur?.(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Input
        value={value}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...rest}
      />
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: theme.surface.modal,
          border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
          borderRadius: theme.radius.surface,
          boxShadow: shadows.popover,
          zIndex: 10,
          overflowX: 'hidden',
          overflowY: 'auto',
          maxHeight: 300,
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
        }}>
          {suggestions.map((name, i) => (
            <div
              key={name}
              onPointerDown={(e) => { e.preventDefault(); handleSelect(name); }}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                fontSize: typography.body,
                color: theme.text.primary,
                borderBottom: i < suggestions.length - 1
                  ? `${theme.borderWidth.subtle}px solid ${theme.border.subtle}`
                  : 'none',
                cursor: 'pointer',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
