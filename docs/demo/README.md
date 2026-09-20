# Preview site

A single static page that walks through the product: the customer's journey
(join → wallet card → NFC tap), the barista's stamping console, and the owner's
dashboard. Everything runs in the browser on sample data — there is no API, no
database and no real wallet pass here.

It exists so the product can be shown with a link, which GitHub Pages can serve
and the real application cannot: the platform needs Node and PostgreSQL.

- `index.html` — the page
- `demo.js` — the sample state and the three views
- `demo.css` — preview chrome (phone frame, tabs)
- `app.css` — a copy of the web app's stylesheet, so the preview looks exactly
  like the real screens. Refresh it with `npm run demo:sync` after changing
  `apps/web/src/app/globals.css`.

Published by `.github/workflows/pages.yml` on every push that touches this
folder.
