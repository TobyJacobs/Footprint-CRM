# FootprintOS — Brand guide

_Taken from footprintgroup.uk on 29 September 2026. The owner will supply the official logo files; until then, the website is the reference._

## Font
- **Montserrat** (free from Google Fonts), weights 400–900.
- **Headings:** very bold (weight 800–900).
- **Body text:** regular (400), 16px.

## Colours

| Name | Hex | Used for (on the website) |
|---|---|---|
| Black | `#000000` | Main background of header and hero areas; body text |
| Dark grey | `#222222` | Dark panels |
| Mid grey | `#888888` | Secondary text |
| Border | `#e8e8e8` | Lines and dividers |
| Light | `#f2f2f2` | Light panels |
| Off-white | `#f7f7f7` | Page backgrounds |
| White | `#ffffff` | Text on dark, cards |
| **Pink** | `#de2277` | Main accent: buttons, highlights |
| Pink light | `#eb5cb8` | Hover states |
| **Orange** | `#e58207` | Accent |
| Amber | `#fab200` | Accent, warnings |
| **Teal** | `#7bcbd1` | Accent |
| Teal deep | `#0092a3` | Links and accents on light backgrounds |

**Signature gradient:** pink → orange → teal: `linear-gradient(90deg, #de2277 0%, #e58207 50%, #7bcbd1 100%)`.

## Look and feel
- Bold, confident, high contrast: black and white with the pink/orange/teal gradient as the accent.
- A white version of the logo on black is used in the website header (`fpg-logo-white.png`).

## How the platform will use it
- **Navigation bar:** black, with the white logo and the gradient as a thin accent line.
- **Work areas:** off-white/white, so data-heavy screens (tables, forms) stay calm and readable.
- **Buttons:**
  - main actions in pink
  - secondary actions outlined
- **Status colours:**
  - teal deep for success or information
  - amber for warnings
  - pink for urgent or high priority
  - _(to confirm: a distinct red for errors, so errors aren't confused with the brand pink)_
- **Accessibility:** text colours will be checked for contrast so everything is easy to read.

## Logo files in use
- `public/brand/footprint-logo-white.png`: the white "Footprint Group" logo with the gradient infinity "oo". It was downloaded from footprintgroup.uk with the owner's permission on 1 October 2026 and resized to 1200×352. It's for **dark backgrounds only** and is used in the sidebar and on the login page.
- `src/app/icon.png`: the browser tab icon. It's the gradient infinity mark on a black rounded square, made from the same file.

## Still needed from the owner
- Official logo files (ideally SVG): full-colour for light backgrounds, white for dark backgrounds, and the mark on its own. They'll replace the files above.
