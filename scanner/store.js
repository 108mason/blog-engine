import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_PATH = join(__dirname, '../blog/data/posts.json');

export function readPosts() {
  if (!existsSync(POSTS_PATH)) return [];
  return JSON.parse(readFileSync(POSTS_PATH, 'utf8'));
}

export function writePosts(posts) {
  writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2));
}

export function savePost(post) {
  const posts = readPosts();
  // Deduplicate by sourceUrl — never re-process the same article
  const alreadyExists = posts.some(p => p.sourceUrl === post.sourceUrl);
  if (alreadyExists) {
    console.log(`[Store] Skipping duplicate: ${post.sourceUrl}`);
    return null;
  }
  posts.unshift(post); // newest first
  writePosts(posts);
  return post;
}

export function getPublished() {
  return readPosts().filter(p => p.status === 'published');
}

export function getDrafts() {
  return readPosts().filter(p => p.status === 'draft');
}
