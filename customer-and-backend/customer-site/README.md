# LYCA — Royal Purple, Champagne & Partners

Complete React + TypeScript multipage website with a repaired landing journey, supplied landing imagery and a permanent `#5a1f82` background.

## Run on Windows / VS Code

Install Node.js 22.12 or newer, extract the ZIP and open `LYCA-Dark-Glass-Website` in VS Code.

```cmd
npm install
npm run build
npm run preview
```

Open the preview address printed in the terminal (normally http://localhost:8443). For editing, run `npm run dev`, or double-click `START_LYCA_WINDOWS.bat`.

## This revision

- Replaced the circled neon-lime ingredient ticker with soft champagne `#e4d5bc`, deep-plum `#351345` text and matching edge fades.
- Changed the enquiry form CTA to **Let’s Create Your Next Flavour**, consistently for email and API delivery.
- Added ECOM, Foods & Inns, Medibel, Appco and Zentis to the home and company pages, using the original partner logos from brochure page 3.
- Partner cards open the enquiry form with an optional preferred-partner selection, included in the email/API payload. The footer links directly to the partner section.
- `PARTNER-SOURCES.json` records the source for every logo. The brochure does not include individual company profiles or partner contact details; none were invented.

- `#5a1f82` is the HTML, body, root and persistent atmosphere base colour.
- Removed the clearable canvas background. The aurora uses layered CSS gradients with slow transform animation, independently of scroll and quality changes.
- Rebuilt the six-scene landing sequence with one GSAP scroll timeline. Forward/reverse scrolling uses the same geometry across devices and quality modes.
- One fixed glass caption stays readable while photographs crossfade. It avoids duplicate, overlapping caption text during transitions.
- Used all six supplied photographs throughout the home route, including the image journey, collection panels and visual atelier. No previous stock photographs are rendered on the home route.
- Glassmorphism is used on navigation and selected panels. Liquid-glass styling is limited to control rims and highlights; there is no expensive image-displacement filter.
- Desktop navigation and the hero caption support a small backdrop blur. Mobile and balanced mode use lighter translucent surfaces.
- The existing catalogue, ingredient search, company information, office contacts, applications, enquiry links and brand phrases are preserved.

## Images

The six supplied visuals are bundled in `public/images/landing` as responsive WebP images. `LANDING-IMAGES.json` records their original filenames. They illustrate ingredient families and creative applications. An avocado or fig visual does not add an unlisted ingredient to LYCA's catalogue.

Previous stock photographs remain available to interior pages, where they illustrate the actual product categories. Their source records are in `IMAGE-SOURCES.json`. The bundled fonts retain their Open Font Licences.

## Accessibility and motion

The complete six-image sequence becomes a readable grid under reduced motion. Gallery tabs support arrow keys, Home and End. Controls retain visible focus rings. Aurora motion stops in hidden tabs and under reduced motion.

## Enquiries and deployment

By default the enquiry form composes an email. A live enquiry service requires `VITE_ENQUIRY_API_URL` to be configured.

Vercel settings: Vite; build command `npm run build`; output directory `dist`. The included SPA rewrite supports direct page reloads. Dependencies, Git history and generated build files are excluded from this ZIP.

The final theme is in `src/aurora.css`; the champagne ticker and partner layouts are in `src/partners.css`. Partner content is in `src/app/partners.tsx`. Landing scene content is in `src/app/landingData.ts`; its animation is in `src/app/cinematic.tsx`.

See `VALIDATION.md` and `PERFORMANCE.md` for verification and implementation limits.
