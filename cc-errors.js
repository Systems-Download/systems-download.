/* ═══════════════════════════════════════════════════════════
   CONCH & CMDR — CENTRAL ERROR BOUNDARY
   ═══════════════════════════════════════════════════════════
   Instead of every live-data section showing its own
   "couldn't load" message, failures are collected here and
   surfaced as ONE banner at the top of the page.

   Usage from any page:
     CCErrors.report('Sneak Peeks');       // something failed
     CCErrors.clear('Sneak Peeks');        // it recovered

   Load AFTER config.js:
     <script src="config.js"></script>
     <script src="cc-errors.js"></script>
═══════════════════════════════════════════════════════════ */

(function () {
  const failed = new Set();
  let bannerEl = null;

  function ensureBanner() {
    if (bannerEl) return bannerEl;

    const style = document.createElement('style');
    style.textContent = `
      #cc-error-banner{
        position:fixed;top:0;left:0;right:0;z-index:10050;
        background:rgba(255,200,50,.12);
        border-bottom:1px solid rgba(255,200,50,.28);
        color:#ffc832;
        font-family:'JetBrains Mono',monospace;font-size:.78rem;
        padding:.7rem 1.2rem;
        display:flex;align-items:center;gap:.75rem;
        justify-content:center;flex-wrap:wrap;
        animation:ccErrIn .3s ease;
      }
      @keyframes ccErrIn{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}
      #cc-error-banner .cc-err-retry{
        font-family:inherit;font-size:.72rem;
        padding:.3rem .8rem;border-radius:6px;
        border:1px solid rgba(255,200,50,.35);
        background:rgba(255,200,50,.1);color:#ffc832;
        cursor:pointer;transition:background .2s;
      }
      #cc-error-banner .cc-err-retry:hover{background:rgba(255,200,50,.22)}
      #cc-error-banner .cc-err-close{
        background:none;border:none;color:#ffc832;
        cursor:pointer;font-size:.9rem;padding:.1rem .3rem;opacity:.7;
      }
      #cc-error-banner .cc-err-close:hover{opacity:1}
    `;
    document.head.appendChild(style);

    bannerEl = document.createElement('div');
    bannerEl.id = 'cc-error-banner';
    document.body.appendChild(bannerEl);
    return bannerEl;
  }

  function render() {
    if (failed.size === 0) {
      if (bannerEl) {
        bannerEl.remove();
        bannerEl = null;
      }
      return;
    }

    const el = ensureBanner();
    const names = Array.from(failed);
    const label =
      names.length === 1
        ? `Couldn't load ${names[0]} right now.`
        : `Couldn't load ${names.length} sections right now (${names.join(', ')}).`;

    el.innerHTML = `
      <span>⚠️ ${label} Some info may be missing or out of date.</span>
      <button class="cc-err-retry" onclick="location.reload()">↻ Retry</button>
      <button class="cc-err-close" onclick="CCErrors.dismiss()" title="Dismiss">✕</button>
    `;
  }

  window.CCErrors = {
    /* Mark a named section as failed */
    report(sectionName) {
      failed.add(sectionName);
      if (document.body) render();
      else document.addEventListener('DOMContentLoaded', render, { once: true });
    },

    /* Mark a named section as recovered */
    clear(sectionName) {
      failed.delete(sectionName);
      render();
    },

    /* Hide the banner without clearing the underlying state */
    dismiss() {
      if (bannerEl) {
        bannerEl.remove();
        bannerEl = null;
      }
    },

    /* For debugging */
    list() {
      return Array.from(failed);
    },
  };
})();
