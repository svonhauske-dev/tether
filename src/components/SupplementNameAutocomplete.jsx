import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { spacing, typography, shadows } from '../design-system';
import { useTheme } from '../lib/theme';
import { SUPPLEMENTS_DATABASE } from '../data/supplements-database';
import Input from './Input';

export default function SupplementNameAutocomplete({ value, onChange, history = [], onBlur, ...rest }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 300 });
  const debounceRef = useRef(null);
  const blurTimerRef = useRef(null);
  const containerRef = useRef(null);

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

  // Compute fixed screen position from container's bounding rect
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 4 - 16;
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(300, spaceBelow)),
    });
  }, [open]);

  // Dismiss when any ancestor scrolls (capture phase catches nested scroll containers)
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [open]);

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

  const dropdown = open ? (
    <div style={{
      position: 'fixed',
      top: dropdownPos.top,
      left: dropdownPos.left,
      width: dropdownPos.width,
      maxHeight: dropdownPos.maxHeight,
      background: theme.surface.modal,
      border: `${theme.borderWidth.default}px solid ${theme.border.subtle}`,
      borderRadius: theme.radius.surface,
      boxShadow: shadows.popover,
      zIndex: 9999,
      fontFamily: typography.fontBody,
      fontSize: typography.body,
      color: theme.text.primary,
      overflowX: 'hidden',
      overflowY: 'auto',
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
  ) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Input
        value={value}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...rest}
      />
      {createPortal(dropdown, document.body)}
    </div>
  );
}
