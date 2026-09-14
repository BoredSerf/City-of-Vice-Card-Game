# City of Vice

City of Vice is a browser-based 36-card game for one human player against a
heuristic rival. The current playable prototype is a self-contained `index.html`.
The accepted MVP rebuilds it as a tested, modular application with a pure OCaml
game engine, a Melange JavaScript boundary, and a TypeScript browser interface.

## Project contents

| Path | Purpose |
| --- | --- |
| [`README.md`](README.md) | Current product overview and instructions for the playable prototype. |
| [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md) | Authoritative MVP scope, architecture, acceptance criteria, non-goals, and future delivery tracks. |
| [`IMPLEMENTATION.md`](IMPLEMENTATION.md) | Numbered development slices, dependencies, priorities, status, and backlog process. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Human and agent workflow for prototype changes, baselines, deltas, and review. |
| [`index.html`](index.html) | Existing playable prototype and behavioral parity reference. |

Read the documents above before changing the application. Follow the active slice
in `IMPLEMENTATION.md`, and route any rule conflict or material scope change to the
project owner rather than resolving it by assumption.

## When someone requests a product change

Follow `CONTRIBUTING.md` for any request that changes rules, behavior,
presentation, copy, or `index.html`. Explain two things in plain language: the next
ready roadmap slice overall, and the slice or backlog destination applicable to
the request. These may be different.

If the request would move the prototype beyond the snapshot used by the modular
application, warn that changing `index.html` alone creates migration work. Recommend
the applicable modular slice, a recorded delta, or backlog intake. Do not silently
move a baseline, leave an approved change only in the prototype, or infer product
authority from the request alone.
