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
| [`index.html`](index.html) | Existing playable prototype and behavioral parity reference. |

Read the documents above before changing the application. Follow the active slice
in `IMPLEMENTATION.md`, and route any rule conflict or material scope change to the
project owner rather than resolving it by assumption.

## When the product owner requests a change

For a request that changes game rules, behavior, or `index.html`, first inspect the
slice register and the prototype baseline policy in `IMPLEMENTATION.md`. Explain in
plain language whether the request affects rules, presentation, or both, and
recommend the lowest-numbered ready slice at the highest priority.

If the request would extend the prototype beyond the snapshot used by the modular
application, warn that changing `index.html` alone creates a migration delta. State
which baseline, characterization scenarios, and slices are affected when known,
then recommend the disciplined path: implement through the applicable modular
slice when ready, record an accepted delta and update characterization before a
rule change, or place non-urgent work in the feature backlog.

Do not silently move the baseline or leave an approved change only in the
prototype. Let the product owner choose the path, then record that decision in the
prototype change ledger or backlog as required by `IMPLEMENTATION.md`.
