import { card_name } from "../presentation/catalog.ts";

export const artwork = {
  "vice-art-0": new URL("./artwork/vice-art-0.webp", import.meta.url).href,
  "vice-art-1": new URL("./artwork/vice-art-1.webp", import.meta.url).href,
  "vice-art-2": new URL("./artwork/vice-art-2.webp", import.meta.url).href,
  "vice-leon": new URL("./artwork/vice-leon.webp", import.meta.url).href,
  menu: new URL("./artwork/menu.webp", import.meta.url).href,
  win: new URL("./artwork/win.webp", import.meta.url).href,
  lose: new URL("./artwork/lose.webp", import.meta.url).href,
};
const xs = [
  [0, 344, 685, 1024],
  [0, 343, 685, 1024],
  [0, 342, 686, 1024],
] as const;
const ys = [
  [0, 367, 727, 1166, 1536],
  [0, 364, 733, 1102, 1536],
  [0, 376, 754, 1138, 1536],
] as const;
export function portrait_geometry(id: number) {
  card_name(id);
  if (id === 34)
    return {
      binding: "vice-leon" as const,
      background_size: "cover",
      background_position: "center",
      crop: null,
    };
  const atlas = Math.floor(id / 12),
    tile = id % 12,
    col = tile % 3,
    row = Math.floor(tile / 3);
  const x = xs[atlas]![col]!,
    y = ys[atlas]![row]!;
  const width = xs[atlas]![col + 1]! - x - (col < 2 ? 5 : 0),
    height = ys[atlas]![row + 1]! - y - (row < 3 ? 5 : 0);
  return {
    binding: `vice-art-${atlas}` as "vice-art-0" | "vice-art-1" | "vice-art-2",
    background_size: `${(1024 / width) * 100}% ${(1536 / height) * 100}%`,
    background_position: `${(x / (1024 - width)) * 100}% ${(y / (1536 - height)) * 100}%`,
    crop: { x, y, width, height },
  };
}
export function portrait(id: number): HTMLSpanElement {
  const geometry = portrait_geometry(id),
    node = document.createElement("span");
  node.className = "portrait";
  node.setAttribute("aria-hidden", "true");
  node.style.backgroundImage = `url("${artwork[geometry.binding]}")`;
  node.style.backgroundSize = geometry.background_size;
  node.style.backgroundPosition = geometry.background_position;
  return node;
}
