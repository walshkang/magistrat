import { useDevMode } from "../context/DevModeContext.js";

export function DevModeToggle() {
  const { devMode, toggleDevMode } = useDevMode();
  return (
    <button
      type="button"
      className="dev-mode-toggle"
      aria-pressed={devMode}
      onClick={toggleDevMode}
    >
      {devMode ? "Dev ✓" : "Dev"}
    </button>
  );
}
