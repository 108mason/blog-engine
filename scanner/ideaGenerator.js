import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { savePost } from './store.js';

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
13. recommendedProducts — array of 3-5 specific product names (supplements, books, tools) relevant to this post that could be sold as Amazon affiliate products. Use real, well-known product names (e.g. "Garden of Life Magnesium", "Organic Ashwagandha by Himalaya"). Just product names, no URLs.

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

    const saved = savePost({
      ...post,
      id: uuidv4(),
      sourceTitle: article.title,
      sourceUrl: article.url,
      relevanceScore: article.relevanceScore,
      status: 'draft',
      createdAt: new Date().toISOString(),
      publishedAt: null
    });

    if (saved) console.log(`[IdeaGen] Saved draft: "${post.title}"`);
    return saved;
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
