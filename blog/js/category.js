import { fetchPublished, cardHTML } from './posts.js';

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
  container.innerHTML = filtered.length
    ? filtered.map(cardHTML).join('')
    : '<p style="color:var(--muted);grid-column:1/-1">No posts in this category yet.</p>';
}

function setActiveFilter(cat) {
  activeCat = cat;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  updateHeading(cat);
  renderPosts(cat);

  const url = new URL(window.location);
  cat ? url.searchParams.set('cat', cat) : url.searchParams.delete('cat');
  window.history.replaceState({}, '', url);
}

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  setActiveFilter(btn.dataset.cat);
});

async function init() {
  container.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
  try {
    allPosts = await fetchPublished();
    setActiveFilter(activeCat);
  } catch {
    container.innerHTML = '<p style="color:var(--muted)">Could not load posts.</p>';
  }
}

init();
