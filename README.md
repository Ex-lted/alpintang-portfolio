# Alpin: Personal Portfolio

A minimalist and abstract portfolio website for me, Alpin! Three pages, smooth scroll-driven animation, an interactive ASCII hero, a scroll-drawn story roadmap, and toggle-able sound design.

**Live site:** https://alpintang.xyz
**Contact:** mail@alpintang.xyz

---

## Overview

The site presents who I am, what I've built, and how to reach me, in three pages:

| Page | Purpose |
|------|---------|
| **About** | Hero with interactive ASCII background, plus a "My story" timeline rendered as a winding roadmap |
| **Projects** | Showcase of selected work (MYSverse, CLiCScrape, and more) |
| **Contact** | Email address and social links |

---

## Pages and Functions

### About
- **Interactive ASCII hero background.** A field of ASCII characters that reacts to the cursor with a hover glow and to clicks with ripples that spread outward.
- **"My story" roadmap.** A winding road that is drawn as you scroll, with numbered stops for each milestone

### Projects
Each project gets a card or section with description, tech, media and link.

### Contact
- Public email `mail@alpintang.xyz`, which is a forwarding alias.
- A button to LinkedIn.

---

## Feature Deep Dive

### Scroll animation
Sections fade and translate into view as you scroll. The goal is smooth motion that never blocks reading or interaction.

### Roadmap timeline (`js/roadmap.js`)
- A winding road is drawn progressively as the user scrolls, so the path length revealed is tied to scroll position.
- Each milestone is a **numbered stop** along the road.

### ASCII interactive background
- Renders the background as a grid of ASCII characters.
- **Hover:** characters near the cursor glow.
- **Click:** a ripple expands outward from the click point.

### Sound system
- Implemented in `sounds.js` using **recorded CC0 (public-domain) sound effects**.
- **Opt-in:** a sound toggle lets visitors enable or mute audio.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, flexbox/grid, transitions and animations) |
| Logic | Vanilla JavaScript (ES modules or scripts, no framework) |
| Animation | Scroll-driven JS + CSS, with a custom roadmap drawing script |
| Audio | Web Audio / HTML `<audio>` with CC0 recorded samples |
| Storage | `localStorage` (light/dark mode preference) |
| Domain registrar | Exabytes (`alpintang.xyz`, registered 28 Oct 2026) |
| Hosting | Cloudflare connected with a GitHub repo |

**Why no framework?** The site is small and content-focused. Vanilla HTML/CSS/JS keeps the bundle tiny, loads fast, and has no build step to maintain.

---

## Project Structure

```
.
├── public/
│   ├── css/
│   │   ├── roadmap.css
│   │   └── style.css
│   ├── images/
│   ├── js/
│   │   ├── ascii.js
│   │   ├── main.js
│   │   ├── roadmap.js
│   │   └── sounds.js
│   ├── sounds/
│   ├── videos/
│   ├── apple-touch-icon.png
│   ├── favicon-32.png
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon.svg
│   └── index.html
└── wrangler.jsonc
```

---

## Running Locally

No build step is needed. Serve the folder with any static server (opening `index.html` directly can break audio preloading and module imports):

```bash
# Python
python -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000.

---

## Deployment and Infrastructure
 
### Domain and DNS
1. Domain `alpintang.xyz` registered at **Exabytes** (28 Oct 2026).
2. Nameservers point to **Cloudflare**, so DNS, hosting and email routing are all managed in one place.

### Hosting and deployment
The site is hosted on **Cloudflare** and deployed through **Git**. The repository is connected to Cloudflare, so every push to the production branch builds and deploys automatically. `wrangler.jsonc` in the project root holds the deployment configuration, and the contents of `public/` are served as static assets.
 
```bash
git add .
git commit -m "Update site"
git push
```

---

## Design Principles

- **Minimalist, abstract:** generous whitespace, clean typography, restrained colour.
- **Content first:** no logo or name in the nav, just centred navigation buttons.
- **Motion with purpose:** animation guides attention (the roadmap, scroll reveals) rather than decorating.
- **Playful but optional:** sound and the ASCII background add personality without being required to use the site.
- **Zero-dependency:** easy to read, easy to host, easy to maintain.

---

## Performance and Accessibility Notes

- Lazy-load large media (such as the demo video).
- Keep sound **off by default** until the visitor opts in.
- Respect `prefers-reduced-motion` by reducing or disabling scroll and ASCII animations.
- Provide `alt` text for images and keep sufficient colour contrast.
- Ensure keyboard focus states on nav buttons and the sound toggle.
- Make the ASCII canvas non-essential (decorative, `aria-hidden`) and test on touch devices, where "hover" does not exist.

---

## Credits

- Sound effects: CC0 / public-domain recordings
- Project logos and media: owned by their respective projects (MYSverse)

© Alpin. All rights reserved.
