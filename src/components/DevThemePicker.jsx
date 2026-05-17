import { useTheme, THEME_NAMES } from "../lib/theme";

const SWATCHES = {
  achromatic: ["#0D0D0D", "#FFFFFF", "#FFFFFF"],
};

const LABELS = {
  achromatic: "Achromatic",
};

export default function DevThemePicker() {
  const { themeName, setTheme } = useTheme();

  return (
    <div style={{
      position: "fixed",
      bottom: 16,
      right: 16,
      zIndex: 9000,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      borderRadius: 10,
      padding: "8px 6px",
      border: "1px solid rgba(255,255,255,0.12)",
    }}>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2, fontFamily: "monospace" }}>theme</div>
      {THEME_NAMES.map(name => {
        const [bg, fg, ac] = SWATCHES[name] ?? ["#888", "#fff", "#fff"];
        const active = name === themeName;
        return (
          <button
            key={name}
            onClick={() => setTheme(name)}
            title={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: active ? "rgba(255,255,255,0.15)" : "transparent",
              border: active ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
              borderRadius: 6,
              padding: "4px 6px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: bg, border: "1px solid rgba(255,255,255,0.15)" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: fg }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ac }} />
            </div>
            <span style={{ fontSize: 11, color: active ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: "monospace", whiteSpace: "nowrap" }}>{LABELS[name] ?? name}</span>
          </button>
        );
      })}
    </div>
  );
}
