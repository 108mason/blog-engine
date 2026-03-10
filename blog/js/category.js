import { API_BASE, cardHTML } from './posts.js';

const container = document.getElementById('categoryPosts');
const heading   = document.getElementById('catHeading');
const subhead   = document.getElementById('catSubhead');
const filters   = document.getElementById('catFilters');

const CAT_ICONS = {
  'Manifestation':  '🌙',
  'Holistic Health':'🌿',
  'Supplements':    '🌱',
  'Lifestyle':      '☀️'
};

let allPosts = [];
let activeCat = new URLSearchParams(window.location.search).get('cat') || '';

// Update heading based on active category
function updateHeading(cat) {
  if (cat) {
    heading.textContent = `${CAT_ICONS[cat] || ''} ${cat}`;
    subhead.textContent = `All articles in ${cat}`;
    document.title = `${cat} — Rooted & Rising`;
  } else {
    heading.textContent = 'All Articles';
    subhead.textContent = 'Explore our full library of wisdom';
    document.title = 'Articles — Rooted & Rising';
  }
}

function renderPosts(cat) {
  const filtered = cat ? allPosts.filter(p => p.category === cat) : allPosts;
  if (!filtered.length) {
    container.innerHTML = '<p style="color:var(--muted);grid-column:1/-1">No posts in this category yet.</p>';
    return;
  }
  container.innerHTML = filtered.map(cardHTML).join('');
}

function setActiveFilter(cat) {
  activeCat = cat;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  updateHeading(cat);
  renderPosts(cat);

  // Update URL without reload
  const url = new URL(window.location);
  if (cat) {
    url.searchParams.set('cat', cat);
  } else {
    url.searchParams.delete('cat');
  }
  window.history.replaceState({}, '', url);
}

// Wire up filter buttons
filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  setActiveFilter(btn.dataset.cat);
});

// Initial data load
async function init() {
  container.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
  try {
    const res = await fetch(`${API_BASE}/api/posts`);
    allPosts = await res.json();
    setActiveFilter(activeCat);
  } catch (err) {
    container.innerHTML = '<p style="color:var(--muted)">Could not load posts. Make sure the API server is running.</p>';
  }
}

init();
