// ── Config ────────────────────────────────────────────────────────────────────
const POSTS_URL        = './data/posts.json';
const BLOG_ENGINE_REPO = '108mason/blog-engine';
const SACRED_ROOTS     = '108mason/sacred-roots';
const GH_API           = 'https://api.github.com';

// Category → sacred-roots page + emoji + default sub-category
const CAT_MAP = {
  'Holistic Health': { file: 'health.html',        emoji: '🌿', sub: 'remedies' },
  'Manifestation':   { file: 'manifestation.html', emoji: '✨', sub: 'law-of-attraction' },
  'Supplements':     { file: 'supplements.html',   emoji: '🌱', sub: 'adaptogens' },
  'Lifestyle':       { file: 'lifestyle.html',      emoji: '☀️', sub: 'mindfulness' },
};

// ── Token ─────────────────────────────────────────────────────────────────────
const getToken        = () => localStorage.getItem('gh_pat') || '';
const saveToken       = t  => localStorage.setItem('gh_pat', t);
const getAnthropicKey = () => localStorage.getItem('anthropic_key') || '';
const saveAnthropicKey= t  => localStorage.setItem('anthropic_key', t);

// ── Social queue ───────────────────────────────────────────────────────────────
const SOCIAL_QUEUE_PATH = 'blog/data/social-queue.json';
let socialQueue = [];
let currentSocialPost = null;

// ── GitHub API helpers ────────────────────────────────────────────────────────
function ghHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
}

async function ghGet(repo, path) {
  const res = await fetch(`${GH_API}/repos/${repo}/contents/${path}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Returns existing file sha (for update) or undefined (for new file create)
async function ghGetSha(repo, path) {
  const res = await fetch(`${GH_API}/repos/${repo}/contents/${path}`, { headers: ghHeaders() });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  return (await res.json()).sha;
}

async function ghPut(repo, path, content, sha, message) {
  // GitHub requires base64 — handle UTF-8 safely
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const res = await fetch(`${GH_API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({ message, content: encoded, sha })
  });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Load posts.json ───────────────────────────────────────────────────────────
async function loadPosts() {
  const res = await fetch(`${POSTS_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error('Could not load posts.json');
  return res.json();
}

// ── Render ────────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timingClass(t) {
  return (t || '').replace(/\s/g, '');
}

function draftCard(post) {
  const cat     = CAT_MAP[post.category] || {};
  const timing  = post.publishTiming || '';
  const tags    = Array.isArray(post.tags) ? post.tags.join(', ') : '';

  return `
  <div class="draft-card" data-id="${post.id}">
    <div class="draft-header">
      <div>
        <div class="draft-title">${post.title || '(untitled)'}</div>
        <div class="draft-meta">
          <span class="badge badge-cat">${post.category || '—'}</span>
          <span class="badge badge-score">Score: ${post.relevanceScore || 0}</span>
          ${timing ? `<span class="badge badge-${timingClass(timing)}">${timing}</span>` : ''}
          ${post.sourceUrl ? `<a class="source-link" href="${post.sourceUrl}" target="_blank" rel="noopener">↗ Source</a>` : ''}
        </div>
      </div>
      <span class="draft-toggle">▼</span>
    </div>
    <div class="draft-expand">
      <div class="hook-box">${post.hook || ''}</div>

      <span class="field-label">Title</span>
      <input class="field" data-field="title" value="${esc(post.title || '')}" />

      <span class="field-label">Hook / Summary</span>
      <input class="field" data-field="hook" value="${esc(post.hook || '')}" />

      <span class="field-label">Category</span>
      <select class="field" data-field="category">
        ${Object.keys(CAT_MAP).map(c => `<option value="${c}" ${post.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>

      <span class="field-label">Full Body</span>
      <textarea class="field body-field" data-field="body" style="min-height:280px;font-family:monospace;font-size:.82rem;line-height:1.6">${esc(post.body || '')}</textarea>

      <div class="publish-row">
        <div>
          <label>Target page</label>
          <select class="field pub-target" style="min-width:190px">
            ${Object.entries(CAT_MAP).map(([k,v]) =>
              `<option value="${v.file}" data-emoji="${v.emoji}" data-sub="${v.sub}" ${post.category === k ? 'selected' : ''}>${v.file}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label>Sub-category (data-category)</label>
          <input class="field pub-sub" style="min-width:150px" value="${cat.sub || ''}" />
        </div>
        <div>
          <label>Emoji</label>
          <input class="field pub-emoji" style="max-width:80px" value="${cat.emoji || '🌿'}" />
        </div>
        <div style="margin-top:auto">
          <button class="btn btn-green pub-btn">📤 Publish to Sacred Roots</button>
        </div>
        <div style="margin-top:auto">
          <button class="btn btn-humanize hum-btn" title="Rewrite with Claude — <60% similarity, humanized voice">✨ Humanize</button>
        </div>
        <div style="margin-top:auto">
          <button class="btn btn-danger del-btn">🗑 Delete</button>
        </div>
      </div>
      <span class="field-label" style="margin-top:1rem">Affiliate Links <small style="text-transform:none;letter-spacing:0;font-weight:400">One per line: Product Name | https://amzn.to/...</small></span>
      <textarea class="field aff-links" style="min-height:72px;font-size:.82rem" placeholder="Ashwagandha Root | https://amzn.to/abc123&#10;Magnesium Glycinate | https://amzn.to/xyz456">${(post.affiliateLinks||[]).map(l=>l.name+'|'+l.url).join('\n')}</textarea>
      ${tags ? `<p style="font-size:.78rem;color:var(--muted);margin-top:.75rem">Tags: ${tags}</p>` : ''}
    </div>
  </div>`;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Render lists ──────────────────────────────────────────────────────────────
let allPosts = [];

function renderDrafts() {
  const drafts = allPosts.filter(p => p.status === 'draft');
  document.getElementById('draftCount').textContent = drafts.length;
  const el = document.getElementById('draftsList');
  el.innerHTML = drafts.length
    ? drafts.map(draftCard).join('')
    : '<p class="muted">No drafts. Run a scan to generate posts.</p>';
  bindDraftEvents();
}

function renderPublished() {
  const pubs = allPosts.filter(p => p.status === 'published');
  document.getElementById('pubCount').textContent = pubs.length;
  const el = document.getElementById('publishedList');
  el.innerHTML = pubs.length
    ? pubs.map(p => {
        const slug = p.slug || slugify(p.title);
        const url  = `https://108mason.github.io/sacred-roots/posts/${slug}.html`;
        return `
        <div class="pub-row">
          <div>
            <div class="pub-title">${p.title}</div>
            <div class="pub-meta">${p.category} · Published ${formatDate(p.publishedAt)}</div>
          </div>
          <a href="${url}" target="_blank" rel="noopener" class="btn btn-sm btn-green">↗ View</a>
        </div>`;
      }).join('')
    : '<p class="muted">Nothing published yet.</p>';
}

function updateStats() {
  const d = allPosts.filter(p => p.status === 'draft').length;
  const p = allPosts.filter(p => p.status === 'published').length;
  document.getElementById('statsBar').textContent = `${d} draft${d !== 1 ? 's' : ''} · ${p} published`;
}

// ── Event bindings ────────────────────────────────────────────────────────────
function bindDraftEvents() {
  // Toggle expand
  document.querySelectorAll('.draft-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const expand = hdr.nextElementSibling;
      const toggle = hdr.querySelector('.draft-toggle');
      expand.classList.toggle('open');
      toggle.classList.toggle('open');
    });
  });

  // Sync target page → emoji + sub defaults
  document.querySelectorAll('.pub-target').forEach(sel => {
    sel.addEventListener('change', () => {
      const opt  = sel.options[sel.selectedIndex];
      const card = sel.closest('.draft-card');
      card.querySelector('.pub-emoji').value = opt.dataset.emoji || '🌿';
      card.querySelector('.pub-sub').value   = opt.dataset.sub   || '';
    });
  });

  // Publish
  document.querySelectorAll('.pub-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!getToken()) { alert('Set your GitHub token in Settings first.'); return; }
      const card      = btn.closest('.draft-card');
      const id        = card.dataset.id;
      const post      = allPosts.find(p => p.id === id);
      const title     = card.querySelector('[data-field="title"]').value.trim();
      const hook      = card.querySelector('[data-field="hook"]').value.trim();
      const category  = card.querySelector('[data-field="category"]').value;
      const body      = card.querySelector('[data-field="body"]').value.trim();
      const target    = card.querySelector('.pub-target').value;
      const sub       = card.querySelector('.pub-sub').value.trim();
      const emoji     = card.querySelector('.pub-emoji').value.trim();
      const affLinks  = parseAffLinks(card.querySelector('.aff-links').value);

      btn.disabled = true;
      btn.textContent = '⏳ Publishing…';
      try {
        await injectIntoSacredRoots({ ...post, title, hook, category, body, affiliateLinks: affLinks }, target, sub, emoji);
        await markPublished(id, affLinks);
        toast(`✅ Published to ${target}`);
      } catch (err) {
        toast(`❌ ${err.message}`, true);
        btn.disabled = false;
        btn.textContent = '📤 Publish to Sacred Roots';
      }
    });
  });

  // Humanize
  document.querySelectorAll('.hum-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!getToken()) { alert('Set your GitHub token in Settings first.'); return; }
      const card  = btn.closest('.draft-card');
      const id    = card.dataset.id;
      const title = card.querySelector('[data-field="title"]').value.trim();

      if (!confirm(`Humanize & rewrite "${title}"?\n\nClaude will rewrite this post with <60% similarity and a fresh human voice.\n\nRefresh the hub in ~3 minutes to see the result.`)) return;

      btn.disabled = true;
      btn.textContent = '⏳ Queuing…';

      try {
        const res = await fetch(
          `${GH_API}/repos/${BLOG_ENGINE_REPO}/actions/workflows/humanize.yml/dispatches`,
          {
            method: 'POST',
            headers: ghHeaders(),
            body: JSON.stringify({ ref: 'master', inputs: { post_id: id } })
          }
        );
        if (res.status === 204) {
          btn.textContent = '✅ Queued';
          toast('✨ Humanize job started — refresh in ~3 minutes');
        } else {
          const err = await res.text();
          throw new Error(`Status ${res.status}: ${err}`);
        }
      } catch (err) {
        toast(`❌ ${err.message}`, true);
        btn.disabled = false;
        btn.textContent = '✨ Humanize';
      }
    });
  });

  // Delete
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.draft-card').dataset.id;
      if (!confirm('Delete this draft?')) return;
      await deleteDraft(id);
    });
  });
}

// ── Affiliate helpers ─────────────────────────────────────────────────────────
function parseAffLinks(raw) {
  return (raw || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [name, url] = l.split('|').map(s => s.trim());
    return name && url ? { name, url } : null;
  }).filter(Boolean);
}

// ── SEO helpers ───────────────────────────────────────────────────────────────
function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

function mdToHtml(md) {
  const lines = (md || '').split('\n');
  const out = [];
  let inList = false;
  for (const raw of lines) {
    const safe = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    if (/^### /.test(raw)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${safe.slice(4)}</h3>`);
    } else if (/^## /.test(raw)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${safe.slice(3)}</h2>`);
    } else if (/^- /.test(raw)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${safe.slice(2)}</li>`);
    } else if (raw.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${safe}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function buildPostPage(post, catFile, emoji, relatedPosts = []) {
  const slug      = post.slug || slugify(post.title);
  const catName   = post.category || 'Holistic Health';
  const dateISO   = new Date().toISOString();
  const dateStr   = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const desc      = (post.metaDescription || post.hook || '').replace(/"/g, '&quot;');
  const body      = mdToHtml(post.body);
  const title     = (post.title || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const hook      = (post.hook  || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const wordCount = (post.body || '').trim().split(/\s+/).length;
  const readTime  = Math.max(1, Math.round(wordCount / 200));
  const affLinks  = post.affiliateLinks || [];

  const productBlock = affLinks.length ? `
  <div class="affiliate-box">
    <h3>🌿 Recommended Products</h3>
    <div class="product-grid">
      ${affLinks.map(p => `<a href="${p.url}" class="product-card" target="_blank" rel="noopener sponsored"><span class="product-name">${p.name}</span><span class="product-cta">Shop on Amazon →</span></a>`).join('')}
    </div>
  </div>` : '';

  const relatedBlock = relatedPosts.length ? `
  <div class="related-posts">
    <h3>Related Articles</h3>
    <div class="related-grid">
      ${relatedPosts.map(p => {
        const s = p.slug || slugify(p.title);
        return `<a href="${s}.html" class="related-card"><div class="related-title">${p.title}</div><div class="related-meta">${p.category}</div></a>`;
      }).join('')}
    </div>
  </div>` : '';

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription || post.hook || '',
    datePublished: dateISO,
    author: { '@type': 'Organization', name: 'Sacred Roots Wellness' },
    publisher: { '@type': 'Organization', name: 'Sacred Roots Wellness', url: 'https://108mason.github.io/sacred-roots/' }
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Sacred Roots Wellness</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="https://108mason.github.io/sacred-roots/posts/${slug}.html" />
  <link rel="stylesheet" href="../css/style.css" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>" />
  <script type="application/ld+json">${schema}</script>
  <style>
    .post-body { max-width: 760px; margin: 0 auto; }
    .post-body h2 { font-family: var(--font-serif); color: var(--green-dark); margin: 2rem 0 .75rem; font-size: 1.5rem; }
    .post-body h3 { font-family: var(--font-serif); color: var(--green-dark); margin: 1.5rem 0 .5rem; font-size: 1.2rem; }
    .post-body p  { line-height: 1.85; margin-bottom: 1.25rem; color: var(--text-mid); }
    .post-body ul { margin: 0 0 1.25rem 1.5rem; color: var(--text-mid); line-height: 1.8; }
    .post-body li { margin-bottom: .4rem; }
    .post-body strong { color: var(--text-dark); }
    .post-meta-bar { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin-bottom:2rem; padding-bottom:1rem; border-bottom:1px solid var(--cream-dark); }
    .post-meta-bar .post-category { background:var(--green-light); color:var(--green-dark); padding:.2rem .75rem; border-radius:50px; font-size:.8rem; font-weight:700; }
    .post-meta-bar .post-date, .post-read-time { color:var(--text-light); font-size:.85rem; }
    .affiliate-disclosure { background:#FFFBEB; border-left:3px solid #F59E0B; padding:.6rem 1rem; border-radius:0 6px 6px 0; font-size:.78rem; color:#92400E; margin-bottom:1.5rem; }
    .affiliate-box { background:var(--cream); border:1px solid var(--cream-dark); border-radius:var(--radius-md); padding:1.5rem; margin:2rem 0; }
    .affiliate-box h3 { font-family:var(--font-serif); color:var(--green-dark); margin-bottom:1rem; font-size:1.1rem; }
    .product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:1rem; }
    .product-card { display:block; background:#fff; border:1px solid var(--cream-dark); border-radius:var(--radius-sm); padding:1rem; text-decoration:none; transition:var(--transition); }
    .product-card:hover { border-color:var(--green-sage); box-shadow:var(--shadow-sm); }
    .product-name { display:block; font-weight:600; color:var(--text-dark); margin-bottom:.5rem; font-size:.9rem; }
    .product-cta { display:block; color:var(--green-deep); font-size:.82rem; font-weight:600; }
    .related-posts { margin-top:3rem; padding-top:2rem; border-top:1px solid var(--cream-dark); }
    .related-posts h3 { font-family:var(--font-serif); color:var(--green-dark); margin-bottom:1.25rem; font-size:1.2rem; }
    .related-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:1rem; }
    .related-card { display:block; background:var(--cream); border:1px solid var(--cream-dark); border-radius:var(--radius-sm); padding:1rem; text-decoration:none; transition:var(--transition); }
    .related-card:hover { background:#fff; box-shadow:var(--shadow-sm); }
    .related-title { font-weight:600; color:var(--text-dark); font-size:.88rem; margin-bottom:.3rem; }
    .related-meta { color:var(--text-light); font-size:.78rem; }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="../index.html" class="logo"><div class="logo-icon">🌿</div><div class="logo-text"><span class="logo-name">Sacred Roots</span><span class="logo-tagline">Wellness &amp; Manifestation</span></div></a>
      <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="main-nav">
        <a href="../index.html"         class="nav-link">Home</a>
        <a href="../blog.html"          class="nav-link">Blog</a>
        <a href="../manifestation.html" class="nav-link">Manifestation</a>
        <a href="../health.html"        class="nav-link">Health &amp; Supplements</a>
        <a href="../lifestyle.html"     class="nav-link">Lifestyle</a>
        <a href="../ebook.html"         class="nav-link">eBook</a>
        <a href="../community.html"     class="nav-link">Community</a>
        <a href="../contact.html"       class="nav-link nav-cta">Contact</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="page-hero">
      <div class="container">
        <nav class="breadcrumb"><a href="../index.html">Home</a> <span>/</span> <a href="../${catFile}">${catName}</a> <span>/</span> <span>${title}</span></nav>
        <span class="section-label">${emoji} ${catName}</span>
        <h1>${title}</h1>
        <p>${hook}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <article class="post-body">
          <div class="post-meta-bar">
            <span class="post-category">${catName}</span>
            <span class="post-date">${dateStr}</span>
            <span class="post-read-time">~${readTime} min read</span>
          </div>
          <p class="affiliate-disclosure">⚠️ <strong>Disclosure:</strong> Sacred Roots may earn a small commission from links in this post, at no extra cost to you.</p>
          ${body}
          ${productBlock}
          ${relatedBlock}
        </article>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand"><a href="../index.html" class="logo" style="margin-bottom:1rem"><div class="logo-icon">🌿</div><div class="logo-text"><span class="logo-name">Sacred Roots</span><span class="logo-tagline">Wellness &amp; Manifestation</span></div></a><p class="footer-about">A sanctuary for seekers, dreamers, and conscious creators.</p><div class="footer-social"><a href="#" class="footer-social-link" aria-label="Facebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a><a href="#" class="footer-social-link" aria-label="Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a></div></div>
        <div><h4 class="footer-col-title">Explore</h4><ul class="footer-links"><li><a href="../blog.html">All Articles</a></li><li><a href="../manifestation.html">Manifestation</a></li><li><a href="../health.html">Holistic Health</a></li><li><a href="../supplements.html">Supplements</a></li><li><a href="../lifestyle.html">Lifestyle</a></li></ul></div>
        <div><h4 class="footer-col-title">Company</h4><ul class="footer-links"><li><a href="../community.html">Community</a></li><li><a href="../ebook.html">eBook</a></li><li><a href="../contact.html">Contact</a></li><li><a href="#">Privacy</a></li></ul></div>
        <div><h4 class="footer-col-title">Weekly Wisdom</h4><p class="footer-newsletter-desc">Sacred letters, every Sunday.</p><form class="footer-newsletter-form" novalidate><input type="email" class="footer-newsletter-input" placeholder="your@email.com" required /><button type="submit" class="footer-newsletter-btn">Subscribe →</button></form></div>
      </div>
      <div class="footer-bottom"><p>&copy; 2026 Sacred Roots Wellness. All rights reserved.</p><div class="footer-bottom-links"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a></div></div>
    </div>
  </footer>

  <script src="../js/main.js"></script>
</body>
</html>`;
}

// ── Publish: create post page + inject card into category page ────────────────
async function injectIntoSacredRoots(post, targetFile, sub, emoji) {
  const slug = post.slug || slugify(post.title);

  // 1. Create (or update) individual post page with full SEO meta
  const relatedPosts = allPosts.filter(p => p.status === 'published' && p.id !== post.id && p.category === post.category).slice(0, 3);
  const pageHtml    = buildPostPage(post, targetFile, emoji, relatedPosts);
  const existingSha = await ghGetSha(SACRED_ROOTS, `posts/${slug}.html`);
  await ghPut(SACRED_ROOTS, `posts/${slug}.html`, pageHtml, existingSha,
    `post: create page for "${post.title}"`);

  // 2. Inject card into category page with working Read link
  const fileData = await ghGet(SACRED_ROOTS, targetFile);
  const current  = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
  const date     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const newCard = `\n              <article class="post-card" data-category="${sub}">
                <div class="post-card-image">${emoji}</div>
                <div class="post-card-body">
                  <div class="post-card-meta"><span class="post-category">${post.category}</span><span class="post-date">${date}</span></div>
                  <h3>${post.title}</h3>
                  <p>${post.hook}</p>
                  <a href="posts/${slug}.html" class="post-card-link">Read</a>
                </div>
              </article>\n`;

  const MARKER = '<article class="post-card"';
  if (!current.includes(MARKER)) throw new Error(`Could not find post-card marker in ${targetFile}`);

  const updated = current.replace(MARKER, newCard + '              ' + MARKER);
  await ghPut(SACRED_ROOTS, targetFile, updated, fileData.sha,
    `post: add "${post.title}" to ${targetFile}`);

  // 3. Update sitemap
  await updateSitemap(slug);
}

async function updateSitemap(newSlug) {
  const BASE    = 'https://108mason.github.io/sacred-roots';
  const statics = ['', 'blog.html', 'health.html', 'manifestation.html', 'supplements.html', 'lifestyle.html'];
  const postSlugs = allPosts
    .filter(p => p.status === 'published')
    .map(p => p.slug || slugify(p.title));
  // Include the newly published slug in case allPosts isn't updated yet
  if (newSlug && !postSlugs.includes(newSlug)) postSlugs.unshift(newSlug);

  const urls = [
    ...statics.map(f => `${BASE}/${f}`),
    ...postSlugs.map(s => `${BASE}/posts/${s}.html`)
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;

  const sha = await ghGetSha(SACRED_ROOTS, 'sitemap.xml');
  await ghPut(SACRED_ROOTS, 'sitemap.xml', sitemap, sha, 'chore: update sitemap');
}

// ── Update posts.json in blog-engine repo ────────────────────────────────────
async function markPublished(id, affiliateLinks = []) {
  const fileData = await ghGet(BLOG_ENGINE_REPO, 'blog/data/posts.json');
  const posts    = JSON.parse(decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, '')))));
  const idx      = posts.findIndex(p => p.id === id);
  if (idx === -1) return;
  posts[idx].status      = 'published';
  posts[idx].publishedAt = new Date().toISOString();
  if (affiliateLinks.length) posts[idx].affiliateLinks = affiliateLinks;
  await ghPut(BLOG_ENGINE_REPO, 'blog/data/posts.json',
    JSON.stringify(posts, null, 2), fileData.sha,
    `chore: mark post "${posts[idx].title}" as published`);

  allPosts = posts;
  renderDrafts();
  renderPublished();
  updateStats();
}

async function deleteDraft(id) {
  const fileData = await ghGet(BLOG_ENGINE_REPO, 'blog/data/posts.json');
  const posts    = JSON.parse(decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, '')))));
  const title    = posts.find(p => p.id === id)?.title || id;
  const updated  = posts.filter(p => p.id !== id);
  await ghPut(BLOG_ENGINE_REPO, 'blog/data/posts.json',
    JSON.stringify(updated, null, 2), fileData.sha,
    `chore: delete draft "${title}"`);

  allPosts = updated;
  renderDrafts();
  renderPublished();
  updateStats();
}

// ── Social: load queue ────────────────────────────────────────────────────────
async function loadSocialQueue() {
  try {
    const res = await fetch(`./data/social-queue.json?t=${Date.now()}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ── Social: render tab ────────────────────────────────────────────────────────
function platformIcon(k) {
  return k === 'x' ? '𝕏' : k === 'facebook' ? 'f' : '📷';
}

function renderSocial() {
  const el   = document.getElementById('socialList');
  const pubs = allPosts.filter(p => p.status === 'published');

  const queueItems   = socialQueue.filter(i => i.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
  const recentPosted = socialQueue.filter(i => i.status !== 'scheduled').slice(-5).reverse();

  const renderItem = (item, isPosted) => {
    const platforms = Object.entries(item.platforms)
      .filter(([, v]) => v.enabled)
      .map(([k, v]) => {
        const cls = isPosted ? (v.posted ? `badge-${k}` : 'badge-failed') : `badge-${k}`;
        return `<span class="badge ${cls}">${platformIcon(k)} ${k}</span>`;
      }).join(' ');
    return `<div class="social-queue-item">
      <div>
        <div class="pub-title">${item.postTitle}</div>
        <div class="pub-meta">${isPosted ? 'Posted' : 'Scheduled'} ${formatDate(item.scheduledFor)} · ${platforms}</div>
      </div>
      <span class="badge badge-${item.status}">${item.status}</span>
    </div>`;
  };

  const queueHtml  = queueItems.length   ? `<h3 class="social-section-title">Scheduled</h3>${queueItems.map(i => renderItem(i, false)).join('')}` : '';
  const recentHtml = recentPosted.length ? `<h3 class="social-section-title" style="margin-top:1.25rem">Recently Posted</h3>${recentPosted.map(i => renderItem(i, true)).join('')}` : '';

  const pubsHtml = pubs.length ? `
    <h3 class="social-section-title" style="margin-top:1.25rem">Published Posts</h3>
    ${pubs.map(p => `
    <div class="pub-row">
      <div>
        <div class="pub-title">${p.title}</div>
        <div class="pub-meta">${p.category} · Published ${formatDate(p.publishedAt)}</div>
      </div>
      <button class="btn btn-sm btn-green btn-social-schedule" data-id="${p.id}">📣 Schedule</button>
    </div>`).join('')}
  ` : '<p class="muted">No published posts yet. Publish a draft first.</p>';

  el.innerHTML = `${queueHtml}${recentHtml}${pubsHtml}`;

  const pending = socialQueue.filter(i => i.status === 'scheduled').length;
  document.getElementById('socialCount').textContent = pending;

  document.querySelectorAll('.btn-social-schedule').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = allPosts.find(p => p.id === btn.dataset.id);
      if (post) openSocialModal(post);
    });
  });
}

// ── Social: open compose modal ────────────────────────────────────────────────
function openSocialModal(post) {
  currentSocialPost = post;
  document.getElementById('socialModalTitle').textContent =
    `Schedule: ${post.title.slice(0, 55)}${post.title.length > 55 ? '…' : ''}`;

  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('scheduledFor').value =
    `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T${pad(next.getHours())}:00`;

  document.getElementById('socialPlatforms').innerHTML = `
    <div class="platform-card" data-platform="x">
      <div class="platform-header">
        <label class="platform-toggle"><input type="checkbox" class="plat-enable" checked /> 𝕏 (Twitter / X)</label>
        <span class="char-counter" id="counter-x">0 / 280</span>
      </div>
      <textarea class="field plat-text" id="text-x" placeholder="Draft your X post…" style="min-height:80px"></textarea>
    </div>
    <div class="platform-card" data-platform="facebook">
      <div class="platform-header">
        <label class="platform-toggle"><input type="checkbox" class="plat-enable" checked /> Facebook</label>
      </div>
      <textarea class="field plat-text" id="text-facebook" placeholder="Draft your Facebook post…" style="min-height:110px"></textarea>
    </div>
    <div class="platform-card" data-platform="instagram">
      <div class="platform-header">
        <label class="platform-toggle"><input type="checkbox" class="plat-enable" /> Instagram</label>
        <span style="font-size:.75rem;color:var(--muted)">(requires image — optional)</span>
      </div>
      <textarea class="field plat-text" id="text-instagram" placeholder="Caption + hashtags…" style="min-height:110px"></textarea>
    </div>`;

  document.getElementById('text-x').addEventListener('input', function() {
    const c = document.getElementById('counter-x');
    c.textContent = `${this.value.length} / 280`;
    c.style.color  = this.value.length > 260 ? 'var(--red)' : 'var(--muted)';
  });

  document.getElementById('socialModal').classList.add('open');
}

// ── Social: draft with Claude ─────────────────────────────────────────────────
async function draftSocialPosts(post) {
  const key = getAnthropicKey();
  if (!key) { alert('Add your Anthropic API key in Settings first.'); return null; }

  const url = `https://108mason.github.io/sacred-roots/posts/${post.slug || slugify(post.title)}.html`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a social media manager for a spiritual wellness blog. Draft platform-optimized social posts. Return strict JSON only — no markdown, no preamble: { "x": "...", "facebook": "...", "instagram": "..." }. X: ≤280 chars, punchy opener, 2-3 hashtags, include URL. Facebook: 2-3 short paragraphs, warm/conversational, include URL at end. Instagram: engaging caption 150-300 chars then blank line then 20-25 relevant hashtags, no URL.',
      messages: [{ role: 'user', content: `Blog post:\nTitle: ${post.title}\nURL: ${url}\nHook: ${post.hook}\nCategory: ${post.category}\nTags: ${(post.tags||[]).join(', ')}` }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw  = data.content[0].text.trim().replace(/^```json\s*/i,'').replace(/^```/,'').replace(/```$/,'').trim();
  return JSON.parse(raw);
}

// ── Social: save to queue ─────────────────────────────────────────────────────
async function scheduleSocialPost(postId, platforms, scheduledFor) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) throw new Error('Post not found');

  const fileData = await ghGet(BLOG_ENGINE_REPO, SOCIAL_QUEUE_PATH);
  const queue    = JSON.parse(decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, '')))));

  queue.push({
    id: crypto.randomUUID(),
    postId,
    postTitle: post.title,
    postSlug:  post.slug || slugify(post.title),
    postUrl:   `https://108mason.github.io/sacred-roots/posts/${post.slug || slugify(post.title)}.html`,
    scheduledFor: new Date(scheduledFor).toISOString(),
    platforms,
    status: 'scheduled',
    createdAt: new Date().toISOString()
  });

  await ghPut(BLOG_ENGINE_REPO, SOCIAL_QUEUE_PATH,
    JSON.stringify(queue, null, 2), fileData.sha,
    `chore: schedule social post "${post.title}"`);

  socialQueue = queue;
  renderSocial();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'1.5rem', right:'1.5rem',
    background: isError ? '#DC2626' : '#2D6A4F',
    color:'#fff', padding:'.75rem 1.25rem',
    borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,.15)',
    zIndex:'9999', fontWeight:'600', fontSize:'.9rem'
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Settings modal ────────────────────────────────────────────────────────────
const modal = document.getElementById('settingsModal');
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('patInput').value          = getToken();
  document.getElementById('anthropicKeyInput').value = getAnthropicKey();
  modal.classList.add('open');
});
document.getElementById('closeSettings').addEventListener('click', () => modal.classList.remove('open'));
document.getElementById('savePat').addEventListener('click', () => {
  saveToken(document.getElementById('patInput').value.trim());
  saveAnthropicKey(document.getElementById('anthropicKeyInput').value.trim());
  modal.classList.remove('open');
  document.getElementById('noPat').style.display = 'none';
  toast('Settings saved');
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabDrafts').style.display    = btn.dataset.tab === 'drafts'    ? 'block' : 'none';
    document.getElementById('tabPublished').style.display = btn.dataset.tab === 'published' ? 'block' : 'none';
    document.getElementById('tabSocial').style.display    = btn.dataset.tab === 'social'    ? 'block' : 'none';
    if (btn.dataset.tab === 'social') renderSocial();
  });
});

// ── Run Scan button ───────────────────────────────────────────────────────────
document.getElementById('scanBtn').addEventListener('click', async () => {
  if (!getToken()) { alert('Set your GitHub token in Settings first.'); return; }
  const btn = document.getElementById('scanBtn');
  btn.disabled = true; btn.textContent = '⏳ Triggering…';
  try {
    const res = await fetch(
      `${GH_API}/repos/${BLOG_ENGINE_REPO}/actions/workflows/scan.yml/dispatches`,
      { method: 'POST', headers: ghHeaders(), body: JSON.stringify({ ref: 'master' }) }
    );
    if (res.status === 204) {
      toast('✅ Scan triggered — check Actions tab in ~3 mins');
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (err) {
    toast(`❌ ${err.message}`, true);
  } finally {
    btn.disabled = false; btn.textContent = '▶ Run Scan';
  }
});

// ── Social modal bindings ─────────────────────────────────────────────────────
document.getElementById('closeSocialModal').addEventListener('click', () => {
  document.getElementById('socialModal').classList.remove('open');
});

document.getElementById('draftAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('draftAllBtn');
  btn.disabled = true; btn.textContent = '⏳ Drafting…';
  try {
    const drafts = await draftSocialPosts(currentSocialPost);
    if (!drafts) return;
    if (drafts.x)         { document.getElementById('text-x').value         = drafts.x;         document.getElementById('text-x').dispatchEvent(new Event('input')); }
    if (drafts.facebook)  document.getElementById('text-facebook').value  = drafts.facebook;
    if (drafts.instagram) document.getElementById('text-instagram').value = drafts.instagram;
    toast('✅ Drafts ready — review and schedule');
  } catch (err) {
    toast(`❌ ${err.message}`, true);
  } finally {
    btn.disabled = false; btn.textContent = '✨ Draft with Claude';
  }
});

document.getElementById('confirmSchedule').addEventListener('click', async () => {
  if (!getToken()) { alert('Set your GitHub token in Settings first.'); return; }
  const scheduledFor = document.getElementById('scheduledFor').value;
  if (!scheduledFor) { alert('Pick a schedule date/time.'); return; }
  if (!currentSocialPost) return;

  const btn = document.getElementById('confirmSchedule');
  btn.disabled = true; btn.textContent = '⏳ Saving…';
  try {
    const platforms = {};
    document.querySelectorAll('#socialPlatforms .platform-card').forEach(card => {
      const p = card.dataset.platform;
      platforms[p] = {
        enabled: card.querySelector('.plat-enable').checked,
        text:    card.querySelector('.plat-text').value.trim(),
        posted:  false, postedAt: null, error: null
      };
    });
    if (!Object.values(platforms).some(v => v.enabled && v.text)) {
      alert('Enable at least one platform and add text.');
      btn.disabled = false; btn.textContent = 'Schedule'; return;
    }
    await scheduleSocialPost(currentSocialPost.id, platforms, scheduledFor);
    document.getElementById('socialModal').classList.remove('open');
    toast('📅 Post scheduled!');
  } catch (err) {
    toast(`❌ ${err.message}`, true);
    btn.disabled = false; btn.textContent = 'Schedule';
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  if (!getToken()) document.getElementById('noPat').style.display = 'block';

  try {
    [allPosts, socialQueue] = await Promise.all([loadPosts(), loadSocialQueue()]);
    renderDrafts();
    renderPublished();
    updateStats();
    document.getElementById('socialCount').textContent =
      socialQueue.filter(i => i.status === 'scheduled').length;
  } catch (err) {
    document.getElementById('draftsList').innerHTML = `<p class="muted">Could not load posts.json — ${err.message}</p>`;
  }
}

init();
