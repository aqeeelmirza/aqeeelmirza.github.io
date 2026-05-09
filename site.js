/* Site renderer — loads content.json and renders all sections */
(function() {
  'use strict';

  const ICONS = {
    paper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    role:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    visit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    degree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    award:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
    talk:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  };

  const TYPE_LABELS = { paper: 'Paper', role: 'New role', visit: 'Visit', degree: 'Degree', award: 'Award', talk: 'Talk' };

  // Markdown-light: **bold** and [text](url)
  function md(text) {
    if (!text) return '';
    const escaped = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function authorList(authors) {
    return authors.map(a => {
      if (a.startsWith('*')) return `<span class="author-self">${a.slice(1)}</span>`;
      return a;
    }).join(', ');
  }

  function pubLinksInline(p) {
    const parts = [];
    if (p.links && p.links.pdf) parts.push(`<a href="${p.links.pdf}" target="_blank" rel="noopener">PDF</a>`);
    if (p.links && p.links.code) parts.push(`<a href="${p.links.code}" target="_blank" rel="noopener">Code</a>`);
    if (p.links && p.links.project) parts.push(`<a href="${p.links.project}" target="_blank" rel="noopener">Project</a>`);
    parts.push(`<button class="bibtex-btn" data-bibtex-id="${p.id}">BibTeX</button>`);
    return parts.join('<span class="sep">·</span>');
  }

  function makeBibtex(p) {
    const firstAuthor = p.authors[0].replace(/^\*/, '').split(' ').slice(-1)[0].toLowerCase();
    const key = `${firstAuthor}${p.year}${p.title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const authorString = p.authors.map(a => a.replace(/^\*/, '')).join(' and ');
    const venueClean = p.venue;
    const isJournal = /access|journal|trans/i.test(venueClean);
    const type = isJournal ? '@article' : '@inproceedings';
    const venueField = isJournal ? 'journal' : 'booktitle';
    return `${type}{${key},
  title={${p.title}},
  author={${authorString}},
  ${venueField}={${venueClean}},
  year={${p.year}}
}`;
  }

  // ===== Renderers =====

  function renderHeader(profile) {
    const interests = profile.interests.map(i => `<span class="interest-pill">${i}</span>`).join('');
    return `
      <div class="profile-block">
        <div class="profile-image" id="profileImage">
          <span class="profile-initials" aria-hidden="true">${profile.name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>
          <img src="${profile.photo}" alt="${profile.name}" id="profileImg">
        </div>
        <a href="${profile.cvUrl}" class="cv-icon" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download CV
        </a>
      </div>
      <div class="header-info">
        <h1 class="name">${profile.name}</h1>
        <p class="affiliation"><strong>${profile.title}</strong><br>${profile.affiliation}</p>
        <div class="interests" aria-label="Research interests">${interests}</div>
        <div class="contact-icons">
          <a href="mailto:${profile.links.email}" class="contact-icon" title="Email" aria-label="Email">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </a>
          <a href="${profile.links.scholar}" class="contact-icon" title="Google Scholar" target="_blank" rel="noopener" aria-label="Google Scholar">
            <svg viewBox="0 0 24 24" class="scholar-icon" aria-hidden="true"><path d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-24L0 9.5l4.838 3.94A8 8 0 0 1 12 9a8 8 0 0 1 7.162 4.44L24 9.5z"/></svg>
          </a>
          <a href="${profile.links.github}" class="contact-icon" title="GitHub" target="_blank" rel="noopener" aria-label="GitHub">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.776.42-1.305.762-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.467-2.38 1.236-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <a href="${profile.links.linkedin}" class="contact-icon" title="LinkedIn" target="_blank" rel="noopener" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
          <a href="${profile.links.orcid}" class="contact-icon" title="ORCID" target="_blank" rel="noopener" aria-label="ORCID">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 01-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"/></svg>
          </a>
        </div>
        <a href="${profile.cvUrl}" class="cv-icon cv-icon-mobile" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download CV
        </a>
      </div>`;
  }

  function renderBio(paragraphs) {
    return paragraphs.map(p => `<p>${md(p)}</p>`).join('');
  }

  function renderHomeNews(news) {
    const items = news.slice(0, 4).map(n => `
      <div class="news-item">
        <span class="news-date">${n.date}</span>
        <span class="news-icon ${n.type}" role="img" aria-label="${TYPE_LABELS[n.type] || ''}">${ICONS[n.type] || ICONS.paper}</span>
        <span class="news-content">${n.html}</span>
      </div>`).join('');
    return items + `<div class="see-all-news"><a href="#news" class="show-all-news">See all news →</a></div>`;
  }

  function renderSelectedPubs(pubs) {
    const featured = pubs.filter(p => p.selected).slice(0, 5);
    return featured.map(p => `
      <div class="pub-entry">
        <div class="pub-thumb">
          ${p.thumb
            ? `<img src="${p.thumb}" alt="${p.title} thumbnail" loading="lazy">`
            : `<div class="pub-thumb-placeholder">paper figure</div>`}
        </div>
        <div class="pub-content">
          <p class="pub-title">${p.title}</p>
          <p class="pub-authors">${authorList(p.authors)}</p>
          <p class="pub-venue"><em>${p.venue}${p.oral ? ' (Oral)' : ''}</em>${
            (p.links && (p.links.pdf || p.links.code))
              ? '<span class="sep">·</span>' + [
                p.links.pdf && `<a href="${p.links.pdf}" target="_blank" rel="noopener">PDF</a>`,
                p.links.code && `<a href="${p.links.code}" target="_blank" rel="noopener">Code</a>`
              ].filter(Boolean).join('<span class="sep">·</span>')
              : ''
          }<span class="sep">·</span><button class="bibtex-btn" data-bibtex-id="${p.id}">BibTeX</button></p>
        </div>
      </div>`).join('') + `<p class="see-all"><a href="#publications" class="show-all-pubs">See all publications →</a></p>`;
  }

  function renderResearch(research, pubs) {
    if (!research || !research.length) return '';
    const cards = research.map(r => {
      const linkedPubs = (r.papers || []).map(id => pubs.find(p => p.id === id)).filter(Boolean);
      const meta = linkedPubs.length
        ? `${linkedPubs.length} paper${linkedPubs.length === 1 ? '' : 's'} · ${linkedPubs[0].year}${linkedPubs.length > 1 && linkedPubs[linkedPubs.length-1].year !== linkedPubs[0].year ? '–' + linkedPubs[linkedPubs.length-1].year : ''}`
        : '';
      return `<div class="research-card">
        <div class="research-card-title">${r.title}</div>
        <div class="research-card-summary">${md(r.summary)}</div>
        ${meta ? `<div class="research-card-meta">${meta}</div>` : ''}
      </div>`;
    }).join('');
    return `<section class="content-section">
      <h2 class="section-title">Research</h2>
      <div class="research-grid">${cards}</div>
    </section>`;
  }

  function renderNewsPage(news) {
    const groups = {};
    news.forEach(n => {
      const year = (n.date.match(/\d{4}/) || ['Other'])[0];
      (groups[year] = groups[year] || []).push(n);
    });
    const years = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return years.map(y => `
      <h2 class="year-heading">${y}</h2>
      ${groups[y].map(n => `
        <div class="news-item-page">
          <span class="news-date">${n.date}</span>
          <span class="news-icon ${n.type}" role="img" aria-label="${TYPE_LABELS[n.type] || ''}">${ICONS[n.type] || ICONS.paper}</span>
          <span class="news-content">${n.html}</span>
        </div>`).join('')}
    `).join('');
  }

  function renderPubsPage(pubs) {
    const sorted = [...pubs].sort((a, b) => b.year - a.year);
    const groups = {};
    sorted.forEach(p => (groups[p.year] = groups[p.year] || []).push(p));
    const years = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    let n = 0;
    return years.map(y => `
      <h2 class="year-heading" data-year="${y}">${y}</h2>
      ${groups[y].map(p => {
        n++;
        const badges = [`<span class="venue-badge tier-${p.venueTier}">${p.venue}</span>`];
        if (p.oral) badges.push(`<span class="venue-badge tier-oral">Oral</span>`);
        return `<div class="pub-entry-flat" data-featured="${p.featured ? 'true' : 'false'}">
          <span class="pub-number" data-original-num="${n}">[${n}]</span>
          <div class="pub-body">
            <p class="pub-title">${p.title}</p>
            <p class="pub-authors">${authorList(p.authors)}</p>
            <div class="pub-venue-line">
              ${badges.join('')}
              <span class="pub-links">${pubLinksInline(p)}</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    `).join('');
  }

  function renderTimeline(items) {
    if (!items || !items.length) return '';
    return items.map(it => `
      <div class="timeline-item">
        <span class="timeline-period">${it.period}</span>
        <div class="timeline-content">
          <p class="timeline-title">${it.title}</p>
          ${it.org ? `<p class="timeline-org">${it.orgUrl ? `<a href="${it.orgUrl}" target="_blank" rel="noopener">${it.org}</a>` : it.org}</p>` : ''}
          ${it.detail ? `<p class="timeline-detail">${it.detail}</p>` : ''}
        </div>
      </div>`).join('');
  }

  // ===== Routing =====

  function showPage(name) {
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === name);
    });
    if (location.hash !== '#' + name && name !== 'home') {
      history.replaceState(null, '', '#' + name);
    } else if (name === 'home' && location.hash) {
      history.replaceState(null, '', location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const main = document.getElementById('main-content');
    if (main) main.focus();
  }
  window.showPage = showPage;

  // ===== BibTeX modal =====

  function openBibtex(pub) {
    const bib = makeBibtex(pub);
    const modal = document.getElementById('bibtexModal');
    modal.querySelector('pre').textContent = bib;
    modal.querySelector('h3').textContent = pub.title;
    modal.dataset.bibtex = bib;
    document.getElementById('bibtexBackdrop').classList.add('visible');
    document.getElementById('bibtexCopyBtn').focus();
  }
  function closeBibtex() {
    document.getElementById('bibtexBackdrop').classList.remove('visible');
  }

  // ===== Init =====

  async function init() {
    let data;
    try {
      const res = await fetch('content.json', { cache: 'no-store' });
      data = await res.json();
    } catch (e) {
      document.getElementById('main-content').innerHTML =
        '<p style="padding: 40px 0; color: var(--text-secondary);">Could not load content. Please try again.</p>';
      console.error(e);
      return;
    }

    // Save publication map for bibtex lookup
    window.__pubMap = Object.fromEntries(data.publications.map(p => [p.id, p]));

    // Header
    document.querySelector('.header').innerHTML = renderHeader(data.profile);
    document.querySelector('.bio').innerHTML = renderBio(data.profile.bioParagraphs);
    document.title = data.profile.name;

    // Profile image loading
    const wrap = document.getElementById('profileImage');
    const img = document.getElementById('profileImg');
    if (img.complete && img.naturalWidth > 0) wrap.classList.add('loaded');
    img.addEventListener('load', () => wrap.classList.add('loaded'));
    img.addEventListener('error', () => wrap.classList.add('failed'));

    // Sections
    document.getElementById('homeNews').innerHTML = renderHomeNews(data.news);
    document.getElementById('homeSelectedPubs').innerHTML = renderSelectedPubs(data.publications);
    document.getElementById('newsPageBody').innerHTML = renderNewsPage(data.news);
    document.getElementById('publicationsList').innerHTML = renderPubsPage(data.publications);
    document.getElementById('grantsList').innerHTML = renderTimeline(data.grants);
    document.getElementById('educationList').innerHTML = renderTimeline(data.education);
    document.getElementById('experienceList').innerHTML = renderTimeline(data.experience);

    // Optional: talks/service/mentees
    const talksWrap = document.getElementById('talksWrap');
    if (data.talks && data.talks.length) {
      talksWrap.innerHTML = `<h2 class="career-subsection-title">Talks</h2>` + renderTimeline(data.talks);
    } else { talksWrap.innerHTML = ''; }
    const serviceWrap = document.getElementById('serviceWrap');
    if (data.service && data.service.length) {
      serviceWrap.innerHTML = `<h2 class="career-subsection-title">Service</h2>` + renderTimeline(data.service);
    } else { serviceWrap.innerHTML = ''; }
    const menteesWrap = document.getElementById('menteesWrap');
    if (data.mentees && data.mentees.length) {
      menteesWrap.innerHTML = `<h2 class="career-subsection-title">Mentoring</h2>` + renderTimeline(data.mentees);
    } else { menteesWrap.innerHTML = ''; }

    // Initial route
    const hash = location.hash.replace('#', '');
    const known = ['home', 'news', 'publications', 'grants', 'career'];
    showPage(known.includes(hash) ? hash : 'home');

    bindEvents(data);
  }

  function bindEvents(data) {
    // Nav
    document.querySelectorAll('.nav-link, .nav-brand').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        showPage(el.dataset.page || 'home');
        document.getElementById('navMenu').classList.remove('menu-open');
        document.getElementById('hamburger').classList.remove('active');
      });
    });
    document.addEventListener('click', e => {
      if (e.target.classList.contains('show-all-news')) { e.preventDefault(); showPage('news'); }
      if (e.target.classList.contains('show-all-pubs')) { e.preventDefault(); showPage('publications'); }
      if (e.target.classList.contains('bibtex-btn')) {
        const id = e.target.dataset.bibtexId;
        const p = window.__pubMap[id];
        if (p) openBibtex(p);
      }
    });

    // Hamburger
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    hamburger.addEventListener('click', e => {
      e.stopPropagation();
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('menu-open');
    });
    document.addEventListener('click', e => {
      if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('menu-open');
      }
    });

    // Scroll shadow
    window.addEventListener('scroll', () => {
      document.body.classList.toggle('scrolled', window.scrollY > 30);
    }, { passive: true });

    // Pub filter
    document.querySelectorAll('.pub-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => filterPubs(btn));
    });

    // BibTeX modal
    const backdrop = document.getElementById('bibtexBackdrop');
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeBibtex(); });
    document.getElementById('bibtexCloseBtn').addEventListener('click', closeBibtex);
    document.getElementById('bibtexCopyBtn').addEventListener('click', async () => {
      const text = document.getElementById('bibtexModal').dataset.bibtex;
      try {
        await navigator.clipboard.writeText(text);
        const b = document.getElementById('bibtexCopyBtn');
        const old = b.textContent;
        b.textContent = '✓ Copied';
        setTimeout(() => { b.textContent = old; }, 1400);
      } catch(_) {}
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeBibtex();
    });

    // Hash routing
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '') || 'home';
      const known = ['home', 'news', 'publications', 'grants', 'career'];
      if (known.includes(h)) showPage(h);
    });
  }

  function filterPubs(activeBtn) {
    document.querySelectorAll('.pub-filter-btn').forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
    const filter = activeBtn.dataset.filter;
    let visibleIdx = 0;
    document.querySelectorAll('#publicationsList .pub-entry-flat').forEach(pub => {
      const numEl = pub.querySelector('.pub-number');
      if (filter === 'all') {
        pub.style.display = '';
        numEl.textContent = '[' + numEl.dataset.originalNum + ']';
      } else {
        if (pub.dataset.featured === 'true') {
          pub.style.display = '';
          visibleIdx++;
          numEl.textContent = '[' + visibleIdx + ']';
        } else {
          pub.style.display = 'none';
        }
      }
    });
    document.querySelectorAll('#publicationsList .year-heading').forEach(h => {
      let next = h.nextElementSibling;
      let any = false;
      while (next && !next.classList.contains('year-heading')) {
        if (next.classList.contains('pub-entry-flat') && next.style.display !== 'none') { any = true; break; }
        next = next.nextElementSibling;
      }
      h.style.display = any ? '' : 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
