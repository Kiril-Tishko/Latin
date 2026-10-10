import { render } from "preact";
import "./styles.css";
import { App } from "./ui/app";

const root = document.getElementById("app");
if (root) render(<App />, root);
