import { render } from "preact";
import { App } from "./App.tsx";
import { FIXTURE_BUILD } from "./gateway.ts";
import { registerAppShell } from "./pwa.ts";
import "./style.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");
document.documentElement.dataset.buildId = __BUILD_ID__;
// The render bench exists only in test-fixture builds; formal builds always run the game flow.
// It is imported dynamically behind the compile-time flag, so it is not in the formal bundle.
if (FIXTURE_BUILD && new URLSearchParams(location.search).has("bench")) {
  void import("./BenchApp.tsx").then(({ BenchApp }) => render(<BenchApp />, root));
} else {
  render(<App />, root);
}
registerAppShell();
