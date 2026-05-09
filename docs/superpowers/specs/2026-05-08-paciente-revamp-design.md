# Patient Portal Revamp — Design Spec

**Date:** 2026-05-08
**Status:** Draft awaiting user review
**Surface:** `/paciente` and all sub-states
**Direction:** B — Storefront acolhedor (warm e-commerce with care signals)
**Mockups:** `/tmp/av-mockups/` served at http://127.0.0.1:8765/ during
brainstorm. Move to `docs/superpowers/specs/paciente-revamp-mockups/`
before implementation so they survive past the brainstorm session.

---

## 1. Goal

Replace the current patient portal UX, which the user described as "bad
UX, UI, spacing, alignment — everything is bad", with a coherent,
trustworthy storefront-style portal in B's visual language. Ten screens
in scope. Done when:

- All ten screens match their mockup counterparts.
- All existing E2E selectors in `test/` continue to resolve.
- `npm run check`, `npm test`, and `npm run e2e` all pass.
- The user has signed off after a visual walkthrough on the dev server.

## 2. Scope

In scope (10 screens):

| #   | Screen                       | Mockup file        | Existing component(s)                          |
| --- | ---------------------------- | ------------------ | ---------------------------------------------- |
| 1   | Login                        | `b-login.html`     | `PatientPortal.jsx` (logged-out branch ~L260+) |
| 2   | Consentimento LGPD           | `b-consent.html`   | `PrivacyConsentGate.jsx`                       |
| 3   | Bloqueado                    | `b-blocked.html`   | `AccessIssueScreen.jsx`                        |
| 4   | Pedido — vazio               | `b.html`           | `PatientPortal.jsx` + `EmptyHero.jsx`          |
| 5   | Pedido — carrinho cheio      | `b2.html`          | `CartHero.jsx` + catalog grid in PatientPortal |
| 6   | Pedido — Pix aberto          | `b3.html`          | `PixHero.jsx` + `OrderTimeline.jsx`            |
| 7   | Pedido — pago / em separação | `b4.html`          | `PixHero.jsx` paid mode (or new component)     |
| 8   | Histórico                    | `b-historico.html` | `HistoryList.jsx`                              |
| 9   | Suporte                      | `b-suporte.html`   | `SupportThread.jsx`                            |
| 10  | Meu perfil                   | `b-perfil.html`    | NEW page; decommission `ProfileDrawer.jsx`     |

Out of scope:

- Admin/equipe/fulfillment surfaces (different routes; not user-facing
  for patients).
- Brand mark / logo work (using the existing `Brand` component as-is).
- Backend API changes — purely a presentation refactor.
- Mobile breakpoint _redesign_ below 768px is best-effort only; this
  spec targets desktop-first ≥1024px and mobile ≥375px with column
  stacking. A future spec can refine mobile.
- New product photography. Mockups use gradient thumbnails (gold/green
  tinted with monogram letters); we keep that style until photos exist.

## 3. Visual language (Direction B)

### 3.1 Tokens (already in `app/globals.css`)

The mockups use only the existing tokens. No new colors or fonts are
required by this spec.

- **Surface:** `--paper` (cards), `--paper-warm` (page background),
  `--soft` (chips/hovers), `--paper-cool` (rare).
- **Ink:** `--ink` (primary), `--ink-soft` (secondary), `--muted`
  (meta/helper).
- **Greens:** `--green` (accents), `--green-deep` (hover/CTA),
  `--green-soft` (borders), `--green-tint` (status pill backgrounds).
- **Gold:** `--gold-soft`/`--gold` for product thumbnails. **Not** used
  for primary CTAs.
- **Status:** `--good` / `--warn` / `--danger` with their `*-soft` chip
  backgrounds.
- **Hairlines:** `--line` (default), `--line-soft` (sub-divider).
- **Radii:** `--r-sm 3px / --r-md 5px / --r-lg 7px` (matches the
  already-shipped `app/globals.css` values; the brainstorm mockups
  initially used 8/12/16 — those were too rounded). Pills/avatars stay
  `999px`; buttons use 3px (NOT fully rounded).
- **Type:** `--font-display` (Outfit) for h1/h2 + amounts;
  `--font-ui` (Inter) for body; mono for IDs and copy-paste codes.

### 3.2 Topbar (every authenticated screen)

- Single row, sticky top, white surface, 1px bottom hairline.
- Left: `Brand` component.
- Center: search field with magnifier icon, soft surface, fully rounded.
  Acts as the catalog search on Pedido; on other tabs it stays present
  but is debounce-routed back to Pedido on input.
- Right: patient pill `Helena · APO-1027` (green-tint background) with a
  status-tone variant (warn for "Pix pendente", danger for "Acesso
  bloqueado"). Then a quiet "Sair" button.

### 3.3 Tab row

- 4 tabs: **Pedido · Histórico · Suporte** left-justified, **Meu perfil**
  right-aligned (`margin-left: auto`).
- Active tab: ink color + 2px ink underline; inactive: muted.
- Sticky on scroll along with the topbar.

### 3.4 Page surface

- Body background `--paper-warm`.
- Cards on `--paper` with `--line` borders and `--r-lg` radius.
- Maximum width 1100–1200px; padding 28–32px on the outer wrapper.

## 4. Screen-by-screen specs

### 4.1 Login (`b-login.html`)

Logged-out hero. Replaces the current "associated/receita/pedido atual"
3-card grid which leaks framework concerns into a marketing surface.

- 50/50 split.
- **Left (dark green gradient):** kicker "Portal do Paciente", h1 "Sua
  receita, seus pedidos, em um só lugar", short value-prop paragraph,
  three trust signals with green ✓ markers (estoque reservado, receita/
  carteirinha visíveis, histórico privado e auditado), thin footer line
  (© year, LGPD-compliant, operação privada).
- **Right (form card):** "Entrar com segurança" h2, lead "Use o código de
  associado e o convite privado enviados pela equipe.", two fields
  (`memberCode` placeholder `APO-1027`, `inviteCode` placeholder
  `HELENA2026`) with a "enviado por e-mail/WhatsApp" hint, full-width
  ink CTA "Entrar →", footer link "Não recebeu seu convite? Falar com a
  equipe".
- Preserve `id="patient-login"`, `input[name=memberCode]`,
  `input[name=inviteCode]`, button[type=submit].
- Drop the 3-card "Acesso restrito / Receita / Pedido atual" grid that
  exists pre-login.
- Keep the `#patient-status` element in the DOM (E2E reads it). Render
  it inside the topbar replacement or as a hidden element on this
  screen — to be confirmed when reading the test.

### 4.2 Consentimento LGPD (`b-consent.html`)

Replaces the current dense block.

- 3-step progress bar at top: `Login ✓` → `Consentimento` (now) →
  `Pedido` (pending). Pure visual — not a routing wizard.
- One card with: kicker "Privacidade e LGPD", h1 "Autorize o uso dos
  seus dados", lead paragraph.
- 2×2 grid of "use" cards: Elegibilidade · Pedidos · Suporte ·
  Auditoria, each with an emoji icon in a `--green-tint` 32px square.
- Two `<details>` collapsibles: "O que NÃO fazemos com seus dados" and
  "Quem tem acesso na associação". Closed by default.
- An explicit `<input type="checkbox">` block on a `--green-tint`
  background: "Autorizo o uso dos meus dados para os fins descritos
  acima, conforme a versão `lgpd-2026-05`…".
- Footer row: meta text "Sua autorização será registrada com data, hora
  e versão." + ink CTA "Aceitar e continuar →".
- Preserve `id="privacy-consent-panel"` on the wrapper plus literal
  text "Privacidade e LGPD". Pre-consent must contain "Autorizar uso
  dos dados" substring (current copy may shift to "Autorize o uso dos
  seus dados" — verify the E2E literal before flipping). Post-consent
  state continues to render "Consentimento registrado".

### 4.3 Bloqueado (`b-blocked.html`)

Replaces the current red-toned panel.

- Top **alert**: red-soft surface, 42px round red icon "!", h1 "Acesso
  não liberado", message-line that quotes the _actual reason_ the system
  returned (e.g., "Sua receita venceu em 02/04/2026.").
- **"O que você pode fazer agora"** card — 3-item checklist with
  empty-checkbox visuals; each item has a bold first line + a muted
  one-line explanation.
- **"Pedir revisão"** form: `memberCode`, `inviteCode`, `message` (3
  rows, pre-filled with "Preciso revisar meu acesso: <reason>"), submit
  "Enviar revisão". Footer line: link back to login.
- Preserve `id="access-issue"`, the literal "Acesso não liberado",
  "Atendimento precisa revisar seu cadastro" strings (verify exact
  assertion — current text may shift slightly), and form fields
  `memberCode`/`inviteCode`/`message`.

### 4.4 Pedido — vazio (`b.html`)

The default authenticated landing.

- Identity does NOT repeat the patient name — the topbar pill carries
  it. The page has no h1 with the patient name.
- A short **dark gradient hero** at the top of the Pedido tab: kicker
  "Bem-vinda de volta", h1 "Tudo certo para fazer um pedido", short
  reassuring sentence, plus a translucent **receipt block** (right
  side of the hero) listing: receita válida até `<date>`, LGPD aceita
  `<date>`, status "Liberada".
- **Category chips** with counts: Todos · Óleos · Flores · Gomas · Mais
  usados (the last is a virtual category — patient's own top-3 SKUs
  across history).
- **Product grid**: `repeat(auto-fill, minmax(220px, 1fr))`, cards have
  a 140px gradient thumbnail (gold/green/warn-tinted variants), name,
  meta line (presentation + stock), price + "Adicionar" CTA. Hover lift.
- **Right rail (380px sticky)**: empty state — small soft icon, "Carrinho
  vazio · Adicione itens do catálogo ao lado.", entrega select with the
  three options (GED Log / Correios / Retirada), `R$ 0,00` total, and a
  disabled gold-soft "SELECIONE PRODUTOS" CTA.

### 4.5 Pedido — carrinho cheio (`b2.html`)

- Same shell. Hero is replaced with a thin breadcrumb line "Pedido em
  construção · A reserva acontece quando o Pix é gerado" and a
  pagehead with h1 "Catálogo autorizado" + a quiet underlined "Limpar
  carrinho" link.
- Product cards already in the cart get a `--green` 1px border + box
  shadow ring + a green "✓ N no carrinho" badge in the top-right and an
  inline qty stepper on the price row instead of "Adicionar".
- Right rail switches to live mode: "Resumo do pedido · 3 itens" + lead.
  Each line has a 36px monogram square, name, "2× R$ 180,00 · remover",
  and right-aligned subtotal. Below: entrega select, totals (subtotal /
  frete = "calculado no Pix" / total estimado), the **ink** CTA "Gerar
  Pix →", and a 2-line reassurance: "Ao gerar Pix, **o estoque é
  reservado** até o vencimento do pagamento. Sem cobrança em
  duplicidade."
- Preserve `#cart-summary` container with the literal "Resumo antes do
  Pix" string somewhere inside (currently in `CartHero.jsx`'s overline).
  We can keep that overline as a visually-hidden span if redesigning the
  visual heading.

### 4.6 Pedido — Pix aberto (`b3.html`)

- Catalog UI is **gone** while a Pix is pending. The whole content area
  hosts the Pix hero card (max-width 980px, centered).
- Topbar pill flips to warn tone: `Helena · Pix pendente`.
- Card structure:
  - **Top strip** (gold-soft surface, gold-line border bottom): pulsing
    warn dot, "Pix gerado · estoque reservado até o vencimento", order
    ID right-aligned in monospace.
  - **Left half (60%)**: amount row with massive "R$ 600,00" + small
    `BRL` superscript, right-aligned countdown "Vence em / 14:32" in
    display font. Three meta items (Método / Vencimento / Entrega) on
    a hairline-bordered row. Then a 200px QR placeholder (real QR in
    impl) + a copy block: copia-e-cola textarea + ink "Copiar" button +
    primary green "Já paguei, atualizar" + ghost "Cancelar pedido".
  - **Right half (40%, paper-warm bg)**: "N produtos reservados" header
    - line items, right-total "R$ 600,00" in display font, then a
      **5-step vertical timeline** (Pix gerado → Aguardando pagamento
      [now, with countdown subline] → Pagamento confirmado → Em
      separação → Enviado). Stages get green dot when done, warn-glow
      when current.

### 4.7 Pedido — pago / em separação (`b4.html`)

- Replaces the "Pix open" view as soon as payment is confirmed.
- **Green hero** (`--green-tint` → `--paper` gradient, `--green-soft`
  border): 56px green ✓ circle, kicker "Pagamento confirmado", h1
  "Recebemos o seu Pix", lead. Right side: a small receipt card with
  order ID (monospace), "Pago em <datetime>", "Total <amount>".
- 2-column body:
  - **Left (status panel):** "Status do pedido" h2 + lead "Atualizamos
    automaticamente conforme a equipe avança." then the same 5-step
    vertical timeline. Each stage shows a "when" timestamp on the
    right and a one-line subtitle (e.g. "Webhook do banco recebido").
  - **Right rail (320px):** order summary card (items + total),
    entrega card with carrier label and a "Rastreio aparecerá aqui:
    <code>" placeholder.

### 4.8 Histórico (`b-historico.html`)

- Pagehead: h1 "Histórico de pedidos" + lead "5 pedidos · totalizado
  R$ 2.340,00 desde <month/year>" on the left; **segmented filter chip
  group** on the right (Todos · Ativos · Concluídos · Expirados, each
  with a count).
- One row per order: 4-column grid `[ID monospace] [name + meta] [status
pill] [total]`, plus a chevron toggle. Click expands an inline body
  containing the line items, a meta-row (Pago / Entrega / Rastreio),
  and two actions: ink-pill "Ver pedido" (links to that order's Pedido
  view) + ghost "Falar com suporte".
- Status pills: warn (Em separação / Pix pendente), ok (Enviado / Pago),
  danger (Pix expirado), muted (default).
- Preserve `id="patient-orders"` on the list container.
- **Mockup glitch to fix in impl:** chevron column in the open row
  collides with the body grid; rebuild expand layout cleanly with
  `details/summary` or a separate body row.

### 4.9 Suporte (`b-suporte.html`)

- Pagehead: h1 "Falar com a equipe" + lead about response SLA.
- 2-column body:
  - **Left (form card):** h2 "Solicitar atendimento" + lead "Escolha um
    motivo comum ou descreva o problema:" then a row of **quick-reason
    chips**: Renovar receita · Pix não confirmou · Pedido atrasado ·
    Trocar endereço · Cancelar pedido · Outro. Clicking a chip
    pre-fills `subject` + `priority`. Below: the existing form fields
    in a 2-column row (Assunto wide / Prioridade narrow), a wide
    Mensagem textarea with a hint about including pedido IDs and prints,
    and a footer row meta + ink "Enviar ao suporte" submit.
  - **Right rail (320px):** **Pedido recente** card auto-linking to the
    most recent open order with a "Trocar" link. **FAQ** card with five
    canned questions linking out to a knowledge base (or to scoped
    in-app help — defer that decision to plan).
- Preserve `id="support-request-form"`, `input[name=subject]`,
  `select[name=priority]`, `textarea[name=message]`,
  `input[type=hidden][name=relatedOrderId]`, `button[type=submit]`.

### 4.10 Meu perfil (`b-perfil.html`) — own page, NOT a drawer

- 4th tab in the tab row, right-aligned.
- Pagehead: 64px green-gradient avatar with monogram (e.g. "HR"), h1
  with patient name, meta strip (`APO-1027` mono code, "Liberada" pill,
  "Convite HELENA2026", "Membro desde <month>").
- 2-column body:
  - **Left (2/3, three stacked cards):**
    1. **Elegibilidade** — receita médica (with doctor + CRM), carteirinha,
       LGPD; each row has a label + value + status pill.
    2. **Plano de cuidado** — médico responsável, diagnóstico (CID hidden,
       "Confidencial · CID em receita"), próxima reavaliação (with a
       "Lembrete em 30 dias" warn pill). Header has a "Ver receita ↗"
       link.
    3. **Contato e entrega** — e-mail, WhatsApp (masked), endereço; each
       with an inline "editar" link.
  - **Right rail (1/3):**
    - **Pedidos no total** stat card (e.g., "5 pedidos · R$ 2.340,00")
      linking to Histórico.
    - **Atividade recente** mini-timeline: Pix gerado / Login realizado
      / Pedido enviado / Receita atualizada / LGPD aceita.
    - **LGPD rights** card with two actions: ghost "Baixar meus dados"
      and ghost-danger "Solicitar exclusão".
- **Decommission `ProfileDrawer.jsx`** unless an E2E selector forces it
  to remain mounted. The current code keeps `#patient-profile-details`
  always-mounted via `display:none`/transform tricks; on a real page
  route there is no drawer. **Verify the E2E test before removal.**

## 5. Component impact matrix

| Component                       | Action                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PatientShell.jsx`              | Reshape topbar (search field, pill, sair)                                                                            |
| `PatientShell.module.css`       | Rewrite                                                                                                              |
| `PatientTabs.jsx`               | Add 4th tab "Meu perfil"; right-align it                                                                             |
| `PatientTabs.module.css`        | Rewrite (chip-style is gone; ink underline)                                                                          |
| `PatientPortal.jsx`             | Slim logged-out branch (drop 3-card grid); route 4th tab; mount Pix-open as full takeover                            |
| `CartHero.jsx`                  | Reshape into right-rail summary                                                                                      |
| `CartHero.module.css`           | Rewrite                                                                                                              |
| `PixHero.jsx`                   | Reshape into the gold-strip card; split _paid_ state into a sibling component (`OrderPaidHero.jsx`) or a `mode` prop |
| `PixHero.module.css`            | Rewrite                                                                                                              |
| `OrderTimeline.jsx`             | Reuse; restyle dots/pulse                                                                                            |
| `OrderTimeline.module.css`      | Rewrite                                                                                                              |
| `HistoryList.jsx`               | Add filter chips; rebuild row + expand                                                                               |
| `HistoryList.module.css`        | Rewrite                                                                                                              |
| `SupportThread.jsx`             | Add quick-reason chips; add side rail                                                                                |
| `SupportThread.module.css`      | Rewrite                                                                                                              |
| `PrivacyConsentGate.jsx`        | Add progress bar, use-cards, collapsibles                                                                            |
| `PrivacyConsentGate.module.css` | Rewrite                                                                                                              |
| `AccessIssueScreen.jsx`         | Add alert + checks list; reshape form                                                                                |
| `AccessIssueScreen.module.css`  | Rewrite                                                                                                              |
| `EmptyHero.jsx`                 | Likely retire — empty state moves into right rail. Confirm no E2E selector points at it                              |
| `ProfileDrawer.jsx`             | Decommission (verify E2E test first)                                                                                 |
| `ProfileDrawer.module.css`      | Delete with above                                                                                                    |
| `MyProfilePage.jsx`             | NEW — wraps the perfil page content                                                                                  |
| `MyProfilePage.module.css`      | NEW                                                                                                                  |
| `Brand.jsx`                     | No change                                                                                                            |
| `Toast.jsx`                     | No change (style audit only)                                                                                         |

## 6. Constraints & invariants

- **Framework boundary:** `src/` cannot import `next` or `react`.
  Reaffirmed; this spec touches only `app/paciente/**` and CSS.
- **Single domain instance:** all data still flows through
  `getSystem()`. No new endpoint calls are required by this spec.
- **E2E selector inventory** must be cross-checked before each phase.
  See ledger for the current list. Treat the spec as the contract for
  _visual_ changes, the existing E2E tests as the contract for
  _selectors_.
- **No new external dependencies.** `framer-motion` and
  `qrcode.react` are already installed; reuse them.
- **Mobile**: when `< 1024px` the right rail collapses below the main
  column and becomes a non-sticky section; product grid relaxes to
  `minmax(160px, 1fr)`. Below 768px, topbar collapses to two rows
  (logo+pill on row 1; search on row 2). Detailed mobile rules are
  out-of-scope but the layouts must not break.
- **Motion budget:** countdown numbers update in place; "now" timeline
  step pulses (1.6s ease-out); product cards lift on hover. Nothing
  else animates.

## 7. Risks & open questions

- **Profile-drawer E2E coupling.** The current
  `#patient-profile-details` is always-mounted. Moving profile to its
  own route changes that. _Action: read the E2E test first._
- **Consent gate copy.** Current literal "Autorizar uso dos dados para
  atendimento" may be the exact assertion. The mockup says "Autorize o
  uso dos seus dados". _Action: confirm by reading the test before
  changing the copy; if it's a literal, keep the original heading and
  use the new copy as a sub-header._
- **Login-screen `#patient-status` requirement.** The status pill must
  remain in the DOM even on the logged-out screen. _Action: render it
  hidden or repurpose the topbar pill._
- **`PatientPortal.jsx` size.** Already 919 lines. Risk of ballooning.
  _Action: split each tab's body into its own component (`OrderTab`,
  `HistoryTab`, `SupportTab`, `MyProfilePage`) so the orchestrator
  stays slim._
- **Missing product photography.** The gold-tinted gradient thumbnails
  are intentional for now. _Action: future spec to add photo support._
- **Mockup CSS bugs.** `b-historico.html` has a chevron alignment glitch
  in the expanded row. Don't carry over to impl.

## 8. Verification

Before declaring any phase complete:

1. `npm run check` (lint + format) — no new violations.
2. `npm test` — no failures.
3. `npm run e2e` — no failures.
4. Visual smoke: open the dev server (`npm run dev`) and walk through
   the 10 screens. Compare against `/tmp/av-mockups/*.html` (or wherever
   we move them). Note any drift.
5. User sign-off after the visual smoke.

## 9. Out of scope for _this_ spec, queued for later

- Mobile redesign (this spec only ensures non-broken layouts).
- Product photography.
- Admin/equipe surfaces.
- New copywriting beyond what's needed to remove redundancy
  (e.g., dropping the patient-name h1 because the pill already names them).
- Any change to the underlying state machine
  (`src/production-system.ts`).

---

**Awaiting user review.** Once approved, the next step is to invoke
`superpowers:writing-plans` to produce the phased implementation plan.
