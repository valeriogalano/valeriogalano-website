// In-content link navigation with j/k + Enter
// - Restricts navigation to links inside the main content (.tg-buffer within #content)
// - Highlights the active link
// - Opens the active link on Enter
(function() {
  let links = [];
  let idx = -1; // no preselection until user presses j/k

  // --- Footer loading indicator (replaces selected link in footer) -----------
  function showLoading() {
    try {
      const el = document.getElementById('tg-link-target');
      if (!el) return;
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-busy', 'true');
      el.innerHTML = '<span class="tg-loading-text">loading<span class="d1">.</span><span class="d2">.</span><span class="d3">.</span></span>';
    } catch(_) {}
  }

  function isModifiedClick(e) {
    return !!(e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1));
  }

  function isHashOnly(href) {
    if (!href) return false;
    const t = href.trim();
    return t.startsWith('#');
  }

  function shouldShowLoadingForLink(a, e) {
    if (!a) return false;
    const target = (a.getAttribute('target') || '').toLowerCase();
    if (target === '_blank') return false;
    if (isModifiedClick(e)) return false;
    const href = a.getAttribute('href') || '';
    if (!href) return false;
    if (isHashOnly(href)) return false; // same-page anchor
    return true; // navigating in same tab
  }

  function navigateWithDelay(a, delayMs) {
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    const target = (a.getAttribute('target') || '').toLowerCase();
    if (target === '_blank') {
      // Do not delay new-tab navigations
      try { window.open(href, '_blank'); } catch(_) { /* noop */ }
      return;
    }
    // Same-tab navigation: show loading, delay to let animation be visible
    showLoading();
    const ms = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : 500;
    setTimeout(() => {
      try { window.location.assign(href); } catch(_) { window.location.href = href; }
    }, ms);
  }

  function setStatus(cur, total) {
    try {
      const pos = document.getElementById('tg-pos');
      if (pos) {
        pos.textContent = `${cur}:${total}`;
        return;
      }
      // Fallback: try to update the text of .vim-status if #tg-pos is missing
      const vs = document.querySelector('.vim-status');
      if (vs) {
        const txt = vs.textContent || '';
        const rest = txt.replace(/^\s*\d+[:,]\d+\s*/, '');
        vs.textContent = `${cur}:${total}    ${rest}`;
      }
    } catch(_) {}
  }

  function setLinkTarget(text, target) {
    try {
      const el = document.getElementById('tg-link-target');
      if (!el) return;
      // Show nothing when empty/undefined
      const t = (text || '').trim();
      // ensure any previous loading state is cleared
      el.removeAttribute('aria-busy');
      el.textContent = t;
      if (t) {
        el.setAttribute('href', t);
        const tgt = (target || '').trim();
        if (tgt) {
          el.setAttribute('target', tgt);
          // security best practice when opening new tabs
          if (tgt === '_blank') el.setAttribute('rel', 'noopener noreferrer');
        } else {
          el.removeAttribute('target');
          el.removeAttribute('rel');
        }
        // Make sure it's visible and interactive when a link exists
        el.removeAttribute('aria-hidden');
        try { el.style.pointerEvents = ''; } catch(_) {}
      } else {
        // Remove href so it is not focusable/clickable when empty
        el.removeAttribute('href');
        el.removeAttribute('target');
        el.removeAttribute('rel');
        el.setAttribute('aria-hidden', 'true');
        try { el.style.pointerEvents = 'none'; } catch(_) {}
      }
    } catch(_) {}
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function inCommandMode() {
    return document.body.classList.contains('cmd-active');
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return !!(r.width || r.height) && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function uniqueByRef(arr) {
    return Array.from(new Set(arr));
  }

  function collectLinks() {
    // Collect from navbar first so that initial j/k starts there
    const content = document.getElementById('content') || document.body;
    const scopePrimary = content.querySelector('.tg-buffer');
    // Gather candidates, navbar first
    const cands = [];
    const nav = document.querySelector('.vim-nav');
    if (nav) cands.push(...nav.querySelectorAll('a[href]'));
    if (scopePrimary) cands.push(...scopePrimary.querySelectorAll('a[href]'));
    // Always add any remaining anchors under #content
    cands.push(...content.querySelectorAll('a[href]'));

    const newLinks = uniqueByRef(cands).filter(a => isVisible(a));
    // Remove previous highlights from old list
    if (links && links.length) links.forEach(a => a.classList.remove('tg-link-focus'));
    links = newLinks;
    // Preserve current selection if still valid, otherwise no selection
    if (!(idx >= 0 && idx < links.length)) {
      idx = -1; // do not auto-select any link
    }
    if (idx >= 0) {
      highlight();
    }
    // Update footer status: current index (1-based) or 0 when none
    setStatus(idx >= 0 ? (idx + 1) : 0, links.length);
    // Update link target display
    if (idx >= 0 && idx < links.length) {
      const a = links[idx];
      setLinkTarget(a.getAttribute('href') || '', a.getAttribute('target') || '');
    } else {
      setLinkTarget('', '');
    }
  }

  function clearHighlight() {
    links.forEach(a => a.classList.remove('tg-link-focus'));
  }

  function clearSelection() {
    idx = -1;
    clearHighlight();
    setStatus(0, links.length);
    setLinkTarget('', '');
  }

  function highlight() {
    clearHighlight();
    if (idx < 0 || idx >= links.length) return;
    const a = links[idx];
    a.classList.add('tg-link-focus');
    // Use native focus for accessibility but avoid default focus ring by CSS override
    try { a.focus({ preventScroll: true }); } catch(_) { try { a.focus(); } catch(_) {} }
    // Update link target BEFORE measuring footer and scrolling,
    // so the increased footer height is accounted for on first selection
    setLinkTarget(a.getAttribute('href') || '', a.getAttribute('target') || '');
    // Ensure the link is visible above the fixed footer
    ensureVisibleWithFooter(a);
    setStatus(idx + 1, links.length);
  }

  function move(delta) {
    if (!links.length) return;
    // First movement selects the first/last depending on direction
    if (idx === -1) {
      idx = delta > 0 ? 0 : links.length - 1;
    } else {
      idx = (idx + delta + links.length) % links.length;
    }
    highlight();
  }

  function openActive(e) {
    if (idx < 0 || idx >= links.length) return;
    const a = links[idx];
    const href = a.getAttribute('href');
    if (!href) return;
    // Respect target if set
    const target = a.getAttribute('target');
    if (target === '_blank') {
      window.open(href, '_blank');
    } else {
      // Delay same-tab navigation to show loading animation
      navigateWithDelay(a, 500);
    }
    if (e) e.preventDefault();
  }

  function onKey(e) {
    // Esc should always clear selection, even in command mode
    if (e.key === 'Escape') {
      clearSelection();
      return; // don't block other Esc handlers
    }

    if (inCommandMode()) return; // disabled while ':' command is active (other than Esc)
    if (isEditable(document.activeElement)) return; // don't intercept typing

    if (e.key === 'j') {
      move(1);
      e.preventDefault();
    } else if (e.key === 'k') {
      move(-1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      // Only act if a link is highlighted
      const hasFocus = idx >= 0 && idx < links.length && links[idx].classList.contains('tg-link-focus');
      if (hasFocus) {
        openActive(e);
      }
    }
  }

  // --- Scrolling helpers ----------------------------------------------------
  function getFooterHeight() {
    // Prefer actual footer height when present
    const f = document.querySelector('.tg-footer');
    if (f && f.offsetHeight) return f.offsetHeight;
    // Fallback to CSS var --footer-h if set
    try {
      const cs = getComputedStyle(document.body);
      const v = cs.getPropertyValue('--footer-h');
      const n = parseInt(v, 10);
      if (!isNaN(n) && n > 0) return n;
    } catch(_) {}
    // Sensible default
    return 64;
  }

  function ensureVisibleWithFooter(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const rect = el.getBoundingClientRect();
    const footerH = getFooterHeight();
    const vpH = window.innerHeight || document.documentElement.clientHeight || 0;
    const topVisible = 0;
    const bottomVisible = vpH - footerH;

    let dy = 0;
    if (rect.bottom > bottomVisible) {
      dy = rect.bottom - bottomVisible + 4; // small margin
    } else if (rect.top < topVisible) {
      dy = rect.top - topVisible - 8; // small margin
    }
    if (dy !== 0) {
      // Prefer smooth scrolling; respect reduced-motion preference
      const prefersReduced = (() => {
        try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(_) { return false; }
      })();
      try {
        window.scrollBy({ top: dy, left: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
      } catch(_) {
        window.scrollBy(0, dy);
      }
    }
  }

  function init() {
    // Initial collection without selecting any link
    collectLinks();
    document.addEventListener('keydown', onKey, true);
    // Show loader on normal link clicks (same-tab navigations)
    document.addEventListener('click', function(e) {
      const t = e.target;
      if (!t) return;
      // Find nearest anchor
      const a = t.closest ? t.closest('a[href]') : null;
      if (!a) return;
      if (!shouldShowLoadingForLink(a, e)) return;
      // We will intentionally delay navigation, so prevent default and navigate manually
      e.preventDefault();
      // mark as handled by delayed nav to avoid any restoration branches
      try { e.__tgDelayedNav = true; } catch(_) {}
      navigateWithDelay(a, 500);
    }, true);
    // Do not clear selection on page clicks (desktop or mobile) per requirement
    // Re-collect on resizes and DOM mutations within #content (helps for /help and partial rerenders)
    const ro = new ResizeObserver(() => collectLinks());
    const content = document.getElementById('content') || document.body;
    try { ro.observe(content); } catch(_) {}
    try {
      const mo = new MutationObserver(collectLinks);
      mo.observe(content, { childList: true, subtree: true });
    } catch(_) {}
    // Also re-collect after page load/fonts
    window.addEventListener('load', collectLinks, { once: true });
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(collectLinks).catch(() => {}); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
