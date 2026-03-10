import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadKeywords() {
  const raw = readFileSync(join(__dirname, '../data/keywords.json'), 'utf8');
  return JSON.parse(raw);
}

function normalize(text) {
  return (text || '').toLowerCase();
}

export function scoreArticle(article, keywords) {
  const text = normalize(`${article.title} ${article.summary}`);

  // Check exclusions first
  for (const word of keywords.exclude) {
    if (text.includes(normalize(word))) {
      return 0;
    }
  }

  let score = 0;

  for (const word of keywords.high_priority) {
    if (text.includes(normalize(word))) {
      score += 3;
    }
  }

  for (const word of keywords.medium_priority) {
    if (text.includes(normalize(word))) {
      score += 1;
    }
  }

  // Recency bonus: published within 48 hours
  const ageMs = Date.now() - new Date(article.publishedAt).getTime();
  const hours48 = 48 * 60 * 60 * 1000;
  if (ageMs < hours48) {
    score += 10;
  }

  return score;
}

export function filterArticles(articles) {
  const keywords = loadKeywords();
  const MIN_SCORE = 20;

  return articles
    .map(article => ({
      ...article,
      relevanceScore: scoreArticle(article, keywords)
    }))
    .filter(article => article.relevanceScore >= MIN_SCORE)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
