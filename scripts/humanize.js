import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readPosts, writePosts } from '../scanner/store.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a skilled human content writer for a spiritual wellness blog. Your job is to completely rewrite AI-generated blog posts so they:

1. Sound naturally human — conversational, warm, imperfect in the best way
2. Share less than 60% textual similarity with the original
3. Have a fresh title that captures the same topic but from a different angle
4. Keep the same category and spiritual/holistic brand voice
5. Maintain minimum 600 words with H2 subheadings
6. Feel like a real person wrote this from experience, not an AI

Avoid: overly polished prose, list-heavy structure, buzzword stacking, corporate wellness language.
Use: personal anecdotes (implied), rhetorical questions, varied sentence length, occasional informal phrasing.

Return strictly as a single JSON object with these fields:
- title (string) — new title, different angle from original
- slug (string) — URL-friendly version of new title
- hook (string) — 2 fresh sentences, personal and direct
- body (string) — full rewritten post in markdown, min 600 words
- metaDescription (string) — 155 char SEO summary

No markdown fences, no preamble. JSON only.`;

async function humanizePost(postId) {
  const posts = readPosts();
  const idx   = posts.findIndex(p => p.id === postId);

  if (idx === -1) {
    console.error(`[Humanize] Post not found: ${postId}`);
    process.exit(1);
  }

  const post = posts[idx];
  console.log(`[Humanize] Rewriting: "${post.title}"`);

  const userMessage = `Original post to rewrite:

Title: ${post.title}
Category: ${post.category}
Hook: ${post.hook}
Body:
${post.body}

Rewrite this completely. Change the title angle, humanize the voice, reduce similarity to under 60%. Same topic, fresh perspective.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }]
  });

  const raw = response.content[0].text.trim();

  let rewritten;
  try {
    rewritten = JSON.parse(raw);
  } catch {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    rewritten = JSON.parse(cleaned);
  }

  // Merge rewritten fields, preserve everything else
  posts[idx] = {
    ...post,
    title:           rewritten.title,
    slug:            rewritten.slug || slugify(rewritten.title),
    hook:            rewritten.hook,
    body:            rewritten.body,
    metaDescription: rewritten.metaDescription,
    humanized:       true,
    humanizedAt:     new Date().toISOString()
  };

  writePosts(posts);
  console.log(`[Humanize] Done: "${rewritten.title}"`);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// Entry point — post ID passed as CLI arg
const postId = process.argv[2];
if (!postId) {
  console.error('Usage: node scripts/humanize.js <post-id>');
  process.exit(1);
}

humanizePost(postId).catch(err => {
  console.error('[Humanize] Error:', err.message);
  process.exit(1);
});
