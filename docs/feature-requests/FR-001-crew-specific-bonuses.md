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

Replace the current one-free-resource bonus with one ability per crew, following
prototype crew order:

1. **The Docks:** pay for one draw, then either draw one card normally or draw two
   cards and discard one of them.
2. **Club Circuit:** an Operator may target two rivals instead of one. Pay the
   Operator's full ability cost for each target.
3. **Trailer Park:** if a rival would kill or buy one of the owner's Distributors,
   put that Distributor in the owner's hand instead.
4. **The Burbs:** after the owner collects income, draw one card for free.
5. **Pipeline:** when a rival Operator targets the owner, the owner may pay its
   activation cost to stop the attack and take the Operator. Put it into play on
   the owner's side.
6. **Night Shift:** gain one extra resource when the owner's turn starts. The owner
   may keep up to twelve resources instead of ten.
7. **Arts District:** once each turn, swap one of the owner's active Distributors
   for one of the rival's. Pay the activation cost of both Distributors.
8. **Hill Country:** trade two matching resources for one resource of another type.
   Normally this trade costs four.

Display each ability once per crew on the opening-partner screen. Remove the copy
“Unknown cards may be in the draw pile or the rival’s hidden hand.”

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

The clarified request maps each ability to prototype crew order and supplies the
cost rule for the Arts District trade. Product authority, priority, disposition,
save-schema compatibility, overflow behavior, and the modular-MVP scheduling
decision still require an authorized record under `CONTRIBUTING.md`.

## Verification expected if accepted

- Add deterministic characterization scenarios for every ability, for multiple
  simultaneously complete crews, and for gaining or losing a completed crew.
- Add success, rejection, and no-mutation coverage for every new or changed public
  command and each limit or overflow edge case.
- Update rival-policy fixtures so the rival can value, use, and respond to all
  eight abilities without observing hidden information.
- Update browser copy, crew inspection, turn guidance, payment flows, accessibility
  announcements, persistence fixtures, and full-game simulations.
