import { render } from "preact";
import { App } from "./App.tsx";
import { BenchApp } from "./BenchApp.tsx";
import { FIXTURE_BUILD } from "./gateway.ts";
import "./style.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");
document.documentElement.dataset.buildId = __BUILD_ID__;
// The render bench exists only in test-fixture builds; formal builds always run the game flow.
const bench = FIXTURE_BUILD && new URLSearchParams(location.search).has("bench");
render(bench ? <BenchApp /> : <App />, root);
