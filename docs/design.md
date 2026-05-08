# Design System Inspired by Apoiar Brasil

This document captures the public Apoiar Brasil website design language and
translates it into reusable guidance for future product and application work.
The source site is a public trust, education, and association-acquisition
experience for medicinal cannabis care. In this repository, which is a private
daily operations system for Apoiar/Associacao Verde, use this as brand guidance
while preserving the operational product principle: calm, secure, useful, and
Portuguese-first.

## 1. Visual Theme & Atmosphere

Apoiar Brasil is a warm medical-association brand, not a cold clinical SaaS
interface. The page combines legal/security language, patient acolhimento,
medicinal cannabis imagery, and family-centered photography into a visual tone
that feels safe, community-led, and socially purposeful.

The experience is built around soft off-white sections, translucent green washes,
large serif headings, and a recurring rhythm of trust cards, process cards,
stats, portraits, testimonials, FAQ rows, and strong gold calls to action.
Background images are almost always treated as atmosphere: blurred family hero
photography, low-opacity cannabis leaf textures, dark green overlays, and muted
medical/education images. The brand does not rely on abstract decoration; it
uses authentic people, care environments, association founders, medical context, and
community evidence.

Typography is the main expressive layer. `Playfair Display` gives headings a
human, editorial quality, while `Outfit` keeps body text, forms, buttons, and
navigation approachable and legible. The result is more "guided care" than
"retail catalog": language should emphasize access, treatment, legal safety,
medical orientation, and association membership.

**Key Characteristics:**

- Warm green-and-gold medical association identity.
- Public-facing trust tone: acolhimento, ciencia, seguranca juridica, acesso
  responsavel.
- Large serif headlines over authentic photography.
- Off-white and pale green section backgrounds with layered cannabis textures.
- Gold CTA buttons as the primary conversion signal.
- Rounded cards with soft shadows and centered iconography.
- Heavy use of patient, founder, doctor, event, and family imagery.
- Portuguese-first copy with direct, concrete action labels.

## 2. Color Palette & Roles

The live site uses HSL design tokens. The hex values below are approximate
conversions from the rendered CSS tokens.

### Primary

- **Apoiar Green** (`hsl(145 55% 32%)`, `#257E4A`): Main brand color. Use for
  logo-adjacent accents, icon circles, section headings, primary borders, and
  trust markers.
- **Deep Association Green** (`hsl(150 10% 15%)`, `#222A26`): Footer,
  dark overlays, high-contrast text, and serious legal/compliance contexts.
- **White** (`#FFFFFF`): Card surfaces, text on dark green overlays, logo
  inversion, and clean form backgrounds.

### Secondary & Accent

- **Apoiar Gold** (`hsl(48 96% 53%)`, `#FACC14`): Primary CTA fill, statistic
  numbers, star ratings, and high-priority conversion/action highlights.
- **Gold Text Ink** (`hsl(0 0% 8%)`, `#141414`): Text on gold buttons.
- **Soft Green Surface** (`hsl(145 30% 95%)`, `#EEF6F2`): Section backgrounds,
  pale panels, low-intensity brand tint.
- **Muted Surface** (`hsl(140 15% 96%)`, `#F3F6F4`): Neutral application
  background and quiet content bands.

### Neutrals & Text

- **Foreground** (`#222A26`): Primary body text and footer background.
- **Muted Text** (`hsl(150 10% 40%)`, `#5C7066`): Body descriptions, supporting
  copy, FAQ labels, card details.
- **Border** (`hsl(140 15% 90%)`, `#E2E9E4`): Card borders, form inputs,
  dividers, accordion rows.
- **White 90%** (`rgba(255,255,255,.9)`): Text over image overlays.
- **White 60%** (`rgba(255,255,255,.6)`): Footer metadata and secondary links.

### Semantic Extensions

- **Success/Available:** Use Apoiar Green with pale green background.
- **Attention/Pending:** Use Apoiar Gold on white or pale green surfaces.
- **Blocked/Error:** Use restrained red only for operational warnings; do not
  introduce red into public brand sections unless the content is an actual
  error state.
- **Legal/Compliance:** Prefer Deep Association Green, white, and muted
  supporting text.

### Gradient & Overlay System

- **Hero Photo Overlay:** Blurred background image with brightness around 40%
  plus `bg-primary/30`.
- **Trust Section Wash:** Cannabis texture at 8-15% opacity with a pale
  green/white gradient.
- **Impact Overlay:** Authentic patient/community image with `bg-primary/70` for
  high contrast.
- **Medical Cards:** Image background plus dark foreground overlay around 70%.

## 3. Typography Rules

### Font Family

**Display:** `Playfair Display`, serif

- Used for H1, H2, large editorial statements, section titles, and emotionally
  resonant quotes.
- Available weights in the live site: 400, 500, 600, 700.
- Best role: trust, humanity, institutional voice.

**Body/UI:** `Outfit`, sans-serif

- Used for body copy, labels, buttons, navigation, cards, inputs, and data.
- Available weights in the live site: 300, 400, 500, 600, 700.
- Best role: forms, operational clarity, repeated workflows.

### Hierarchy

| Role               | Size    | Weight  | Line Height | Font     | Notes                                   |
| ------------------ | ------- | ------- | ----------- | -------- | --------------------------------------- |
| Hero H1 Desktop    | 64px    | 600     | 1.2         | Playfair | Main public promise over image          |
| Hero H1 Tablet     | 56px    | 600     | 1.2         | Playfair | Keep centered and readable              |
| Hero H1 Mobile     | 28-40px | 600     | 1.2         | Playfair | Constrain width to avoid wrapping badly |
| Section H2 Desktop | 48-60px | 600     | 1.0-1.15    | Playfair | Green on light, white on dark           |
| Section H2 Mobile  | 30-36px | 600     | 1.25-1.35   | Playfair | Use generous bottom spacing             |
| Card Title         | 20-30px | 600     | 1.25-1.35   | Outfit   | The site often switches cards to sans   |
| Lead Copy          | 20-24px | 400-500 | 1.6-1.75    | Outfit   | Use for supportive explanations         |
| Body               | 18-20px | 400     | 1.75        | Outfit   | Public page default body is large       |
| Body Small         | 16px    | 400     | 1.5         | Outfit   | Card descriptions, metadata             |
| Nav Link           | 15px    | 500     | 1.0         | Outfit   | Compact, stable header                  |
| Button             | 15-20px | 700     | 1.2-1.5     | Outfit   | Uppercase CTAs                          |
| Overline           | 12px    | 700     | 1.2         | Outfit   | Uppercase stage labels                  |
| Form Label         | 16px    | 600     | 1.4         | Outfit   | Clear and direct                        |

### Principles

- Use serif headings to add warmth, but keep all operational UI in `Outfit`.
- Do not make body text small on public or patient-facing screens; the brand
  reads as accessible because text is generous.
- Use uppercase sparingly for buttons, stage labels, and section metadata.
- Avoid negative letter spacing. Use `tracking-wider` only for short overlines.
- In the private app, reserve `Playfair Display` for page titles, empty states,
  and calm patient-facing moments; dense team workflows should lean on `Outfit`.

## 4. Component Styling

### Buttons

**Primary CTA: Gold Fill**

- Background: Apoiar Gold (`#FACC14`).
- Text: near black (`#141414`).
- Font: `Outfit`, 700, uppercase.
- Border: none.
- Radius: 6-8px (`rounded-md` / token radius `.5rem`).
- Height: 44px for nav, 56px for hero/major CTAs.
- Padding: 32-48px horizontal for major CTAs.
- Shadow: soft `shadow-lg`.
- Hover: slightly darker or 90% opacity.
- Focus: 2px Apoiar Green ring with visible offset.

**Secondary CTA: White Outline On Image**

- Background: transparent.
- Text: white.
- Border: 2px solid white.
- Radius: 6-8px.
- Hover: subtle white overlay (`rgba(255,255,255,.1)`).
- Use beside the primary CTA in hero sections.

**Quiet Button: White/Border**

- Background: white.
- Border: 1px solid Border.
- Text: Foreground.
- Hover: gold background and gold text contrast where appropriate.
- Use for profile "SAIBA MAIS", carousel controls, and lower-priority actions.

### Cards & Containers

- Background: usually white or white with light transparency.
- Border: 1px solid `#E2E9E4` or green at 10-20% opacity.
- Radius: 12px for cards; 8px for forms/accordion rows.
- Shadow: `shadow-md`, `shadow-lg`, or `shadow-xl`; soft but visible.
- Padding: 24px standard; 32-40px for large people/testimonial cards.
- Card content often centers icons, labels, titles, and descriptions.
- Cards can sit over image/gradient backgrounds, but text contrast must remain
  clear.

### Forms

- Form surface: `rgba(255,255,255,.8)` with backdrop blur on textured sections.
- Input background: white.
- Border: `#E2E9E4`.
- Radius: 6px.
- Height: 44px minimum.
- Label: 16px/600, visible above each input.
- Placeholder: muted text.
- Focus: Apoiar Green ring.
- Use two-column grids on desktop, one column on mobile.
- Include clear submit labels: "ENVIAR INFORMACOES", "ACOLHIMENTO",
  "ASSOCIE-SE".

### Navigation

- Header: fixed top, white/95 background, backdrop blur, bottom border.
- Height: 56px mobile, 72px desktop.
- Logo: left, 40px mobile and about 56px desktop.
- Nav links: 15px/500 Outfit, muted text, hover to Apoiar Green.
- Primary nav CTA: gold button at the far right.
- Mobile: hamburger menu; keep logo and menu button visible.
- Do not crowd desktop nav with long labels unless the viewport can support it.

### Process Cards

- Use a 4-step pattern for access/treatment flows.
- Icon circle: 56-64px, Apoiar Green fill, white icon.
- Stage label: uppercase, 12px, gold or green.
- Title: 20px/600 Outfit.
- Description: 16px muted text.
- Layout: 4 columns desktop, 2 columns tablet, 1 column mobile.

### Stats Cards

- Statistic number: 48-72px, Outfit bold, Apoiar Gold.
- Description: 16px foreground or muted.
- Surface: white, rounded 12px, visible shadow.
- Use on dark green/image overlays for contrast.
- Keep numbers factual and dated when needed; do not overstate public impact.

### People Cards

- Portrait: 3:4 aspect ratio, rounded 12px, object-cover.
- Role badge: green pill, uppercase 12px, white text.
- Name: 18-20px/600 Outfit.
- Role/credential: 14px, Apoiar Green.
- Button: quiet bordered button.
- Use authentic photos; avoid generic stock portraits when identifying people.

### FAQ Rows

- Surface: white or white/60 with backdrop blur.
- Border: 1px solid Border.
- Radius: 8px.
- Question: 18px/500 Outfit.
- Icon: chevron, rotate on open.
- Answer text: muted 16-18px.

## 5. Layout Principles

### Spacing System

Use an 8px base unit with generous public-facing sections.

| Token    | Value | Use                             |
| -------- | ----- | ------------------------------- |
| space-1  | 4px   | Icon gaps, tight separators     |
| space-2  | 8px   | Micro spacing                   |
| space-3  | 12px  | Inline controls                 |
| space-4  | 16px  | Mobile padding, card inner gaps |
| space-5  | 20px  | Icon/title gaps                 |
| space-6  | 24px  | Card padding                    |
| space-8  | 32px  | Grid gaps, section internals    |
| space-10 | 40px  | Medium card padding             |
| space-12 | 48px  | Section title to content        |
| space-16 | 64px  | Standard section padding        |
| space-20 | 80px  | Desktop public sections         |
| space-24 | 96px  | Large narrative breaks          |
| space-32 | 128px | Hero vertical padding           |

### Grid & Container

- Maximum content width: around 1280px.
- Narrow content width: around 1024-1152px for forms, FAQ, and centered
  storytelling.
- Horizontal padding: 16px mobile, 24px tablet, 32-40px desktop.
- Hero: image-backed full-width band, centered content.
- Public sections: alternate light, muted, green overlay, image overlay.
- Operational private app: avoid long marketing-style flow; use route-level
  surfaces and dense but calm information layouts.

### Visual Rhythm

The public site alternates between:

1. Emotional trust section with photography.
2. Concrete form or process.
3. Evidence/stats.
4. Education and association story.
5. People and credibility.
6. FAQ and final CTA.

For the private daily app, keep the brand rhythm but shift priority to:

1. Current eligibility/payment/stock status.
2. Queues and exceptions.
3. Patient or order details.
4. Forms and corrections.
5. Audit/compliance evidence.

## 6. Depth & Elevation

| Level   | Treatment                       | Use                                       |
| ------- | ------------------------------- | ----------------------------------------- |
| Base    | White or pale green section     | Default page body                         |
| Soft    | Border + `shadow-md`            | Forms, FAQ, small cards                   |
| Medium  | `shadow-lg`                     | Process cards, CTAs, operational cards    |
| High    | `shadow-xl` / `shadow-2xl`      | Stats cards, portraits, major image cards |
| Overlay | Dark green/foreground at 60-80% | Text over photography                     |
| Focus   | 2px Apoiar Green ring           | Keyboard focus and input active state     |

Depth should feel reassuring, not glossy. Shadows are there to separate cards
from textured backgrounds and image overlays. Avoid heavy black shadows on the
private app unless the component is truly modal or over imagery.

### Decorative Depth

- Use authentic images with opacity, blur, and green overlays.
- Use cannabis leaf textures only as subtle background patterning.
- Use small line-dot-line dividers between major public sections.
- Avoid decorative blobs, unrelated gradients, and generic medical stock
  elements that do not show care, treatment, community, or association context.

## 7. Do's And Don'ts

### Do

- Use Apoiar Green as the institutional anchor and Apoiar Gold as the primary
  action signal.
- Keep public copy warm and direct: acolhimento, acesso, orientacao, seguranca.
- Use `Playfair Display` for emotional/public headings and `Outfit` for UI.
- Preserve large readable text, especially for patient-facing flows.
- Use authentic photography for hero, founders, doctors, events, and patient/community
  trust moments.
- Treat all cannabis imagery as medicinal and responsible, never recreational.
- Keep CTAs concrete and action-oriented.
- Keep forms calm, short, and clearly labeled.
- In the private app, put operational status before forms.

### Don't

- Do not turn the brand into a dark-first tech dashboard.
- Do not use neon greens, purple gradients, or cold blue clinical palettes.
- Do not use public ecommerce language for private patient access.
- Do not make cannabis imagery decorative in a way that feels recreational.
- Do not use tiny body text; the public site deliberately feels accessible.
- Do not overuse gold on large surfaces; reserve it for action and evidence.
- Do not put cards inside cards.
- Do not hide compliance or legal status behind vague messaging.
- Do not let marketing page patterns override the private application's route
  and workflow structure.

## 8. Responsive Behavior

| Breakpoint    | Width       | Key Changes                                                                    |
| ------------- | ----------- | ------------------------------------------------------------------------------ |
| Mobile        | <640px      | Single-column sections, 16px page padding, 28-40px hero headline, stacked CTAs |
| Tablet        | 640-1024px  | 2-column card grids, 40-56px headings, larger vertical padding                 |
| Desktop       | 1024-1440px | Full nav, 4-column process/stats grids, 64px hero headline                     |
| Large Desktop | >1440px     | Center max-width containers, preserve section rhythm                           |

### Touch Targets

- Minimum touch target: 44x44px.
- Major CTAs: 56px high on public/patient surfaces.
- Form fields: 44px high minimum.
- Carousel controls: 40px circles minimum.
- Mobile nav: hamburger target at least 44px.

### Collapsing Strategy

- Navigation: full horizontal nav to hamburger below desktop.
- Hero: centered content remains first viewport; CTAs stack on mobile.
- Forms: two columns to one column below tablet.
- Process cards: 4 columns to 2 to 1.
- Stats: 4 columns to 2; condition stats 6 columns to 3 to 2.
- People cards: 4 columns to 2; keep portraits stable with aspect ratio.
- Footer: 3 columns to stacked; social links should remain touch-friendly.

### Image Behavior

- Hero images cover and crop; keep subject centered enough for mobile.
- Portraits use `object-cover` in fixed aspect-ratio containers.
- Event images may use `object-contain` when preserving poster content matters.
- Always pair image backgrounds with overlays for text contrast.

## 9. Agent Prompt Guide

### Quick Color Reference

- Brand green: `#257E4A`
- Deep green/foreground: `#222A26`
- Soft green surface: `#EEF6F2`
- Muted surface: `#F3F6F4`
- Border: `#E2E9E4`
- Muted text: `#5C7066`
- Gold CTA/accent: `#FACC14`
- Text on gold: `#141414`
- White: `#FFFFFF`

### Example Component Prompts

- "Create a patient-facing access hero using a authentic family/care photo with a
  dark green overlay, a 56-64px Playfair Display heading in white, a 20-22px
  Outfit subtitle, and two CTAs: gold filled ASSOCIE-SE and white outlined
  SAIBA COMO FUNCIONA."
- "Design a four-step treatment access section on pale green with white cards,
  green circular lucide icons, uppercase Etapa labels, 20px Outfit titles, and
  muted 16px descriptions."
- "Create an impact stats band on a dark green image overlay with white cards,
  large gold Outfit numbers, and short factual captions."
- "Design a calm eligibility status card for the private app using a white
  surface, green status icon, clear Portuguese label, muted explanation, and a
  concrete next-action button."
- "Build a team operations dashboard that preserves the Apoiar palette but uses
  dense Outfit typography, route-level sections, queue cards, and explicit Pix,
  prescription, stock, and fulfillment states."

### Iteration Guide

When refining screens generated with this design system:

1. Check whether the screen is public/trust-building or private/operational.
2. Use Playfair headings only where the product needs warmth or ceremony.
3. Keep action color disciplined: gold for primary action, green for identity
   and status.
4. Make text larger before adding decoration.
5. Prefer authentic association, medical, patient, or community imagery over abstract
   backgrounds.
6. In operational screens, bring queues, blockers, payment state, stock state,
   and audit evidence above forms.
7. Verify mobile at roughly 390px wide; patient workflows must remain readable
   and tappable.
