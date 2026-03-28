import { createContext, useContext, useState, type ReactNode } from "react";

interface DevModeContextValue {
  devMode: boolean;
  toggleDevMode: () => void;
}

const DevModeContext = createContext<DevModeContextValue>({
  devMode: false,
  toggleDevMode: () => {}
});

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devMode, setDevMode] = useState(false);
  return (
    <DevModeContext.Provider value={{ devMode, toggleDevMode: () => setDevMode((v) => !v) }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeContextValue {
  return useContext(DevModeContext);
}
