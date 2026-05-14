async function api(url, opts = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  if (r.status === 401) { location.href = '/admin/login.html'; throw new Error('未登录'); }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || '请求失败');
  }
  return r.json();
}

function escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg, type) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle('err', type === 'err');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function renderSidebar(active) {
  const items = [
    { href: '/admin/', key: 'dashboard', label: '总览' },
    { href: '/admin/products.html', key: 'products', label: '商品管理' },
    { href: '/admin/categories.html', key: 'categories', label: '分类管理' },
    { href: '/admin/orders.html', key: 'orders', label: '订单管理' },
    { href: '/admin/messages.html', key: 'messages', label: '留言反馈' },
    { href: '/admin/settings.html', key: 'settings', label: '网站设置' }
  ];
  return `
    <aside class="sidebar">
      <div class="side-brand">岱岭<small>Admin Console</small></div>
      <nav class="side-nav">
        ${items.map(it => `<a href="${it.href}" class="${it.key === active ? 'active' : ''}"><span>${it.label}</span></a>`).join('')}
      </nav>
      <div class="side-foot">
        <a href="/" target="_blank">查看前台 ↗</a>
        <a href="#" id="logoutBtn">退出登录</a>
      </div>
    </aside>
  `;
}

function bindLogout() {
  const el = document.getElementById('logoutBtn');
  if (!el) return;
  el.onclick = async (e) => {
    e.preventDefault();
    await fetch('/api/admin/logout', { method: 'POST' });
    location.href = '/admin/login.html';
  };
}

function modal(open) {
  const m = document.getElementById('modal');
  if (!m) return;
  m.classList.toggle('open', !!open);
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
