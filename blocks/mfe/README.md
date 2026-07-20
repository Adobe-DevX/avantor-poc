# MFE Block

## Overview

Generic, reusable block that embeds a remote micro-frontend (MFE) exposed as a custom element
(Web Component) into the page. It is entirely config-driven — the same block code can host any
number of different remote apps, distinguished only by the config authored on each instance. Drop
the block in more than once on a page to compose multiple MFEs (e.g. one instance configured for a
header MFE, another for a footer MFE).

The block does not know anything about a specific MFE. It only knows how to:

1. Optionally load a CSS file for the MFE.
2. Load one or two JS modules (an optional "polyfills" module, then the main module) that call
   `customElements.define(...)` for the MFE's tag.
3. Create that custom element tag in the DOM once the module(s) have loaded.
4. Defer all of the above until the block is near the viewport, unless configured to load eagerly.

## Integration

### Block Configuration

Configuration keys read via `readBlockConfig()`:

| Configuration Key | Type | Default | Description | Required | Side Effects |
|-------------------|------|---------|-------------|----------|--------------|
| `tag-name` | string | none | Custom element tag name the remote script registers, e.g. `vwr-header` | Yes | Used with `document.createElement()` to mount the MFE once its script(s) resolve |
| `script-url` | string | none | Absolute URL to the remote MFE's main JS module | Yes | Loaded via dynamic `import()`; must be a valid ES module served with CORS-friendly headers |
| `polyfills-url` | string | `''` | Absolute URL to a secondary JS module that must load and execute *before* `script-url` | No | If set, imported and awaited before importing `script-url` (e.g. Angular's `polyfills.js`, which patches the runtime that `main.js` depends on) |
| `style-url` | string | `''` | Absolute URL to a CSS file for the MFE | No | Loaded via the shared `loadCSS()` helper (deduped by `href`, loaded in parallel with the script(s)) |
| `loading` | string | `lazy` | `eager` or `lazy` | No | `eager` mounts immediately in `decorate()`; `lazy` defers via `IntersectionObserver` until the block nears the viewport |
| `root-margin` | string | `200px` | `IntersectionObserver` `rootMargin`, only used when `loading` is `lazy` | No | Larger values start loading further before the block enters the viewport |
| `min-height` | string | none | CSS length (e.g. `80px`) for a placeholder reserved before the MFE mounts | No | Reduces layout shift, especially for `eager` instances that render above the fold |

If `tag-name` or `script-url` is missing, the block logs a console warning and renders nothing
rather than throwing, since authors may leave configuration incomplete mid-edit.

### Local Storage

None.

### Events

None. The block does not emit or listen for any AEM/commerce events — it only manages the
loading/mounting lifecycle of the remote custom element. Any interactivity is entirely internal to
the embedded MFE.

## Behavior Patterns

### Loading Strategy

- **Eager**: the remote CSS/JS is requested immediately when the block decorates. Use this for
  MFE instances that render above the fold (e.g. a header), since deferring them causes a visible
  layout shift as they pop in.
- **Lazy (default)**: an `IntersectionObserver` is attached to the block with the configured
  `root-margin`. Loading only starts once the block is within that margin of the viewport, and the
  observer disconnects after the first intersection. Use this for anything below the fold (e.g. a
  footer), so its JS/CSS never competes with above-the-fold resources.

### De-duplication

Script modules are cached by URL at the module scope (a `Map<url, Promise>`), so if the same
`script-url` (and `polyfills-url`) is configured on more than one block instance on the same page,
the remote bundle is only fetched and evaluated once — each instance still creates and mounts its
own `<tag-name>` element.

### Error Handling

- **Missing required config** (`tag-name`/`script-url`): logged as a `console.warn`, block left
  empty — no exception thrown.
- **Script/CSS load failure**: caught and logged as a `console.error`; the placeholder (if
  configured) is left in place instead of the custom element, rather than leaving a broken/partial
  state.

## Usage Example

To embed the header and footer micro-frontends from `sample_angular_app` (built via
`npm run build:mfe`, output under `dist/mfe/browser/`), add two `MFE` block instances to a page in
Universal Editor:

**Instance 1 — header (above the fold, eager):**

| Field | Value |
|---|---|
| Tag Name | `vwr-header` |
| Script URL | `https://<mfe-host>/mfe/main.js` |
| Polyfills URL | `https://<mfe-host>/mfe/polyfills.js` |
| Style URL | `https://<mfe-host>/mfe/styles.css` |
| Loading | Eager |

**Instance 2 — footer (below the fold, lazy):**

| Field | Value |
|---|---|
| Tag Name | `vwr-footer` |
| Script URL | `https://<mfe-host>/mfe/main.js` |
| Polyfills URL | `https://<mfe-host>/mfe/polyfills.js` |
| Style URL | `https://<mfe-host>/mfe/styles.css` |
| Loading | Lazy |
| Root Margin | `200px` |

Since both instances point at the same `script-url`/`polyfills-url`, the underlying Angular bundle
(which defines both `vwr-header` and `vwr-footer`) is only loaded once, no matter which instance
triggers it first.

## Security

This block intentionally loads and executes arbitrary author-supplied remote JavaScript by design
— that is the point of embedding a micro-frontend. It never uses `innerHTML`/`unsafeHTML` for the
authored values themselves (they are only ever passed to `import()`, `loadCSS()`, and
`document.createElement()`), but there is no sandboxing of the loaded MFE. Only point `script-url` /
`polyfills-url` / `style-url` at trusted, known MFE hosts.
