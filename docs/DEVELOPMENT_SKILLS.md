# Development skills

City of Vice selects all eleven implemented skills from
[philsaxton/codex-skills](https://github.com/philsaxton/codex-skills) at one exact
source revision. Project governance and the current task's authorization remain
authoritative; selecting a skill does not create a new contract or release gate.

## Source pin and project selection

- Vendor: `.agents/vendors/codex-skills`
- Repository: `https://github.com/philsaxton/codex-skills.git`
- Commit: `f1f2ac57f3e409649da95e1ff6195ac00e2944ae`
- Root tree: `1c8a352cdf9717db3597fe853634260ed5324f70`

Selected links under `.agents/skills/`:

- `cleaning-git-repositories`
- `cloud-development`
- `contract-author`
- `contract-reviewer`
- `coordinator`
- `running-discrete-shell-commands`
- `solution-design`
- `verification-method-author`
- `verifier`
- `workspace-scratch`
- `workspace-setup`

The gitlink pins the source revision, `.gitmodules` identifies its repository, and
the symlinks select the project-visible names. Keep the vendor outside the skill
discovery directory. This revision refreshes the original seven selected skills
and supplies the four additional roles, without replacing unrelated runtime or
personal skills.

## Recover and check the selection

Materialize the exact pin using the environment's authorized repository-recovery
route. In the cloud workflow, retrieve source through the GitHub connector and
check file bytes against the pinned tree's Git blob identities. Preserve the
distinction between a source snapshot and a complete Git checkout with history.

The 2026-10-13 cloud setup materialized the eleven complete skill directories plus
the upstream `README.md` and `scripts/link-skills.sh`: 35 files, 335,015 bytes.
This is a partial source snapshot, not a full clone. The gitlink denotes the
complete upstream revision; repository-wide test runners and historical evidence
remain available from that pinned upstream source. Do not report unmaterialized
checks as locally available or run.

Restore missing selection links from their versioned link bytes. For a new
selection, use the pinned upstream helper from the consuming project root with
explicit missing skill names:

```sh
./.agents/vendors/codex-skills/scripts/link-skills.sh verifier verification-method-author
```

The helper validates names and refuses to replace existing paths. Seven legacy
links use an equivalent shorter relative target spelling; the helper compares
literal link text, so avoid `--all` over an existing selection. Inspect a conflict
instead of replacing links blindly. The selector's exact Git blob is
`930e61690686afaf595ce89348a8191ca632b585` (1,551 bytes).

Before starting work:

1. Check the gitlink against the commit above. Check all eleven links and their
   resolved `SKILL.md` files; missing vendor sources leave dangling links.
2. Read the applicable project-pinned instructions and required supporting
   resources. Resolve instruction conflicts against project governance and current
   authorization; do not silently substitute another installed version.
3. Compare the current executor's supported skill inventory with the selections.
   Verify any required installation through the supported installer, then a fresh
   inventory and supported skill read. A file read or symlink alone is not proof
   of installation, registration, or automatic loading.
4. If exact registration or automatic loading cannot be established, report that
   limit. Explicit source reading establishes which instructions were consulted,
   but cannot satisfy a gate that specifically requires runtime registration.

## Registration limitation observed on 2026-10-13

The project selection directory was writable and its links were updated.
`verifier` and `verification-method-author` could not be globally registered
because the separate supported installation destination was read-only, including
after the required permission escalation. The project-selected files are readable;
no automatic-registration or automatic-loading claim is made. Recheck the current
runtime's supported inventory and installation route before relying on registration.
