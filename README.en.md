# Everdale Tree Planner

**Plan your groves. Track them as they grow.**

A community tool for Everdale players: start with a reference layout, arrange groves on a 70 × 70 village map, and track growth one group at a time. Runs in your browser without an account.

**[Open the planner →](https://z-voluntad.github.io/everdale-tree-planner/)** · [简体中文](README.md) · [Sources](docs/SOURCES.md) · [Architecture & development (中文)](docs/ARCHITECTURE.md) · [Report an issue](https://github.com/z-voluntad/everdale-tree-planner/issues)

[![Check and deploy](https://github.com/z-voluntad/everdale-tree-planner/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/z-voluntad/everdale-tree-planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4c7558.svg)](LICENSE)

![Layout editor showing the second template and fixed resources](docs/preview.png)

## Features

| Feature           | What it does                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference layouts | Two built-in templates. Your first edit creates a personal copy, leaving the template intact.                                                                                                     |
| Grove editing     | Add 5 × 5 and 4 × 4 groups; move, duplicate or delete existing ones. Grid snapping and collision checks protect map edges, fixed resources and other groves. Existing 2 × 2 groups are preserved. |
| Growth tracking   | Mark whole groves as grown. Dark green fills and check marks show their state, alongside completed and remaining totals.                                                                          |
| Save and share    | Browser-local autosave, undo/redo, portable JSON backups and SVG image exports.                                                                                                                   |
| Map controls      | English and Simplified Chinese, pan and zoom, optional grid and build-area reference boundary.                                                                                                    |

## Get started

1. **Choose a layout.** Open [the planner](https://z-voluntad.github.io/everdale-tree-planner/) and pick a preset, or create a blank custom layout.
2. **Track or edit.** In **Track growth**, click a grove to mark it grown or pending. Switch to **Edit layout** to move or add groves. You can rename your custom copy.
3. **Back up your work.** Export JSON from the file menu to preserve both layout and growth, then import it on another device. Export SVG to share an image.

Moving a grove preserves its growth state. New and duplicated groves start pending. Progress is recorded manually for **whole groves**, not individual trees.

### Controls

| Action             | Control                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| Toggle growth      | Click a grove in Track growth, or Tab to it and press Enter / Space.               |
| Add a grove        | In Edit layout, drag a size onto the map, or click a size and then a map position. |
| Move precisely     | Select a grove and enter X / Y, or use arrow keys. Hold Shift to move 5 tiles.     |
| Delete a grove     | Select it in Edit layout and press Delete / Backspace.                             |
| Undo / redo        | Ctrl / ⌘ + Z and Ctrl / ⌘ + Shift + Z. History lasts for the current page session. |
| View the whole map | Use the zoom and fit buttons above the map.                                        |

## Data and limitations

- **Local saves:** layouts stay in this browser's localStorage. The app does not upload them or provide cloud sync. Clearing site data removes saves; export JSON regularly. Different devices, browsers, localhost and deployed domains require manual export/import.
- **Fixed map:** the map is 70 × 70, with the entrance at the bottom and seven fixed resource locations. Imports cannot replace those locations.
- **Reference boundary:** the blue line is derived from static configuration and has not been verified tile by tile in game. Placement checks enforce map edges, resources and grove collisions; the blue line is advisory.
- **Estimated trees:** 5 × 5 / 4 × 4 / 2 × 2 groups count as 7 / 5 / 3 trees. Layout one estimates 450; layout two estimates 451. The reference geometry is preserved. Layout two's interior colored areas are a visual reference, not trees.

See [Sources](docs/SOURCES.md) for extraction methods, uncertainties and attribution. The planner does not connect to the game or detect live growth.

### If saving is interrupted

A persistent notice pauses saving when a save is damaged or another page has changed it. Your in-memory edits remain available. **Files & settings → Export all layouts** backs up every custom layout; **Import JSON** restores them as additional copies.

- **Damaged save:** the original data stays untouched. If a previous valid backup exists, it is loaded for viewing. Download the original save if needed, check the current layouts, then choose **Resume saving**. Recovery archives the original first.
- **Another page updated the save:** export all layouts before choosing **Load latest save**. Reimport your backup to keep both versions.
- **Save failure:** keep the page open, export a backup, check browser storage permissions and space, then retry. Wait for **Saved** before closing the page.

Use an up-to-date browser over HTTPS. Browsers without safe cross-page saving show a notice and still allow editing and exporting. Browser-local backups are also removed when site data is cleared, so download JSON regularly.

## Local development

Built with **React 19 · TypeScript · Vite · SVG · Vitest**. A static frontend with no backend or environment variables to configure.

Use **Node.js 24** and **pnpm 11.25.0**, as pinned in `package.json`.

```sh
git clone https://github.com/z-voluntad/everdale-tree-planner.git
cd everdale-tree-planner
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`. Use the server URL rather than opening `index.html` directly.

```sh
pnpm check    # TypeScript and unit tests
pnpm build    # Production output in dist/
pnpm preview  # Preview the production build
```

## Deployment

The live site uses **GitHub Pages**. Pushes to the default branch (`master`) are checked, built and deployed by a single [workflow](.github/workflows/ci.yml). Pull requests and other branches only check and build. You can also run the workflow manually on the default branch.

For your own fork, enable **Settings → Pages → Build and deployment → Source → GitHub Actions**, then run the workflow. GitHub Free supports Pages for public repositories; private repositories require an eligible plan. See [GitHub's documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Other static hosts can install with `pnpm install --frozen-lockfile`, build with `pnpm build` and publish `dist/` using Node.js 24. Relative asset paths support repository subpaths. No server-side routing rules are required.

## Contributing

[Issues](https://github.com/z-voluntad/everdale-tree-planner/issues) and pull requests are welcome. Include reproduction steps, browser details and a shareable screenshot or JSON example when reporting a layout problem.

Run `pnpm check` and `pnpm build` before submitting code. Keep UI messages in both languages. New templates should document their source, coordinate convention and permission to use the reference. The [architecture guide](docs/ARCHITECTURE.md) describes module responsibilities and extension points.

## License and attribution

Application source code is licensed under [MIT](LICENSE). Game names, trademarks, game data and third-party diagrams retain their respective rights and are not relicensed by this repository.

This is an independent community project, not affiliated with or endorsed by Supercell. No APKs, game artwork or original reference images are bundled. Provenance and uncertainties are documented in [Sources](docs/SOURCES.md).
