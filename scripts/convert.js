import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { YoutubeTranscript } from 'youtube-transcript';
import * as cheerio from 'cheerio';
import RSSParser from 'rss-parser';
import { readPosts, writePosts } from '../scanner/store.js';
import { v4 as uuidv4 } from 'uuid';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a content writer for a spiritual wellness blog targeting the manifestation and holistic health community. Your tone is inspirational, warm, and spiritually grounded. Never use clinical or pharmaceutical language.

Given source content, generate a complete blog post draft including:
1. title — compelling, spiritual/inspirational tone
2. slug — URL-friendly version of title
3. category — one of: Manifestation | Holistic Health | Supplements | Lifestyle
4. type — Trending or Evergreen
5. hook — 2 sentence intro that pulls the reader in
6. body — full blog post, minimum 600 words, with H2 subheadings, written in brand voice
7. metaDescription — 155 character SEO summary
8. tags — array of 5 relevant tags
9. publishTiming — ASAP | This Week | This Month
10. recommendedProducts — array of 3-5 specific product names (supplements, books, tools) relevant to this post that could be sold as Amazon affiliate products. Use real, well-known product names. Just names, no URLs.

Return strictly as a single JSON object. No markdown, no preamble.`;

// ── Parse CLI args ─────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type') result.type = args[++i];
    if (args[i] === '--url')  result.url  = args[++i];
  }
  return result;
}

// ── Save draft ─────────────────────────────────────────────────────────────────
function saveDraft(post, sourceTitle, sourceUrl) {
  const posts = readPosts();
  const newPost = {
    ...post,
    id:          uuidv4(),
    sourceTitle,
    sourceUrl,
    relevanceScore: 8,
    status:      'draft',
    createdAt:   new Date().toISOString(),
    publishedAt: null,
    humanized:   false,
    affiliateLinks: []
  };
  posts.unshift(newPost);
  writePosts(posts);
  console.log(`[Convert] Saved draft: "${post.title}"`);
  return newPost;
}

// ── Generate post with Claude ──────────────────────────────────────────────────
async function generateFromContent(sourceContent, sourceTitle, sourceUrl) {
  const userMessage = `Source content to convert into a Sacred Roots blog post:

Title / Source: ${sourceTitle}
URL: ${sourceUrl}

Content:
${sourceContent.slice(0, 8000)}

Generate a complete blog post draft based on this content, written in Sacred Roots' spiritual wellness voice.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }]
  });

  const raw = response.content[0].text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  }
}

// ── YouTube ────────────────────────────────────────────────────────────────────
async function convertYouTube(videoUrl) {
  console.log(`[Convert] YouTube: ${videoUrl}`);

  // Extract video ID
  const match = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (!match) throw new Error('Could not extract YouTube video ID from URL');
  const videoId = match[1];

  // Fetch transcript
  let transcript;
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    transcript = segments.map(s => s.text).join(' ');
  } catch (err) {
    throw new Error(`Could not fetch YouTube transcript: ${err.message}. The video may not have captions enabled.`);
  }

  // Fetch video metadata via oEmbed (no API key needed)
  let videoTitle = `YouTube Video ${videoId}`;
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
    if (oembedRes.ok) {
      const meta = await oembedRes.json();
      videoTitle = meta.title || videoTitle;
    }
  } catch { /* ignore metadata errors */ }

  console.log(`[Convert] Video: "${videoTitle}" — transcript ${transcript.length} chars`);
  const post = await generateFromContent(transcript, videoTitle, videoUrl);
  saveDraft(post, videoTitle, videoUrl);
}

// ── Twitter / X ────────────────────────────────────────────────────────────────
async function convertTwitter(tweetUrl) {
  console.log(`[Convert] Twitter: ${tweetUrl}`);

  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) throw new Error('TWITTER_BEARER_TOKEN secret not set in GitHub Secrets');

  // Extract tweet ID
  const match = tweetUrl.match(/status\/(\d+)/);
  if (!match) throw new Error('Could not extract tweet ID from URL');
  const tweetId = match[1];

  // Fetch tweet via Twitter API v2
  const apiUrl = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text,author_id,conversation_id,created_at&expansions=author_id&user.fields=name,username`;
  const res = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${bearerToken}` }
  });

  if (!res.ok) throw new Error(`Twitter API error ${res.status}: ${await res.text()}`);
  const data = await res.json();

  if (!data.data) throw new Error('Tweet not found or not accessible');

  const authorName = data.includes?.users?.[0]?.name || 'Unknown';
  const authorUsername = data.includes?.users?.[0]?.username || 'unknown';
  const tweetText = data.data.text;
  const conversationId = data.data.conversation_id;

  // Try to fetch the thread (replies from same author in conversation)
  let threadText = tweetText;
  try {
    const threadRes = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${conversationId} from:${authorUsername}&tweet.fields=text,created_at&max_results=100`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );
    if (threadRes.ok) {
      const threadData = await threadRes.json();
      if (threadData.data?.length > 1) {
        const sorted = threadData.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        threadText = sorted.map(t => t.text).join('\n\n');
      }
    }
  } catch { /* use single tweet text if thread fetch fails */ }

  const sourceTitle = `Thread by @${authorUsername}: ${tweetText.slice(0, 80)}`;
  console.log(`[Convert] Thread by @${authorUsername} — ${threadText.length} chars`);
  const post = await generateFromContent(threadText, sourceTitle, tweetUrl);
  saveDraft(post, sourceTitle, tweetUrl);
}

// ── Podcast / RSS ──────────────────────────────────────────────────────────────
async function convertPodcast(podcastUrl) {
  console.log(`[Convert] Podcast: ${podcastUrl}`);

  const res = await fetch(podcastUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SacredRootsBot/1.0)' }
  });
  if (!res.ok) throw new Error(`Could not fetch URL: ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  const body = await res.text();

  let content, sourceTitle;

  if (contentType.includes('xml') || contentType.includes('rss') || body.trim().startsWith('<?xml')) {
    // RSS feed
    const parser = new RSSParser();
    const feed = await parser.parseString(body);
    const episode = feed.items?.[0];
    if (!episode) throw new Error('No episodes found in RSS feed');

    sourceTitle = episode.title || feed.title || 'Podcast Episode';
    const description = episode.contentSnippet || episode.content || episode.summary || episode.description || '';
    const notes = episode['content:encoded'] || description;
    content = `Episode: ${sourceTitle}\n\n${notes}`;
    console.log(`[Convert] RSS episode: "${sourceTitle}" — ${content.length} chars`);
  } else {
    // Episode page — extract with cheerio
    const $ = cheerio.load(body);
    sourceTitle = $('title').first().text().trim() || 'Podcast Episode';
    const selectors = ['article', 'main', '.episode-description', '.show-notes', '.content'];
    let extracted = '';
    for (const sel of selectors) {
      const text = $(sel).text().trim();
      if (text.length > 200) { extracted = text; break; }
    }
    if (!extracted) extracted = $('body').text().replace(/\s+/g, ' ').trim();
    content = extracted.slice(0, 8000);
    console.log(`[Convert] Episode page: "${sourceTitle}" — ${content.length} chars`);
  }

  const post = await generateFromContent(content, sourceTitle, podcastUrl);
  saveDraft(post, sourceTitle, podcastUrl);
}

// ── Any URL / Web Page ─────────────────────────────────────────────────────────
async function convertUrl(pageUrl) {
  console.log(`[Convert] Web page: ${pageUrl}`);

  const res = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SacredRootsBot/1.0)' }
  });
  if (!res.ok) throw new Error(`Could not fetch URL: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const sourceTitle = $('title').first().text().trim() ||
    $('h1').first().text().trim() || 'Web Article';

  // Extract main content in priority order
  const selectors = ['article', 'main', '[role="main"]', '.post-content', '.entry-content', '.article-body', '.content'];
  let content = '';
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      // Remove nav, aside, header, footer, scripts from selection
      el.find('nav, aside, header, footer, script, style, .ad, .advertisement').remove();
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 300) { content = text; break; }
    }
  }

  if (!content) {
    $('script, style, nav, footer, header, aside').remove();
    content = $('body').text().replace(/\s+/g, ' ').trim();
  }

  content = content.slice(0, 8000);
  console.log(`[Convert] Page: "${sourceTitle}" — ${content.length} chars`);

  const post = await generateFromContent(content, sourceTitle, pageUrl);
  saveDraft(post, sourceTitle, pageUrl);
}

// ── Entry point ────────────────────────────────────────────────────────────────
async function main() {
  const { type, url } = parseArgs();

  if (!type || !url) {
    console.error('Usage: node scripts/convert.js --type <youtube|twitter|podcast|url> --url <source-url>');
    process.exit(1);
  }

  if (type === 'youtube')  await convertYouTube(url);
  else if (type === 'twitter') await convertTwitter(url);
  else if (type === 'podcast') await convertPodcast(url);
  else if (type === 'url')     await convertUrl(url);
  else {
    console.error(`Unknown type: ${type}. Use: youtube | twitter | podcast | url`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Convert] Fatal:', err.message);
  process.exit(1);
});
