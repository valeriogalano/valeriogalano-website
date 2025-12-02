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
  function openCmd() {
    const w = wrapper();
    if (!w) return;
    if (!w.classList.contains('active')) {
      w.classList.add('active');
      // mark body as command-active so UI can swap footer status with input
      document.body.classList.add('cmd-active');
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
        window.location.assign(target);
        return;
      }
      print(normalized);
      window.location.assign(target);
    } else {
      print(`E492: Not an editor command: ${cmd}`);
    }
  }

  function init() {
    // Reserve footer space only when the visible page content would be obscured by the fixed footer.
    // This eliminates useless scroll on short pages while ensuring the last line stays visible on long pages.
    function updateFooterHeight() {
      const root = document.documentElement;
      const footer = document.querySelector('.tg-footer');
      if (!root || !footer) return;

      const footerH = footer.offsetHeight || 0;

      // Temporarily remove any reserved space so measurements reflect natural layout
      const prev = getComputedStyle(root).getPropertyValue('--footer-h');
      root.style.setProperty('--footer-h', '0px');

      const vpH = window.innerHeight || root.clientHeight || 0;
      const content = document.getElementById('content');

      let needsReserve = false;
      if (content) {
        // Compute where the content actually ends in the document
        const rect = content.getBoundingClientRect();
        const contentBottom = Math.round(rect.bottom + (window.scrollY || window.pageYOffset || 0));
        // If we were to reserve the footer, the visible bottom of the viewport shifts up by footerH
        const viewportBottomIfReserved = Math.round((window.scrollY || window.pageYOffset || 0) + vpH - footerH);
        // Reserve space if content would meet or exceed the visible bottom once the footer is present
        needsReserve = contentBottom >= (viewportBottomIfReserved - 1); // epsilon guards off-by-one
      } else {
        // Fallback: compare document height to viewport height
        const docH = Math.max(
          document.body ? document.body.scrollHeight : 0,
          root.scrollHeight || 0
        );
        needsReserve = docH >= (vpH - 1);
      }

      root.style.setProperty('--footer-h', (needsReserve ? footerH : 0) + 'px');
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
        handle(input.value);
        input.value = "";
        closeCmd();
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

    // Mobile key bar bindings (cmq, j, k)
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
    // cmq opens command input (simulate ':' key press)
    bindBtn('tg-key-cmq', ':');
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
