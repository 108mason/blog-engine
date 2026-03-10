# Rooted & Rising — Blog Engine

Automated spiritual wellness blog. Claude generates posts from RSS feeds via GitHub Actions. Everything hosted free on GitHub.

## Architecture

```
GitHub Actions (cron every 12hrs)
  → Fetches RSS feeds
  → Scores articles by keyword relevance
  → Claude API generates full blog post drafts
  → Writes to blog/data/posts.json
  → Commits & pushes to repo
  → GitHub Pages serves the updated blog automatically
```

No server. No database. No hosting costs.

---

## Setup

### 1. Add your API key as a GitHub Secret

Go to **repo Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

### 2. Enable GitHub Pages

Go to **repo Settings → Pages → Source**: `Deploy from a branch` → Branch: `master` → Folder: `/blog`

Blog will be live at: `https://108mason.github.io/blog-engine/`

### 3. Trigger your first scan

Go to **Actions → Scan & Generate Posts → Run workflow**

New draft posts will appear in `blog/data/posts.json`.

---

## Managing Content (GitHub Web UI)

All content management happens directly in `blog/data/posts.json` via the GitHub editor.

**Publish a post:**
1. Open `blog/data/posts.json` in GitHub
2. Find the post (status: "draft")
3. Change `"status": "draft"` → `"status": "published"`
4. Set `"publishedAt"` to current ISO date: `"2025-06-01T10:00:00.000Z"`
5. Commit — GitHub Pages deploys in ~30 seconds

**Edit a post:** Edit any field directly in the JSON and commit.

**Delete a post:** Remove the object from the array and commit.

---

## Run scanner locally

```bash
npm install
# add ANTHROPIC_API_KEY to .env
npm run scan
```

---

## Post JSON structure

```json
{
  "id": "uuid",
  "title": "Your Post Title",
  "slug": "your-post-title",
  "category": "Manifestation | Holistic Health | Supplements | Lifestyle",
  "type": "Trending | Evergreen",
  "hook": "Two sentence intro...",
  "body": "Full markdown body...",
  "metaDescription": "155 char SEO summary",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "publishTiming": "ASAP | This Week | This Month",
  "sourceTitle": "Original article title",
  "sourceUrl": "https://...",
  "relevanceScore": 42,
  "status": "draft",
  "createdAt": "2025-06-01T08:00:00.000Z",
  "publishedAt": null
}
```

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
