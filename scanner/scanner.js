import Parser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// User-Agent required by Reddit and some other feeds
const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; blog-engine/1.0; +https://github.com/108mason/blog-engine)' }
});

function loadSources() {
  const raw = readFileSync(join(__dirname, '../data/sources.json'), 'utf8');
  return JSON.parse(raw).rss_feeds;
}

async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map(item => ({
      id: uuidv4(),
      title: item.title || '',
      url: item.link || item.guid || '',
      summary: item.contentSnippet || item.summary || item.content || '',
      source: feed.title || new URL(url).hostname,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      relevanceScore: null,
      status: 'pending'
    }));
  } catch (err) {
    console.warn(`[Scanner] Failed to fetch ${url}: ${err.message}`);
    return [];
  }
}

export async function fetchAllFeeds() {
  const sources = loadSources();
  const results = await Promise.allSettled(sources.map(fetchFeed));
  const articles = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }
  console.log(`[Scanner] Fetched ${articles.length} articles from ${sources.length} feeds`);
  return articles;
}
