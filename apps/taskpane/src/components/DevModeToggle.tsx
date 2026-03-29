import { useDevMode } from "../context/DevModeContext.js";

export function DevModeToggle() {
  const { devMode, toggleDevMode } = useDevMode();
  return (
    <button
      type="button"
      className="btn-ghost btn-ghost-sm dev-mode-toggle"
      aria-pressed={devMode}
      onClick={toggleDevMode}
    >
      {devMode ? "Dev ✓" : "Dev"}
    </button>
  );
}
