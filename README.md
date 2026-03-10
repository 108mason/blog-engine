# Rooted & Rising — Blog Engine

Automated spiritual wellness blog with Claude-powered content generation.

## Architecture

```
Scanner → Scorer → Claude API → SQLite → Express API → GitHub Pages Blog
```

- **Scanner** fetches RSS feeds every 12 hours
- **Scorer** filters articles by keyword relevance (min score 20)
- **Idea Generator** sends passing articles to Claude claude-sonnet-4-20250514 → returns full blog post draft
- **API** serves drafts (protected) and published posts (public)
- **Dashboard** lets you review, edit, and publish drafts
- **Blog** renders published posts from the API

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env` with your actual values:
```
ANTHROPIC_API_KEY=sk-ant-...
DASHBOARD_PASSWORD=choose_a_strong_password
PORT=3000
```

### 3. Run locally

```bash
# Full daemon (server + 12hr cron)
npm start

# Run one scan immediately, then keep running
npm run scan

# API server only (no scanner)
npm run server
```

---

## Deployment

### Backend → Railway

1. Push repo to GitHub (public or private)
2. Create a new Railway project → **Deploy from GitHub**
3. Set **Root Directory** to `/` and **Start Command** to `node index.js`
4. Add environment variables in Railway dashboard:
   - `ANTHROPIC_API_KEY`
   - `DASHBOARD_PASSWORD`
   - `PORT` (Railway sets this automatically)
5. Copy the Railway public URL (e.g. `https://blog-engine-production.up.railway.app`)

### Frontend → GitHub Pages

1. Update `API_BASE` in [blog/js/posts.js](blog/js/posts.js) and [blog/js/dashboard.js](blog/js/dashboard.js) to your Railway URL
2. Go to repo **Settings → Pages → Source**: select the `blog/` folder
3. Blog live at `https://yourusername.github.io/blog-engine/`

---

## API Reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/posts` | Public | All published posts |
| GET | `/api/posts/:slug` | Public | Single published post |
| GET | `/api/posts/category/:cat` | Public | Posts by category |
| GET | `/api/drafts` | Protected | All drafts |
| PATCH | `/api/drafts/:id` | Protected | Update draft |
| POST | `/api/publish/:id` | Protected | Publish a draft |
| POST | `/api/unpublish/:id` | Protected | Move back to draft |
| DELETE | `/api/drafts/:id` | Protected | Delete draft |

**Auth:** Pass `Authorization: Bearer YOUR_PASSWORD` header on protected routes.

---

## Categories

- **Manifestation** — Law of attraction, abundance mindset, vision boards
- **Holistic Health** — Gut health, detox, natural remedies
- **Supplements** — Adaptogens, herbal supplements, nootropics
- **Lifestyle** — Conscious living, minimalism, breathwork

---

## Phase 2 (Planned)

- Google Sheets content calendar sync
- Daily email digest of new drafts
- X/Twitter hashtag trend scraper
- Image auto-generation per post
- eBook payment (Gumroad / Stripe)
