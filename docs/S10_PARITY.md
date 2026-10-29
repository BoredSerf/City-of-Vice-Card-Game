# Rich browser and working reference comparison

The modular browser now uses seven byte-identical WebPs extracted from the
approved initial prototype `4ccb19703d4af1a1c202d922b514a58a17d0e537` (index SHA256
`f01755c9c82c3f871fafc7f8b5b1b078ad05ddb6421a15425a0e824ebc6fac15`).
This is a **working comparison**, not an owner-selected final parity cutoff.
S10-AC12 remains unsatisfied until the owner selects that reference, reconciles
the ledger through it, and accepts product parity and intentional differences.
Detailed provisional rule decisions and issues94/95/96/99/100 remain open.
No ledger or final-reference value is changed by this implementation.

## Playing the rich flow

Use [the browser guide](S09_BROWSER.md) and [locked setup](S02_FOUNDATION.md).
Rules, Card gallery and Achievements are available from the menu and game.
Opening choices show all24 offered distributors in eight crews. The gallery has
three pages of12 and card/crew inspection. Artwork beside named controls is
decorative; enlarged inspection preserves the original crop, including Leonard
Huff's separate portrait. Resources show both explicit colors and source aliases.

Actions still select complete offered commands, including whole payment arrays
and ordered targets. Summaries are selections, not predicted outcomes. Own hand,
own active and rival active locations may be shown; other locations are unlisted.
Required decisions remain reachable during information/results, with the actual
owner taking priority. A rule description or displayed count never validates an
action or adjudicates a win.

Current transitions entering11 businesses show a UI-only warning; operators do
not count. Leaving/re-entering11 may warn again. Restored11 shows static status,
without replaying the warning. Completed operator/interception/disposal facts
show actual discard/active/suspended/ordinary-hand destinations. OK and recap
Continue change presentation only. Outcomes appear immediately from actual engine
winner/reason with the original win/lose art. Reduced-motion disables decorative
result/outcome animation and keeps controls usable. Information navigation
cancels old ordinary rival callbacks; mandatory rival ownership still progresses.

## History and achievements

`read_visible_history()` adds one bounded read-only controller publication. It
uses the current adopted canonical history and the same pure24-tag visibility
mapper as current narration, with no controller-to-DOM dependency. At most30
detached contextual safe facts are returned; unknown projection fails minimally.
Only current trusted batches announce, animate, create recap or measure awards.
History/restoration/render/OK never manufacture such a batch. Resume can show a
local marker; it does not rewrite saves or replay commands/policy/income/RNG.
Memory progress follows its own live lineage even when old saved bytes survive.

The isolated `city-of-vice-modular-achievements-v1` record has exactly
`{schema_version:1,earned_ids:string[],win_streak:number}`: unique known award IDs
and a nonnegative safe integer. It never imports the legacy achievement key.
The16 source predicates are elimination victory, streak10, eight complete crews
and six complete color business sets including legit businesses; operators cannot
satisfy a monopoly. A real current human win increments once; loss resets streak
and keeps earned IDs. Memory-only/unsaved wins remain eligible.

An in-memory per-live-game guard consumes each current finish once. A missing
final public view holds only public winner/reason until a matching view from the
same live game is available; another adoption discards that unmeasured context.
Passive terminal adoption/history cannot award. Unknown baseline means unknown
count/streak; current summaries may wait for explicit recovery. Invalid bytes are
protected. Failed writes retain pending progress and explicit Retry does not
recount or call the game. Recovery permits null or the exact known prior raw
baseline; changed non-null bytes remain protected. Overflow reports unavailable.
Reload can lose pending progress. There is no durable old-save replay deduplication,
cross-tab ownership, legacy migration or atomic game/achievement transaction.

## Working differences requiring owner acceptance

| Feature                  | Supported behavior / comparison limit                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules/economy            | PD-002 automatic incoming income and verified owner/whole-action/crew corrections replace obsolete reference lifecycle wording. Individual rule acceptance remains pending.                                                                                                                                                                                                                          |
| Art/inspection           | Seven exact payloads, normalized atlas geometry and card34 override; semantic layout rather than pixel identity. All36 public card identities remain available.                                                                                                                                                                                                                                      |
| Opening income placement | Working4ccb index1090 shows each opening's inline `+1 <resource alias> per turn`; the current opening grid shows portrait/name and crew benefit. Resource/color and income facts remain reachable before commitment through Rules and Card gallery/inspection ([B01](../tests/browser/playable.test.ts)/[P01](../tests/browser/ui.test.ts)). This placement difference awaits AC12 owner acceptance. |
| Locations/choice aids    | Authorized known locations, printed facts, complete selected values and actual completed destinations; hidden legit/discard membership and exact forecast/disabled-reason solver are omitted under provisional100.                                                                                                                                                                                   |
| Results/recap            | Mandatory owners and authoritative outcomes take priority. Immediate usable OK and scoped reduced-motion CSS replace legacy delays. Provisional94 covers interrupt/ack details.                                                                                                                                                                                                                      |
| Restored log             | Newest30 contextual safe facts, grouping/wording may differ from legacy45 stored prose. No second history key; provisional95.                                                                                                                                                                                                                                                                        |
| Achievements             | New isolated schema, no legacy import, current-batch guard and honest pending/unknown failures. No durable replay deduplication; provisional99.                                                                                                                                                                                                                                                      |
| Final cutoff             | Working4ccb only. Final reference/ledger/deltas and human parity acceptance remain required; AC12 unsatisfied.                                                                                                                                                                                                                                                                                       |

## Finite executable and visual method

Use the existing toolchain and generated inputs from S07/S08. Run:

```sh
npm run test:contract
npm run build:web
npm run test:browser
npm run verify
```

Both actual development and fresh standalone facade targets include
`tests/integration/rich.test.ts`: A01 exact source bytes/dimensions/all36 mappings;
E01 warning entry/count/re-entry; H01–03 contextual/current-lineage/detached/history
reads without game/storage calls; J01–03 all16 independent predicates and isolated
record admission/failure/recovery controls. Existing U03 supplies all24 tags and
visibility variants. Existing controller and browser coverage remains required.

Normal development/built B01 adds all rich screens/art loads, restored history
without current effects, actual human/rival expansion/elimination finishes and
current awards. `tests/presentation/rich_cases.json` discloses the independently
authored mirrored WIN002 and10-to11 variants; it is private test input, never a
shipping state hook. Existing B02/B03 retain complete alternatives and both owners.
E02 checks literal actual result destinations/order/boundaries, reduced motion and
UI-only OK; E03 checks actual either/both11. J04 checks current setter and missing
final-view recovery without replay and invalidation on new adoption.
E04 follows one actual same-game rival entry, protected return and re-entry into11;
P01 checks factual own-hand/own-active/rival-active/crew inspection without mutation.
R02–R04 retain detached acknowledgement nodes across real same-mount adoptions or
disposal. The old result OK, warning OK, recap Continue, information close and
confirmation Cancel cannot mutate new presentation or call the game/storage/awards;
current OK/Continue/close still work. R02 uses protected WIN002 Hitman30→6 then
Fixer35→6,9 through actual menu/Resume, without remounting or fabricated success.
It fails on the pre-repair callback and passes with the existing epoch/disposal
guard. Ordinary gameplay candidates still reach current engine validation (B07).

Run this focused same-mount regression with the existing generated inputs/browser:

```sh
npm exec -- vitest run --config vitest.browser.config.ts tests/browser/ui.test.ts -t 'S10-R02|S10-R03|S10-R04'
```

It must preserve the new presentation's complete DOM, exact saved bytes and
engine/game-storage/award call counts after detached old acknowledgements, while
current acknowledgements clear their own panels. A missing fixture/control or
unavailable browser fails the measurement; it is not a passing rejection. Existing
S07–S09 prerequisite controls and awaited browser cleanup remain applicable.
J05 checks unsaved current-win eligibility and explicitly admitted passive terminal
history/render without reawarding or creating new effects.

`tests/browser/reference.test.ts` R01 verifies the protected working index hash.
Ordinary reference menu/rules/opening/gallery/Leonard use unchanged bytes. Four
hard reference outcomes replace **only** its final initialization statement with
independent characterization literal terminal states (mirrored inputs disclosed),
preserving renderer/rules. This is renderer comparison, not reference policy proof.
No reference consumer, test fixture or legacy script ships. Shallow CI needs only
the protected current index bytes, not a historical Git object.

Set `CITY_UI_EVIDENCE_DIR` to an existing retained directory outside source before
browser checks to save paired1280×900 reference/modular screenshots and exact
original/patch/fixture hash receipts. Visually inspect all three gallery pages,
card34, opening, rules and four outcomes for artwork identity/crop, readable facts
and usable controls. Metadata/hash assertions alone cannot establish that visual
judgment. Record viewport, actions, initialization disclosure and observations.

For the A01 known-failure control, make an isolated copy of the integration suite
named `tests/integration/rich_control.test.ts`; change only its source SHA assertion
to64zeroes. Run `npm exec -- vitest run --config vitest.config.ts tests/integration/rich_control.test.ts -t S10-A01`.
It must fail on the unchanged source digest. Recreate that owned copy from the
original and change only `../presentation/reference_assets.json` to
`../presentation/required_s10_missing.json`; the same command must fail ENOENT.
Retain both nonzero logs, remove only the owned temporary copy and confirm the
original hash unchanged. Reuse the S07 loader/S08/S09 private-input/unavailable
controls; an unrelated import/launch failure is unavailable measurement, not a
passing rejection. Do not mutate product code or purge native caches for controls.

Browser methods use isolated real Chromium contexts, own sandbox enabled, actual
ephemeral loopback origins, local-only requests and empty page-error checks.
Every failure awaits its owned contexts/browser/server cleanup. Preserve shared
listeners and evidence. Retain source/output/asset/fixture/screenshot hashes,
commands/exits/adverse attempts and actual PID/profile/port cleanup. Native cache
reuse is not a fresh120-game run; independent/current hosted proof remains separate
from author results and human acceptance. S11 full matrix and S12 distribution are
outside this slice.
