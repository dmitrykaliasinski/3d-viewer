# React + Vite + Three Fibers + Three.js

### node version 22.12.0

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# 3d-viewer

## Model animation dependencies

The viewer recognizes these clip names.

- `<id>.open` opens a door or another part.
- `out.<id>` extends a part.
- `out.<id>.requires.<parentId>` extends a part after opening the specified part.
- `out.tray.requires.door_left.requires.cover` specifies multiple dependencies.

The 5C70S9690ME oven uses `door.open` and `out.grid.requires.door`. Clicking the rack opens the door before extending the rack. Closing the door retracts the rack first.

For two independent compartments, use `door_left.open`, `out.drawer_left_01.requires.door_left`, `door_right.open`, and `out.drawer_right_01.requires.door_right`. Give each drawer its own clip. Clip IDs must be unique and may contain only ASCII letters, digits, and underscores. The viewer compares IDs case-insensitively. Numeric suffixes are part of the ID, so `drawer_01` and `drawer_02` identify different parts.

Export the model in its closed pose. Each clip starts in the closed state and ends in the open state. Closing plays the same clip in reverse from its end. Each clip should animate only its moving node and that node's components. The viewer uses animation track targets and their descendants to determine which objects respond to clicks. Object names can differ from clip IDs. The `extras` metadata and dedicated compartment groups are optional.

Dependencies can be nested. Opening a part opens its prerequisites first, and closing a part closes its dependents first. The viewer waits for the AnimationMixer completion event. It ignores repeated clicks within a connected group until the entire operation finishes. Independent groups can run in parallel. Clips outside the naming convention still toggle independently.

The viewer disables the affected group and logs a console warning when it encounters missing or ambiguous references, malformed `requires` syntax, or dependency cycles.

To verify the project, run `npm test`, `npm run lint`, and `npm run build`.
