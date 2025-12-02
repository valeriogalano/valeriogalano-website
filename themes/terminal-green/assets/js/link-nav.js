// In-content link navigation with j/k + Enter
// - Restricts navigation to links inside the main content (.tg-buffer within #content)
// - Highlights the active link
// - Opens the active link on Enter
(function() {
  let links = [];
  let idx = -1; // no preselection until user presses j/k

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
    const helpList = content.querySelector('.tg-dir');
    if (helpList) cands.push(...helpList.querySelectorAll('a[href]'));
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
  }

  function clearHighlight() {
    links.forEach(a => a.classList.remove('tg-link-focus'));
  }

  function clearSelection() {
    idx = -1;
    clearHighlight();
    setStatus(0, links.length);
  }

  function highlight() {
    clearHighlight();
    if (idx < 0 || idx >= links.length) return;
    const a = links[idx];
    a.classList.add('tg-link-focus');
    // Use native focus for accessibility but avoid default focus ring by CSS override
    try { a.focus({ preventScroll: true }); } catch(_) { try { a.focus(); } catch(_) {} }
    // Ensure minimal scroll to reveal the link
    a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
      // Prefer native click to preserve SPA behaviors if any
      if (typeof a.click === 'function') {
        a.click();
      } else {
        window.location.assign(href);
      }
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

  function init() {
    // Initial collection without selecting any link
    collectLinks();
    document.addEventListener('keydown', onKey, true);
    // Clear any link selection on any mouse click anywhere in the page
    // Clear selection on generic mouse interactions, but ignore taps on the mobile key bar
    document.addEventListener('mousedown', (e) => {
      try {
        if (e && e.target && typeof e.target.closest === 'function') {
          if (e.target.closest('.vim-mobile-keys')) return; // don't clear when using mobile j/k/cmd buttons
        }
      } catch(_) {}
      clearSelection();
    }, true);
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
