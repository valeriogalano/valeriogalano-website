// Command-line navigation (no external libs)
(function() {
  // Build routes map from server-provided data (single source of truth: config.toml -> route_data.html)
  function loadRoutes() {
    try {
      const el = document.getElementById('tg-routes');
      if (!el) throw new Error('no tg-routes element');
      const raw = el.getAttribute('data-json') || '';
      if (!raw) throw new Error('empty tg-routes data');
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return obj;
    } catch(_) {}
    // Fallback defaults if server data missing
    return {
      ":home": "/",
      ":help": "/help/",
      ":q": "/"
    };
  }
  const routes = loadRoutes();

  function $(id) { return document.getElementById(id); }

  function wrapper() { return document.querySelector('.cmd-wrapper'); }

  // --- Footer loading indicator (same visual used for link navigation) ------
  function showLoadingFooter() {
    try {
      const el = document.getElementById('tg-link-target');
      if (!el) return;
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-busy', 'true');
      el.innerHTML = '<span class="tg-loading-text">loading<span class="d1">.</span><span class="d2">.</span><span class="d3">.</span></span>';
    } catch(_) {}
  }

  function isHashOnly(href) {
    if (!href) return false;
    const t = href.trim();
    return t.startsWith('#');
  }

  function navigateWithDelayCmd(href, delayMs) {
    if (!href) return;
    // If it's a same-page anchor, navigate immediately without loading/delay
    if (isHashOnly(href)) {
      try { window.location.assign(href); } catch(_) { window.location.href = href; }
      return;
    }
    // Ensure the footer is visible (command UI hides it)
    closeCmd();
    // Show loading in the footer and delay navigation so the animation is visible
    showLoadingFooter();
    const ms = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : 500;
    setTimeout(() => {
      try { window.location.assign(href); } catch(_) { window.location.href = href; }
    }, ms);
  }
  let lastOpenedAt = 0;
  function openCmd() {
    const w = wrapper();
    if (!w) return;
    if (!w.classList.contains('active')) {
      w.classList.add('active');
      // mark body as command-active so UI can swap footer status with input
      document.body.classList.add('cmd-active');
      // guard to avoid immediately closing from the same tap/click that opened it (mobile)
      lastOpenedAt = Date.now();
    }
  }
  function closeCmd() {
    const w = wrapper();
    if (!w) return;
    if (w.classList.contains('active')) {
      w.classList.remove('active');
      document.body.classList.remove('cmd-active');
    }
  }

  function print(msg) {
    const out = $("cmd-output");
    if (!out) return;
    const line = document.createElement('div');
    line.textContent = msg;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  }

  function handle(cmdRaw) {
    const cmd = (cmdRaw || "").trim();
    if (!cmd) return;
    // accept with or without leading ':'
    const normalized = cmd.startsWith(":") ? cmd : ":" + cmd;
    if (routes[normalized]) {
      const target = routes[normalized];
      if (normalized === ":q") {
        // try to close tab; fallback to redirect home
        print(":q");
        try { window.close(); } catch (e) {}
        // Show loading in footer and delay redirect so the animation is visible
        navigateWithDelayCmd(target, 500);
        return; // nothing more to do
      }
      print(normalized);
      // Navigate with a short delay to show the loading animation in the footer
      navigateWithDelayCmd(target, 500);
    } else {
      print(`E492: Not an editor command: ${cmd}`);
    }
  }

  function init() {
    // Always reserve footer space equal to the actual fixed footer height
    // so the last line of content is never covered.
    function updateFooterHeight() {
      const root = document.documentElement;
      const footer = document.querySelector('.tg-footer');
      if (!root || !footer) return;

      const footerH = footer.offsetHeight || 0;
      root.style.setProperty('--footer-h', footerH + 'px');
    }

    // Initial set and observers
    updateFooterHeight();
    window.addEventListener('resize', updateFooterHeight);
    window.addEventListener('load', updateFooterHeight, { once: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateFooterHeight).catch(() => {});
    }
    // Recompute when content size or structure changes
    try {
      const content = document.getElementById('content') || document.body;
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => updateFooterHeight());
        ro.observe(content);
      }
      if (window.MutationObserver) {
        const mo = new MutationObserver(updateFooterHeight);
        mo.observe(content, { childList: true, subtree: true });
      }
    } catch(_) {}

    const input = $("cmd-input");
    if (!input) return;
    // Command area opens on ':' and closes on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === ':' && document.activeElement !== input) {
        openCmd();
        // Prefill with ':' and place caret at the end
        input.value = ':';
        input.focus();
        // move caret to end
        try { input.setSelectionRange(input.value.length, input.value.length); } catch(_) {}
        e.preventDefault();
      } else if (e.key === 'Escape') {
        closeCmd();
        // blur input if focused
        if (document.activeElement === input) input.blur();
      } else if (e.key === "Enter" && document.activeElement === input) {
        // Let handle() manage closing and loading/navigation
        handle(input.value);
        input.value = "";
      }
    });

    // Prevent deleting the leading ':' with Backspace; instead close the command area
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        const startsWithColon = input.value.startsWith(':');
        const atStart = input.selectionStart === 1 && input.selectionEnd === 1;
        if (startsWithColon && atStart) {
          e.preventDefault();
          input.value = '';
          closeCmd();
          input.blur();
        }
      }
    });

    // If the value ever stops starting with ':', auto-close the command area
    input.addEventListener('input', () => {
      if (!input.value.startsWith(':')) {
        closeCmd();
        input.blur();
      }
    });

    // Close when tapping/clicking anywhere outside the command area
    function isInsideCmd(el) {
      const w = wrapper();
      return !!(w && (el === w || w.contains(el)));
    }
    function outsideCloseHandler(e) {
      // If we just opened, ignore the very next outside event to prevent immediate close
      if (Date.now() - lastOpenedAt < 250) return;
      const w = wrapper();
      if (!w || !w.classList.contains('active')) return;
      const target = e.target;
      // Keep open if interacting with the input/cmd area
      if (target === input || isInsideCmd(target)) return;
      closeCmd();
      // blur input if focused
      if (document.activeElement === input) input.blur();
    }
    // Use pointerdown to react fast on touch devices
    document.addEventListener('pointerdown', outsideCloseHandler, { passive: true });

    // Mobile key bar bindings (cmd, Enter, j, k)
    function dispatchKey(key) {
      try {
        const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        document.dispatchEvent(ev);
      } catch(_) {
        // Fallback for very old browsers
        const ev = document.createEvent('KeyboardEvent');
        try { ev.initKeyboardEvent('keydown', true, true, window, key, 0, '', false, ''); } catch(_) {}
        document.dispatchEvent(ev);
      }
    }
    function bindBtn(id, keyOrFn) {
      const el = document.getElementById(id);
      if (!el) return;
      const handler = (e) => {
        if (typeof keyOrFn === 'string') {
          dispatchKey(keyOrFn);
        } else if (typeof keyOrFn === 'function') {
          keyOrFn();
        }
        e.preventDefault();
      };
      el.addEventListener('click', handler);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handler(e);
      });
    }
    // cmd opens command input (simulate ':' key press)
    bindBtn('tg-key-cmd', ':');
    // Enter opens the selected link (simulate Enter keypress)
    bindBtn('tg-key-enter', 'Enter');
    // j/k navigate links
    bindBtn('tg-key-j', 'j');
    bindBtn('tg-key-k', 'k');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
