import Anthropic from '@anthropic-ai/sdk';
import { savePost } from '../server/db.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a content writer for a spiritual wellness blog targeting the manifestation and holistic health community. Your tone is inspirational, warm, and spiritually grounded. Never use clinical or pharmaceutical language.

Given a source article, generate a complete blog post draft including:
1. title — compelling, spiritual/inspirational tone
2. slug — URL-friendly version of title
3. category — one of: Manifestation | Holistic Health | Supplements | Lifestyle
4. type — Trending or Evergreen
5. hook — 2 sentence intro that pulls the reader in
6. body — full blog post, minimum 600 words, with H2 subheadings, written in brand voice
7. metaDescription — 155 character SEO summary
8. tags — array of 5 relevant tags
9. publishTiming — ASAP | This Week | This Month
10. sourceTitle — original article title
11. sourceUrl — original article URL
12. relevanceScore — passed in from scorer

Return strictly as a single JSON object. No markdown, no preamble.`;

export async function generatePost(article) {
  const userMessage = `Source article:
Title: ${article.title}
URL: ${article.url}
Summary: ${article.summary}
Relevance Score: ${article.relevanceScore}

Generate a complete blog post draft based on this source.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    });

    const raw = response.content[0].text.trim();
    const post = JSON.parse(raw);

    // Merge in fields from the article that Claude might not have set correctly
    post.sourceTitle = article.title;
    post.sourceUrl = article.url;
    post.relevanceScore = article.relevanceScore;
    post.status = 'draft';

    savePost(post);
    console.log(`[IdeaGen] Saved draft: "${post.title}"`);
    return post;
  } catch (err) {
    console.error(`[IdeaGen] Failed to generate post for "${article.title}": ${err.message}`);
    return null;
  }
}

export async function generateAllPosts(articles) {
  const results = [];
  for (const article of articles) {
    // Throttle: avoid hammering the API
    const post = await generatePost(article);
    if (post) results.push(post);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`[IdeaGen] Generated ${results.length} draft posts`);
  return results;
}
