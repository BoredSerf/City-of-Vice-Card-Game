# City of Vice upstream skill refresh: independent review

Review date: 2026-10-13, 19:25–19:31 UTC. Independent review of the refreshed one-vendor candidate, separate from implementation.

## Judgment

**Ready for publication as the reviewed project-selection checkpoint. No blocking finding.** The owner's later request to refresh codex-skills from origin supports updating the original vendor and all eleven selected skills to the verified current upstream revision. This supersedes the earlier two-vendor proposal, whose review remains unchanged as historical evidence.

**Global registration remains incomplete.** `verifier` and `verification-method-author` are still absent from the supported runtime inventories. Readable project selections do not establish registration or automatic loading. The repository checkpoint can be accepted without misrepresenting that separate limitation; any future task specifically requiring runtime registration remains blocked until it is actually established.

After exact publication and readback, the independently complete **project-selection** PR may become Ready for review, provided its title/body retain that scope and prominently disclose the runtime-registration limitation. The overall user request remains partial until registration is resolved. The inspected proposed PR body makes this distinction accurately. This readiness judgment grants no merge, installation or security-change authority.

## Exact reviewed artifact

- Project: [BoredSerf/City-of-Vice-Card-Game](https://github.com/BoredSerf/City-of-Vice-Card-Game).
- Branch: `phil/development-skills-20261013`.
- Base HEAD: `4ccb19703d4af1a1c202d922b514a58a17d0e537`, tree `2ec9c3176abea9efcce93491a9ea0265dbb6db17`.
- Upstream: [philsaxton/codex-skills](https://github.com/philsaxton/codex-skills), `main` independently read during this review at commit `f1f2ac57f3e409649da95e1ff6195ac00e2944ae`, root tree `1c8a352cdf9717db3597fe853634260ed5324f70`.

The complete intended project change is seven paths:

| Path | Mode | Exact Git object |
| --- | --- | --- |
| `.agents/vendors/codex-skills` | `160000` | commit `f1f2ac57f3e409649da95e1ff6195ac00e2944ae` |
| `AGENTS.md` | `100644` | blob `4dfb8f504a6f1423652ca40e4de7dd820381ce90` |
| `docs/DEVELOPMENT_SKILLS.md` | `100644` | blob `7ec8f22a259d24cec0527722f3d47aec9007b5de` |
| `.agents/skills/cloud-development` | `120000` | blob `7576cc1ee0352399631fe5c43be3baee05d36f15` |
| `.agents/skills/solution-design` | `120000` | blob `a2adf1c141b37c8453af577a06358ee7ca1cf867` |
| `.agents/skills/verification-method-author` | `120000` | blob `18a4429f8ed019b9a90768c22cd1b38793312fda` |
| `.agents/skills/verifier` | `120000` | blob `69eb661c678e379d366ac1c9f51eeae79cecb4c3` |

Each new link targets `../../.agents/vendors/codex-skills/<name>` exactly. The seven legacy link bytes remain identical to the base and use their existing `../vendors/codex-skills/<name>` spelling. All eleven resolve to readable skill files. `.gitmodules` is byte-identical to HEAD; the staged second gitlink is gone and the local additions vendor is absent.

AGENTS.md SHA-256: `a5a3c09a40ff30788a7b5eca2c35e9d8a868850b6c489cea91b4fae420cfff71`.
Guide SHA-256: `e181187d67c1d7ef5e5e8ef1f59e2c2328b5db3766d2362c8f4bf17c8ccc65e2`.

The two tracked-path diff SHA-256 is `603e10fbb23f85b4745f381c740946b184879fcfbb624becdb428f6b2942c4ad`; it excludes the untracked guide and four links, so the complete seven-path table above controls identity. At review, only the vendor gitlink change was staged. This receipt does not claim a commit, publication or PR transition.

## Source and selector verification

Fresh connector reads confirmed current origin/main and obtained the exact root's non-truncated recursive tree. An independent local audit recomputed every materialized Git blob, byte size, executable mode and selected directory tree. **All 35 files, 335,015 bytes matched**: eleven complete skill directories plus upstream README.md and scripts/link-skills.sh. No extra local source file appeared. The materialization remains a partial source snapshot, not a complete checkout/history; repository-wide test runners were not materialized or represented as run.

| Selected directory | Verified upstream tree |
| --- | --- |
| cleaning-git-repositories | `119925bbb3439db0e67784f592aa6937ab1636e7` |
| cloud-development | `faa8c609d11256105aad247450965091214ad2ee` |
| contract-author | `f4ff8db26790a28cf63725a35d3ae1dd33165f6d` |
| contract-reviewer | `a90c9656cea4bac480ae1798a74938f8846d5e56` |
| coordinator | `294c8747a75be4293bba10fdcb48e1b1e8a24ec5` |
| running-discrete-shell-commands | `1790ab11664b60ebc3e391ad1ecfc759e7acb760` |
| solution-design | `cd560a976750e445945031549d0e90446a9eb32e` |
| verification-method-author | `ada481ddf584ddce26bd535eb0614a6f6f406d38` |
| verifier | `043662baecc8981075f001883b586ee6bc75f858` |
| workspace-scratch | `443b2337a2ebdcbbd049da61dff1b71dcc0c3e88` |
| workspace-setup | `30dc7718181a6482fcc927ae0a20697c24ac7533` |

The selector matches upstream blob `930e61690686afaf595ce89348a8191ca632b585`, 1,551 bytes, mode `100755`. Fresh checks:

- `sh -n` passed.
- Explicit invocation for the four new names returned `Already linked` for all four without file changes.
- Invocation for legacy `cleaning-git-repositories` returned exit 1, `Refusing to replace existing path`, because the existing equivalent target spelling differs literally. This confirms the guide's warning and preserves the old link.
- `..` and `no-such-skill` each returned exit 1 with the expected invalid/unknown-name message.
- `git diff --check HEAD` passed.
- Both bundled recovery modules match the SHA-256 pins in recovery-dependency.json. In-memory syntax compilation passed for seven Python files without module execution or bytecode writes. No recovery/profile/test workflow was activated.

## Instruction changes reviewed

The reviewer directly compared the original selected source at `edbcabf470902032963de28c4a01d6400fb36f41` with the new bytes. Six SKILL.md files changed; workspace-scratch is unchanged. The existing helpers, tests and refactoring reference within the original seven directories are unchanged. workspace-setup also updates its UI description/default prompt and adds ten cloud-readiness resources. These differences are included in the judgment, not hidden behind a changed gitlink.

- **Cleaning:** Adds active-writer checks and treats checkout-placement restoration separately. Existing safe-deletion, protected-installation, no-force and explicit remote-authority rules remain. The writable, symlinked project installation does not qualify for the helper's protected `apply-local` route.
- **Contract author:** Preserves unaffected requirements and stable criteria, allows compact organization, reuses adequate tests and routes consequential design choices. It expressly avoids invented universal gates and preserves approval for semantic changes.
- **Contract reviewer:** Adds design-evidence and verification-feasibility investigation, with bounded method-author support. Read-only assignments still prohibit file edits; reviewers still do not author requirements, implement the product or grant continuation authority.
- **Coordinator:** Adds proportional role/skill selection, explicit dispatch context and design-return paths. Required independence, exact-artifact acceptance, ownership, preservation and consequential-action authority remain intact. Optional unavailable skills do not become blanket blockers.
- **Discrete commands:** Simplifies examples without weakening separation, visibility or permission rules.
- **Workspace setup:** Adds conditional cloud setup/recovery guidance. Concrete migration approval, preservation, no silent restructuring and project-governance boundaries remain. The UI description matches this expanded conditional capability; it is not an instruction to run it automatically.

No authority weakening or unrequested City product/release gate was found. The four added roles retain the bounded behavior previously reviewed at this same upstream pin.

## Cloud-readiness and runtime boundaries

The new cloud guidance, schema, dependency pins, provenance and read-only helper were inspected. V1 explicitly distinguishes source checks, supplied host observations, prerequisites, tests not run and acceptance not assessed. It refuses unsupported source symlinks and linked-worktree history, does not execute recipe commands, and leaves report-writing ability unverified without separate evidence. City uses selected symlinks and linked worktrees; this source refresh does not make that helper an applicable universal readiness gate or establish a passing City profile. No new profile was created or applied, and no working files were relocated to satisfy it.

Fresh cloud/executor inventories still omit the two verification roles. The already documented supported-installer failure at the separate read-only destination is carried forward, not described as a newly attempted installation. The project selection directory's successful link creation is distinct from that global destination. Pinned instruction files were explicitly read where relevant; loading/registration was not inferred from links. Existing independently registered TDD, debugging and verification-before-completion capabilities remain present and were not replaced by fabricated vendor copies.

## Privacy, preservation and limits

The public guide and AGENTS pointer contain portable repository/version instructions and the accurate registration limitation, without private audit payloads, credentials, unrelated user material or machine-specific private paths. The prior two-vendor review and preserved proposal remain unchanged outside the publication content. Existing project governance, prototype, application tests and unrelated source are unchanged; S01, roadmap and S02 work were not reopened.

The new review output is small; the initial `du -sb` check reported 9,968,825 apparent bytes for the City recovery directory, not allocated disk use, and the filesystem had over 20 GB free. No dependency installation, browser, heavy build, security change, global support edit, staging, commit or publication was performed. This is source-selection/integrity and instruction-scope acceptance, not a revalidation of every upstream utility or a claim of completed global installation. Publication must preserve the seven-path identity above and be independently read back afterward.
