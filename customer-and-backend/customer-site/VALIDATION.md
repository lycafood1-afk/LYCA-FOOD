# Validation — Champagne & Partner Revision

Checked against the production build on 23 October 2026.

- `npm run build` passed TypeScript checking, the 82-asset verifier and Vite production compilation. The existing large-JavaScript-chunk warning remains non-blocking.
- `npm run test:animation-clock` passed all nine display-rate/target-rate scenarios.
- The ingredient ribbon computes to champagne `#e4d5bc` with deep-plum `#351345` text. Their text contrast ratio is 10.93:1. Its matching edge fades were visually checked.
- All five original partner logos load, with names ECOM, Foods & Inns, Medibel, Appco and Zentis. They were compared with brochure page 3; original colours, proportions and transparency are retained.
- Home links reach the partner section on the company page. A Foods & Inns card prefilled the preferred-partner field on desktop; a Zentis card did the same on mobile.
- The enquiry CTA reads “Let’s Create Your Next Flavour”. Empty submission retains field errors and focuses the first invalid field. A valid email-mode submission retains the selected partner and explains that the customer must send the prepared email. No real enquiry was sent.
- Direct reloads of products, applications, about, network, enquiry, privacy and terms render their expected page headings.
- Layout checks passed at 1440×1000, 390×844, 375×667 and landscape 844×390 without horizontal overflow in the checked routes. Desktop partner layout, mobile partner cards, mobile enquiry CTA and the champagne ribbon were visually inspected after the opening animation.
- Reduced-motion mode keeps the champagne ribbon, stops ticker animation and presents the landing story as a static grid.
- Checked browser scenarios produced no JavaScript errors or HTTP failures.

Limits: Chromium software rendering and synthetic mobile viewports were used. A configured external enquiry API, physical phones, Safari and Firefox were not tested. The new partner field is included by the existing FormData-based email/API payload construction; external API acceptance depends on that service’s schema.

## Earlier revision’s validation notes

The following notes were retained from the supplied ZIP; they describe its earlier background/animation work.

# Validation — Royal Purple Aurora revision

## Build

- `npm run build` passed TypeScript and the Vite production build.
- The asset verifier found 77 valid local assets, without empty files or Git LFS pointers.
- Vite retains a large-JavaScript-chunk warning; the build completes successfully.

## Background regression

Verified in headless Chromium:

- Body and persistent atmosphere compute to `rgb(90, 31, 130)` (`#5a1f82`).
- The atmosphere continues to cover the viewport after the first wheel scroll and after resting.
- Changing the quality flag after scrolling does not clear the background or change hero geometry.
- The same base colour remains through all six chapters, tablet resize, interior navigation and browser back.
- No canvas is created by the page.

## Landing images and animation

- All six supplied visuals appear in the hero and visual atelier.
- Every raster photograph rendered on the home route comes from `public/images/landing`; no previous stock photograph remains on that route.
- Next controls reached all six chapters in order. Previous controls returned through all six chapters in reverse.
- Captions remain in one fixed glass panel while photographs transition.
- No horizontal overflow at desktop 1440 × 1000, tablet 1024 × 768 or touch 390 × 844.
- Screenshots were visually checked at the beginning, during the first scroll, at the second chapter, and on mobile.
- Reduced motion displays all six scenes as readable static cards.

## Existing controls

- Six atelier choices update the displayed image. Keyboard Home returns to the first choice.
- Searching for “beetroot” still returns two catalogue collections.
- Mobile navigation opens and reaches the ingredient portfolio.
- The checked scenarios produced no browser JavaScript errors or HTTP failures.

## Limits

Checks used headless Chromium, including a synthetic touch viewport. Safari, Firefox and physical mobile GPUs were not tested. These checks verify the specified regressions and interactions; they are not a guarantee of a device-independent frame rate. Enquiry-service configuration remains separate from the visual changes.
