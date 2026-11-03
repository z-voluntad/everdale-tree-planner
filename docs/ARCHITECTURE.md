# Architecture / 架构

## Layers

```text
src/
  App.tsx                  Application composition and menus
  components/              SVG map, grove symbol, previews, source dialog
  hooks/usePlanner.ts      Custom plans, template copying, undo/redo, save state
  domain/types.ts          Shared typed contracts
  domain/layout.ts         Pure geometry, counts, validation, portable schema
  services/storage.ts     Versioned localStorage codec and legacy migration
  services/export.ts      Safe JSON / standalone SVG export
  data/                    Fixed resources, templates and derived map mask
  i18n/                    Typed zh-CN/en messages and language context
  styles.css               Responsive application design
docs/SOURCES.md            Provenance, assumptions and rights
```

The map uses SVG in logical grid units, independent of display pixels. Pointer positions are transformed through the SVG screen matrix, then snapped to integer map coordinates. Drag previews remain transient; a drop modifies a plan only after bounds and collision checks pass. The canvas supports mouse, touch/pointer capture, keyboard selection adjustments, pan and zoom.

Fixed resources are imported from one canonical data file and cannot be modified through user plans. Templates are also immutable: the first successful edit creates a custom copy. Every custom plan has its own in-memory undo/redo history. Custom layouts are persisted as a versioned library; history is intentionally session-only. Switching templates does not erase custom plans.

The browser is the only persistence layer. There are no credentials, remote saves, telemetry or runtime resource fetches. Static assets use relative URLs, allowing root or GitHub repository-path hosting. CI checks types, geometry, provenance counts, serialization, SVG escaping and translation parity.

## Add a template

1. Add `src/data/layout-three.json` using the same schema as `layout-one.json`. Tree `w` and `h` must match and be 2, 4 or 5. Coordinates are 0-based, X right / Y down.
2. Register the data and translation keys in the `templates` array in `src/data/index.ts`. Give it a unique `preset-` ID. Only extend the reference union in `domain/types.ts` and its parser if it has a new reference layer.
3. Add both language strings and description keys in `i18n/messages.ts`. Template cards are rendered from the data collection.
4. Record attribution and extraction assumptions in `docs/SOURCES.md`.
5. Add a fixture count assertion, then run `pnpm check && pnpm build`.

## Add a language

Add a complete `Record<MessageKey,string>` dictionary, extend the locale union and provider selector. The current language persists separately from layouts. Automatically generated names are editable; user-authored names are not translated when the language changes.

## JSON contract

Exports contain `format`, `version`, `N`, `id`, `name`, `groups`, `cells`, optional `reference` and `updatedAt`. Legacy `treeGroups` is accepted. Fixed-node records are not part of editable data. Inputs are validated before touching the library. JSON up to 2 MB is accepted through the UI.

## Local extraction helper

`scripts/import-verified-data.py` documents the one-time migration from earlier local artifacts. The resulting JSON files are checked in. Normal install, build and CI do not require the original files or Python.
