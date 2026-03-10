import 'dotenv/config';
import { fetchAllFeeds } from './scanner/scanner.js';
import { filterArticles } from './scanner/scorer.js';
import { generateAllPosts } from './scanner/ideaGenerator.js';

async function runScan() {
  console.log('[App] Starting scan pipeline...');
  const articles = await fetchAllFeeds();
  const scored   = filterArticles(articles);
  console.log(`[App] ${scored.length} articles passed scoring threshold`);
  await generateAllPosts(scored);
  console.log('[App] Done — new drafts written to blog/data/posts.json');
}

runScan().catch(err => {
  console.error('[App] Fatal error:', err.message);
  process.exit(1);
});

// Phase 2 placeholders:
// TODO: Google Sheets content calendar sync
// TODO: Daily email digest of new drafts
// TODO: X/Twitter hashtag trend scraper
// TODO: Image auto-generation per post (via image API)
// TODO: eBook payment integration (Gumroad / Stripe)
