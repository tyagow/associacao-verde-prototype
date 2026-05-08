# Apoiar — Design Tokens (Calm Clinical Modern)

This document is the canonical reference for the design tokens declared in
`app/globals.css :root`. Every redesign phase pulls from these names; no
phase invents new ones. The aesthetic direction is **B · Calm Clinical
Modern**: off-white paper, soft greens, refined gold ornament only on
product thumbs and CTAs, system sans (Inter), small amount of Outfit for
display headings only, generous whitespace, hairline borders, status
communicated by colored dots, soft shadows.

The visual contract lives at
`.superpowers/brainstorm/70960-1778242539/content/all-pages.html` (20
approved screens). Token values were chosen to make those screens
buildable without any per-screen color invention.

## How to use tokens

1. **Use the variable, not the literal.** Reference `var(--green)` rather
   than `#1d8c52`. Future palette tweaks should require zero JSX changes.
2. **Keep gold as ornament only.** `--gold*` is reserved for product
   thumbnails, the live-pulse dot, and the optional gold CTA. Body
   surfaces, text, and primary buttons use ink + green.
3. **Status is dots, not floods.** Use `.pill--good`, `.pill--warn`,
   `.pill--danger`. Avoid full-row red/green backgrounds.
4. **Tabular numerics on data.** Apply `font-feature-settings: "tnum"` (or
   the existing `.kpi__value` rule) to stat values, ledger rows, prices.
5. **Hairline borders, soft shadows.** Borders are 1px `--line`. Shadows
   are `--shadow-soft` for elevated surfaces, never harder than
   `--shadow-2`.
6. **Never duplicate a value.** If you need a new shade, add it to
   `:root` in this doc and in `globals.css` together.

## Color · surface

| Token          | Value     | Use                                                     | Example                          |
| -------------- | --------- | ------------------------------------------------------- | -------------------------------- |
| `--paper`      | `#fbfcfa` | Primary off-white background for cards, frames, screens | `background: var(--paper);`      |
| `--paper-warm` | `#f7f9f6` | Slightly warmer surface tier (sidebars, alt rows)       | `background: var(--paper-warm);` |
| `--paper-cool` | `#f3f7f4` | Slightly cooler surface tier (login stage gradient end) | `background: var(--paper-cool);` |
| `--soft`       | `#f1f6f3` | Tonal soft fill for chips, hover states, segments       | `background: var(--soft);`       |
| `--soft-2`     | `#f3f7f4` | Alternate soft fill for browser-chrome strips           | `background: var(--soft-2);`     |

## Color · ink + muted

| Token        | Value     | Use                                         | Example                       |
| ------------ | --------- | ------------------------------------------- | ----------------------------- |
| `--ink`      | `#0d1f17` | Primary text + dark CTA (`.btn--primary`)   | `color: var(--ink);`          |
| `--ink-soft` | `#1f3329` | Secondary text on light surfaces            | `color: var(--ink-soft);`     |
| `--muted`    | `#687970` | Meta + helper text, overlines, field labels | `color: var(--muted);`        |
| `--muted-2`  | `#92a098` | Tertiary / inactive status dots             | `background: var(--muted-2);` |

## Color · hairlines

| Token           | Value     | Use                                              | Example                                      |
| --------------- | --------- | ------------------------------------------------ | -------------------------------------------- |
| `--line`        | `#e3ebe6` | Default hairline border on cards, inputs, panels | `border: 1px solid var(--line);`             |
| `--line-soft`   | `#ecf1ee` | Sub-hairline divider inside dense layouts        | `border-bottom: 1px solid var(--line-soft);` |
| `--line-strong` | `#c7d3cc` | Emphasized border for inactive timeline nodes    | `border: 1px solid var(--line-strong);`      |

## Color · greens

| Token          | Value     | Use                                                       | Example                            |
| -------------- | --------- | --------------------------------------------------------- | ---------------------------------- |
| `--green`      | `#1d8c52` | Brand green: links, accents, progress fills, success dots | `color: var(--green);`             |
| `--green-deep` | `#135b35` | Hover / pressed green, body text on green-tinted bg       | `color: var(--green-deep);`        |
| `--green-soft` | `#c7e2d2` | Soft green border on success pills                        | `border-color: var(--green-soft);` |
| `--green-tint` | `#dff0e6` | Green chip / highlight background                         | `background: var(--green-tint);`   |
| `--moss`       | `#4a7d56` | Legacy moss alias (avoid in new code)                     | —                                  |
| `--forest`     | `#0d1f17` | Legacy alias of `--ink`                                   | —                                  |
| `--forest-2`   | `#1f3329` | Legacy alias of `--ink-soft`                              | —                                  |

## Color · gold (ornament only)

> Use sparingly. Gold is for product thumbs, the live-pulse dot, and the
> optional gold CTA. Do not use gold for body text, primary actions, or
> status states.

| Token         | Value     | Use                                          | Example                           |
| ------------- | --------- | -------------------------------------------- | --------------------------------- |
| `--gold`      | `#d6b56a` | Product thumb accent, pulse dot, gold CTA bg | `background: var(--gold);`        |
| `--gold-deep` | `#b89313` | Pressed gold border                          | `border-color: var(--gold-deep);` |
| `--gold-soft` | `#fff5d4` | Soft gold tint, identical to `--warn-soft`   | `background: var(--gold-soft);`   |
| `--gold-on`   | `#1a1408` | Text on gold backgrounds                     | `color: var(--gold-on);`          |

## Color · status

| Token           | Value     | Use                                  | Example                             |
| --------------- | --------- | ------------------------------------ | ----------------------------------- |
| `--warn`        | `#d6a91a` | Warning dot, warning progress fill   | `background: var(--warn);`          |
| `--warn-soft`   | `#fff5d4` | Warning chip background              | `background: var(--warn-soft);`     |
| `--warn-ink`    | `#876f12` | Warning chip text                    | `color: var(--warn-ink);`           |
| `--good`        | `#1d8c52` | Alias of `--green` for success state | `color: var(--good);`               |
| `--danger`      | `#b03a2e` | Danger dot, danger button text       | `color: var(--danger);`             |
| `--danger-soft` | `#fbe5e1` | Danger chip background               | `background: var(--danger-soft);`   |
| `--danger-line` | `#ecc3bd` | Danger chip border                   | `border-color: var(--danger-line);` |

## Type · families

| Token            | Value                                    | Use                                                | Example                             |
| ---------------- | ---------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| `--font-ui`      | Inter (next/font) → system sans fallback | Body, forms, controls, tables, headings            | `font-family: var(--font-ui);`      |
| `--font-display` | Outfit (next/font) → Inter fallback      | Display headings only (hero h1, key splash titles) | `font-family: var(--font-display);` |
| `--font-mono`    | JetBrains Mono → ui-monospace            | Code samples, mock chrome address bar              | `font-family: var(--font-mono);`    |

## Type · scale

Sizes target a 14px base. Use the variable rather than the literal.

| Token                 | Value      | Use                              |
| --------------------- | ---------- | -------------------------------- |
| `--fs-xs`             | `11px`     | Overlines, pill text, microcopy  |
| `--fs-sm`             | `12px`     | Helper text, dense table cells   |
| `--fs-base`           | `14px`     | Body, button text, default UI    |
| `--fs-md`             | `15.5px`   | Lede paragraphs, login copy      |
| `--fs-lg`             | `18px`     | Action card titles               |
| `--fs-h3`             | `20px`     | Section h3                       |
| `--fs-h2`             | `24px`     | Page h2                          |
| `--fs-h1`             | `32px`     | Primary page h1                  |
| `--fs-hero`           | `48px`     | Public home hero only            |
| `--lh-tight`          | `1.15`     | Headings                         |
| `--lh-body`           | `1.55`     | Body                             |
| `--tracking-tight`    | `-0.018em` | Tight letter-spacing on headings |
| `--tracking-overline` | `0.14em`   | Overlines, section crumbs        |

## Spacing scale

| Token     | Value  | Typical use                            |
| --------- | ------ | -------------------------------------- |
| `--sp-1`  | `4px`  | Inline gap, label-to-input             |
| `--sp-2`  | `8px`  | Tight stacks, chip gaps                |
| `--sp-3`  | `12px` | Default row gap inside cards           |
| `--sp-4`  | `16px` | Card inner padding                     |
| `--sp-5`  | `20px` | Card outer padding                     |
| `--sp-6`  | `24px` | Panel padding, app-work column gap     |
| `--sp-7`  | `32px` | Section separation                     |
| `--sp-8`  | `40px` | Page-level gap on desktop              |
| `--sp-9`  | `56px` | Hero block padding                     |
| `--sp-10` | `72px` | Top-level page padding on wide screens |

## Radii

| Token      | Value   | Use                                             |
| ---------- | ------- | ----------------------------------------------- |
| `--r-xs`   | `4px`   | Tight inline tags                               |
| `--r-sm`   | `8px`   | Small input / inline chip                       |
| `--r-md`   | `12px`  | Inputs, buttons, panels (default)               |
| `--r-lg`   | `16px`  | Cards, frames                                   |
| `--r-xl`   | `22px`  | Hero panels, large modals                       |
| `--r-pill` | `999px` | Pills, chips, segmented control, progress track |

## Shadow / depth

| Token           | Value                                                              | Use                                            |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `--shadow-soft` | `0 1px 0 rgba(13,31,23,.04), 0 8px 24px -16px rgba(13,31,23,.16)`  | Default elevated surface (cards, panels, kpis) |
| `--shadow-1`    | same as soft                                                       | Alias used in legacy rules                     |
| `--shadow-2`    | `0 1px 0 rgba(13,31,23,.04), 0 18px 44px -22px rgba(13,31,23,.22)` | Login card, popovers                           |
| `--shadow-3`    | `0 2px 0 rgba(13,31,23,.05), 0 30px 80px -50px rgba(13,31,23,.28)` | Phone preview, hero frame                      |
| `--ring`        | gold + green focus rings                                           | `:focus-visible` outline                       |

## Motion

| Token        | Value                            | Use                                   |
| ------------ | -------------------------------- | ------------------------------------- |
| `--ease-out` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | Default easing for hover, transitions |
| `--t-fast`   | `120ms`                          | Hover, color, border swaps            |
| `--t-base`   | `200ms`                          | Default UI transitions                |
| `--t-slow`   | `320ms`                          | Progress fills, panel expansion       |

## Utilities introduced in Phase 0

These additive classes live at the bottom of `globals.css` under the
`Phase 0 — Calm Clinical Modern foundation` fence and consume the tokens
above. They do not override existing selectors.

- **Surfaces**: `.frame`, `.frame__chrome`, `.panel` (+ `--flush`,
  `--quiet`, `--soft`)
- **Status / labels**: `.pill` (+ `--good`, `--warn`, `--danger`,
  `--live`), `.overline` (+ `--green`, `--warn`, `--danger`)
- **Selection**: `.chip` (+ `.chip__avatar`), `.segment` (+
  `.segment__option`)
- **Buttons**: `.btn` (+ `--primary`, `--ghost`, `--gold`, `--danger`,
  `--sm`, `--lg`)
- **Inputs**: `.field` (+ `__label`, `__input`, `__textarea`, `__hint`)
- **Data viz**: `.kpi` (+ `__label`, `__value`, `__delta`, `__spark`),
  `.spark`, `.progress` (+ `--warn`, `--danger`)
- **Flow**: `.stepper` (+ step states), `.timeline` (+ node states)
- **Layout primitives**: `.app-shell`, `.app-sidebar`, `.app-topbar`,
  `.app-work`, `.app-tabs` (+ `.app-tabs__tab`)
