import { createContext, useContext, useState } from "react";
import { themes } from "../design-system";

const ThemeContext = createContext({ theme: themes.light, themeName: "light", setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState("light");
  const theme = themes[themeName] ?? themes.light;
  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme: setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
