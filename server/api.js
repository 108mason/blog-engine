import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { authMiddleware } from './auth.js';
import {
  getPublishedPosts,
  getPublishedPost,
  getPostsByCategory,
  getDrafts,
  updateDraft,
  publishPost,
  unpublishPost,
  deleteDraft
} from './db.js';

const app = express();

// CORS — allow GitHub Pages domain + localhost
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://yourusername.github.io' // Replace with your GitHub Pages URL
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      cb(null, true);
    } else {
      cb(null, true); // Open for now; tighten after deploying
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ── Public Routes ──────────────────────────────────────────────────────────────

app.get('/api/posts', (req, res) => {
  try {
    res.json(getPublishedPosts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// IMPORTANT: specific routes before parameterized ones
app.get('/api/posts/category/:cat', (req, res) => {
  try {
    const posts = getPostsByCategory(req.params.cat);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posts/:slug', (req, res) => {
  try {
    const post = getPublishedPost(req.params.slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Protected Routes ──────────────────────────────────────────────────────────

app.get('/api/drafts', authMiddleware, (req, res) => {
  try {
    res.json(getDrafts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/drafts/:id', authMiddleware, (req, res) => {
  try {
    updateDraft(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/publish/:id', authMiddleware, (req, res) => {
  try {
    publishPost(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/unpublish/:id', authMiddleware, (req, res) => {
  try {
    unpublishPost(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drafts/:id', authMiddleware, (req, res) => {
  try {
    deleteDraft(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

export function startServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[API] Server listening on port ${port}`);
  });
}

export default app;
