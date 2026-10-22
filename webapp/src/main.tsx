import { createRoot } from "react-dom/client";
import { App } from "./App";
import { tg } from "./tg";
import "./styles.css";

tg?.ready();
tg?.expand();
createRoot(document.getElementById("root")!).render(<App />);
