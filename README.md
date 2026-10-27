# City of Vice

Standalone 36-card base-game prototype: one human player against the rival AI.

## Upload to GitHub

1. Unzip this package.
2. Create or open your GitHub repository.
3. Upload `index.html`, `README.md`, and `.nojekyll` to the repository root. Upload the extracted files, not the ZIP itself. `index.html` is the only file required to play.
4. To publish: open **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, and save.
5. Open the website address shown in Pages after deployment finishes.

GitHub Pages publishes a website; do not publish this repository if you want to keep its contents private. See [GitHub's Pages setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Play and edit

Open `index.html` in a modern browser, or serve it through GitHub Pages. On iPad, use the published Pages link in Safari rather than the Files preview.

Choose **New game**, then an opening distributor. Rules and achievements are available from the main menu. This is the base game, not the expansion. Includes the latest strategic AI changes, operator results with OK confirmation, 11-business warning, illustrated end screens, persistent achievements, and local game resume.

All game code, styling, and artwork are embedded in `index.html`. No installation, build command, external asset downloads, API keys, or backend required. Edit that file to change the prototype.

This is a playtesting prototype; balance and AI still need playtesting. Reloading returns to the main menu, where an unfinished saved game can be resumed. Starting a new game replaces that saved game, while earned achievements and the win streak remain stored in the browser. No open-source license is assigned by this package.

## Modular development foundation

The prerequisite foundation has independent technical verification, including
successful hosted bootstrap and aggregate checks. This combined S01/S02 source
requires current cumulative review; required integration-gate enforcement and
controlled failure/block/correction/pass acceptance proof remain open.

The separate S02 foundation uses OCaml/Melange, TypeScript, Vite, and real-browser
smoke tests. With Node 24.22.1 (bundled npm 11.19.1), opam 2.6.1, and the documented
system prerequisites, run `npm run bootstrap`, explicitly install the test browser
with `npm run browser:install`, then run `npm run verify`. After Melange compilation,
`npm run dev` serves the foundation probe and `npm run build:web` produces its
backend-free static site in `dist/`.

The aggregate includes S01's original/validator tests and explicit
`npm run test:characterization` corpus check. Its six PD-002 golden cases are
validated as specifications only, while all 92 historical observations still
execute against the pinned prototype.

See [the foundation guide](docs/S02_FOUNDATION.md) for prerequisites, architecture,
locked dependencies, individual checks, and remaining CI/integration acceptance
gates. The foundation does not implement gameplay; continue using root `index.html`
for the current prototype. No open-source license has been assigned.
