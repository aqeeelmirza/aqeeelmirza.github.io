/* Admin UI — content editor with GitHub publishing */
(function() {
  'use strict';

  // ===== State =====
  const State = {
    content: null,
    dirty: false,
    config: null, // {token, owner, repo, branch}
    activeTab: 'profile',
    activeListId: null
  };

  // ===== Storage =====
  const STORAGE_KEY = 'admin_config_v1';
  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(_) { return null; }
  }
  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }
  function clearConfig() { localStorage.removeItem(STORAGE_KEY); }

  // ===== Utilities =====
  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style') Object.assign(e.style, attrs[k]);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    children.flat().forEach(c => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function markDirty() {
    State.dirty = true;
    document.getElementById('saveBtn').classList.add('pulse');
    document.getElementById('dirtyDot').style.display = 'inline-block';
  }
  function clearDirty() {
    State.dirty = false;
    document.getElementById('saveBtn').classList.remove('pulse');
    document.getElementById('dirtyDot').style.display = 'none';
  }
  function toast(msg, tone = 'ok') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast visible ' + tone;
    setTimeout(() => t.classList.remove('visible'), 2400);
  }
  window.addEventListener('beforeunload', e => {
    if (State.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ===== GitHub API =====
  async function ghFetch(path, opts = {}) {
    const cfg = State.config;
    if (!cfg || !cfg.token) throw new Error('Not connected to GitHub');
    const res = await fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub ${res.status}: ${txt}`);
    }
    return res.json();
  }
  async function ghGetFileSha(path) {
    const cfg = State.config;
    try {
      const data = await ghFetch(`/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}?ref=${cfg.branch}`);
      return data.sha;
    } catch(_) { return null; }
  }
  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  async function ghPutFile(path, content, message) {
    const cfg = State.config;
    const sha = await ghGetFileSha(path);
    const body = {
      message,
      content: b64encode(content),
      branch: cfg.branch,
      ...(sha ? { sha } : {})
    };
    return ghFetch(`/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }
  async function ghPutBinaryFile(path, base64, message) {
    const cfg = State.config;
    const sha = await ghGetFileSha(path);
    const body = {
      message,
      content: base64,
      branch: cfg.branch,
      ...(sha ? { sha } : {})
    };
    return ghFetch(`/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }
  async function ghLoadContent() {
    const cfg = State.config;
    const data = await ghFetch(`/repos/${cfg.owner}/${cfg.repo}/contents/content.json?ref=${cfg.branch}`);
    return JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\s/g, '')))));
  }

  // ===== Field components =====

  function field(label, input, hint) {
    return el('div', { class: 'field' },
      el('label', {}, label),
      input,
      hint ? el('div', { class: 'hint' }, hint) : null
    );
  }
  function input(value, onInput, placeholder = '') {
    const i = el('input', { type: 'text', value: value || '', placeholder });
    i.addEventListener('input', e => { onInput(e.target.value); markDirty(); });
    return i;
  }
  function textarea(value, onInput, rows = 3) {
    const t = el('textarea', { rows });
    t.value = value || '';
    t.addEventListener('input', e => { onInput(e.target.value); markDirty(); });
    return t;
  }
  function select(options, value, onChange) {
    const s = el('select', {});
    options.forEach(o => {
      const opt = el('option', { value: o.value }, o.label);
      if (o.value === value) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener('change', e => { onChange(e.target.value); markDirty(); });
    return s;
  }
  function checkbox(value, onChange, label) {
    const id = uid('cb_');
    const c = el('input', { type: 'checkbox', id });
    c.checked = !!value;
    c.addEventListener('change', e => { onChange(e.target.checked); markDirty(); });
    return el('div', { class: 'check' }, c, el('label', { for: id }, label));
  }
  function numberInput(value, onInput) {
    const i = el('input', { type: 'number', value: value || '' });
    i.addEventListener('input', e => { onInput(parseInt(e.target.value, 10) || 0); markDirty(); });
    return i;
  }
  function repeater(items, onChange, itemLabel = 'item', authorMode = false) {
    const wrap = el('div', { class: 'repeater' });
    function render() {
      wrap.innerHTML = '';
      items.forEach((it, idx) => {
        const isSelf = authorMode && it.startsWith('*');
        const display = authorMode ? it.replace(/^\*/, '') : it;
        const i = el('input', { type: 'text', value: display });
        i.addEventListener('input', e => {
          items[idx] = authorMode && isSelf ? '*' + e.target.value : e.target.value;
          onChange(items); markDirty();
        });
        const row = el('div', { class: 'rep-row' }, i);
        if (authorMode) {
          const star = el('button', { class: 'rep-btn ' + (isSelf ? 'star-on' : ''), title: 'Mark as me', type: 'button' }, '★');
          star.addEventListener('click', () => {
            // toggle: if already self, unstar; else clear all stars first then star this
            if (isSelf) items[idx] = it.replace(/^\*/, '');
            else {
              for (let j = 0; j < items.length; j++) items[j] = items[j].replace(/^\*/, '');
              items[idx] = '*' + items[idx];
            }
            onChange(items); markDirty(); render();
          });
          row.appendChild(star);
        }
        const up = el('button', { class: 'rep-btn', title: 'Move up', type: 'button' }, '↑');
        up.disabled = idx === 0;
        up.addEventListener('click', () => {
          [items[idx-1], items[idx]] = [items[idx], items[idx-1]];
          onChange(items); markDirty(); render();
        });
        const down = el('button', { class: 'rep-btn', title: 'Move down', type: 'button' }, '↓');
        down.disabled = idx === items.length - 1;
        down.addEventListener('click', () => {
          [items[idx+1], items[idx]] = [items[idx], items[idx+1]];
          onChange(items); markDirty(); render();
        });
        const del = el('button', { class: 'rep-btn danger', title: 'Remove', type: 'button' }, '✕');
        del.addEventListener('click', () => {
          items.splice(idx, 1); onChange(items); markDirty(); render();
        });
        row.append(up, down, del);
        wrap.appendChild(row);
      });
      const add = el('button', { class: 'rep-add', type: 'button' }, '+ Add ' + itemLabel);
      add.addEventListener('click', () => {
        items.push(''); onChange(items); markDirty(); render();
      });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // ===== Tab renderers =====

  function renderProfileTab() {
    const p = State.content.profile;
    const wrap = el('div', { class: 'panel' });
    wrap.append(
      el('h2', {}, 'Profile'),
      field('Name', input(p.name, v => p.name = v)),
      field('Title', input(p.title, v => p.title = v)),
      field('Affiliation', input(p.affiliation, v => p.affiliation = v)),
      field('Photo path', input(p.photo, v => p.photo = v), 'e.g. PPP.JPG — relative to repo root'),
      field('CV URL', input(p.cvUrl, v => p.cvUrl = v)),
      el('h3', {}, 'Bio paragraphs'),
      el('div', { class: 'hint', style: { marginBottom: '8px' } }, 'Use **bold** and [link text](url) — basic markdown'),
      repeaterMulti(p.bioParagraphs, items => p.bioParagraphs = items, 'paragraph', true),
      el('h3', {}, 'Research interests'),
      repeater(p.interests, items => p.interests = items, 'interest'),
      el('h3', {}, 'Contact links'),
      field('Email', input(p.links.email, v => p.links.email = v)),
      field('Google Scholar', input(p.links.scholar, v => p.links.scholar = v)),
      field('GitHub', input(p.links.github, v => p.links.github = v)),
      field('LinkedIn', input(p.links.linkedin, v => p.links.linkedin = v)),
      field('ORCID', input(p.links.orcid, v => p.links.orcid = v))
    );
    return wrap;
  }

  function repeaterMulti(items, onChange, label, multiline = false) {
    const wrap = el('div', { class: 'repeater' });
    function render() {
      wrap.innerHTML = '';
      items.forEach((txt, idx) => {
        const i = multiline ? el('textarea', { rows: 3 }) : el('input', { type: 'text' });
        i.value = txt;
        i.addEventListener('input', e => { items[idx] = e.target.value; onChange(items); markDirty(); });
        const row = el('div', { class: 'rep-row' }, i);
        const up = el('button', { class: 'rep-btn', type: 'button' }, '↑');
        up.disabled = idx === 0;
        up.addEventListener('click', () => { [items[idx-1], items[idx]] = [items[idx], items[idx-1]]; onChange(items); markDirty(); render(); });
        const down = el('button', { class: 'rep-btn', type: 'button' }, '↓');
        down.disabled = idx === items.length - 1;
        down.addEventListener('click', () => { [items[idx+1], items[idx]] = [items[idx], items[idx+1]]; onChange(items); markDirty(); render(); });
        const del = el('button', { class: 'rep-btn danger', type: 'button' }, '✕');
        del.addEventListener('click', () => { items.splice(idx, 1); onChange(items); markDirty(); render(); });
        row.append(up, down, del);
        wrap.appendChild(row);
      });
      const add = el('button', { class: 'rep-add', type: 'button' }, '+ Add ' + label);
      add.addEventListener('click', () => { items.push(''); onChange(items); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  function renderListTab(key, label, schema, opts = {}) {
    const items = State.content[key] = State.content[key] || [];
    const wrap = el('div', { class: 'list-tab' });
    const sidebar = el('div', { class: 'list-sidebar' });
    const editor = el('div', { class: 'list-editor' });

    function addItem() {
      const blank = schema.blank();
      blank.id = uid(opts.idPrefix || key.charAt(0));
      items.unshift(blank);
      State.activeListId = blank.id;
      markDirty(); render();
    }

    function deleteItem(id) {
      if (!confirm('Delete this item?')) return;
      const idx = items.findIndex(i => i.id === id);
      if (idx >= 0) {
        items.splice(idx, 1);
        if (State.activeListId === id) State.activeListId = items[0] ? items[0].id : null;
        markDirty(); render();
      }
    }

    function moveItem(id, dir) {
      const idx = items.findIndex(i => i.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= items.length) return;
      [items[idx], items[j]] = [items[j], items[idx]];
      markDirty(); render();
    }

    function render() {
      wrap.innerHTML = '';
      sidebar.innerHTML = '';
      editor.innerHTML = '';

      const head = el('div', { class: 'list-head' },
        el('h2', {}, label),
        el('button', { class: 'btn btn-primary', type: 'button', onclick: addItem }, '+ New')
      );

      const ul = el('ul', { class: 'list-rows' });
      items.forEach((item, idx) => {
        const li = el('li', {
          class: 'list-row' + (item.id === State.activeListId ? ' active' : ''),
          onclick: () => { State.activeListId = item.id; render(); }
        },
          el('div', { class: 'list-row-title' }, schema.titleOf(item) || el('em', {}, '(untitled)')),
          el('div', { class: 'list-row-meta' }, schema.metaOf(item) || ''),
          el('div', { class: 'list-row-actions' },
            el('button', { class: 'rep-btn', type: 'button', title: 'Move up', onclick: e => { e.stopPropagation(); moveItem(item.id, -1); } }, '↑'),
            el('button', { class: 'rep-btn', type: 'button', title: 'Move down', onclick: e => { e.stopPropagation(); moveItem(item.id, 1); } }, '↓'),
            el('button', { class: 'rep-btn danger', type: 'button', title: 'Delete', onclick: e => { e.stopPropagation(); deleteItem(item.id); } }, '✕')
          )
        );
        ul.appendChild(li);
      });
      sidebar.append(head, ul);

      const active = items.find(i => i.id === State.activeListId);
      if (active) {
        editor.appendChild(schema.render(active, () => render()));
      } else if (items.length === 0) {
        editor.appendChild(el('div', { class: 'empty' }, 'No items yet. Click "+ New" to add one.'));
      } else {
        editor.appendChild(el('div', { class: 'empty' }, 'Select an item from the left.'));
      }

      wrap.append(sidebar, editor);
    }

    render();
    return wrap;
  }

  // ===== Schemas =====

  const NEWS_TYPES = [
    { value: 'paper', label: 'Paper' },
    { value: 'role', label: 'New role' },
    { value: 'visit', label: 'Visit' },
    { value: 'degree', label: 'Degree' },
    { value: 'award', label: 'Award' },
    { value: 'talk', label: 'Talk' }
  ];
  const VENUE_TIERS = [
    { value: 'main', label: 'Main conference / journal' },
    { value: 'workshop', label: 'Workshop' }
  ];

  const newsSchema = {
    blank: () => ({ id: '', date: '', type: 'paper', html: '' }),
    titleOf: n => n.html ? n.html.replace(/<[^>]+>/g, '').slice(0, 60) : '',
    metaOf: n => `${n.date} · ${n.type}`,
    render: (n, refresh) => el('div', { class: 'panel' },
      el('h3', {}, 'News item'),
      field('Date', input(n.date, v => { n.date = v; refresh(); }), 'e.g. "Apr 2026" or "Jun 2025"'),
      field('Type', select(NEWS_TYPES, n.type, v => { n.type = v; refresh(); })),
      field('Content (HTML allowed)', textarea(n.html, v => { n.html = v; refresh(); }, 4), 'Use <strong>bold</strong> and <a href="...">links</a>')
    )
  };

  const pubSchema = {
    blank: () => ({ id: '', year: new Date().getFullYear(), featured: false, selected: false, title: '', authors: ['*Muhammad Aqeel'], venue: '', venueTier: 'main', oral: false, thumb: '', links: {} }),
    titleOf: p => p.title,
    metaOf: p => `${p.year} · ${p.venue}${p.featured ? ' · ★' : ''}`,
    render: (p, refresh) => {
      const linksField = el('div', {},
        field('PDF URL', input((p.links || {}).pdf, v => { p.links = p.links || {}; p.links.pdf = v; })),
        field('Code URL', input((p.links || {}).code, v => { p.links = p.links || {}; p.links.code = v; })),
        field('Project URL', input((p.links || {}).project, v => { p.links = p.links || {}; p.links.project = v; }))
      );
      const thumbWrap = el('div', { class: 'thumb-wrap' });
      const thumbInput = input(p.thumb, v => { p.thumb = v; refreshThumb(); });
      const thumbPreview = el('div', { class: 'thumb-preview' });
      function refreshThumb() {
        thumbPreview.innerHTML = '';
        if (p.thumb) {
          const img = el('img', { src: p.thumb, alt: 'thumb' });
          img.onerror = () => { thumbPreview.innerHTML = '<span class="hint">(not found yet — upload below or commit the file)</span>'; };
          thumbPreview.appendChild(img);
        }
      }
      const fileInput = el('input', { type: 'file', accept: 'image/*' });
      fileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1];
          const ext = file.name.split('.').pop().toLowerCase();
          const filename = `spubs/${(p.id || uid('p_'))}.${ext}`;
          if (!State.config) {
            toast('Connect GitHub first to upload images', 'err');
            return;
          }
          try {
            await ghPutBinaryFile(filename, base64, `Upload thumbnail for ${p.title || 'pub'}`);
            p.thumb = filename;
            thumbInput.value = filename;
            refreshThumb();
            markDirty();
            toast('Image uploaded to ' + filename);
          } catch (err) {
            toast('Upload failed: ' + err.message, 'err');
          }
        };
        reader.readAsDataURL(file);
      });
      thumbWrap.append(thumbInput, thumbPreview, el('div', { class: 'hint' }, 'Or upload a new image:'), fileInput);
      refreshThumb();

      return el('div', { class: 'panel' },
        el('h3', {}, 'Publication'),
        field('Title', input(p.title, v => { p.title = v; refresh(); })),
        field('Year', numberInput(p.year, v => { p.year = v; refresh(); })),
        field('Authors',
          repeater(p.authors, items => { p.authors = items; refresh(); }, 'author', true),
          'Click ★ to mark yourself; bold styling will be applied on the site.'),
        field('Venue', input(p.venue, v => { p.venue = v; refresh(); }), 'e.g. "ICCV 2025", "IEEE Access 2025"'),
        field('Venue tier', select(VENUE_TIERS, p.venueTier, v => { p.venueTier = v; })),
        checkbox(p.oral, v => p.oral = v, 'Oral presentation'),
        checkbox(p.featured, v => { p.featured = v; refresh(); }, 'Featured (shown when "Selected" filter is active)'),
        checkbox(p.selected, v => { p.selected = v; refresh(); }, 'Show on home page (Selected publications)'),
        el('h4', {}, 'Thumbnail'),
        thumbWrap,
        el('h4', {}, 'Links'),
        linksField
      );
    }
  };

  const researchSchema = {
    blank: () => ({ id: '', title: '', summary: '', papers: [] }),
    titleOf: r => r.title,
    metaOf: r => `${(r.papers || []).length} papers`,
    render: (r, refresh) => {
      const allPubs = State.content.publications || [];
      const ids = r.papers || (r.papers = []);
      const checks = el('div', { class: 'pub-picker' });
      allPubs.forEach(p => {
        const id = uid('rp_');
        const cb = el('input', { type: 'checkbox', id });
        cb.checked = ids.includes(p.id);
        cb.addEventListener('change', () => {
          if (cb.checked) { if (!ids.includes(p.id)) ids.push(p.id); }
          else { const idx = ids.indexOf(p.id); if (idx >= 0) ids.splice(idx, 1); }
          markDirty(); refresh();
        });
        checks.appendChild(el('label', { for: id, class: 'pub-pick-row' }, cb,
          el('span', {}, `${p.year} — ${p.title}`)));
      });
      return el('div', { class: 'panel' },
        el('h3', {}, 'Research area'),
        field('Title', input(r.title, v => { r.title = v; refresh(); })),
        field('Summary', textarea(r.summary, v => { r.summary = v; }, 4), 'Use **bold** and [link](url)'),
        el('h4', {}, 'Linked publications'),
        checks
      );
    }
  };

  const timelineSchema = (label) => ({
    blank: () => ({ id: '', period: '', title: '', org: '', orgUrl: '', detail: '' }),
    titleOf: t => t.title,
    metaOf: t => t.period,
    render: (t, refresh) => el('div', { class: 'panel' },
      el('h3', {}, label),
      field('Period', input(t.period, v => { t.period = v; refresh(); }), 'e.g. "2022 – 2025" or "Jun 2025 – Nov 2025"'),
      field('Title', input(t.title, v => { t.title = v; refresh(); })),
      field('Organization', input(t.org, v => { t.org = v; refresh(); })),
      field('Organization URL (optional)', input(t.orgUrl, v => { t.orgUrl = v; })),
      field('Detail (optional)', textarea(t.detail, v => { t.detail = v; }, 3))
    )
  });

  // ===== Tabs =====

  const TABS = [
    { id: 'profile', label: 'Profile' },
    { id: 'news', label: 'News', schema: newsSchema, key: 'news' },
    { id: 'publications', label: 'Publications', schema: pubSchema, key: 'publications' },
    { id: 'research', label: 'Research', schema: researchSchema, key: 'research' },
    { id: 'grants', label: 'Grants', schema: timelineSchema('Grant'), key: 'grants' },
    { id: 'education', label: 'Education', schema: timelineSchema('Education entry'), key: 'education' },
    { id: 'experience', label: 'Experience', schema: timelineSchema('Experience entry'), key: 'experience' },
    { id: 'talks', label: 'Talks', schema: timelineSchema('Talk'), key: 'talks' },
    { id: 'service', label: 'Service', schema: timelineSchema('Service entry'), key: 'service' },
    { id: 'mentees', label: 'Mentoring', schema: timelineSchema('Mentee'), key: 'mentees' }
  ];

  function renderTabs() {
    const nav = document.getElementById('tabs');
    nav.innerHTML = '';
    TABS.forEach(t => {
      const btn = el('button', {
        class: 'tab' + (t.id === State.activeTab ? ' active' : ''),
        type: 'button',
        onclick: () => { State.activeTab = t.id; State.activeListId = null; renderTabs(); renderActive(); }
      }, t.label);
      nav.appendChild(btn);
    });
  }

  function renderActive() {
    const main = document.getElementById('editor');
    main.innerHTML = '';
    const tab = TABS.find(t => t.id === State.activeTab);
    if (tab.id === 'profile') {
      main.appendChild(renderProfileTab());
    } else {
      // ensure list exists
      State.content[tab.key] = State.content[tab.key] || [];
      // pre-select first item
      if (!State.activeListId && State.content[tab.key].length) {
        State.activeListId = State.content[tab.key][0].id;
      }
      main.appendChild(renderListTab(tab.key, tab.label, tab.schema, { idPrefix: tab.key.charAt(0) }));
    }
  }

  // ===== Connection / loading =====

  async function connectAndLoad(cfg) {
    State.config = cfg;
    saveConfig(cfg);
    document.getElementById('connectionPanel').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('repoLabel').textContent = `${cfg.owner}/${cfg.repo}@${cfg.branch}`;

    try {
      State.content = await ghLoadContent();
      toast('Loaded content.json from GitHub');
    } catch (e) {
      // Fall back to local file
      try {
        const res = await fetch('content.json', { cache: 'no-store' });
        State.content = await res.json();
        toast('Loaded local content.json (GitHub fetch failed)', 'warn');
      } catch (e2) {
        toast('Failed to load content: ' + e.message, 'err');
        return;
      }
    }
    State.activeTab = 'profile';
    renderTabs();
    renderActive();
    clearDirty();
  }

  async function tryLoadLocalOnly() {
    try {
      const res = await fetch('content.json', { cache: 'no-store' });
      State.content = await res.json();
      document.getElementById('connectionPanel').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      document.getElementById('repoLabel').textContent = '(local — no GitHub)';
      State.activeTab = 'profile';
      renderTabs();
      renderActive();
      clearDirty();
      toast('Editing locally. Use "Export JSON" to save.', 'warn');
    } catch (e) {
      toast('Cannot load content.json', 'err');
    }
  }

  async function publish() {
    if (!State.config) {
      toast('Connect GitHub to publish', 'err');
      return;
    }
    const json = JSON.stringify(State.content, null, 2);
    const msg = prompt('Commit message:', 'Update content.json');
    if (msg == null) return;
    document.getElementById('saveBtn').disabled = true;
    try {
      await ghPutFile('content.json', json, msg);
      clearDirty();
      toast('Published to GitHub');
    } catch (e) {
      toast('Publish failed: ' + e.message, 'err');
    } finally {
      document.getElementById('saveBtn').disabled = false;
    }
  }

  function exportJson() {
    const json = JSON.stringify(State.content, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'content.json' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Downloaded content.json');
  }

  // ===== Init =====

  function init() {
    // Wire connection form
    const form = document.getElementById('connForm');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const cfg = {
        token: form.token.value.trim(),
        owner: form.owner.value.trim(),
        repo: form.repo.value.trim(),
        branch: form.branch.value.trim() || 'main'
      };
      connectAndLoad(cfg);
    });
    document.getElementById('localOnlyBtn').addEventListener('click', tryLoadLocalOnly);
    document.getElementById('disconnectBtn').addEventListener('click', () => {
      if (State.dirty && !confirm('Unsaved changes will be lost. Continue?')) return;
      clearConfig(); location.reload();
    });
    document.getElementById('saveBtn').addEventListener('click', publish);
    document.getElementById('exportBtn').addEventListener('click', exportJson);
    document.getElementById('viewSiteBtn').addEventListener('click', () => window.open('index.html', '_blank'));

    const saved = loadConfig();
    if (saved && saved.token) {
      form.token.value = saved.token;
      form.owner.value = saved.owner || '';
      form.repo.value = saved.repo || '';
      form.branch.value = saved.branch || 'main';
      connectAndLoad(saved);
    } else {
      // prefill owner/repo if hosted on github pages
      const host = location.hostname;
      const m = host.match(/^([^.]+)\.github\.io$/);
      if (m) {
        form.owner.value = m[1];
        form.repo.value = m[1] + '.github.io';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
