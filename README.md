# Hotel Pandia's website

Astro site with a scroll-driven 3D mascot story, full menu, QR table ordering (TableServe-ready), branches and booking.
Built by The Vincis.

## Run it

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/  (deploy to Netlify, Vercel, Hostinger, any static host)
npm run preview   # serve the built site
```

Set the real domain in `astro.config.mjs` (`site:`) before going live. It is used for canonical URLs, the sitemap and the table QR codes.

## Deploy

The site is static (plain HTML, CSS, JS and images in `dist/`). Orders, bills, staff logins and feedback live in
Supabase, so **any** static host works. The public Supabase settings are in `.env.production` (publishable key
only; all data is protected by row-level security), so every build comes out live, with nothing to configure.

Before going live on a real domain, set `site:` in `astro.config.mjs` (canonical links, sitemap, table QR codes).

### Vercel (recommended)

1. vercel.com/new → import `vinciscontact/Pandia-s` → **Deploy**. Astro is detected; `vercel.json` adds the caching rules.
2. Every push to `main` redeploys. Add the domain under Project → Settings → Domains.

### Hostinger (or any Apache / cPanel host)

1. `npm run build:hostinger` (builds and adds `deploy/hostinger/.htaccess`: HTTPS redirect, caching,
   compression, 404 page, the `.glb` file type).
2. Upload **everything inside `dist/`**, including the hidden `.htaccess`, into `public_html`
   (hPanel File Manager: upload a zip and extract, or FTP).
3. Turn on the free SSL certificate for the domain in hPanel.

Re-run steps 1 and 2 for each update. Hostinger plans that support Git deployments can pull from GitHub,
but they don't run `npm run build`, so upload the built `dist/` (or keep Vercel for automatic builds).

## Where things live

| What | File |
|---|---|
| Brand, phone, WhatsApp, branches, reviews | `src/data/site.ts` |
| Menu (categories, dishes, prices, veg/egg/non-veg, tags) | `src/data/menu.ts` |
| Colours, fonts, spacing (design tokens) | `src/styles/global.css` |
| Fonts (Anek Tamil, self-hosted + trimmed) | `public/fonts/`, rebuilt by `python scripts/subset-fonts.py` |
| 3D mascot scroll story | `src/components/MascotStory.astro` + `src/scripts/mascot-stage.ts` |
| 3D model (animated, meshopt-compressed) | `public/models/pandia-mascot.glb` |
| Ordering API layer | `src/lib/order/api.ts`, `src/lib/order/types.ts` |
| Printable table QR codes | `/tables` (not linked, not indexed) |

### Components

`Nav`, `Footer`, `Icon`, `SectionHead`, `DishCard` (feature / tile / row), `MenuBrowser` (browse or order mode),
`MenuTeaser`, `Signatures`, `Reviews`, `BranchCards`, `CateringCTA`, `MascotStory`. All data-driven, no copy hard-coded in two places.

### Adding real dish photos

Put images in `public/img/dishes/` and set `image: "/img/dishes/mutton-biryani.webp"` on the dish in `menu.ts`.
Until then, dishes use an illustrated plate.

## QR table ordering + Chef Magic (Supabase)

Each table QR opens `/order?branch=<branchId>&table=<n>`. Print the cards from `/tables`.
Guests order, see the running bill for their table, call the waiter, ask for the bill, then leave a rating
(every guest then gets the "Share on Google" button; low ratings alert the manager).

**The guest's number.** At their first "Send to kitchen" the guest gives a mobile number (required, 10-digit
Indian, no OTP) and their name (required), so staff bring each order to the right person; no messages are sent. It's remembered on that phone
and stored once per number in `customers`, linked to every order and bill (`supabase/migrations/20261007_customers.sql`).
Friends who join a bill with the table PIN aren't asked again. The desk shows the guest on the bill; Dashboard →
Customers lists them (owner: all branches, manager: own branch) with CSV export for a WhatsApp/SMS tool later.
Plain-language notice at `/privacy`. Nothing is messaged yet.

**Getting back to the bill.** The phone that orders keeps a private key for the table's open bill, so a refresh or
reopened tab lands straight back on it. Every open bill also has a 4-digit **table PIN**, shown on the guest's bill
screen and on the desk screen. Any other phone (a friend, another browser, cleared data) that scans the QR while the
bill is open is asked for that PIN before it can see or order on it; 5 wrong tries lock it for 15 minutes.
All phones at a table share one bill. Schema change: `supabase/migrations/20261002_table_pin.sql`.

Backend: Supabase project `hotel-pandias` (ap-south-1). Copy `.env.example` to `.env` and set `PUBLIC_SUPABASE_URL`
and `PUBLIC_SUPABASE_KEY` (publishable key; every table is behind row-level security, all writes go through checked
database functions). With them empty the order page runs on a built-in demo backend ("Demo mode" badge).

| Data layer | File |
|---|---|
| Supabase client | `src/lib/supabase.ts` |
| Customer ordering API + types | `src/lib/order/api.ts`, `src/lib/order/types.ts` |
| Staff helpers (login guard, roles, branch picker) | `src/lib/staff.ts` |
| Staff account management (Edge Function, admin only) | `supabase/functions/manage-staff/` |

**Chef Magic** (staff app, linked by the small "Chef magic" pill in the footer, `noindex`, blocked in robots.txt):

| Page | Who | What |
|---|---|---|
| `/chef` | everyone | Sign in, then sent to the right screen for their role |
| `/chef/kitchen` | kitchen, manager, admin | Live ticket board: new → preparing → ready → served, timers, sound |
| `/chef/desk` | cashier, manager, admin | Table map, waiter/bill calls, itemised bill, discount, Cash/Card/UPI, close table, print |
| `/chef/admin` | manager (own branch), admin | Sales, bills, feedback; admin also gets menu & prices, branches & tables, staff |

Roles: **admin** (all branches), **manager**, **kitchen**, **cashier** (one branch each).
Google review links: paste each branch's "write a review" link in Dashboard → Branches & tables.
Until then the button opens a Google Maps search for that branch.

## The 3D mascot

- Built procedurally in Blender (`mascot/build_mascot.py`), animated with `mascot/anim_mascot.py`, compressed with
  `npx gltf-transform optimize in.glb out.glb --compress meshopt`.
- One 10 s timeline: walk in, present the tray, OK-sign flourish, happy spin. Scroll position scrubs it.
- Loads after first paint; the still image `mascot-900.webp` shows until it is ready, and stays if WebGL is missing or Data Saver is on.
- Respects `prefers-reduced-motion` (no walk-in, no idle motion).

## Before launch: confirm with the owner

- [ ] Menu and prices. Most prices in `menu.ts` are drafts (`verified: false`); only a few were confirmed on public listings.
- [ ] Washermenpet full street address. Royapuram phone and hours (and the second Royapuram outlet). Is Kottivakkam still open?
- [ ] WhatsApp number for bookings (currently +91 92170 02598 from the Vadapalani magicpin listing).
- [ ] Instagram / Facebook links.
- [ ] Real food and restaurant photos.
- [ ] Domain name.
