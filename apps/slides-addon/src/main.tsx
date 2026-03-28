import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { DevModeProvider } from "./context/DevModeContext.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DevModeProvider>
        <App />
      </DevModeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
