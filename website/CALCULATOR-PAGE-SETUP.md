# Roof Cost Calculator Page: Setup

**File:** `blog/roof-replacement-cost-calculator.html`
**Live URL once uploaded:** https://homeoptionsllc.net/blog/roof-replacement-cost-calculator.html

It uses the same header, footer, styles, Google Analytics tag and blog layout as your other blog posts, so it drops in like any other article.

## 1. Before uploading

- The estimator server must be live first (see the main README). The page loads it from `https://estimate.homeoptionsllc.net/embed.js`. If you deploy it to a different address, search the page for `CHANGE THIS URL` and update that one line.
- Until the server is reachable, the page shows a "Request a Free Estimate" box in place of the calculator, so it never looks broken.

## 2. Upload and get it indexed

1. Upload the file to your site's `/blog/` folder.
2. Add it to `sitemap.xml`:
```xml
<url>
  <loc>https://homeoptionsllc.net/blog/roof-replacement-cost-calculator.html</loc>
  <lastmod>2026-11-08</lastmod>
</url>
```
3. Add a card for it on your `/blog/` index page, like your other guides.
4. In Google Search Console, use URL Inspection on the new URL and click **Request indexing**.

## 3. Link to it from your content pages (not the homepage or Google Business Profile)

Internal links from related pages are how Google finds this page and judges what it's about. Add a short callout to each of these pages, close to where they discuss price:

| Page | Where to place the link |
|---|---|
| `blog/missouri-roof-replacement-cost-2026.html` | Right after the "Average Roof Replacement Cost" section |
| `blog/roofing-cost-guide.html` | Near the top, after the intro |
| `blog/insurance-claim-walkthrough.html` | Where the post discusses replacement cost |
| `blog/how-to-choose-roofing-contractor.html` | In the "compare quotes" section |
| `roofing.html` | Next to the pricing or "free estimate" content |
| Service-area pages | One line near the bottom of each, e.g. "See what a new roof costs in Ballwin" |

Copy-paste callout (styled to match your blog posts; use `../blog/roof-replacement-cost-calculator.html` on pages outside `/blog/`):

```html
<div style="display:flex;gap:14px;align-items:flex-start;background:var(--g0);border:1px solid var(--g1);border-left:4px solid var(--g7);border-radius:6px;padding:18px 20px;margin:22px 0;font-size:15px;line-height:1.7">
  <span style="font-size:22px;line-height:1">🧮</span>
  <div><strong>What would your roof cost?</strong> Our free <a href="roof-replacement-cost-calculator.html" style="color:var(--g7);font-weight:600;text-decoration:underline">St. Louis roof replacement cost calculator</a> measures your actual roof from satellite imagery and shows your price range in about 60 seconds.</div>
</div>
```

Vary the link wording across pages (for example "roof replacement cost calculator", "estimate your roof cost", "see your roof price") so the links don't all read identically.

## 4. What's on the page

- **Title:** Roof Replacement Cost Calculator St. Louis (2026) | Instant Estimate
- **Targets searches like:** roof replacement cost calculator, roof cost estimator St. Louis, how much does a new roof cost in St. Louis, roofing squares and pitch multipliers.
- **Content (about 1,700 words):** how the calculator works, a table of what drives price, 2026 cost ranges (the same figures as your Missouri cost guide), a do-it-yourself measuring guide with pitch multipliers and a worked example, why the result is a range, ways to lower cost, 7 FAQs, local service-area links, and related guides.
- **Structured data:** WebPage, WebApplication, BreadcrumbList and FAQPage. Google currently shows FAQ rich results mostly for authoritative sites, but the markup still helps search engines understand the page.
- **Keep the numbers in sync:** if you update prices in your cost guide, update the cost-range table here too, and set the estimator's admin formula so its results land inside those ranges.
