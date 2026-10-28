import { mount_game } from "../src/ui/app.ts";
import "../src/ui/styles.css";

const root = document.querySelector<HTMLElement>("#game");
if (!root) throw Error("Missing game root");
mount_game(root);
