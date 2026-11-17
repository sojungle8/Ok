import { render } from "preact";
import { App } from "./App.tsx";
import "./style.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");
document.documentElement.dataset.buildId = __BUILD_ID__;
render(<App />, root);
