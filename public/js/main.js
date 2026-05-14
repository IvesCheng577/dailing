async function api(url, opts = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败');
  }
  return r.json();
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

function escape(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function productCard(p) {
  const a = document.createElement('a');
  a.className = 'product';
  a.href = `/product.html?id=${p.id}`;

  const tag = p.featured ? `<div class="product-tag">臻品</div>` : '';
  const img = p.image
    ? `<div class="product-img"><img src="${escape(p.image)}" alt="${escape(p.name)}">${tag}</div>`
    : `<div class="product-img placeholder" data-text="${escape(p.name.slice(0, 1))}">${tag}</div>`;

  a.innerHTML = `
    ${img}
    <div class="product-cat">${escape(p.catName || '')}</div>
    <h3>${escape(p.name)}</h3>
    <div class="product-origin">产地 · ${escape(p.origin || '')}</div>
    <div class="product-price">
      <span class="currency">¥</span>
      <span class="num">${p.price}</span>
      <span class="unit">${escape(p.unit || '')}</span>
    </div>
  `;
  return a;
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

// ===== Settings binding =====
// Elements with [data-bind="path.to.value"] get their text content set.
// Elements with [data-bind-attr="attrName:path.to.value"] get an attr set.
// Elements with [data-bind-html="path"] get innerHTML (newlines → <br>).
// Elements with [data-bind-bg="path"] get background-image style.
function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function nl2br(s) {
  return escape(s || '').replace(/\n/g, '<br>');
}

async function applySettings() {
  let settings;
  try {
    settings = await api('/api/settings');
    window.__settings = settings;
  } catch (e) { return; }

  document.querySelectorAll('[data-bind]').forEach(el => {
    const v = getByPath(settings, el.getAttribute('data-bind'));
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-bind-html]').forEach(el => {
    const v = getByPath(settings, el.getAttribute('data-bind-html'));
    if (v != null) el.innerHTML = nl2br(v);
  });
  document.querySelectorAll('[data-bind-attr]').forEach(el => {
    const spec = el.getAttribute('data-bind-attr'); // "href:phone" or "title:brand"
    const [attr, path] = spec.split(':');
    const v = getByPath(settings, path);
    if (v != null) el.setAttribute(attr, v);
  });
  document.querySelectorAll('[data-bind-bg]').forEach(el => {
    const v = getByPath(settings, el.getAttribute('data-bind-bg'));
    if (v) {
      el.style.backgroundImage = `linear-gradient(rgba(31,51,41,0.55), rgba(31,51,41,0.55)), url("${v}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.classList.add('has-bg');
    }
  });

  // tel: link
  document.querySelectorAll('[data-tel]').forEach(el => {
    if (settings.phone) {
      el.href = 'tel:' + String(settings.phone).replace(/\s/g, '');
      el.textContent = settings.phone;
    }
  });
}

// auto-run when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applySettings);
} else {
  applySettings();
}
