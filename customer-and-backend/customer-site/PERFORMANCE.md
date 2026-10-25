# Background and motion repair

The previous canvas could be resized by a quality change, clearing its contents, then skip its next draw in balanced mode. The old hero could also switch between 3D and 2D geometry while a scroll was in progress.

This revision removes that failure path:

- A permanent CSS atmosphere, HTML, body and root all have `#5a1f82` as their base colour.
- No background canvas or WebGL context is created. Scrolling, quality changes and context loss cannot clear the CSS background.
- Aurora ribbons animate cached gradient layers using transforms. There are no full-screen blur or displacement filters.
- The hero has one GSAP timeline and consistent geometry. It updates only transforms, opacity and chapter state as its timeline moves.
- One glass caption sits above the image layers, keeping caption text from overlapping during crossfades.
- Backdrop blur is restricted to navigation and one hero caption. Mobile and balanced mode use translucent painted surfaces.
- Responsive local WebP assets are used throughout. Upcoming chapter images decode during idle time.
- Native wheel and touch scrolling, reduced-motion layouts and hidden-tab animation pausing are retained.

These changes target stable rendering and lower GPU work. They are not a guarantee of a particular frame rate on every browser or device. The earlier WebGL benchmark results no longer describe this implementation; see VALIDATION.md for the checks performed on this revision.

## Current diagnostic sample

Headless Chromium, desktop viewport 1440 × 900, 4× CPU slowdown, 60 animation-frame scroll steps after loading. Median frame interval: 16.7 ms; 95th percentile: 35.7 ms. The background remained `#5a1f82`, and no background canvas was present. This is one synthetic sample, not a physical-device frame-rate guarantee.
