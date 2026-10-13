# FR-001 — Crew-specific bonuses

## Intake

- **Requested:** 2026-09-15
- **Classification:** `rules`, `ui`, `copy`
- **Priority:** `unset`
- **Disposition:** `accepted` for the high-level eight-crew MVP direction
- **Authority status:** The product owner accepted retaining eight distinct crew
  bonuses on 2026-10-13 in [PD-001](../decisions/PD-001-reference-and-crews.md#crew-direction).
  Detailed semantics remain unresolved under RD-002 and the related decision
  gates. No priority ruling or delegated product authority was supplied.

## Original request

The descriptions below preserve the requested abilities and presentation. The
accepted direction does not separately approve every timing, choice, overflow or
interaction detail in this original proposal or in its later implementation.

Replace the current one-free-resource bonus with one ability per crew, following
prototype crew order:

1. **The Docks:** whenever the owner pays to draw, they may draw two cards and
   must discard one.
2. **Club Circuit:** when the owner can afford each target cost, an operator may
   perform its function on up to two targets.
3. **Trailer Park:** when one of the owner's distributors would be killed or
   bought, return it to the owner's hand instead.
4. **The Burbs:** draw one card when collecting income.
5. **Pipeline:** the owner may intercept an operator used against them by paying
   its cost; the operator becomes active on their side and can be paid to perform
   its function on a later turn.
6. **Night Shift:** gain one extra resource per turn and hold up to twelve.
7. **Arts District:** once per turn, pay the costs of the target and the gifted
   distributor to trade one active distributor with the rival.
8. **Hill Country:** trade two resources for one instead of four for one.

Display each ability once per crew on the opening-partner screen. Remove the copy
“Unknown cards may be in the draw pile or the rival’s hidden hand.”

## Roadmap destination

The [accepted MVP amendment](../MVP_PLAN.md#accepted-amendment-2026-10-13)
records the high-level product direction. S01 already characterizes the observed
bonuses at the approved initial reference; those observations have not become
approved corrections. S02's independent foundation work may continue. The eventual
implementation affects at least S04 (income, crew bonuses, resource limits, and
resource trades), S05 (activation costs, operator limits and outcomes, and active
distributor trades), S06 (rival policy), S07 (the facade), S08 (versioned saved state), S09 (browser
interaction), S10 (parity), and S11 (browser and resume verification). If an
affected slice is already done when a specific change is accepted, follow the
delta-slice procedure rather than reopening it.

The roadmap coordinator alone updates the backlog register and chooses scheduling
after the remaining rulings and dependencies are satisfied. Record `accepted`
direction with Priority `unset`; do not infer readiness from this disposition.
RD-007 continues to block S03 independently of baseline acceptance.

## Remaining decisions

RD-002 retains the detailed ability questions: timing, mandatory-choice order,
overflow, consent and save compatibility. Related exact observations and affected
commands/slices are in the [decision register](../../tests/characterization/rule_decisions.json),
including automatic Pipeline interception, Burbs cash/trim order, Fixer overflow,
Ruffian redundant targeting and Hill Country AI funding. None is resolved by
accepting the crew direction. Priority and implementation scheduling also remain
separate decisions under `CONTRIBUTING.md`.

## Verification for implementation

- Add deterministic characterization scenarios for every ability, for multiple
  simultaneously complete crews, and for gaining or losing a completed crew.
- Add success, rejection, and no-mutation coverage for every new or changed public
  command and each limit or overflow edge case.
- Update rival-policy fixtures so the rival can value, use, and respond to all
  eight abilities without observing hidden information.
- Update browser copy, crew inspection, turn guidance, payment flows, accessibility
  announcements, persistence fixtures, and full-game simulations.
