import 'dotenv/config';
import { startServer } from './server/api.js';
import { startScheduler, runFullScan } from './scanner/scheduler.js';

const args = process.argv.slice(2);

if (args.includes('--scan')) {
  // One-time scan then keep server + scheduler running
  console.log('[App] Mode: scan + server');
  startServer();
  startScheduler();
  runFullScan();

} else if (args.includes('--server')) {
  // API server only, no scanner
  console.log('[App] Mode: server only');
  startServer();

} else {
  // Default daemon: server + scheduled scanner
  console.log('[App] Mode: daemon (server + scheduler)');
  startServer();
  startScheduler();
}

// Phase 2 placeholders:
// TODO: Google Sheets content calendar sync
// TODO: Daily email digest of new drafts
// TODO: X/Twitter hashtag trend scraper
// TODO: Image auto-generation per post (via image API)
// TODO: eBook payment integration (Gumroad / Stripe)
