# Data provenance / 资料出处

Recorded on 2026-11-03. Evidence is separated from interpretation. No live game state is queried by this website.

## 1. Map reference boundary

- Public archive: [everdale-forever/everdale-assets](https://github.com/everdale-forever/everdale-assets).
- File: [assets/csv_logic/tilemaps.csv](https://github.com/everdale-forever/everdale-assets/blob/main/assets/csv_logic/tilemaps.csv), `OuterInactiveArea`.
- Project output: `src/data/build-area.json`.
- Transformation: transpose the source matrix, `displayX = sourceY`, `displayY = sourceX`, so the entrance faces down. The `.` cells are interpreted as the ordinary activity/build area: 2,600 of 4,900 tiles.
- The previously retrieved public archive and local resource masks matched row by row. The local package SHA-256 was `ea2501c62a0c05a637b7bc992afe7dc795cabdcc60b50bc2e4cef31f40e2b6d7`. The APK itself is not part of this repository.
- **Limit:** this is a configuration-derived reference. It has not been tested tile by tile in a running game and does not prove that every object can be placed at every position. `SpawnArea` is a separate mask; its pink/purple outline is intentionally absent from this application.

## 2. Fixed resource locations

The seven footprints are from the user's `everdale-layout-70x70.json`, not automatically substituted from a different game version. They are canonical for every plan in this project. In particular, the left forest stays at `(10,37)`.

| Resource            |   X |   Y | Width | Height |
| ------------------- | --: | --: | ----: | -----: |
| Soup kitchen / 汤锅 |  33 |  33 |     4 |      4 |
| Stone / 石头        |  15 |  50 |     4 |      4 |
| Clay / 黏土         |  16 |  17 |     4 |      4 |
| Stone / 石头        |  54 |  12 |     4 |      4 |
| Forest / 树林       |  10 |  37 |     5 |      5 |
| Forest / 树林       |  54 |  27 |     5 |      5 |
| Clay / 黏土         |  48 |  41 |     4 |      4 |

Generated data: `src/data/fixed-nodes.json`. Imports contain tree placements and optional painted cells; imported fixed nodes are ignored.

## 3. Layout one / 方案一

- User-supplied diagram; original author and public publication URL remain unverified. No author is invented.
- Reference image SHA-256: `e9a65dfe96e70e94484a0090045301327aca95e50ec837bfa407936f5475d371`.
- Registration: approximately `(157.8,157.8)` image-pixel origin and `10.52` image pixels per map tile. The image includes margins outside the 70×70 map.
- Detected outer groups: 52 × 5×5, 16 × 4×4, 2 × 2×2. Total 70 groups and 1,564 footprint tiles.
- Coordinates: `src/data/layout-one.json`. No group overlaps another group or a fixed resource.

## 4. Layout two / 方案二

- User-supplied 1052×1052 grid diagram; original author and public publication URL remain unverified.
- Reference image SHA-256: `eee400258151daa4fa99b4962198cc7d2fbfc0836a8b3d8fd0255cd0c82080a8`.
- Registration: origin `(0,0)`, pitch `1052/70 ≈ 15.02857` image pixels per tile. Sampling uses the median RGB in a 5×5 image-pixel patch at each tile center.
- A group is detected only when the full square outline has a consistent green class and the interior is light background. Coordinates are the **whole square footprint**, not only its hollow interior.
- Result: 8 × 5×5 and 79 × 4×4, 87 groups, 1,464 footprint tiles. This includes the two outer-ring protrusions near the entrance at `(29,62)` and `(41,62)`.
- **User clarification:** the interior green band is not trees. Only the outer outlined groups are editable groves. `reference-two.json` is an optional color reference, never included in tree counts or collisions.
- Data: `src/data/layout-two.json`. All detected groups fit within 0…69 and do not overlap fixed resources.

## 5. Tree-count assumption

The local asset analysis of tree-group prefabs found 7 / 5 / 3 child trees for 5×5 / 4×4 / 2×2 groups. This supplies an **estimate**, not an independently verified runtime quota rule. A tree-group footprint is not a pixel count.

- Layout one: `52×7 + 16×5 + 2×3 = 450`.
- Layout two: `8×7 + 79×5 = 451`.

The reference geometry is preserved instead of silently deleting or changing a group to force a total of 450. The UI shows the excess as a planning indicator and permits experimentation.

## 6. Attribution and redistribution

The user also supplied this [Bilibili channel](https://space.bilibili.com/328790948) as background on tree placement. No specific video URL or transcript was verified, so it is not used as proof of the grid geometry, refresh boundary or quota. The authorship of the supplied diagrams cannot be attributed to that channel from the available evidence.

The public resource archive is a community archive, not an official API or endorsement. Game names, original assets and third-party diagrams retain their respective rights. The MIT license covers newly authored application code; it does not relicense game data or third-party material. The repository contains derived grid data, not an APK, original reference images or game artwork.

Before adding a future template, record its author/URL when known, extraction method, coordinate convention, license/permission information, and uncertainties here. A source URL supplied later can be added without changing the editor.
