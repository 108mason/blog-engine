import { TwitterApi } from 'twitter-api-v2';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUEUE_PATH = join(__dirname, '../blog/data/social-queue.json');

async function postToX(text) {
  const client = new TwitterApi({
    appKey:       process.env.TWITTER_API_KEY,
    appSecret:    process.env.TWITTER_API_SECRET,
    accessToken:  process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
  const tweet = await client.v2.tweet(text);
  return tweet.data.id;
}

async function postToFacebook(text) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token  = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error('Facebook credentials not configured');

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, access_token: token })
  });
  if (!res.ok) throw new Error(`Facebook API error: ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function postToInstagram(caption) {
  // Instagram Graph API requires a media container with an image_url
  // Text-only posts are not supported — skipping
  throw new Error('Instagram requires an image URL — text-only posts not supported by Graph API');
}

async function run() {
  let queue;
  try {
    queue = JSON.parse(readFileSync(QUEUE_PATH, 'utf-8'));
  } catch {
    console.log('[Social] social-queue.json not found — nothing to do');
    return;
  }

  const now = new Date();
  const due = queue.filter(item =>
    item.status === 'scheduled' && new Date(item.scheduledFor) <= now
  );

  if (due.length === 0) {
    console.log('[Social] No posts due — done');
    return;
  }

  console.log(`[Social] ${due.length} post(s) due`);

  for (const item of due) {
    console.log(`[Social] Processing: "${item.postTitle}"`);

    for (const [platform, pdata] of Object.entries(item.platforms)) {
      if (!pdata.enabled || pdata.posted) continue;
      if (!pdata.text?.trim()) { console.log(`[Social] ${platform}: no text — skipping`); continue; }

      try {
        let postId;
        if (platform === 'x')         postId = await postToX(pdata.text);
        if (platform === 'facebook')  postId = await postToFacebook(pdata.text);
        if (platform === 'instagram') postId = await postToInstagram(pdata.text);

        item.platforms[platform].posted   = true;
        item.platforms[platform].postedAt = new Date().toISOString();
        item.platforms[platform].postId   = postId || null;
        item.platforms[platform].error    = null;
        console.log(`[Social] ${platform}: posted ✓`);
      } catch (err) {
        item.platforms[platform].error = err.message;
        console.error(`[Social] ${platform}: failed — ${err.message}`);
      }
    }

    const enabled = Object.values(item.platforms).filter(p => p.enabled);
    const posted  = enabled.filter(p => p.posted).length;
    item.status   = posted === 0 ? 'failed' : posted === enabled.length ? 'posted' : 'partial';
  }

  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
  console.log('[Social] Queue updated');
}

run().catch(err => {
  console.error('[Social] Fatal:', err.message);
  process.exit(1);
});
