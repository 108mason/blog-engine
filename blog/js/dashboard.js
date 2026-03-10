const API_BASE = window.API_BASE_URL || 'http://localhost:3000';

const loginScreen   = document.getElementById('loginScreen');
const dashboardApp  = document.getElementById('dashboardApp');
const pwInput       = document.getElementById('pwInput');
const loginBtn      = document.getElementById('loginBtn');
const loginError    = document.getElementById('loginError');
const logoutBtn     = document.getElementById('logoutBtn');
const statsBar      = document.getElementById('statsBar');
const draftCount    = document.getElementById('draftCount');
const pubCount      = document.getElementById('pubCount');

let authToken = sessionStorage.getItem('dash_token') || '';

// ── Auth ─────────────────────────────────────────────────────────────────────

async function login() {
  const pw = pwInput.value.trim();
  if (!pw) return;

  // Verify by hitting a protected endpoint
  try {
    const res = await fetch(`${API_BASE}/api/drafts`, {
      headers: { 'Authorization': `Bearer ${pw}` }
    });
    if (res.ok) {
      authToken = pw;
      sessionStorage.setItem('dash_token', authToken);
      showDashboard();
    } else {
      loginError.style.display = 'block';
    }
  } catch (err) {
    loginError.textContent = 'Cannot reach API server. Is it running?';
    loginError.style.display = 'block';
  }
}

function logout() {
  authToken = '';
  sessionStorage.removeItem('dash_token');
  loginScreen.style.display = 'block';
  dashboardApp.style.display = 'none';
  pwInput.value = '';
}

loginBtn.addEventListener('click', login);
pwInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') login(); });
logoutBtn.addEventListener('click', logout);

function authHeaders() {
  return { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tabDrafts').style.display    = tab === 'drafts'    ? 'block' : 'none';
    document.getElementById('tabPublished').style.display = tab === 'published' ? 'block' : 'none';
  });
});

// ── Dashboard Init ────────────────────────────────────────────────────────────

async function showDashboard() {
  loginScreen.style.display  = 'none';
  dashboardApp.style.display = 'block';
  await Promise.all([loadDrafts(), loadPublished()]);
}

// ── Drafts ────────────────────────────────────────────────────────────────────

async function loadDrafts() {
  const list = document.getElementById('draftsList');
  list.innerHTML = '<p style="color:var(--muted)">Loading drafts…</p>';
  try {
    const res = await fetch(`${API_BASE}/api/drafts`, { headers: authHeaders() });
    const drafts = await res.json();
    draftCount.textContent = drafts.length;
    list.innerHTML = drafts.length
      ? drafts.map(draftCard).join('')
      : '<p style="color:var(--muted)">No drafts. Run a scan to generate posts.</p>';
    bindDraftEvents();
  } catch (err) {
    list.innerHTML = `<p style="color:#DC2626">Error: ${err.message}</p>`;
  }
}

function timingClass(timing) {
  return 'timing-' + (timing || '').replace(' ', '\\.');
}

function draftCard(post) {
  const tags = Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || '');
  return `
  <div class="draft-item" data-id="${post.id}">
    <div class="draft-summary">
      <div class="draft-info">
        <h3>${post.title || '(untitled)'}</h3>
        <div class="draft-badges">
          <span class="badge">${post.category || '—'}</span>
          <span class="score-pill">Score: ${post.relevanceScore || 0}</span>
          <span class="timing-badge timing-${(post.publishTiming || '').replace(' ', '')}">${post.publishTiming || ''}</span>
          ${post.type === 'Trending' ? '<span class="badge-type">Trending</span>' : ''}
        </div>
        ${post.sourceTitle ? `<small style="color:var(--muted);margin-top:.25rem;display:block">Source: ${post.sourceTitle}</small>` : ''}
      </div>
      <span style="color:var(--muted);font-size:1.2rem">▾</span>
    </div>
    <div class="draft-expand">
      <div class="hook-preview" style="background:var(--cream);padding:1rem;border-radius:6px;margin-bottom:1rem;font-style:italic;color:var(--muted)">
        ${post.hook || ''}
      </div>
      <label style="font-weight:700;font-size:.85rem;color:var(--green)">Title</label>
      <input class="edit-field" data-field="title" value="${escapeAttr(post.title || '')}" />
      <label style="font-weight:700;font-size:.85rem;color:var(--green)">Category</label>
      <select class="edit-field" data-field="category">
        ${['Manifestation','Holistic Health','Supplements','Lifestyle'].map(c =>
          `<option value="${c}" ${post.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <label style="font-weight:700;font-size:.85rem;color:var(--green)">Body</label>
      <textarea class="edit-field" data-field="body">${escapeHTML(post.body || '')}</textarea>
      <div class="draft-actions">
        <button class="btn-publish" data-action="publish">✅ Publish</button>
        <button class="btn-save"    data-action="save">💾 Save Changes</button>
        <button class="btn-delete"  data-action="delete">🗑️ Delete</button>
      </div>
    </div>
  </div>`;
}

function bindDraftEvents() {
  document.querySelectorAll('.draft-summary').forEach(summary => {
    summary.addEventListener('click', () => {
      const expand = summary.nextElementSibling;
      expand.classList.toggle('open');
    });
  });

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = btn.closest('.draft-item');
      const id   = item.dataset.id;
      const action = btn.dataset.action;

      if (action === 'publish') {
        await fetch(`${API_BASE}/api/publish/${id}`, { method: 'POST', headers: authHeaders() });
        await Promise.all([loadDrafts(), loadPublished()]);
      }

      if (action === 'save') {
        const fields = {};
        item.querySelectorAll('[data-field]').forEach(el => {
          fields[el.dataset.field] = el.value;
        });
        await fetch(`${API_BASE}/api/drafts/${id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify(fields)
        });
        showToast('Changes saved');
      }

      if (action === 'delete') {
        if (!confirm('Delete this draft permanently?')) return;
        await fetch(`${API_BASE}/api/drafts/${id}`, { method: 'DELETE', headers: authHeaders() });
        await loadDrafts();
      }
    });
  });
}

// ── Published Posts ───────────────────────────────────────────────────────────

async function loadPublished() {
  const list = document.getElementById('publishedList');
  try {
    const res = await fetch(`${API_BASE}/api/posts`, { headers: authHeaders() });
    const posts = await res.json();
    pubCount.textContent = posts.length;

    if (!posts.length) {
      list.innerHTML = '<p style="color:var(--muted)">No published posts yet.</p>';
      return;
    }

    list.innerHTML = posts.map(p => `
      <div class="draft-item" data-id="${p.id}" style="margin-bottom:.75rem">
        <div class="draft-summary">
          <div class="draft-info">
            <h3>${p.title}</h3>
            <div class="draft-badges">
              <span class="badge">${p.category}</span>
              <small style="color:var(--muted)">Published: ${new Date(p.publishedAt).toLocaleDateString()}</small>
            </div>
          </div>
          <button class="btn-delete" data-pub-id="${p.id}" style="padding:.4rem .9rem;border:none;border-radius:6px;cursor:pointer;font-weight:700;background:#FEF3C7;color:#D97706">Unpublish</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-pub-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`${API_BASE}/api/unpublish/${btn.dataset.pubId}`, { method: 'POST', headers: authHeaders() });
        await Promise.all([loadDrafts(), loadPublished()]);
      });
    });
  } catch (err) {
    list.innerHTML = `<p style="color:#DC2626">Error: ${err.message}</p>`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'2rem', right:'2rem',
    background:'var(--green)', color:'#fff',
    padding:'.75rem 1.5rem', borderRadius:'8px',
    boxShadow:'0 4px 16px rgba(0,0,0,.15)', zIndex:'9999',
    fontWeight:'700', fontSize:'.95rem'
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── Auto-init ─────────────────────────────────────────────────────────────────
if (authToken) {
  showDashboard();
}
