import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/blog.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT,
      slug TEXT UNIQUE,
      category TEXT,
      type TEXT,
      hook TEXT,
      body TEXT,
      metaDescription TEXT,
      tags TEXT,
      publishTiming TEXT,
      sourceTitle TEXT,
      sourceUrl TEXT,
      relevanceScore INTEGER,
      status TEXT DEFAULT 'draft',
      createdAt TEXT,
      publishedAt TEXT
    )
  `);
}

export function savePost(post) {
  const db = getDb();
  const id = post.id || uuidv4();
  const now = new Date().toISOString();

  // Ensure slug uniqueness by appending uuid suffix if collision exists
  let slug = post.slug || slugify(post.title);
  const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
  if (existing && existing.id !== id) {
    slug = `${slug}-${id.slice(0, 8)}`;
  }

  const stmt = db.prepare(`
    INSERT INTO posts (id, title, slug, category, type, hook, body, metaDescription, tags,
      publishTiming, sourceTitle, sourceUrl, relevanceScore, status, createdAt, publishedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, slug=excluded.slug, category=excluded.category,
      type=excluded.type, hook=excluded.hook, body=excluded.body,
      metaDescription=excluded.metaDescription, tags=excluded.tags,
      publishTiming=excluded.publishTiming, status=excluded.status,
      publishedAt=excluded.publishedAt
  `);

  stmt.run(
    id,
    post.title,
    slug,
    post.category,
    post.type,
    post.hook,
    post.body,
    post.metaDescription,
    Array.isArray(post.tags) ? JSON.stringify(post.tags) : post.tags,
    post.publishTiming,
    post.sourceTitle,
    post.sourceUrl,
    post.relevanceScore,
    post.status || 'draft',
    now,
    post.publishedAt || null
  );

  return { ...post, id, slug };
}

export function getPublishedPosts() {
  const db = getDb();
  return db.prepare("SELECT * FROM posts WHERE status='published' ORDER BY publishedAt DESC").all().map(deserialize);
}

export function getPublishedPost(slug) {
  const db = getDb();
  const post = db.prepare("SELECT * FROM posts WHERE slug=? AND status='published'").get(slug);
  return post ? deserialize(post) : null;
}

export function getPostsByCategory(category) {
  const db = getDb();
  return db.prepare("SELECT * FROM posts WHERE category=? AND status='published' ORDER BY publishedAt DESC").all(category).map(deserialize);
}

export function getDrafts() {
  const db = getDb();
  return db.prepare("SELECT * FROM posts WHERE status='draft' ORDER BY createdAt DESC").all().map(deserialize);
}

export function updateDraft(id, fields) {
  const db = getDb();
  const allowed = ['title', 'slug', 'category', 'type', 'hook', 'body', 'metaDescription', 'tags'];
  const updates = Object.entries(fields)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => [k, Array.isArray(v) ? JSON.stringify(v) : v]);

  if (!updates.length) return;

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = updates.map(([, v]) => v);

  db.prepare(`UPDATE posts SET ${setClause} WHERE id = ? AND status = 'draft'`).run(...values, id);
}

export function publishPost(id) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE posts SET status='published', publishedAt=? WHERE id=?").run(now, id);
}

export function unpublishPost(id) {
  const db = getDb();
  db.prepare("UPDATE posts SET status='draft', publishedAt=NULL WHERE id=?").run(id);
}

export function deleteDraft(id) {
  const db = getDb();
  db.prepare("DELETE FROM posts WHERE id=? AND status='draft'").run(id);
}

function deserialize(post) {
  return {
    ...post,
    tags: post.tags ? JSON.parse(post.tags) : []
  };
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}
