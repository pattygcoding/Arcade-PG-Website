# Patrick Goodwin Arcade

The arcade supporting website for the PG-Website repository. This is an
**Angular + TypeScript** app (created with Angular CLI 21.2.26) whose landing page
is intentionally blank apart from the arcade's name.

It reuses the design language of `pattygcoding.dev` and the Connect Four showcase:
a navy canvas with a mint accent, Inter for text and JetBrains Mono for the small
uppercase `micro` labels, and a light/dark theme that is remembered between
visits. Styling is Tailwind CSS v3 driven by CSS-variable colour tokens declared
in `src/styles.css` and exposed through `tailwind.config.js`.

## Pages

Routing lives in `src/app/app.routes.ts`; every page is lazily loaded so the
games only ship when visited.

| Route | Component | Notes |
| --- | --- | --- |
| `/` | `pages/home` | Selection screen: the arcade name plus a card per game. |
| `/alkalab` | `pages/alkalab` | Powder-sand chemistry lab (Rust compiled to WASM). |
| `/snake` | `pages/snake` | Rust/WASM snake driven by miniquad's JS bundle. |
| `/suprememc` | `pages/suprememc` | Showcase for the SupremeMC Minecraft mod (no runtime WASM). |

The game pages are adapted from the PG-Website portfolio and re-themed to this
site's palette and fonts (Inter + JetBrains Mono). The wasm-backed games keep
their binaries and glue in `public/wasm/` — `alkalab.js` (wasm-bindgen glue),
`alkalab.wasm` and `snake.wasm` — which Angular copies to the build output
verbatim, so they are fetched at runtime from `/wasm/...`.

SupremeMC has no runtime dependency: its Game Icons / Simple Icons artwork is
inlined as path data in `pages/suprememc/suprememc-icons.ts` (lifted from the
`react-icons` sets the portfolio uses, so the arcade does not depend on React),
and its logo is served from `public/assets/images/suprememc.png`.


## Language

Every user-facing string lives in **`src/app/i18n/en.json`** — page copy, button
labels, HUD captions, the reaction-log notes, `aria-label`s and document titles.
Components read it through `src/app/i18n/i18n.ts`:

```ts
import { strings } from '../../i18n/i18n';

protected readonly t = strings;
// template: {{ t.snake.title }}
```

Only non-language constants stay in TypeScript (routes, icon names, the
element names the WASM catalog reports). Adding a locale means dropping a sibling
JSON file next to `en.json` and swapping which one `i18n.ts` exports.


## Link previews (Open Graph)

Crawlers — LinkedIn, Slack, Discord, X, Facebook, WhatsApp — fetch a URL and read
**only the raw HTML**; they never run JavaScript. An Angular app therefore has to
ship static tags for every shareable URL, which is what this pipeline does.

1. **`src/index.html`** carries the full baseline set: `description`,
   `og:type/site_name/title/description/url/image`, `og:image:type/width/height/alt`,
   `twitter:card/title/description/image`, `canonical`, `theme-color`, `author`.
   Those tags are the home page's values, and they are the exact tags the next
   step rewrites — so keep them all in place.
2. **`scripts/generate-og-pages.js`** runs as `postbuild` (so `npm run build`
   does it automatically). It reads the built shell plus `src/app/i18n/en.json`,
   then writes one HTML file per route with its own title, description, canonical
   URL and card image. Because a deep link must resolve on a dumb static host, it
   emits **both** forms — `alkalab.html` (for hosts that map extensionless paths
   onto `.html`) and `alkalab/index.html` (for hosts that use directory indexes).
   It also writes a `404.html` SPA fallback and `sitemap.xml`.
3. **`src/app/trailing-slash-url-serializer.ts`** exists because of that second
   form: a host redirects `/alkalab` → `/alkalab/`, and Angular's stock serializer
   treats the trailing slash as an extra segment that matches no route. Trimming it
   keeps the visitor on the page they clicked instead of the home page.
4. **`public/og/*.png`** are the 1200×630 cards, one per page, generated with
   Pillow (a square logo renders badly in a `summary_large_image` card):

   ```sh
   npm run og:images      # python tools/generate_og_images.py
   ```
5. **`public/CNAME`** (`arcade.pattygcoding.com`) and **`public/robots.txt`** are
   copied into the build root, and `404.html` is served for unknown paths.

### Verifying

```sh
npm run build
npm run check:previews
```

`tools/check_link_previews.py` serves the build the way GitHub Pages would and
then requests each shareable URL as a crawler, asserting that every page returns
200 with a unique title, a complete and absolute tag set, a matching `og:url`, and
a card image that actually resolves at 1200×630:

```
URL          STATUS  PAGE TITLE
/            200     Patrick Goodwin Arcade
                       card home.png 1200x630 OK
/alkalab     200     Alkalab - Patrick Goodwin Arcade
                       card alkalab.png 1200x630 OK
...
PASS - 4 shared URLs all serve distinct, crawler-readable OG tags.
```

### After deploying

Paste each URL into LinkedIn's [Post Inspector](https://www.linkedin.com/post-inspector/)
once. LinkedIn caches previews hard, so the inspector is what forces a refresh —
worth doing on the first launch or after changing any copy or card image.

## Deployment

The site is published to **https://arcade.pattygcoding.com/**.

`.github/workflows/deploy.yml` runs on every push to `main` (or on demand via
**Actions → Deploy to GitHub Pages → Run workflow**). It installs, runs the unit
tests, builds, runs the link-preview check, and only then uploads
`dist/arcade-pg-website/browser` as the Pages artifact — so a failing test or a
regressed OG tag can never reach the live site.

Repository Pages settings, already configured:

| Setting | Value |
| --- | --- |
| Source | GitHub Actions (`build_type: workflow`) |
| Custom domain | `arcade.pattygcoding.com` |
| HTTPS | enforced (certificate approved) |

DNS for the subdomain is a `CNAME` record pointing at `pattygcoding.github.io`,
and `public/CNAME` carries the same domain into the build output so the setting
survives a redeploy.

To ship a change, push to `main`:

```sh
git push origin main
gh run watch          # follow the run to completion
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
