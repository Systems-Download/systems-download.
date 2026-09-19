/* ═══════════════════════════════════════════════════════════
   CONCH & CMDR — CENTRAL CONFIG
   ═══════════════════════════════════════════════════════════
   Change values here once, and they apply across every page.
   Load this BEFORE any other script on the page:
     <script src="config.js"></script>

   Note: The Supabase anon key and Discord webhook are public by
   design (they're visible in any browser's dev tools regardless).
   Never put private keys or secrets in this file.
═══════════════════════════════════════════════════════════ */

window.CC_CONFIG = {

  /* ── SITE ── */
  SITE_NAME: 'Conch & Cmdr',
  SITE_URL: 'https://systems-download.github.io',
  FOUNDED: 'February 2026',

  /* ── GITHUB ── */
  GITHUB_REPO: 'Systems-Download/Systems-Download.github.io',
  MAX_RELEASES: 20,

  /* ── SUPABASE ── */
  SB_URL: 'https://rmdkoauibmzhgnvrwhfd.supabase.co',
  SB_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtZGtvYXVpYm16aGdudnJ3aGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjg2MDksImV4cCI6MjA5Mzg0NDYwOX0.lu6T00f9y9-Q8HhVag-MGjJz6bTlJrYUwC7AApIxaFw',

  /* ── STORAGE BUCKETS ── */
  AVATAR_BUCKET: 'avatars',
  BANNER_BUCKET: 'banners',
  PEEKS_BUCKET: 'sneak-peeks',
  MESSAGE_FILES_BUCKET: 'message-files',

  /* ── DISCORD ── */
  DISCORD_INVITE_CODE: '6zxpMDbecq',
  get DISCORD_INVITE_URL() { return 'https://discord.gg/' + this.DISCORD_INVITE_CODE; },
  DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/1510446146458353747/pnX8TWoZRQsPb9zK5UY5XK1jET80JB9r-DvafMdDVAauLRKCCvGPUha_SvkmtLcoG31p',

  /* ── RELEASE ANNOUNCEMENT WEBHOOK ──
     Separate webhook for automatic release announcements.
     Replace the URL below with your new webhook after revoking the old one.
     Set RELEASE_PING_ROLE_ID to your role ID to ping it on each release. */
  RELEASE_WEBHOOK: 'PASTE_NEW_WEBHOOK_URL_HERE',
  RELEASE_PING_ROLE_ID: '1480242594448539812',

  /* ── RELEASE COUNTDOWNS ──
     Set to null to hide a countdown entirely. */
  NEXT_RELEASE_CONCH: '2026-06-01T15:45:00Z',
  NEXT_RELEASE_CMDR: '2026-07-10T15:45:00Z',
  NEXT_RELEASE_SENTINEL: null,

  /* ── ADMIN ── */
  ADMIN_USERNAME: 'max',

  /* ── THIRD-PARTY ── */
  VPNAPI_KEY: '8f961fd03d784466b46546b5aba9ebdb',

  /* ── MAINTENANCE MODE ──
     Set ENABLED to true to lock the whole site behind a maintenance
     screen. Pages listed in ALLOW stay reachable (so you can still
     get into the admin panel while the site is down for others).
     Admins (see ADMIN_USERNAME) always bypass the lock. */
  MAINTENANCE: {
    ENABLED: true,
    TITLE: 'Under Maintenance',
    MESSAGE: 'We\'re making some improvements right now. Check back shortly — or join our Discord for updates.',
    ALLOW: ['cc-control.html'],
  },

  /* ── SITE BANNER ──
     Quick site-wide notice without touching the database.
     TYPE: 'info' | 'success' | 'warning' | 'danger' */
  SITE_BANNER: {
    ENABLED: false,
    TEXT: '',
    TYPE: 'info',
  },

  /* ── FEATURE FLAGS ──
     Flip these to turn features on/off site-wide. */
  ENABLE_LIVE_RELEASE_BANNER: true,
  ENABLE_DOWNLOAD_LOGGING: true,
  ENABLE_SNEAK_PEEKS: true,
};

/* ═══════════════════════════════════════════════════════════
   MAINTENANCE MODE + SITE BANNER ENFORCEMENT
   Runs automatically on every page that loads config.js.
═══════════════════════════════════════════════════════════ */
(function () {
  const cfg = window.CC_CONFIG;

  /* ── Is the current visitor an admin? ── */
  function isAdmin() {
    try {
      const saved = localStorage.getItem('cc_auth');
      if (!saved) return false;
      const u = JSON.parse(saved);
      if (!u) return false;
      const name = (u.rawUsername || u.username || '').toLowerCase();
      return name === (cfg.ADMIN_USERNAME || '').toLowerCase() || u.isAdmin === true;
    } catch {
      return false;
    }
  }

  /* ── Maintenance lock ── */
  function applyMaintenance() {
    if (!cfg.MAINTENANCE || !cfg.MAINTENANCE.ENABLED) return;

    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const allowed = (cfg.MAINTENANCE.ALLOW || []).map(p => p.toLowerCase());
    if (allowed.includes(page)) return;
    if (isAdmin()) {
      showAdminBypassNotice();
      return;
    }

    const html = `
      <div id="cc-maintenance" style="
        position:fixed;inset:0;z-index:100000;
        background:#0b0c0f;color:#e8eaf0;
        display:flex;align-items:center;justify-content:center;
        flex-direction:column;text-align:center;padding:2rem;
        font-family:'Space Grotesk',sans-serif;">
        <div style="font-size:3.5rem;margin-bottom:1rem">🔧</div>
        <div style="font-size:2rem;font-weight:700;margin-bottom:.8rem;letter-spacing:-.02em">
          ${cfg.MAINTENANCE.TITLE || 'Under Maintenance'}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.85rem;color:#6b7280;
                    line-height:1.8;max-width:420px;margin-bottom:1.8rem">
          ${cfg.MAINTENANCE.MESSAGE || ''}
        </div>
        <a href="${cfg.DISCORD_INVITE_URL}" target="_blank" rel="noopener" style="
          font-family:'JetBrains Mono',monospace;font-size:.82rem;font-weight:700;
          padding:.75rem 1.6rem;border-radius:9px;text-decoration:none;
          background:rgba(88,101,242,.15);border:1px solid rgba(88,101,242,.35);color:#8b9cf4;">
          💬 Join the Discord
        </a>
      </div>`;

    function inject() {
      document.body.insertAdjacentHTML('beforeend', html);
      document.body.style.overflow = 'hidden';
    }
    if (document.body) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  }

  /* ── Small notice so admins know the site is locked for everyone else ── */
  function showAdminBypassNotice() {
    function inject() {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed;bottom:1rem;left:1rem;z-index:99999;
        background:rgba(255,200,50,.12);border:1px solid rgba(255,200,50,.3);
        color:#ffc832;font-family:'JetBrains Mono',monospace;font-size:.72rem;
        padding:.6rem .9rem;border-radius:8px;`;
      el.textContent = '🔧 Maintenance mode is ON — visitors see a maintenance screen.';
      document.body.appendChild(el);
    }
    if (document.body) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  }

  /* ── Config-driven site banner ── */
  function applySiteBanner() {
    const b = cfg.SITE_BANNER;
    if (!b || !b.ENABLED || !b.TEXT) return;

    const colors = {
      info:    ['rgba(100,160,255,.12)', 'rgba(100,160,255,.25)', '#64a0ff'],
      success: ['rgba(60,200,120,.12)',  'rgba(60,200,120,.25)',  '#3cc878'],
      warning: ['rgba(255,200,50,.12)',  'rgba(255,200,50,.25)',  '#ffc832'],
      danger:  ['rgba(255,79,94,.12)',   'rgba(255,79,94,.25)',   '#ff4f5e'],
    };
    const [bg, border, fg] = colors[b.TYPE] || colors.info;

    function inject() {
      const el = document.createElement('div');
      el.id = 'cc-config-banner';
      el.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:10040;
        background:${bg};border-bottom:1px solid ${border};color:${fg};
        font-family:'JetBrains Mono',monospace;font-size:.78rem;
        padding:.65rem 1.2rem;text-align:center;`;
      el.textContent = b.TEXT;
      document.body.appendChild(el);
    }
    if (document.body) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  }

  applyMaintenance();
  applySiteBanner();
})();
