// ── Config ──────────────────────────────────────────────────────────────────
// Replace with your Railway/Render URL after deploying
const API_BASE = window.API_BASE_URL || 'http://localhost:3000';

// ── Utilities ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function cardHTML(post) {
  const date = formatDate(post.publishedAt);
  const tags = Array.isArray(post.tags) ? post.tags.join(', ') : '';
  return `
    <div class="card" style="animation-delay:${Math.random() * .3}s">
      <div class="card-body">
        <div class="card-meta">
          <span class="badge">${post.category || ''}</span>
          ${post.type === 'Trending' ? '<span class="badge-type">Trending</span>' : ''}
        </div>
        <h3><a href="post.html?slug=${encodeURIComponent(post.slug)}">${post.title}</a></h3>
        <p>${post.hook || ''}</p>
      </div>
      <div class="card-footer">
        <span class="card-date">${date}</span>
        <a href="post.html?slug=${encodeURIComponent(post.slug)}" class="btn btn-green" style="padding:.35rem .85rem;font-size:.8rem">Read →</a>
      </div>
    </div>`;
}

// ── Homepage: Featured Posts ─────────────────────────────────────────────────

async function loadFeaturedPosts() {
  const container = document.getElementById('featuredPosts');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/posts`);
    const posts = await res.json();
    const featured = posts.slice(0, 6);

    if (!featured.length) {
      container.innerHTML = '<p style="color:var(--muted)">No posts published yet. Check back soon!</p>';
      return;
    }

    container.innerHTML = featured.map(cardHTML).join('');
  } catch (err) {
    container.innerHTML = `<p style="color:var(--muted)">Could not connect to API. Start the server with <code>node index.js</code></p>`;
  }
}

// ── Single Post Page ─────────────────────────────────────────────────────────

async function loadSinglePost() {
  const container = document.getElementById('postContent');
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    container.innerHTML = '<p style="text-align:center;padding:4rem">No post specified.</p>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Not found');
    const post = await res.json();

    document.title = `${post.title} — Rooted & Rising`;
    document.getElementById('pageDesc').content = post.metaDescription || '';

    const tags = Array.isArray(post.tags) ? post.tags : [];
    const bodyHTML = typeof marked !== 'undefined' ? marked.parse(post.body || '') : (post.body || '').replace(/\n/g, '<br>');

    container.innerHTML = `
      <div class="post-header">
        <div class="card-meta">
          <span class="badge">${post.category || ''}</span>
          ${post.type === 'Trending' ? '<span class="badge-type">Trending</span>' : ''}
        </div>
        <h1>${post.title}</h1>
        <p class="post-meta">
          <span>Published ${formatDate(post.publishedAt)}</span>
          ${tags.length ? `<span>Tags: ${tags.join(', ')}</span>` : ''}
        </p>
      </div>
      <div class="post-body">${bodyHTML}</div>
      ${post.sourceUrl ? `
        <div class="post-source">
          Inspired by: <a href="${post.sourceUrl}" target="_blank" rel="noopener">${post.sourceTitle || post.sourceUrl}</a>
        </div>` : ''}
      <div class="share-row">
        <span>Share:</span>
        <button class="share-btn share-x" onclick="shareX('${encodeURIComponent(post.title)}')">𝕏 Share</button>
        <button class="share-btn share-fb" onclick="shareFB()">Facebook</button>
        <button class="share-btn share-copy" onclick="copyLink()">Copy Link</button>
      </div>`;

    // Load related posts
    loadRelatedPosts(post.category, post.slug);
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;padding:4rem;color:var(--muted)">Post not found.</p>';
  }
}

async function loadRelatedPosts(category, currentSlug) {
  if (!category) return;
  try {
    const res = await fetch(`${API_BASE}/api/posts/category/${encodeURIComponent(category)}`);
    const posts = await res.json();
    const related = posts.filter(p => p.slug !== currentSlug).slice(0, 3);
    if (!related.length) return;

    const section = document.getElementById('relatedSection');
    const container = document.getElementById('relatedPosts');
    if (section && container) {
      section.style.display = 'block';
      container.innerHTML = related.map(cardHTML).join('');
    }
  } catch (_) {}
}

// ── Share Helpers ─────────────────────────────────────────────────────────────

window.shareX = (title) => {
  window.open(`https://twitter.com/intent/tweet?text=${title}&url=${encodeURIComponent(window.location.href)}`, '_blank');
};
window.shareFB = () => {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
};
window.copyLink = () => {
  navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied!'));
};

// ── Auto-init ─────────────────────────────────────────────────────────────────

if (document.getElementById('featuredPosts')) loadFeaturedPosts();
if (document.getElementById('postContent'))  loadSinglePost();

export { API_BASE, cardHTML, formatDate };
