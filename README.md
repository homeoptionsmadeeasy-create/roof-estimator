# Instant Roof Estimator

A self-hosted roof estimate tool for your website. A homeowner enters their address and gets a price range. Behind the scenes:

1. **Google Geocoding** turns the address into map coordinates.
2. **Google Solar API** (`buildingInsights`) returns every roof plane with its sloped area and pitch. The homeowner sees the satellite photo with the planes outlined and confirms it's their house.
3. The homeowner picks a material and answers a few questions (layers to tear off, stories, skylights and chimneys, why they're replacing, timeline).
4. **Lead gate:** they enter name, email and phone before the price appears.
5. Your **adjustable formula** calculates the price, and the homeowner sees a range, a monthly payment and a price for every material.
6. The lead is **saved locally first**, then sent to your **CRM** with the full estimate attached as a note.

If Google has no coverage for an address, or the homeowner says it's not their roof, the lead is still captured and marked **"needs manual measure."**

## 0. Try it right now (no setup)

Double-click **`dist/roof-estimator-demo.html`**, or `public/index.html`. Both run entirely in your browser with a sample roof and the default pricing formula. Nothing is sent anywhere, and after the quote a "Test mode" panel shows the exact lead your CRM would receive.

To rebuild the demo after you change prices in Admin, run `npm run build-demo`.

## 1. Run the real server on your computer (Windows)

1. Install Node.js (the LTS version) from nodejs.org.
2. Open the `roof-quote` folder in File Explorer, click the address bar, type `cmd` and press Enter.
3. Run:
```bash
npm install
copy .env.example .env      (Mac/Linux: cp .env.example .env), then open .env in Notepad and set ADMIN_PASSWORD
npm start
```
4. Open http://localhost:3000 for the widget and http://localhost:3000/admin/ for the admin page.
- Widget: http://localhost:3000
- Admin: http://localhost:3000/admin/ (any username, your `ADMIN_PASSWORD`)

Without `GOOGLE_API_KEY`, every address returns a sample 2,479 sq ft roof, so you can tune the formula and test the CRM connection before paying for anything.

## 2. Google Cloud setup (about 10 minutes)

1. Go to console.cloud.google.com, create a project, and attach a billing account. A credit card is required, but the Solar API Building Insights endpoint has a monthly free tier.
2. **APIs & Services → Library** → enable **Solar API**, **Geocoding API** and **Maps Static API**.
3. **Credentials → Create API key**. Restrict it to those 3 APIs. This key stays on your server and the browser never sees it.
4. Put it in `.env` as `GOOGLE_API_KEY=...` and restart.
5. In Admin, type a real address into **Test a real address** to check that it works.

Notes:
- **Cost control:** responses are cached for 30 days per location (the maximum Google's terms allow). Each visitor IP is limited to 15 address lookups and 8 lead submissions per hour. Lookups for addresses with no coverage (404) aren't billed.
- **Coverage:** good in most U.S. metro and suburban areas, thinner in rural areas. In Admin, **Minimum imagery quality = LOW** gives the most coverage. The homeowner's price range automatically gets wider when imagery quality is lower.
- **Terms of service:** the Solar API is marketed to solar and energy companies. Read the Google Maps Platform terms for the Solar API and confirm that roof-replacement estimating is an allowed use for your account.

## 3. Tune the formula (Admin → Pricing formula)

The admin page has a live preview, so every change recalculates instantly with line items. **The default numbers are placeholders. Replace them with your real prices before going live.**

| Setting | What it does |
|---|---|
| Materials ($/square) | Installed price per 100 sq ft. Add, remove, enable or disable options. |
| Low-slope | Planes flatter than X/12 are priced at a flat-roof rate. |
| Waste | Base % plus extra % for each roof plane above a threshold, with a cap. |
| Steep pitch tiers | Extra $/square for planes at or above each pitch. |
| Stories / tear-off / extras | Per-square charges for access and tear-off per layer; per-item charges for skylights and chimneys. |
| Flat fees | Permit, dumpster and disposal, etc. |
| Complexity | Surcharge % when the roof has more than N planes. |
| Minimum job | Lowest price you'll ever show. |
| Range ± % | How wide the range is, set separately for each Google imagery quality level. |
| Area adjustment % | Adds overhang/eaves that satellite data tends to undercount. **Calibrate this:** run 5–10 addresses you've already measured with EagleView/Hover and adjust until the numbers match. |
| Financing | APR and term used for the "as low as $X/mo" line. |

## 4. Connect your CRM

Set `CRM_PROVIDERS` in `.env` (comma-separate to send to more than one):

| Provider | Value | What happens |
|---|---|---|
| Zapier / Make / n8n / any webhook | `webhook` | POSTs the full lead as JSON with flattened fields (`first_name`, `estimate_low`, `roof_sqft`…). Optional HMAC signature header via `WEBHOOK_SECRET`. Use this for **AccuLynx, Leap, Roofr, ServiceTitan, Salesforce**, etc. |
| GoHighLevel | `gohighlevel` | Creates or updates the contact, adds tags and the estimate note, and optionally opens an opportunity in your pipeline. |
| HubSpot | `hubspot` | Creates the contact (or finds the existing one) and attaches the estimate as a note. |
| JobNimbus | `jobnimbus` | Creates a contact with your record type, status and source, with the estimate in the description. |

Every lead is saved to `data/leads.json` before the CRM is called. If a CRM call fails, the lead shows a red ✗ in **Admin → Leads**, where you can click **Resend**. You can also download all leads as a CSV.

## 5. Put it on your website

Deploy to any Node 18+ host (Render, Railway, Fly.io, DigitalOcean, a VPS). **Use a persistent disk for `/data`** (or set `DATA_DIR` to one) so leads and settings survive redeploys. Then paste this on any page:

```html
<div id="roof-quote"></div>
<script src="https://estimate.yourroofingco.com/embed.js" async></script>
```

The embed resizes itself automatically, passes UTM/gclid/fbclid from your page into the lead, and fires `generate_lead` (GA4/Google Ads), `Lead` (Meta Pixel) and a `roof_estimate_lead` dataLayer event when someone submits.

You can also link directly to `https://estimate.yourroofingco.com/?address=123+Main+St`. The address is prefilled, which is useful for mailers and ads.

## Files

```
server.js              API routes, admin auth, rate limiting
lib/solar.js           Geocoding + Solar API → roof planes, area, pitch, satellite image
lib/pricing.js         The estimate formula
lib/store.js           Settings + lead storage
lib/crm/*.js           CRM connectors
public/                Homeowner widget + embed.js
admin/                 Admin page
data/config.default.json   Default settings (data/config.json is created on first run)
```

## Accuracy notes

- Solar API area is the actual sloped surface area of each plane, so you don't need a pitch multiplier. It may miss overhangs (see Area adjustment), very small planes, and detached garages (it measures only the closest building).
- The pitch value in the API is the average of each plane, rounded here to the nearest X/12.
- Always present the result as an estimate confirmed by inspection. The consent text and disclaimer can be edited in **Admin → Branding & text**; have an attorney review the consent wording if you'll call or text leads.
