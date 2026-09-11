# City of Vice application MVP plan

Status: Accepted

Approved by: Product owner

Approval record: PR #12

Scope: Convert the existing browser prototype into a tested, modular web application without changing the base game's intended rules.

## 1. Outcome

The MVP will turn the single-file prototype into a maintainable application with:

- a deterministic, platform-neutral game engine;
- an automated rules and browser test harness;
- a modular browser interface with feature parity to the current prototype;
- a normal static website build;
- a generated, self-contained HTML export when that can be maintained without distorting the application architecture; and
- stable player and persistence boundaries that can later support desktop, mobile, networked, and LLM-controlled players.

The first supported product remains one local human against the existing heuristic rival. The MVP does not attempt to ship every future platform.

## 2. Product principles

1. **Rules are independent of presentation.** The game engine must not import browser APIs, DOM code, storage, artwork, timers, or a particular player implementation.
2. **Commands in, events and state out.** UI and player implementations interact with the game through a small public game-session API rather than mutating state directly.
3. **Determinism is testable.** Deck order and automated choices accept an injected random source or seed.
4. **The browser is the reference client.** Other clients should reuse the engine instead of reimplementing the rules.
5. **Lightweight describes the shipped product.** Development-only build and test tools are acceptable. The browser build must not require a backend, account, API key, or runtime package download.
6. **Standalone export is a goal, not an architectural veto.** It is retained while one command can generate and verify it. If it begins to block accessibility, security, performance, or platform work, the normal static build takes priority and abandoning the single-file artifact requires an explicit product decision.
7. **Project-owned names use `snake_case`.** OCaml and TypeScript identifiers, serialized fields, commands, events, and MCP tools owned by this project use `snake_case`. Generated bindings and third-party interfaces may retain names required by their source systems, with translation confined to adapters.

## 3. Chosen MVP approach

Implement the game engine, rules, serializable domain state, and heuristic AI in OCaml. Compile that code to ES modules with Melange and Dune. Implement the application controller, persistence adapters, and browser interface in TypeScript. Use Vite for the static web build and Vitest for TypeScript integration and browser tests.

Keep the browser interface framework-free during the MVP: semantic HTML, scoped CSS, and small DOM modules are sufficient for the current screen count and avoid introducing a runtime UI dependency. OCaml unit and property tests cover the engine directly. TypeScript contract tests exercise the generated Melange boundary, and a real-browser Vitest configuration covers a small set of critical interactions.

Keep the OCaml domain library free of Melange, browser, storage, timer, network, and UI APIs. A thin Melange adapter exports only deliberately JavaScript-shaped values. TypeScript must not inspect undocumented Melange runtime representations; exported values crossing the boundary are primitives, arrays, plain records, or serialized JSON with an explicitly maintained TypeScript declaration. Contract tests verify the boundary in both development and production builds.

The production website is the generated `dist/` directory. A project-owned post-build script generates `dist-standalone/index.html` by inlining the built JavaScript, CSS, and required images. The source `index.html` becomes a thin application shell; generated output is never edited by hand.

Cloudflare Pages is the selected website host. GitHub Actions builds and verifies both toolchains, then deploys the already-built `dist/` directory to Cloudflare Pages. Cloudflare does not compile the application. Production deploys originate from the approved production branch; pull requests may receive preview deployments. Cloudflare credentials remain in repository secrets and are never exposed to the application bundle.

No backend is introduced in the MVP.

## 4. Proposed source layout

```text
city-of-vice-card-game/
├── docs/
│   └── MVP_PLAN.md
├── .github/
│   └── workflows/
│       ├── verify.yml
│       └── deploy-web.yml
├── engine/
│   ├── dune
│   ├── cards.ml
│   ├── cards.mli
│   ├── command.ml
│   ├── command.mli
│   ├── engine.ml
│   ├── engine.mli
│   ├── event.ml
│   ├── event.mli
│   ├── player_policy.ml
│   ├── player_policy.mli
│   ├── random_source.ml
│   ├── random_source.mli
│   ├── state.ml
│   └── state.mli
├── engine_js/
│   ├── dune
│   └── adapter.ml
├── public/
│   └── artwork/
├── scripts/
│   └── build-standalone.mjs
├── src/
│   ├── app/
│   │   ├── controller.ts
│   │   ├── persistence.ts
│   │   └── serialization.ts
│   ├── engine/
│   │   ├── index.ts
│   │   └── generated-engine.d.ts
│   ├── ui/
│   │   ├── actions.ts
│   │   ├── components/
│   │   ├── render.ts
│   │   └── styles.css
│   └── main.ts
├── tests/
│   ├── integration/
│   ├── browser/
│   └── fixtures/
├── test/
│   ├── dune
│   └── engine_test.ml
├── dune
├── dune-project
├── city_of_vice.opam
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

Exact filenames may be consolidated when a module would otherwise contain only trivial forwarding code. The domain boundaries are required; the number of files is not.

## 5. Engine contract

### State

The serializable game state owns:

- rules/schema version;
- turn number, active player, phase, winner, and win reason;
- deck and discard order;
- each player's resources, hand, active businesses, active operators, suspended cards, and current draw price;
- pending mandatory decisions, such as crew bonuses and resource trimming; and
- gameplay history required by the interface.

Transient UI animation state, open dialogs, timeouts, and DOM references do not belong in game state.

### Commands

The public engine accepts typed commands such as:

- `start_game`
- `collect_income`
- `choose_crew_bonus`
- `trim_resource`
- `activate_card`
- `cash_card`
- `draw_card`
- `trade_resources`
- `use_operator`
- `end_turn`

Each command returns either a successful state transition with domain events or a typed rejection. Human-readable UI copy is derived outside the engine from rejection codes and event data.

The authoritative command, state, event, and rejection types are OCaml module interfaces. The Melange adapter exposes a stable JavaScript-facing facade for TypeScript. The facade is intentionally narrower than the internal OCaml modules and is the only supported cross-language interface.

### Events

Events describe completed domain facts, including card activation, card cashing, income, payment, operator results, forced returns, discards, reshuffles, turn changes, and victory. Events power the action log, animations, accessibility announcements, future replay diagnostics, and external player integrations.

### Invariants

The engine is the only authority allowed to change game state. It enforces at least:

- all 36 cards occupy exactly one valid location;
- resource counts are non-negative integers;
- hand, resource, legitimate-business, operator, and distributor-capacity limits;
- command legality for the current player and phase;
- protected legitimate businesses;
- operator payment and disposal rules;
- crew completion bonuses;
- discard reshuffling; and
- both victory conditions.

Invalid commands leave state unchanged.

## 6. Player boundary and future LLM play

Define an OCaml `Player_policy` boundary that receives a redacted, immutable player view and the legal commands available from that view. It returns one proposed command. The TypeScript game controller invokes policies through the Melange facade and validates every proposal through the same engine used for human actions.

The heuristic AI is implemented in OCaml behind this interface during the MVP. The interface must not mention an LLM vendor, model, prompt format, network protocol, or MCP. This keeps the game neutral and allows future adapters such as:

- local heuristic AI;
- remote multiplayer participant;
- scripted test player;
- LLM-backed player; or
- an MCP server exposing observations and legal commands.

An eventual LLM or MCP adapter is untrusted orchestration, not a rules authority. It must receive only information the player is allowed to see, must not access hidden cards or deck order, and cannot bypass engine validation. Credentials, provider calls, rate limits, consent, cost controls, and prompt-injection defenses belong outside the core engine.

LLM/MCP implementation is explicitly outside this MVP. The MVP requirement is only to prove that the existing heuristic AI works through the neutral player boundary.

## 7. Persistence

The MVP supports local save and resume in the website using a storage adapter. The engine provides versioned serialization and validation; the browser adapter uses `localStorage`.

Loading must reject malformed, impossible, or unsupported state without partially applying it. On failure, the UI offers a new game and does not overwrite the rejected payload until the player confirms replacement. Schema migrations are required only for versions introduced after this modular MVP; the original prototype state may be treated as a separate legacy format.

No cloud synchronization or user accounts are included.

## 8. Test harness

### Characterization tests

Before changing rules, capture the current prototype's intended behavior as tests. Use seeded deck order and explicit state fixtures rather than timing or random outcomes. Cover:

- opening distributor constraints and initial deal;
- income, complete-crew bonuses, and ten-resource trimming;
- fixed and wildcard payment;
- escalating draw prices and discard reshuffle;
- activating and cashing each card category;
- distributor capacity and legitimate-business protection;
- two-operator and three-legitimate-business limits;
- Hitman, Ruffian, and Fixer outcomes, including full-hand overflow;
- twelve-business and elimination victories; and
- representative heuristic-AI funding, targeting, and stopping decisions.

Where the current code and written rules disagree, do not silently encode either behavior. Record the discrepancy as a product decision and keep migration blocked for that rule until resolved.

### Engine tests

OCaml tests exercise the domain library without compiling it to JavaScript. Every public command has success, rejection, and no-mutation-on-rejection coverage. Scenario tests assert both resulting state and emitted events. A deterministic full-game simulation runs many seeded games and asserts invariants after every command.

TypeScript contract tests import the Melange-generated ES modules and verify that the published facade matches its TypeScript declaration, preserves command and event semantics, rejects malformed external data, and does not expose hidden state through player views.

Coverage percentages are diagnostic rather than the definition of completion. All rules branches and known edge cases must have intentional assertions.

### Browser tests

Real-browser tests cover a deliberately small critical path:

1. Load the main menu and start a game.
2. Choose an opening distributor.
3. Collect income and complete at least one legal action.
4. End the turn and observe an AI recap.
5. Reload and resume the saved game.
6. Reach and display a victory or defeat outcome from a controlled fixture.

Also verify keyboard access to primary actions, visible focus, reduced-motion handling, and layouts at representative phone, tablet, and desktop widths.

### Build verification

CI runs OCaml formatting and compilation, OCaml engine tests, Melange compilation, TypeScript type checking and boundary tests, browser smoke tests, the normal production build, and the standalone build. It then opens both builds through a static server and runs the same critical-path smoke test against each.

## 9. Delivery sequence

### Milestone 0 — Baseline and rule inventory

- Preserve the current `index.html` as the comparison build until parity is accepted.
- Extract a machine-readable card inventory and enumerate current rules and edge cases.
- Record any contradiction between embedded rules, current behavior, and desired behavior.
- Establish seeded fixtures for representative games.

Exit condition: the intended base-game rules are sufficiently resolved to write objective characterization tests.

### Milestone 1 — Tooling and test harness

- Add pinned OCaml, Dune, Melange, TypeScript, Vite, Vitest, browser test support, and reproducible package metadata for both toolchains.
- Extract the card catalog, pure engine, and heuristic AI into OCaml with no intentional rule changes.
- Add a narrow Melange ES-module facade and its TypeScript declaration.
- Add characterization, command, invariant, and seeded simulation tests.
- Add TypeScript contract tests for the generated facade.
- Run both toolchains, all tests, and type checking in CI.

Exit condition: the extracted OCaml engine reproduces approved prototype behavior, passes natively without a DOM, and exposes a production-built Melange facade that passes the TypeScript contract suite.

### Milestone 2 — Modular browser application

- Route the OCaml heuristic AI through `Player_policy` and the Melange facade.
- Add the controller, persistence adapter, and browser UI modules.
- Extract embedded artwork into source assets.
- Reproduce the current menu, board, dialogs, card gallery, rules, recap, animations, warnings, and outcomes.
- Add browser critical-path and responsive/accessibility checks.

Exit condition: the modular website has approved functional parity and no production dependency on the legacy script.

### Milestone 3 — Distribution builds

- Produce and verify the normal static `dist/` website.
- Produce and verify `dist-standalone/index.html` from the same source revision.
- Add an owner-authorized GitHub Actions deployment that uploads the verified `dist/` artifact to Cloudflare Pages.
- Keep Cloudflare account identifiers and API tokens in repository secrets with only the permissions required to deploy the Pages project.
- Document local development, testing, static deployment, and standalone export.
- Remove the legacy implementation only after parity review; retain history in Git rather than maintaining two source implementations.

Exit condition: both artifacts pass the shared smoke suite and an approved production revision is reachable on the Cloudflare Pages production URL.

### Milestone 4 — MVP release hardening

- Run playtesting focused on AI behavior and balance regressions.
- Resolve high-impact accessibility and browser-compatibility findings.
- Define release versioning and publish a changelog.
- Obtain an explicit license decision before inviting outside contributions or distributing source under open-source terms.

Exit condition: the approved browser MVP is releasable and its unsupported capabilities are documented.

## 10. MVP acceptance criteria

- **MVP-001 — Pure OCaml engine:** Engine, card, rule, and heuristic-AI modules compile and pass tests as an OCaml library without Melange, DOM, storage, timers, or network APIs.
- **MVP-002 — Rule parity:** Approved characterization scenarios produce the same outcomes as the prototype, except for explicitly approved corrections.
- **MVP-003 — Determinism:** A recorded seed plus command sequence reproduces the same initial deal, state transitions, events, and winner.
- **MVP-004 — State integrity:** Tests assert all card-location, limit, phase, resource, and victory invariants after every step of seeded simulations.
- **MVP-005 — Rejection safety:** Every invalid public command returns a typed rejection and leaves serialized state unchanged.
- **MVP-006 — Neutral players:** Human input and the OCaml heuristic AI both submit commands through the same engine boundary; the AI has no access to hidden opponent or deck information through `Player_policy`.
- **MVP-006A — Typed Melange boundary:** The production Melange ES modules satisfy the maintained TypeScript declaration and boundary tests; TypeScript code does not depend on undocumented OCaml runtime representations.
- **MVP-007 — Web parity:** The modular browser client supports every base-game action and user-facing state available in the current prototype.
- **MVP-008 — Resume:** Reloading the website restores a valid in-progress local game, while invalid or unsupported saves fail safely.
- **MVP-009 — Static website:** A clean checkout can install locked development dependencies and produce a backend-free static site.
- **MVP-009A — Cloudflare deployment:** An authorized production-branch run deploys the exact verified `dist/` artifact to Cloudflare Pages without placing deployment credentials in source or build output; a post-deployment smoke check passes against the resulting URL.
- **MVP-010 — Standalone export:** One documented command produces a self-contained HTML file from the same source, and that file passes the shared browser smoke test. If this criterion becomes materially preventative, removing it requires a recorded product decision; it cannot silently fail or drift.
- **MVP-011 — Responsive access:** Critical gameplay remains operable by keyboard and at representative phone, tablet, and desktop sizes, with reduced-motion preferences honored.
- **MVP-012 — CI gate:** Type checking, tests, and both distribution builds run automatically and block integration on failure.
- **MVP-013 — Documentation:** The README explains development, tests, architecture, website output, standalone output, known limitations, and the absence or presence of a license.
- **MVP-014 — Legacy retirement:** The original monolithic implementation is removed as live source only after the modular build passes approved parity verification.

## 11. Explicit non-goals

The MVP does not include:

- desktop or mobile packaging;
- app-store submission;
- Steamworks onboarding, store-page publication, depot upload, or public Steam release;
- online multiplayer, matchmaking, accounts, or cloud saves;
- a backend service or database;
- LLM provider integration, MCP transport, prompt design, or usage billing;
- expansion cards or new base-game mechanics;
- a generalized plugin system;
- a visual redesign unrelated to modular parity; or
- an assumption that the project will use any particular model or AI provider.

## 12. Future-platform path

After MVP acceptance:

- **Website:** continue deploying the normal static build to Cloudflare Pages as the primary browser product and optionally publish the standalone artifact for downloads and playtests.
- **Executable:** evaluate a webview wrapper such as Tauri against signing, auto-update, accessibility, binary size, and team-language requirements. The engine and web client remain reusable.
- **Steam:** package the desktop application for Steam using the selected executable wrapper, validate it through private Steam branches, and release it through an owner-controlled Steamworks partner account and SteamPipe depots.
- **Mobile:** first validate the responsive web app as an installable PWA; evaluate Capacitor or the selected desktop wrapper's mobile support only when native distribution or APIs are required.
- **ChatGPT/MCP playable client:** expose a remote MCP adapter so supported LLM desktop applications can host conversational play, and evaluate an optional embedded game UI for a full visual board inside clients that support it. Keep the integration vendor-neutral at the engine boundary and reusable by other MCP-capable clients.

Cloudflare Pages and eventual Steam distribution are selected product targets. The desktop wrapper, mobile wrapper, optional Steamworks features, and LLM transport remain later decisions rather than preselected MVP dependencies.

## 13. Steam delivery track after MVP

Steam is an intended distribution target, not merely a hypothetical executable format. Work begins after the browser MVP is accepted and the product owner chooses the initial supported desktop operating system or systems.

### Ownership and external prerequisites

The client or rights holder owns the Steamworks partner relationship, accepts Valve's agreements, completes tax and banking onboarding, pays any applicable Steam Direct fee, supplies store and ratings information, and authorizes the accounts permitted to upload or publish builds. Repository contributors must not infer authority to accept agreements, spend funds, publish a store page, set a build live, or handle the client's release credentials.

Before implementation, confirm:

- the party authorized to distribute the game and its artwork;
- the Steamworks partner and app owner;
- the assigned App ID and depot IDs;
- the initial supported operating systems and architectures;
- the executable wrapper selected after a focused comparison;
- save-file location and whether Steam Cloud is desired;
- offline behavior and whether any LLM mode is excluded or degraded offline;
- achievements, overlay, rich presence, controller support, and other optional Steamworks features; and
- signing, notarization, privacy, support, and age-rating responsibilities.

### Packaging boundary

The Steam build reuses the same OCaml engine, Melange facade, TypeScript controller, UI, assets, and browser acceptance scenarios. Platform-specific code is confined to a desktop adapter responsible for window lifecycle, filesystem-backed persistence, safe external navigation, and optional Steamworks integration.

The base game must launch and remain playable offline without Cloudflare. The desktop package must contain all required game assets. Cloudflare remains the website host and may host marketing or support content, but it is not a runtime dependency for the base Steam game.

Steamworks integration is opt-in by feature. The Steamworks SDK is not added to the core engine, browser build, or website merely to upload a build; Valve documents the SDK as required for content upload while other SDK features are optional.

### Delivery sequence

1. Select and record the desktop wrapper and initial OS support.
2. Produce local development packages from the verified web build.
3. Add filesystem persistence and migration tests without changing engine serialization semantics.
4. Add code signing or notarization required for the selected platforms.
5. Create Steam launch options and one or more platform-appropriate depots.
6. Upload through SteamPipe using a least-privileged build account and protected credentials.
7. Exercise install, launch, update, rollback, save compatibility, offline play, and uninstall behavior on a private Steam branch.
8. Complete Valve's store-presence and build reviews before scheduling release.

Public release remains a human-controlled action. Automation may upload a candidate to a private branch, but it must not automatically set the public default build live.

### Steam acceptance criteria

- **STEAM-001 — Shared product:** The packaged game uses the same engine and UI source revision as a verified website release; no forked gameplay implementation exists.
- **STEAM-002 — Offline play:** A fresh Steam installation can start and complete the base game without network access.
- **STEAM-003 — Platform packaging:** Each advertised OS and architecture installs, launches, updates, and uninstalls through Steam using its configured depot and launch option.
- **STEAM-004 — Save integrity:** Desktop saves survive ordinary application updates, reject invalid data safely, and follow the selected platform's documented user-data location.
- **STEAM-005 — Release safety:** Candidate builds are tested on a private Steam branch before a human with publish authority promotes them.
- **STEAM-006 — Credential isolation:** Steam build credentials, guard material, SDK redistributables, and private partner data are absent from source control and public build artifacts except where Valve explicitly requires redistribution.
- **STEAM-007 — Store accuracy:** Supported platforms, system requirements, network requirements, accessibility information, screenshots, and feature claims match the reviewed build.
- **STEAM-008 — Optional services:** Steam Cloud, achievements, overlay, rich presence, controllers, and LLM-backed play are advertised only when separately implemented and verified.
- **STEAM-009 — Review readiness:** The owner-controlled submission has completed the applicable Steamworks store-page and build review gates before public release.

## 14. ChatGPT and MCP delivery track after MVP

The game should be playable from a supported LLM desktop application, with ChatGPT as the initial client to investigate. This is a post-MVP product target with two progressively enhanced experiences:

1. **Conversational play:** the client presents game state and narration in chat while calling MCP tools for legal game actions.
2. **Embedded visual play:** where the client platform supports an interactive application UI, it presents the shared game board inside the conversation while MCP remains the command and state bridge.

MCP alone exposes tools and data; it does not automatically embed the website. The visual experience therefore requires a client-supported application UI in addition to the MCP server. Conversational play must remain usable without that optional UI.

### Architecture and trust boundary

The MCP server is an untrusted adapter around the same authoritative OCaml engine used by the website. It exposes a deliberately small protocol such as:

- `create_game`;
- `join_game`;
- `get_player_view`;
- `get_legal_actions`;
- `perform_action`;
- `end_turn`; and
- `resume_game`.

Tool names and payloads are illustrative until the protocol is designed and versioned. Each state-changing request must identify the game, player, expected turn or state version, and an idempotency key. The engine validates every proposed command and returns typed events or rejections. Neither the LLM nor the MCP adapter may mutate state directly.

Only the redacted view authorized for that participant may cross the MCP boundary. Hidden hands, deck order, private decisions, server credentials, and other players' private state must not appear in tool descriptions, responses, logs, prompts, embedded UI resources, or error details.

A lightweight initial deployment may use a Cloudflare Worker for the remote MCP endpoint and an isolated, durable state holder per active game. The hosting design must be validated against current client authentication, transport, persistence, and interactive-UI requirements before implementation. Cloud hosting is not added to the base browser or Steam game's runtime requirements.

### Initial product modes

The shared protocol should be capable of supporting, without adding all modes at once:

- a human playing against the existing heuristic rival through ChatGPT;
- a human playing against an LLM-controlled rival;
- an LLM acting as narrator, rules assistant, or coach without controlling either player;
- two authenticated humans using separate clients; and
- controlled LLM-versus-LLM simulations for testing.

The first implemented mode must be selected before development. An LLM-controlled player continues to use the neutral `Player_policy` contract and receives no information unavailable to an equivalent human player.

### Delivery sequence

1. Verify the current ChatGPT application, MCP transport, authentication, embedded-UI, review, and distribution requirements.
2. Define a versioned MCP protocol from the engine's player-view, legal-action, command, event, and rejection types.
3. Add protocol contract tests proving that private state cannot cross the adapter boundary.
4. Implement local conversational play with deterministic fixtures and reconnectable sessions.
5. Deploy an authenticated remote MCP service to a private test environment with per-game state isolation, rate limits, structured audit logs, and cost controls.
6. Connect ChatGPT and exercise full-game, invalid-action, duplicate-request, stale-turn, reconnect, timeout, and abandonment scenarios.
7. Add the optional embedded visual board only after conversational play is reliable and the client UI mechanism is confirmed.
8. Complete the applicable owner-controlled client registration, review, privacy disclosure, and publication process before offering the integration publicly.

### ChatGPT/MCP acceptance criteria

- **MCP-001 — Shared rules:** MCP play uses the same versioned OCaml engine and command validation as the verified website; no gameplay rules are reimplemented in prompts or server handlers.
- **MCP-002 — Complete conversational game:** A player can create, play, resume, and finish a complete game through a supported ChatGPT desktop experience without using the standalone website.
- **MCP-003 — Hidden-information safety:** Automated tests prove that each MCP response, resource, error, and structured log contains only the requesting participant's authorized view.
- **MCP-004 — Legal-action enforcement:** Fabricated, malformed, stale, unauthorized, and out-of-turn actions are rejected without changing game state.
- **MCP-005 — Reliable sessions:** Duplicate requests are idempotent, concurrent or stale requests cannot overwrite newer state, and an interrupted session can be resumed safely.
- **MCP-006 — Client independence:** Core engine and protocol types contain no ChatGPT-, model-, prompt-, or provider-specific assumptions; client-specific behavior remains in adapters.
- **MCP-007 — Optional UI:** If embedded visual play is shipped, it derives from the same authorized state and action protocol, remains keyboard operable, and does not become required for conversational play.
- **MCP-008 — Operational controls:** Authentication, participant authorization, retention, deletion, rate limits, abuse handling, observability, model usage, and cost limits are documented and tested before public access.
- **MCP-009 — Honest availability:** Documentation names the clients and account configurations actually verified and does not imply that arbitrary LLM applications can connect without setup.
- **MCP-010 — Human-controlled publication:** Client registration, privacy representations, public listing, and production enablement require explicit approval from the game owner and the relevant service-account owner.

## 15. Risks and stop conditions

- **Unclear rules:** Stop the affected extraction when prototype behavior and intended rules conflict; obtain a product ruling before changing semantics.
- **Hidden-information leakage:** Stop any external-player work if a player view cannot be proven to exclude private hand and deck data.
- **Standalone build pressure:** Escalate for a product decision when single-file generation requires parallel source paths, unsafe HTML rewriting, substantial performance loss, or blocks required platform behavior.
- **Visual parity ambiguity:** Use named critical flows and reference screenshots; do not require incidental pixel identity across browsers.
- **Generated-artifact drift:** CI must regenerate builds from source. Generated output must not become an independently edited implementation.
- **Dual-toolchain friction:** OCaml/Melange and TypeScript dependencies are locked independently, with one documented bootstrap and verification path. If routine development requires manually copying generated code or reconciling two authoritative type definitions, stop and simplify the boundary before adding features.
- **Deployment ownership:** Stop production deployment setup until the client identifies a GitHub repository and Cloudflare Pages project they are authorized to connect and supplies an approved secret-management path.
- **Steam rights and authority:** Stop Steam onboarding or upload work if distribution rights, partner ownership, account permissions, platform commitments, or responsibility for fees and store representations are unresolved.
- **Desktop divergence:** Stop desktop work if the wrapper requires a second gameplay implementation or platform-specific state semantics; preserve the shared engine and serialization contract.
- **MCP information leakage:** Stop external play if participant authorization and redaction tests cannot prove that hidden or private game state stays inside the trusted engine and state service.
- **LLM authority confusion:** Stop integration work if prompts or adapters are becoming a second rules implementation, or if a model can bypass engine validation or directly alter persisted state.
- **Client capability drift:** Reconfirm current ChatGPT and MCP application requirements before implementation or publication; do not make the base game depend on an experimental or client-specific feature.
- **Hosted-play operations:** Do not open the MCP service publicly until authentication, abuse limits, privacy disclosures, retention, deletion, monitoring, and spending controls have approved owners.
- **Licensing:** Do not infer permission to relicense, add third-party assets, or publish under an open-source license.

## 16. Verification and handoff

Implementation is complete only when every `MVP-*` criterion has an automated check or a recorded human verification with reproducible steps, and all checks pass from a clean checkout.

Authoritative inputs for this plan are the repository's current `README.md`, the rules and implementation in `index.html`, the existing 36-card prototype behavior, the product owner's selection of Melange plus OCaml for the engine and TypeScript for the UI, Cloudflare Pages for website hosting, and the client's stated goals of Steam distribution and play through an LLM desktop application such as ChatGPT. Technical direction was checked against the official Melange, Dune, Vite, Vitest, Cloudflare Pages, Tauri, Capacitor, Steamworks, and OpenAI developer documentation current when this plan was written; future implementers must select and lock supported versions during the applicable milestone.

Continuation gate: implementation should begin only after the product owner accepts this scope and resolves any rule discrepancies discovered during Milestone 0. Semantic changes to this plan require renewed product approval; mechanical corrections do not.
