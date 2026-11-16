# Roof Estimator & Cost Calculator Page: Handoff

**Prepared:** November 8, 2026 · **For:** Home Options Made Easy (homeoptionsllc.net) · **Owner:** Kyle Bates

## 1. What this is

An instant online roof estimate tool that collects leads for Home Options Made Easy. A homeowner enters their address. The tool measures the roof from Google satellite data, asks a few questions, collects contact information, then shows a price range. The lead goes straight into GoHighLevel (GHL).

It has three parts:

| Part | What it is | Where it lives |
|---|---|---|
| **Estimator server** | A small Node.js app: the quote widget, the Google API calls, the pricing formula, the admin page, lead storage and the CRM connection | Its own hosting (recommended: Render), at **estimate.homeoptionsllc.net** |
| **Calculator page** | A new blog article built in the site's own template, with the widget embedded and about 1,800 words of search content | Your existing website: `/blog/roof-replacement-cost-calculator.html` |
| **GHL automation** | Contact, tags, note and opportunity created automatically, plus the follow-up workflow you build in GHL | Your GHL account |

**Current status:** the code is built and tested in demo mode. It has **not** been run against the live Google APIs, the live GHL API, or the live website. Those first live tests are part of the launch checklist (section 7).

## 2. What's in the package (roof-estimator.zip)

```
roof-quote/
├── HANDOFF.md                 ← this document
├── README.md                  ← developer setup reference
├── render.yaml                ← one-click Render deployment
├── .env.example               ← every setting, with comments
├── server.js                  ← API routes, admin login, rate limits, /healthz
├── lib/solar.js               ← Google Geocoding + Solar API + satellite image
├── lib/pricing.js             ← (points to public/shared.js)
├── lib/store.js               ← settings + lead storage (JSON files in DATA_DIR)
├── lib/crm/                   ← gohighlevel.js, hubspot.js, jobnimbus.js, webhook.js
├── public/                    ← the homeowner widget
│   ├── index.html, widget.css, widget.js
│   ├── shared.js              ← THE PRICING FORMULA (shared by server and demo)
│   ├── embed.js               ← the 2-line embed code websites use
│   └── demo-data.js           ← sample roof for test mode
├── admin/                     ← admin page (pricing, branding, leads)
├── data/config.default.json   ← default prices and text
├── data/mock-building.json    ← sample roof used when there's no Google key
├── dist/roof-estimator-demo.html  ← self-contained demo; double-click to try it
├── scripts/build-demo.js      ← rebuilds the demo after price changes
└── website/
    ├── blog/roof-replacement-cost-calculator.html  ← THE PAGE TO UPLOAD
    └── CALCULATOR-PAGE-SETUP.md
```

## 3. What was tested, what wasn't, and known limitations

### Tested and working

- **Full homeowner flow:** address → roof found → confirm roof → questions → contact form → price. Tested in all three modes: opened from a folder, as the single demo file, and on the running server.
- **Pricing formula:** line items checked against a hand calculation (matched to within rounding). Defaults were recalibrated so the results fall inside the ranges in the site's own 2026 cost guide.
- **Roof rejuvenation:** priced at 50% of architectural; the tear-off question hides; the eligibility warning shows; it appears in the price comparison; the GHL note and tag are correct.
- **"Not my roof" / no coverage flow:** the lead is still captured and flagged "needs manual measure".
- **Form validation:** bad email, short phone number and missing consent are all rejected; the hidden spam-trap field works.
- **Admin page:** password protection, live preview while editing, rejecting broken settings, reset to defaults, leads table, CSV download, resend to CRM.
- **Lead storage and webhook delivery:** leads saved to disk first, then sent to a test webhook with a signature header.
- **Layout:** desktop and phone widths (390 px) in Chrome for the widget, the calculator page and the admin page.
- **Calculator page:**
  - All 35 internal links checked against the live site, with none broken.
  - Search markup (JSON-LD) is valid, and the 8 FAQs in the markup match the 8 on the page.
  - The page opens at the top without jumping.
  - The FAQ accordions and the mobile menu work.
- **Live site compatibility:** homeoptionsllc.net has no content security policy that would block the embedded calculator. Its `X-Frame-Options: DENY` only stops *other* sites from framing it, so it doesn't affect us.
- **Production install:** `npm ci` installs cleanly; the `/healthz` health check responds; data is written to `DATA_DIR`.

### Not yet tested: verify these during launch

| Item | Why it matters | How to verify |
|---|---|---|
| Real Google Geocoding, Solar API and Static Maps calls | The code follows Google's documented API but has never been run with a real key | Admin → "Test a real address" with 3–5 known addresses |
| Real GHL API (contact upsert, note, opportunity) | Written from GHL's v2 API docs; never run against your account | Submit a test lead and check the contact, tags, note and opportunity in GHL |
| HubSpot / JobNimbus connectors | Built but unused; only needed if you switch CRMs | n/a unless used |
| Embed on the live website | Tested inside a preview, not on homeoptionsllc.net itself | Upload the page and run a test lead from it |
| Real iPhone and Android, plus Safari | Only Chrome, at phone width, was tested | Run one estimate on an iPhone and one on an Android |
| Google Analytics `generate_lead` event | Code fires it, but it hasn't been seen arriving in GA4 | GA4 → Reports → Realtime after a test lead |
| Measurement accuracy | Satellite area vs. your real measurements is unknown | Calibrate (section 6, step 3) |

### Known limitations (by design, or worth knowing)

1. **Single server instance.** Rate limits and in-progress sessions are kept in memory. A restart in the middle of an estimate shows "session expired" and the homeowner starts over. Don't run more than one instance. Render's disk setup enforces this anyway.
2. **Leads are stored in a JSON file** on the persistent disk. That's fine for hundreds to low thousands of leads a year. Download the CSV backup regularly.
3. **The roof outline on the satellite photo is approximate.** It draws a rectangle around each roof plane, not the exact shape. The measurements themselves use Google's true plane areas.
4. **Only the main building is measured.** Google measures the building closest to the address, so detached garages and sheds are not included.
5. **No email or text is sent by the estimator itself.** The homeowner is told they'll be contacted. The actual follow-up (text, email, a copy of the estimate) must come from your GHL workflow.
6. **The price isn't available as a GHL merge field yet.** It goes into a contact *note*, so workflow messages can't say "your estimate was $X". This needs GHL custom fields (backlog item 1).
7. **No service-area check.** Out-of-area addresses still get a quote and become leads.
8. **No address autocomplete.** Homeowners type the full address. Phones can autofill it.
9. **One admin password** for everyone, using basic browser login.
10. **The admin page is desktop-first.** It works on a phone but is cramped.

## 4. Decisions needed before launch

| # | Decision | Notes |
|---|---|---|
| 1 | **Rejuvenation 50% or 60%?** | Your roof-rejuvenation page says about 60% of replacement ($2.40 vs $4/sq ft). The calculator is set to 50%. Make them match: change it in Admin, or update that page. |
| 2 | **Real prices** | Every price in the formula is a placeholder, calibrated only to fall inside your published ranges. Enter your actual numbers. |
| 3 | **Who receives new-lead alerts** | Needed for the GHL workflow (text or email to you or a sales rep). |
| 4 | **Consent text** | The default TCPA-style wording should be reviewed by your attorney before you text leads. |
| 5 | **Hosting choice** | This document assumes Render (about $7–8/month). Any Node 18+ host with a persistent disk works. |

## 5. Accounts and access you'll need

- **Google Cloud** account with billing enabled (credit card required)
- **GitHub** account (Render deploys from a GitHub repository)
- **Render** account
- **DNS access** for homeoptionsllc.net (wherever the domain is registered or its DNS is managed)
- **Website file access** for homeoptionsllc.net (FTP, file manager, or however pages are uploaded today)
- **GHL** admin access to the sub-account (location)
- **Google Analytics** (property G-NET62MW5Z5) and **Google Search Console** for homeoptionsllc.net

## 6. Deployment runbook

### Step 1: Google Cloud (about 15 minutes)

1. Go to console.cloud.google.com and create a project named "Roof Estimator". Attach the billing account.
2. **APIs & Services → Library**: enable **Solar API**, **Geocoding API** and **Maps Static API**.
3. **APIs & Services → Credentials → Create credentials → API key.** Then:
   - Under **API restrictions**, choose "Restrict key" and select only those 3 APIs.
   - Leave **Application restrictions** as "None". The key is used only on the server, never in the browser.
4. **Billing → Budgets & alerts**: create a budget (for example $25/month) with email alerts at 50%, 90% and 100%.
5. *(Optional)* In each API's **Quotas** page, cap requests per day (for example 500) as a safety net.
6. **Terms of use:** Google markets the Solar API to solar and energy companies. Read its terms and confirm that roof-replacement estimating is an allowed use.

### Step 2: Put the code on GitHub

1. Create a **private** GitHub repository, for example `roof-estimator`.
2. Upload the contents of the `roof-quote` folder: drag and drop on GitHub, or use `git push`. Don't upload `node_modules/` or a `.env` file. The included `.gitignore` already excludes them.

### Step 3: Deploy on Render

1. Go to render.com → **New → Blueprint** → connect GitHub → select the repository. Render reads `render.yaml`.
2. When prompted, fill in the secret values:

| Variable | Value |
|---|---|
| `GOOGLE_API_KEY` | The key from step 1 |
| `ADMIN_PASSWORD` | A strong password for /admin |
| `GHL_TOKEN` | From step 5 (you can add it later; leads are saved locally until then) |
| `GHL_LOCATION_ID` | From step 5 |
| `GHL_PIPELINE_ID` / `GHL_STAGE_ID` | From step 5 (optional; skip to create contacts without opportunities) |

3. Render creates a **Starter** web service (always on, about $7/month) with a **1 GB persistent disk** at `/var/data` (about $0.25/month). Render snapshots the disk automatically every day.
4. Wait for "Live", then open `https://<service>.onrender.com/healthz`. It should show `{"ok":true,"demo":false,...}`. `"demo":true` means the Google key isn't set.

### Step 4: Custom domain (estimate.homeoptionsllc.net)

1. In Render: service → **Settings → Custom Domains → Add** `estimate.homeoptionsllc.net`.
2. In your DNS provider, add the record Render shows: a **CNAME** named `estimate` pointing to `<service>.onrender.com`.
3. Wait for Render to show the domain as verified. The HTTPS certificate is issued automatically.
4. Check that `https://estimate.homeoptionsllc.net/` loads the widget.

> If you use a different address, update the one line marked `CHANGE THIS URL` in the calculator page.

### Step 5: First-time setup in Admin

Go to `https://estimate.homeoptionsllc.net/admin/` (any username, your `ADMIN_PASSWORD`).

1. **Pricing formula tab:** enter your real prices:
   - $/square for each material, low-slope rate, waste %, steep-pitch charges, stories, tear-off per layer, skylight and chimney charges, flat fees, minimum job, financing APR and term
   - the rejuvenation % (decision 1)
2. **Calibrate measurements:** in "Test a real address", run 5–10 homes you've already measured with EagleView, Hover or by hand. Compare Google's square footage with yours and adjust **Area adjustment %** until they match on average. Note any addresses that come back "no coverage".
3. **Branding & text tab:** check the phone number, button link (currently your contact page), consent text and disclaimer.
4. Click **Save changes**. The live widget uses the new numbers immediately.

### Step 6: GoHighLevel

**Connect:**
1. GHL → Settings → **Private Integrations** → Create. Give it access to contacts (view and edit) and opportunities (view and edit). Copy the token into `GHL_TOKEN`.
2. Settings → Business Profile → copy the **Location ID** into `GHL_LOCATION_ID`.
3. Opportunities → Pipelines → create **"Online Roof Estimates"** with stages: New Estimate → Contacted → Inspection Booked → Proposal Sent → Won / Lost.
4. Get the pipeline ID and the "New Estimate" stage ID, and put them in `GHL_PIPELINE_ID` and `GHL_STAGE_ID`. They're visible in the pipeline settings and URLs; your GHL admin or support can confirm them.
5. In Render → Environment, save the variables. Render redeploys automatically.

**What each lead creates in GHL:**
- A contact (created, or updated if the email or phone already exists) with name, email, phone and address
- Tags:
  - `online-estimate` on every lead
  - `estimate-arch-shingle`, `estimate-designer-shingle`, `estimate-standing-seam` or `estimate-rejuvenation`, depending on the option chosen
  - `needs-manual-measure` when there was no satellite measurement
- A note with the full estimate: price range, material, roof size and pitch, imagery quality, the homeowner's answers, and any tracking codes from your ads
- An opportunity in your pipeline, valued at the estimate midpoint (when the pipeline and stage IDs are set)

**Build the workflow** (Automation → Workflows → new), triggered when the tag `online-estimate` is added:
1. Right away, a text to the homeowner, e.g. "Hi {{contact.first_name}}, it's Kyle with Home Options. Got your roof estimate for {{contact.address1}}. When's a good time for a free inspection to lock in your price?"
2. Right away, an email confirmation (and the copy of the estimate the homeowner expects).
3. Right away, an internal alert to you or a sales rep: "New online estimate: {{contact.name}} {{contact.phone}}".
4. **If/else on tags:**
   - `needs-manual-measure` → create a task: "Measure roof and send price within 1 business day".
   - `estimate-rejuvenation` → create a task: "Inspect for rejuvenation eligibility and check shingle warranty".
5. Follow-ups on day 1, 3 and 7 if there's no reply. In the workflow settings, have it stop when the contact replies.

**Texting compliance:** your GHL phone number must be registered for business texting (**A2P 10DLC**) before automated texts will be delivered reliably. Start this early; carrier approval can take days.

### Step 7: Launch test (do all of these)

- [ ] `https://estimate.homeoptionsllc.net/healthz` shows `"demo":false`
- [ ] Admin test address returns a real roof with a realistic size and pitch
- [ ] From a phone, complete a full estimate on the widget with your own details
- [ ] In GHL: contact, tags, note and opportunity appear, and the workflow fires (text and email arrive)
- [ ] In Admin → Leads: the lead shows a green ✓ for gohighlevel
- [ ] Repeat once choosing **Roof Rejuvenation** and once clicking **"No / not quite"** (manual flow)
- [ ] Repeat on an iPhone (Safari) and an Android (Chrome)
- [ ] Delete the test contacts from GHL afterwards

## 7. Adding the page to homeoptionsllc.net

**File:** `website/blog/roof-replacement-cost-calculator.html` → upload to the site's `/blog/` folder.
**URL:** https://homeoptionsllc.net/blog/roof-replacement-cost-calculator.html

It already contains the site's header, footer, styles, Google Analytics tag, search markup and all internal links (verified against the live site). If the estimator server is offline, the page shows a "Request a Free Estimate" box instead of the calculator, so it never looks broken.

### 7.1 Upload and check

1. Upload the file to `/blog/`.
2. Open the URL on desktop and phone. Check that the logo, menu and footer look like the other blog posts and that the calculator loads.
3. Run one test estimate from the live page.

### 7.2 Add to sitemap.xml (inside the `<!-- BLOG -->` section)

```xml
  <url>
    <loc>https://homeoptionsllc.net/blog/roof-replacement-cost-calculator.html</loc>
    <lastmod>2026-11-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
    <image:image>
      <image:loc>https://homeoptionsllc.net/roofgrey-bluehouse.jpg</image:loc>
      <image:caption>Roof Replacement Cost Calculator St. Louis MO | Instant Estimate – Home Options Made Easy</image:caption>
      <image:title>Roof Replacement Cost Calculator St. Louis MO | Instant Estimate – Home Options Made Easy</image:title>
    </image:image>
  </url>
```
Also change the `<lastmod>` on the `/blog/` entry to the upload date.

### 7.3 Add a card to the blog index (/blog/index.html)

Put it first in the grid of guide cards. The markup matches your existing cards:

```html
<article style="background:var(--wh);border:1px solid var(--gr2);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:.2s" onmouseover="this.style.boxShadow='0 8px 24px rgba(0,0,0,.09)';this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='none';this.style.transform='none'">
<a href="roof-replacement-cost-calculator.html" style="display:block;height:180px;overflow:hidden"><img src="../roofgrey-bluehouse.jpg" alt="St. Louis roof replacement cost calculator" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" loading="lazy" width="903" height="614"></a>
<div style="padding:22px 20px;display:flex;flex-direction:column;gap:9px;flex:1">
<span style="display:inline-block;background:rgba(249,115,22,.1);color:#f97316;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:4px 12px;border-radius:100px">Free Calculator</span>
<h2 style="font-size:16px;line-height:1.4;color:var(--tx);margin:0"><a href="roof-replacement-cost-calculator.html" style="color:inherit;text-decoration:none" onmouseover="this.style.color='var(--g7)'" onmouseout="this.style.color='inherit'">St. Louis Roof Replacement Cost Calculator (2026)</a></h2>
<p style="font-size:13px;color:var(--tx2);line-height:1.6;flex:1;margin:0">Enter your address and see your real roof price, measured from satellite imagery. Replacement or rejuvenation, in about 60 seconds.</p>
<div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--gr2);margin-top:4px">
<span style="font-size:12px;color:var(--tx3)">Interactive tool • Nov 8, 2026</span>
<a href="roof-replacement-cost-calculator.html" style="font-size:13px;font-weight:700;color:var(--g7);text-decoration:none;display:inline-flex;align-items:center;gap:3px">Try it <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
</div></div></article>
```

### 7.4 Internal links from content pages (not the homepage or Google Business Profile)

Add a short callout near where each page discusses price:

| Page | Placement | Suggested link wording |
|---|---|---|
| blog/missouri-roof-replacement-cost-2026.html | After "Average Roof Replacement Cost…" | St. Louis roof replacement cost calculator |
| blog/roofing-cost-guide.html | After the intro | estimate your roof cost |
| blog/insurance-claim-walkthrough.html | Where replacement cost is discussed | see what a new roof costs |
| blog/how-to-choose-roofing-contractor.html | "Compare quotes" section | check a quote against our roof calculator |
| roof-rejuvenation.html | Pricing section | estimate rejuvenation for your roof |
| roofing.html | Near pricing / free estimate | instant roof price |
| service-area/*.html | One line near the bottom | See what a new roof costs in [Town] |

Callout code (use `../blog/roof-replacement-cost-calculator.html` on pages outside `/blog/`):
```html
<div style="display:flex;gap:14px;align-items:flex-start;background:var(--g0);border:1px solid var(--g1);border-left:4px solid var(--g7);border-radius:6px;padding:18px 20px;margin:22px 0;font-size:15px;line-height:1.7">
  <span style="font-size:22px;line-height:1">🧮</span>
  <div><strong>What would your roof cost?</strong> Our free <a href="roof-replacement-cost-calculator.html" style="color:var(--g7);font-weight:600;text-decoration:underline">St. Louis roof replacement cost calculator</a> measures your actual roof from satellite imagery and shows your price range in about 60 seconds.</div>
</div>
```

### 7.5 Analytics and Search Console

1. **GA4:** after the first test lead, go to Admin → Events and mark `generate_lead` as a **key event**. If you run Google Ads, import it as a conversion.
2. **Search Console:** URL Inspection → paste the page URL → **Request indexing**. Resubmit `sitemap.xml`.
3. Use the Rich Results Test (search.google.com/test/rich-results) on the live URL to confirm the markup is read without errors.

## 8. Monthly costs (estimate)

| Item | Approx. cost |
|---|---|
| Render Starter web service | about $7/month |
| Render 1 GB persistent disk | about $0.25/month |
| Google Solar, Geocoding and Static Maps | Each has a monthly free usage tier; at local-roofer volume you should usually stay within it. Check current Google Maps Platform pricing, and the budget alert covers surprises. |
| GHL, GitHub, domain | Existing / free |

## 9. Ongoing operations

**Weekly**
- Admin → Leads: look for red ✗ CRM results and click **Resend**.
- Check that GHL follow-ups are going out and that leads are getting contacted quickly.

**Monthly**
- Admin → Leads → **Download CSV** as a backup (Render's daily disk snapshots are a second backup).
- Glance at Google Cloud billing and the Render dashboard.
- Search Console: impressions and clicks for the calculator page; fix any errors it reports.

**When prices change**
- Update them in Admin and Save. The live widget changes immediately.
- If the cost-range table on the calculator page, or your cost guides, list different numbers, update the page text to match.
- Optional: run `npm run build-demo` to refresh the stand-alone demo file.

**Every January**
- Update "2026" in the calculator page's title, H1, description and markup to the new year, along with the "Updated" date.
- Review the cost ranges against your current pricing.

**As needed**
- **Change the admin password:** Render → Environment → `ADMIN_PASSWORD`.
- **Rotate keys if someone with access leaves:** create a new Google key and GHL token, update Render, then delete the old ones.
- **Dependency updates (2–4 times a year):** `npm update` then `npm audit`, test, and redeploy.
- **Change who gets lead alerts:** in the GHL workflow, not in the estimator.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| The page shows "Request a Free Estimate" instead of the calculator | Estimator server down or wrong URL | Check `/healthz`, the Render dashboard and the `CHANGE THIS URL` line |
| Every address gives the same 2,479 sq ft roof | Demo mode: `GOOGLE_API_KEY` missing | Set the key in Render → Environment |
| "Our measuring service is busy" | Google API error (key restriction, billing, quota) | Render → Logs; check the APIs are enabled and billing is active |
| Many addresses get "measure by hand" | Low Solar coverage or a strict quality setting | Admin → Measurement → Minimum imagery quality = LOW |
| Roof matched to the neighbor's house | Address geocoded to the street | The homeowner clicks "No / not quite" and it becomes a manual lead; adjust "Max distance from address" if frequent |
| Leads in Admin show a red gohighlevel ✗ | Bad token, missing access, wrong location ID | Hover the ✗ to see the error; fix the env var; click Resend |
| GHL texts not delivered | A2P 10DLC not approved | Finish registration in GHL |
| "Too many requests" | Rate limit (15 lookups or 8 leads per IP per hour) | Normal spam protection; it resets hourly |
| Settings or leads gone after a deploy | No persistent disk, or DATA_DIR not set | Check the disk is mounted at /var/data and `DATA_DIR=/var/data` |

## 11. Environment variable reference

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_API_KEY` | Yes (live) | Solar + Geocoding + Static Maps. Without it the server runs in demo mode. |
| `ADMIN_PASSWORD` | Yes | Login for /admin |
| `DATA_DIR` | Yes on Render | Where settings and leads are stored (`/var/data`) |
| `CRM_PROVIDERS` | Yes | `gohighlevel` (comma-separate to add `webhook`, `hubspot` or `jobnimbus`) |
| `GHL_TOKEN`, `GHL_LOCATION_ID` | For GHL | Private Integration token and sub-account ID |
| `GHL_PIPELINE_ID`, `GHL_STAGE_ID` | Optional | Create an opportunity for each lead |
| `GHL_TAGS` | Optional | Base tags (default `online-estimate`) |
| `GEOCODE_COUNTRY` | Optional | `US` limits address lookups to the US |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | Optional | Also send leads to Zapier, Make or n8n |
| `PORT` | Auto | Set by the host |
| `MOCK_SOLAR=1` | Optional | Force demo mode even with a key |

## 12. Backlog (recommended next improvements)

1. **GHL custom fields for the estimate** (low, high, material, roof sq ft) so workflow texts and emails can include the price. *Highest value.*
2. **Send the homeowner a copy of the estimate** from the GHL workflow, using item 1's fields.
3. **Service-area check:** flag or politely redirect addresses outside your 70-mile radius.
4. **Address autocomplete** (Google Places) for fewer typos and faster completion.
5. **Capture partial leads:** record the address even when the homeowner doesn't finish the form.
6. **Exact roof outlines** on the satellite image instead of rectangles.
7. **Move the contact.html form (Formspree) into GHL** so every lead lands in one place.
8. **A/B test** where the contact form appears (before vs. after the price) once there's traffic.
