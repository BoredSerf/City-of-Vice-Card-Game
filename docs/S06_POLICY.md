# Neutral player policy

The pure OCaml heuristic proposes one command from an immutable player view and
the engine's complete ordered legal choices. Human and automated submissions use
the same current-state `Engine.perform_command` validation.

`Player_view.observe state ~player_id` is a trusted projection. The view contains
public phase, turn, active participant, mandatory owner and outcome; both public
banks, ordered active cards and hand counts; the participant's own hand,
suspensions, draw price and Arts allowance; live own resource limit, trade rate and
distributor capacity; draw/discard counts; and only an owned pending decision.
Opponent hand identities, composition and legitimate-business totals, foreign
private pending cards, discard identities, deck order, seed, cursor, history and
full transitions are absent. Inactive defenders can own Pipeline or post-action
trim decisions.

`Player_policy.propose view ~legal_commands` receives only these immutable values.
It returns `Ok (Some command)`, `Ok None`, or a typed rejection. The caller keeps
the intended participant and canonical state, submits the command immediately,
then obtains a fresh observation before choosing again. Never install proposed
state or cached effects. An old command that is illegal now rejects unchanged; an
old command that is still legal can succeed after full current validation, exactly
as a fresh human submission. There is no observation-age stamp or session store.

The source heuristic's business, active-operator, funding, held-operator, draw and
spare-card priorities remain. Funding reserves fixed costs and plans a complete
payment before proposing its first cash/trade step. It replans after submission.
Ties retain hand, active or pending order, then color order Green, Blue, Black,
White, Yellow, Purple. Fixed payments precede wildcard payments; wildcard and draw
spending prefer the largest remaining bank. Draw proposals select the advertised
canonical color-order payment multiset. Legit activation uses the advertised
explicit wildcard color.

The nine original S01 AI records remain unchanged observations. These policy
corrections remain provisional pending human acceptance:

- [#67](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/67): live Hill
  trades use two resources in both eligibility and simulated debit, otherwise four.
- [#79](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/79): prefer legal
  Docks two-card mode, with ordinary-draw fallback when two cards are unavailable.
- [#80](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/80): extend the
  source primary Club attack only with an already legal, affordable second target.
  Before drawing, consider legal Arts swaps that complete an own pair by gifting
  an own singleton, preserving source target and gift order.

Owned mandatory decisions precede ordinary play: Docks discards the lowest
category score (operator, distributor, legit); forced legit cash uses the retained
drawn card and its printed color; trim maximizes
`20 * bank[color] - 7 * min(own hand color count, 2)`; Pipeline accepts when legal.
The engine owns effects, income and decision ordering, including Docks discard →
fourth-legit cash → final trim. A missing required continuation returns
`invalid_state/policy_legal_commands`; it never clears the phase or substitutes an
arbitrary action. Waiting, terminal and human opening selection return no command.
Initial active Ready proposes collection; ordinary stopping proposes `end_turn`.

The maintained JSON-string facade adds:

```ts
player_observation(state_json: string, player_json: string): string;
heuristic_proposal(observation_json: string): string;
```

Projection success is `{status:"accepted",observation:{view,legal_commands}}`;
proposal success is `{status:"accepted",command:Engine_command|null}`. New errors
are only `{status:"rejected",rejection:{code,field}}`. They contain no state,
events or request echo. Malformed observation input reports
`malformed_command/policy_observation`; invalid participant reports
`invalid_actor/player_id`. Projection retains the existing state decoder's typed
errors. Existing full-state facade results are trusted caller data and must never
be passed to policy.

Under [#84](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/84), native
`Wire_value.Object` duplicates reject structurally. The generated boundary retains
JavaScript JSON parsing: later duplicate raw keys replace earlier values before
strict shape validation. It does not claim raw-text duplicate detection. Neither
parsed shape nor prior legal-list membership authorizes a transition.

Run `npm run verify` using the established foundation workflow. Its required native
policy/parity targets and actual generated contract suite consume
`tests/policy/scenarios.json`, including exact source records, literal commands,
complete expected states/facts/views, both mandatory owners, all eight crews,
canonical payment, ordering, privacy twins, detachment and current-validation
controls. Missing, empty or partial fixtures/parity fail. Native/generated
agreement corroborates the independent literals. The existing 120 complete-game
simulation/replay, 92 prototype observations and six specification-only PD-002
goldens remain in the aggregate.

This slice adds no browser policy loop, storage, controller, gameplay UI, strategy
framework, provider, network service or dependency. S07 owns complete facade
stabilization, S08 the controller/persistence and S09 playable modular flows. The
current browser shell remains the foundation probe; use root `index.html` to play.
