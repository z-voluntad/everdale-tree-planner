# Everdale Planner

![Layout two in the village editor](docs/preview.png)

[简体中文](README.md) · [Sources and provenance](docs/SOURCES.md) · [Architecture](docs/ARCHITECTURE.md)

An independent, browser-local village planner built with React, TypeScript and Vite.

Drag 5×5 and 4×4 groves, move existing groups, undo changes and save multiple custom layouts. Two reference templates are included. All layouts share the same seven fixed resource locations on a 70×70 map with the entrance at the bottom. Editing a template creates a custom copy. English and Simplified Chinese are supported throughout the interface.

## Track progress

Use **Track growth** to click whole groves and mark them grown. Grown groves turn dark green with a check mark. Click again to unmark, or undo/redo. The first template edit creates a personal copy. The summary shows completed and remaining groups plus estimated tree counts.

Use **Edit layout** to move, add or delete groups. Moving preserves growth; new or duplicated groups start pending. Progress stays in this browser, without an account or automatic device sync. Export/import JSON to transfer layouts and progress. SVG exports retain growth colors and check marks. Old saves start pending. Keyboard users can Tab to a grove and press Space or Enter to toggle growth.

## Development

Use Node.js 24 (minimum 22.12) and pnpm 11.25.0.

```sh
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm preview
```

The production output is `dist/`. Open the Vite server URL, not index.html directly.

## Deploy

Upload this directory as a GitHub repository, keeping the lockfile and excluding node_modules, dist, environment files and private saves. For GitHub Pages, select **GitHub Actions** under **Settings → Pages**. Pushes to `master` or `main` automatically run **Deploy GitHub Pages**; manual runs are also supported. Pull requests and other branches run checks only. Relative asset paths support repository subpaths. Types, tests and the production build must pass before deployment.

GitHub Free supports Pages from public repositories; private repositories require an eligible paid plan. The workflow does not change repository visibility. See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages). After deployment, the default URL for this repository is `https://z-voluntad.github.io/everdale-tree-planner/`.

For other static hosts: Node.js 24, install `pnpm install --frozen-lockfile`, build `pnpm build`, publish `dist`. No backend, secrets or rewrite rules are needed.

## Data and limitations

Custom layouts are saved in this browser only. Storage does not transfer between file URLs, localhost or deployed domains; export and import JSON to migrate. Legacy 70×70 JSON is supported, while fixed resource locations always come from the canonical project data.

The blue boundary is derived from game configuration and has not been tested tile by tile in game. Layout two contains 87 detected outer groups; the assumed 7/5 weighting gives 451, not 450. Its interior colored areas are not trees. See [the provenance document](docs/SOURCES.md).

Source code is MIT licensed. Game data, names, trademarks and third-party diagrams retain their respective rights. No game artwork, APKs or original reference images are bundled. This project is not affiliated with or endorsed by Supercell.
