import { probe } from "@city-of-vice/engine";

const status = document.querySelector('[role="status"]');
if (!status) throw new Error("Missing foundation status element");
status.textContent = probe("S02");
