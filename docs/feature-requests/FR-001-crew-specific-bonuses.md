# FR-001 — Crew-specific bonuses

## Intake

- **Requested:** 2026-09-15
- **Classification:** `rules`, `ui`, `copy`
- **Priority:** `unset`
- **Disposition:** `triage`
- **Authority status:** The request itself does not establish that the requester is
  the product owner or an explicitly authorized delegate. Product authority,
  priority, and disposition must be recorded before this becomes accepted MVP
  work.

## Request

Replace the current bonus of one free resource per completed crew with one distinct
bonus for each of the eight crews:

1. Whenever the player pays to draw a card, they may draw two but must discard one.
2. The player may hold up to three active operators.
3. When one of the player's distributors would die, return it to the player's hand
   instead.
4. The player draws one card when collecting income.
5. The player may intercept an operator used against them by paying that operator's
   cost. On payment, the operator becomes active for the player and can be paid for
   and used during a later turn.
6. The player receives one additional resource each turn and may hold up to twelve
   resources.
7. Once per turn, the player may trade one active distributor for one active rival
   distributor.
8. The player may trade two resources for one instead of four resources for one.

## Roadmap destination

The next ready roadmap slice overall is **S01 — Behavioral baseline and rule
decisions** (S02 is also ready, but S01 is the lowest-numbered ready P0 slice).
This request does not enter either active slice directly. It remains in the feature
backlog until authorized triage because it replaces an approved base-game mechanic
and therefore changes the MVP's rules and acceptance semantics.

If accepted for the MVP, the product plan must be updated and re-accepted before
the work is scheduled. S01 must then characterize the new bonuses. The eventual
implementation affects at least S04 (income, crew bonuses, resource limits, and
resource trades), S05 (activation costs, operator limits and outcomes, and active
distributor trades), S06 (rival policy), S08 (versioned saved state), S09 (browser
interaction), S10 (parity), and S11 (browser and resume verification). If an
affected slice is already done at acceptance time, the change requires a new delta
slice rather than reopening that slice.

The follow-up change implements these bonuses in `index.html` in the crew order
already used by the prototype: The Docks, Club Circuit, Trailer Park, The Burbs,
Pipeline, Night Shift, Arts District, and Hill Country. S01 must capture this
prototype behavior when it locks `prototype_baseline`; otherwise the modular
application would need a separately accepted delta and migration work.

## Decisions required before acceptance

1. Map each numbered ability to a named crew. The request supplies eight abilities
   but does not explicitly associate them with the eight crew names.
2. Decide whether a completed crew grants its ability to both players symmetrically
   and when the ability starts and stops applying.
3. Define "operator's cost" for interception: activation cost, effect cost, or
   both; define who pays any target-dependent effect cost; and define whether the
   intercepted effect is cancelled.
4. Define destinations and overflow behavior for saved distributors, intercepted
   operators, income draws, and exchanged distributors when hand, operator, or
   distributor limits are full.
5. Define the paid-draw bonus timing, including the mandatory choice between the two drawn cards and interactions with hand and legitimate-business limits.
6. Define the timing and color choice for the extra resource, whether the resource
   cap returns to ten when the crew becomes incomplete, and how excess resources
   are trimmed.
7. Define the distributor-trade command's timing, eligibility, capacity handling,
   once-per-turn state, AI behavior, and interaction with victory and elimination.
8. Define whether the improved resource rate applies to every trade and whether
   crew bonuses stack when several crews are complete.
9. Decide save-schema compatibility and whether existing games retain the old
   shared bonus or migrate to the new rules.

## Verification expected if accepted

- Add deterministic characterization scenarios for every ability, for multiple
  simultaneously complete crews, and for gaining or losing a completed crew.
- Add success, rejection, and no-mutation coverage for every new or changed public
  command and each limit or overflow edge case.
- Update rival-policy fixtures so the rival can value, use, and respond to all
  eight abilities without observing hidden information.
- Update browser copy, crew inspection, turn guidance, payment flows, accessibility
  announcements, persistence fixtures, and full-game simulations.
