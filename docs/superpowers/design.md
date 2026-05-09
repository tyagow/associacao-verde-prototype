# Apoiar Brasil — Shared Design Guide

**Date:** 2026-05-08
**Audience:** Any agent (or human) doing UI work in this repo.
**Scope:** Two portals — `/paciente` (patient-facing) and `/equipe` +
`/admin` (internal team / admin). Same brand tokens, same typography,
two visual _dialects_.

This file is the contract. Don't introduce new colors, fonts, radii, or
shadow values without updating it deliberately.

---

## 1. Brand tokens (already in `app/globals.css`)

Both portals use identical color, typography, and spacing tokens. Do not
fork them. The dialect difference is _radii + density + chrome_, not
color.

### Color (do not extend without discussion)

```
--paper        #fbfcfa   primary surface
--paper-warm   #f7f9f6   page background
--paper-cool   #f3f7f4   rarely used
--soft         #f1f6f3   chips, hovers

--ink          #0d1f17   primary text + dark CTA
--ink-soft     #1f3329   secondary text
--muted        #687970   meta / helper

--line         #e3ebe6   default hairline
--line-soft    #ecf1ee   sub-divider
--line-strong  #c7d3cc   emphasized border

--green        #1d8c52   accents, links
--green-deep   #135b35   hover/pressed
--green-soft   #c7e2d2   soft green border
--green-tint   #dff0e6   chip / highlight bg

--gold         #d6b56a   product thumbs only
--gold-soft    #fff5d4   soft tint for warn / Pix strip
--gold-on      #1a1408   text on gold

--warn         #d6a91a
--warn-soft    #fff5d4
--good         #1d8c52
--danger       #b03a2e
--danger-soft  #fbe5e1
```

### Radii (shared across both dialects — set ONCE, here)

```
--r-sm    3px    inputs, buttons, small cards, chip squares
--r-md    5px    cards, panels, drawers
--r-lg    7px    hero / page-level surfaces
```

These match `app/globals.css` already-shipped values. Do not raise them.

**Tiny bit of rounding everywhere.** Both dialects use these values. The
dialect difference is density and chrome — never radius. The previous
draft had paciente at 8/12/16 and admin at 4/6/8; that fork is gone.

**Pill exception only.** Status pills, avatars, and the topbar
patient pill keep `border-radius: 999px` because they read as
_tokens_, not as surfaces. Buttons are NOT pills — buttons use 4px.

### Type

```
--font-display  Outfit       — h1/h2, amounts, prominent numbers
--font-ui       Inter        — body, labels, buttons
--font-mono     JetBrains Mono — IDs, codes, copy-paste
```

Sizes (existing): `--fs-xs 11px / --fs-sm 12px / --fs-base 14px`. Do
not override at the component level.

### Status pill recipe

A pill is `inline-flex; align-items:center; gap:6px; padding:3-5px 10-12px; border-radius:99px; font-size:11-12px; font-weight:600`
plus a 6px round dot pseudo-element (`::before`).

| Tone    | Background      | Text           | Dot        |
| ------- | --------------- | -------------- | ---------- |
| ok/good | `--green-tint`  | `--green-deep` | `--green`  |
| warn    | `--gold-soft`   | `--gold-on`    | `--warn`   |
| danger  | `--danger-soft` | `#7c2419`      | `--danger` |
| muted   | `--soft`        | `--muted`      | `--muted`  |

---

## 2. Two dialects

The same tokens read differently depending on density and corner radius.

### 2.1 Paciente — "Storefront acolhedor"

The patient is anxious about money, prescription, and shipping. The UI
must _reassure_.

- **Radii:** `--r-sm 3px / --r-md 5px / --r-lg 7px` (see §1 Radii).
  Cards are _just slightly_ softened, not pillowy. Status pills and
  avatars keep `border-radius: 999px`; buttons use 4px.
- **Density:** generous. Cards have 24–32px padding. Lists give each
  row 14–18px vertical padding. Max content width 1100–1200px.
- **Chrome:** white card surfaces over `--paper-warm` page background.
  Hairline borders. Hover lifts on product cards (`translateY(-2px)`
  - soft shadow).
- **CTA:** ink-filled (`--ink` background, `--paper` text), 4px radius
  (NOT fully rounded — fully-rounded buttons read as chips/pills). Hover
  swaps to `--green-deep`.
- **Hero accents:** sparingly use the dark green gradient (`--ink` →
  `#1a3a2a` → `#2a5a3f`) — login pitch panel, Pedido welcome hero. This
  is the only place we go bold.
- **Photography:** product thumbnails are 140px gradient blocks (gold /
  green / warn-tinted) with monogram letters until real photos exist.
- **Motion budget:** countdown updates in place; "now" timeline step
  pulses (1.6s ease-out, gold halo); product cards lift on hover.

The `paciente` mockups are in
`docs/superpowers/specs/paciente-revamp-mockups/` (move from
`/tmp/av-mockups/` before relying on them).

### 2.2 Admin / Equipe — "Operação utilitária"

The admin user is a teammate doing repetitive operations: triaging
pedidos, updating stock, releasing access gates, replying to support.
Speed and density matter; warmth does not.

- **Radii:** same as paciente — `--r-sm 3px / --r-md 5px / --r-lg 7px`.
  Sharper _feels_ the same as paciente; the dialect difference is in
  density, chrome, and tables, not in radius. Pills stay `999px`.
- **Density:** tight. Card padding 16–20px. Table rows 32–44px tall
  with dense typography. Max content width is full-bleed (or
  1440px); the admin works in a wide layout.
- **Chrome:** dark left sidebar (always visible) using `--ink` with
  green accents. Top bar is white over the work area, with breadcrumbs
  and quick filters. White card surfaces with `--line` borders. No
  hover lift on rows — just background swap to `--paper-warm`.
- **Tables are first-class.** Use real `<table>` elements with sortable
  headers, sticky `thead`, monospace IDs, tabular numerals (`font-variant-numeric: tabular-nums`)
  on numeric columns, right-aligned numbers. No row card-isation; flat
  table with `--line-soft` row dividers.
- **CTA:** ink for primary, ghost for secondary. Buttons are 6px radius,
  small (`32px` tall, `13px` font, `0–14px` horizontal padding). Icon
  buttons are 28×28px squares.
- **Forms:** inline labels on the left (label · input). Inputs 32–36px
  tall, 4–6px radius, no soft fill — `--paper` background with `--line`
  border. Focus ring is a 2px `--ink` border, no glow.
- **Empty / loading states:** thin dashed `--line-strong` border with a
  short instruction. No illustrations.
- **Status everywhere.** Every page shows a 32px-tall status strip
  under the topbar (filters + counts + "atualizar" button). Every
  numeric badge uses tabular numerals.
- **No gradients.** No hero blocks. Heroes were a paciente decision.
- **Motion budget:** focus rings; row hover bg swap; nothing else.

Inspiration: Linear, Stripe Dashboard, Retool.

---

## 3. Layout primitives shared by both

These elements are identical across portals (same code, same tokens):

- **`Brand` component** — top-left logo. Same in both.
- **Status pill** — same recipe (see §1).
- **Toast** — same component.
- **Form fields** — same colors + typography. Differ in radius (8 vs 4)
  and height (44 vs 32).
- **Tabular numerals on currency / counts** — both portals.
- **Brazilian formatting** — Intl `pt-BR`, `BRL` for money, `America/Sao_Paulo`
  timezone for dates.

## 4. What NOT to do

- Don't introduce new color tokens. If a state needs color, it maps to
  one of the existing tones (good/warn/danger/muted).
- Don't introduce new fonts. Three families is enough.
- Don't mix dialects on one screen. A page lives entirely in one dialect.
- Don't use shadow as primary structure. A 1px `--line` is the default
  divider; soft shadows (`0 8-16px 30-48px -16…-24px rgba(13,31,23, .08-.18)`)
  are reserved for hover lifts (paciente only) and overlay drop shadows
  (drawers/menus).
- Don't animate layout. Animate opacity, transform, color. Never
  `width`/`height`/`top`/`left`.
- Don't use emojis as primary iconography in the admin dialect. Patients
  see emoji-icons inside soft squares; the admin uses simple SVG icons or
  Unicode symbols (✓ × ↗ ▾ ⚠).
- Don't repeat the patient name across multiple chrome elements on the
  same screen. The topbar pill names them; nothing else needs to.

## 5. Dialect quick-reference table

| Aspect            | Paciente (storefront)   | Admin/Equipe (utility)        |
| ----------------- | ----------------------- | ----------------------------- |
| Radii             | 3 / 5 / 7 (shared)      | 3 / 5 / 7 (shared)            |
| Card padding      | 24–32px                 | 16–20px                       |
| Page background   | `--paper-warm`          | `--paper-warm`                |
| Page chrome       | Topbar + tab row        | Sidebar + topbar + status row |
| Max content width | 1100–1200px             | full-bleed / 1440px           |
| Hero blocks       | yes (sparingly)         | no                            |
| Tables            | rare (rows-as-cards)    | primary data surface          |
| Hover effect      | lift + shadow           | bg swap only                  |
| CTA shape         | rounded `3px`           | rounded `3px`                 |
| Form input height | 44–48px                 | 32–36px                       |
| Density           | breathing room          | tight                         |
| Iconography       | emoji-in-tinted-square  | line SVG / Unicode glyphs     |
| Motion            | hovers, pulse, in-place | focus rings, bg swap          |
| Inspiration       | iFood, Drogasil, Loft   | Linear, Stripe, Retool        |

---

## 6. Where the two dialects live

```
app/
  paciente/                  -> storefront dialect
    PatientPortal.jsx
    components/...
  admin/                     -> utility dialect
    page.jsx
    components/...
  equipe/                    -> utility dialect
    layout.jsx               -> sidebar shell goes here
    page.jsx                 -> dashboard
    estoque/                 -> stock
    pedidos/                 -> orders queue
    pacientes/               -> patient registry
    fulfillment/             -> kanban
    suporte/                 -> support thread queue
```

Anything in `paciente/` follows §2.1. Anything in `admin/` or `equipe/`
follows §2.2.

## 7. Updating this guide

This file is mutable but slow. Changes that affect both portals are
discussed in advance. Changes scoped to one dialect can land alongside
the relevant work as long as they are documented here in the same PR.
