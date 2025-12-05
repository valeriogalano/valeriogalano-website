Project development guidelines for valeriogalano-website

This repository is a Hugo static site using a custom theme `vim-style`. The theme renders a Vim-like UI, exposes command routes configured in `config.toml` to the frontend, and uses Hugo Pipes to fingerprint and serve assets.

The notes below focus on project-specific behaviors and workflows that are useful for maintenance and extension.

1. Build and configuration

- Prerequisites
  - Hugo Extended 0.152+ (for Hugo Pipes: SCSS/CSS minify + fingerprint). Older versions might build, but asset pipeline fingerprints and integrity attributes are verified in tests.
  - No other runtime dependencies are required to serve the already built site under `public/`.

- Local dev (live):
  - From repo root:
    - hugo server -D
    - Opens http://localhost:1313 by default. Drafts are enabled with `-D`.

- Production build:
  - hugo --minify
  - Output goes into `public/`. Our CI (see `README.md` badge) uses GitHub Actions with the default Hugo workflow to deploy.

- Configuration specifics:
  - config.toml
    - `.Site.Params.routes` is the single source of truth for all Vim-style commands. The partial `themes/vim-style/layouts/partials/route_data.html` serializes these routes into a hidden div `<div id="vs-routes" data-json="…">` consumed by `themes/vim-style/assets/js/command-nav.js` at runtime. If you add a command here, it will:
      1) appear in the top navigation when appropriate layouts reference it, 2) be listed in `/help` if `showInHelp` is true, and 3) work via the `:` command line.
    - `params.version` is displayed in the footer (see `.vim-ver`). Bump this when you release.
  - Assets
    - CSS/JS are processed via Hugo Pipes in `baseof.html`:
      - `resources.Get "css/main.css" | resources.Minify | resources.Fingerprint`
      - `resources.Get "js/*.js" | resources.Minify | resources.Fingerprint`
    - The resulting links in HTML include `integrity` attributes and fingerprinted filenames under `/css` and `/js` in `public/`.
  - Content
    - Content files live in `content/` and are plain Markdown with simple frontmatter (see `_index.md`, `_about.md`, `_help.md`, `_changelog.md`).
    - Use the `archetypes/default.md` when creating new content types to maintain consistent frontmatter.

2. Testing

We keep tests pragmatic and fast, focused on validating the static artifacts that Hugo produces. Since the repository already contains a built `public/` directory, we can perform non-destructive smoke checks without requiring Hugo to be installed.

- What we validate in smoke tests
  - Critical pages exist: `public/index.html`, `public/about/index.html`, `public/help/index.html`, `public/changelog/index.html`.
  - The routes JSON bridge is emitted: a hidden div `#vs-routes` with a `data-json` attribute is present in pages (e.g., homepage).
  - Fingerprinted assets are linked and present on disk: a CSS file like `/css/main.min.<fingerprint>.css` is referenced and exists; JS bundles are referenced; footer shows the configured version.

- Permanent smoke test script
  - A maintained script lives at `scripts/smoke_public.sh`. It only reads files under `public/` and does not modify anything.
  - Usage:
    - Static check against current `public/` output:
      - `bash scripts/smoke_public.sh`
    - Build then check (if Hugo is installed):
      - `bash scripts/smoke_public.sh --build`
  - The script exits non-zero on failures. Fix content/theme/config accordingly.

- Adding new tests
  - For static validations (preferred): add additional greps/assertions to `scripts/smoke_public.sh` to verify new invariant HTML blocks, assets, or content markers.
  - For build-time validations (optional): if Hugo is installed in CI or locally, invoke `bash scripts/smoke_public.sh --build` to produce a fresh `public/` before running the static checks.
  - Keep tests deterministic: avoid matching on localhost URLs or livereload artifacts unless you are explicitly testing the dev server output.

3. Additional development notes

- Code style and templates
  - Template partials in `themes/vim-style/layouts/partials` prefer small, composable pieces. Follow the existing naming and logic patterns.
  - Keep partials idempotent and avoid side effects; all dynamic data should flow from Hugo’s `.Site` and page context. Route serialization is performed in a dedicated partial (`route_data.html`).

- Routing commands (Single Source of Truth)
  - Add/modify routes only in `config.toml` under `[[params.routes]]`. Do not hardcode command lists in JS; the JS reads the emitted JSON map. This prevents drift between help, navigation, and command execution.

- Assets
  - If you add new JS/CSS, use Hugo Pipes via `resources.Get` to ensure bundling, minification, and fingerprinting with integrity hashes. Reference assets in `baseof.html` similarly to existing ones.

- Content conventions
  - Frontmatter uses minimal keys: `title`, `url`, `aliases`, `draft`, and optional `navLabel`. Keep URLs trailing with `/` for consistency.

- Versioning
  - Bump `params.version` when you publish changes that should surface in the footer. Consider updating `content/_changelog.md` accordingly.

- Accessibility
  - The theme includes ARIA labels and keyboard navigation. When altering layout or labels, ensure the ARIA attributes remain and that the j/k/Enter flows are not broken.

4. Quick troubleshooting

- Routes not working via `:`
  - Confirm `#vs-routes` exists in the page HTML and that `data-json` contains your new command. If missing, check `config.toml` edits and rebuild.

- CSS/JS 404s after changes
  - Ensure the new assets are processed through Hugo Pipes. Never reference non-fingerprinted filenames from templates that expect fingerprinting.

- Help page missing commands
  - Verify `showInHelp = true` in the corresponding route block in `config.toml`.

 5. Versioning and changelog automation

 - Purpose
   - The page `content/_changelog.md` documents changes to the site's "fake terminal" (Vim-style UI: command line, j/k navigation, mobile keys, and related behaviors). The footer shows the site version from `config.toml` (`.Site.Params.version`). Keep these two in sync on every feature addition/improvement.

 - Recommended workflow (manual, reliable)
   1) Implement the feature (e.g., new `:` command, improved navigation behavior, mobile key tweak).
   2) Bump the footer version by editing `params.version` in `config.toml`.
   3) Prepend a new section to `content/_changelog.md` with a header `### vX.Y.Z` and succinct bullets of the user‑visible changes to the fake terminal (commands, keyboard/mobile interactions, accessibility labels, etc.). Keep newest first.
   4) Build and smoke test:
      - `bash scripts/smoke_public.sh` (or `--build` if Hugo is installed) — confirms the version marker is present and assets are healthy.
   5) Commit both files together in one commit (message style: `chore(release): vX.Y.Z`). Optionally tag the commit (`git tag vX.Y.Z`).

 - Optional automation (scripted release)
   - You may add a small `scripts/release.sh` to automate: version bump in `config.toml`, changelog section prepend, optional `hugo --minify`, and a Git tag. Suggested behavior:
     - Modes: `--dry-run` (prints intended edits) and default (applies changes).
     - Inputs: `--version X.Y.Z` or `--type patch|minor|major` to compute the next version from the latest `params.version`.
     - Edits:
       - Update `params.version = "X.Y.Z"` in `config.toml`.
       - Insert a new top block in `content/_changelog.md`:
         ```
         ### vX.Y.Z
         * <short notes on terminal-related changes>
         ```
     - Post‑steps: run `bash scripts/smoke_public.sh --build` if Hugo is available, then commit+tag.
   - Keep the script idempotent and POSIX/Bash portable (BSD/GNU sed compatible), following the patterns already used in `scripts/smoke_public.sh`.

 - Extra smoke checks (optional)
   - To guard the release process, you can extend `scripts/smoke_public.sh` with two assertions:
     - Ensure `public/changelog/index.html` contains the latest version header (e.g., `grep -q '### vX.Y.Z' ...`).
     - Optionally verify that the footer `.vim-ver` text matches the version set in `config.toml` (parse one and compare), if you decide to add parsing logic.

 6. Vim-like terminal simulation (desktop + mobile)

 - What is included
   - A simulated Vim environment in the UI:
     - Keyboard navigation with `j`/`k` to move across links and `Enter` to open the selected one.
     - A command line activated by typing `:` which accepts commands listed under `[[params.routes]]` in `config.toml` (single source of truth).
     - A footer status bar with current position and the site version (`.vim-ver`).
   - Mobile controls mirror the desktop interactions with four tap targets rendered in the footer: `cmd`, `Enter`, `j`, `k` (see `.vim-mobile-keys` block). These have ARIA labels and `role="button"` to ensure accessibility.

 - Where it lives (key files)
   - Command routes bridge: `themes/vim-style/layouts/partials/route_data.html` emits a hidden `<div id="vs-routes" data-json="…">` used by frontend JS.
   - Frontend behavior:
     - `themes/vim-style/assets/js/command-nav.js` — parses `#vs-routes`, manages the `:` command line and routing.
     - `themes/vim-style/assets/js/link-nav.js` — handles link focus cycling with `j`/`k`, `Enter` activation, footer position updates, and mobile key bindings.
   - Layout/partials:
     - `themes/vim-style/layouts/_default/baseof.html` — wires assets via Hugo Pipes, exposes routes, includes partials.
     - `themes/vim-style/layouts/partials/command_nav.html` — command line markup.
     - `themes/vim-style/layouts/partials/footer.html` — status bar, version marker `.vim-ver`, and mobile keys container `.vim-mobile-keys`.

 - Maintenance tips
   - When adding a new command, only update `config.toml` under `[[params.routes]]`. The help page and `:` command will pick it up automatically via the serialized routes map.
   - If you change labels or ARIA attributes for mobile/keyboard navigation, ensure the Help page content (`content/_help.md`) remains consistent and the smoke tests keep passing.
   - Keep assets going through Hugo Pipes (minify + fingerprint) so integrity and caching remain correct.
