import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { DevModeProvider } from "./context/DevModeContext.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DevModeProvider>
      <App />
    </DevModeProvider>
  </React.StrictMode>
);
