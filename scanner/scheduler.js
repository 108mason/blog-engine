import cron from 'node-cron';
import { fetchAllFeeds } from './scanner.js';
import { filterArticles } from './scorer.js';
import { generateAllPosts } from './ideaGenerator.js';

export async function runFullScan() {
  console.log('[Scheduler] Starting full scan pipeline...');
  try {
    const articles = await fetchAllFeeds();
    const scored = filterArticles(articles);
    console.log(`[Scheduler] ${scored.length} articles passed scoring threshold`);
    await generateAllPosts(scored);
    console.log('[Scheduler] Scan pipeline complete');
  } catch (err) {
    console.error('[Scheduler] Pipeline error:', err.message);
  }
}

export function startScheduler() {
  // Runs every 12 hours at minute 0
  cron.schedule('0 */12 * * *', () => {
    console.log('[Scheduler] Cron triggered');
    runFullScan();
  });
  console.log('[Scheduler] Cron scheduled — runs every 12 hours');
}
