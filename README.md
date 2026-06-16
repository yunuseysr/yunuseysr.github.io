# yunuseysr.github.io

Personal portfolio website for **Yunus Emre Yaşar** — Big Data & AI Engineer.

🔗 **Live:** https://yunuseysr.github.io

A hand-built, single-page portfolio with a custom dark **"Neural"** theme (neon
data-viz, glassmorphism). No framework — plain HTML, CSS Grid/Flexbox and vanilla
JavaScript. Bilingual: English (root) + Turkish (`/tr`).

## Tech

- **HTML / CSS / vanilla JS** — no build step, no package manager, no framework
- **Font Awesome** (icons) and **Google Fonts** (Space Grotesk + Inter) via CDN
- Hosted on **GitHub Pages**

## Structure

```
index.html        # English version (site root)
tr/index.html      # Turkish version (full duplicate, translated)
css/styles.css     # the whole "Neural" theme (:root CSS variables for the palette)
js/scripts.js      # typewriter, scroll-reveal, active-nav, mobile drawer
assets/img/        # favicon, avatar (sidebar) + profile (og:image)
```

> When updating content, edit **both** `index.html` and `tr/index.html` so the two
> languages stay in sync.

## Develop & preview

No build needed. Serve the directory so relative paths and the `/tr` route work:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy

Push to `main` — GitHub Pages publishes automatically. There is no CI.

## License

© Yunus Emre Yaşar. All rights reserved.
