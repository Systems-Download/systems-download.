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
  RELEASE_WEBHOOK: 'https://discordapp.com/api/webhooks/1550553424884535329/xgCYhIqsRudd16ZUSvMMApX4sRhZqAjbLv8EJ6R9tZNVacgBa1dzaES6W8OQO6pEsoFV',
  RELEASE_PING_ROLE_ID: '1480242594448539812',

  /* ── RELEASE COUNTDOWNS ──
     Set to null to hide a countdown entirely. */
  NEXT_RELEASE_CONCH: '2026-06-01T15:45:00Z',
  NEXT_RELEASE_CMDR: null,
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
    ENABLED: false,
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
  ENABLE_LIVE_RELEASE_BANNER: false,
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

/* Shared appearance: glass is strictly opt-in and independent of dark/light. */
(function () {
  const root = document.documentElement;
  root.dataset.ccPage=(location.pathname.split('/').pop()||'index').replace(/\.html$/i,'').toLowerCase();
  const palette = [
    ['Conch','#0ff4c6'],['Red','#ff4f5e'],['Gold','#ffc832'],['Purple','#a78bfa'],
    ['Blue','#60a5fa'],['Orange','#f97316'],['Pink','#f472b6'],['Green','#34d399']
  ];
  const read = (key, fallback) => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  };
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function state() {
    return {
      glass: read('cc_liquid_glass','0') === '1',
      glassStrength: read('cc_glass_strength','strong') === 'subtle' ? 'subtle' : 'strong',
      reduceMotion: read('cc_reduce_motion','0') === '1',
      motion: read('cc_animations','1') !== '0' && read('cc_reduce_motion','0') !== '1' && !reducedMotion.matches,
      mode: read('cc_theme','dark') === 'light' ? 'light' : 'dark',
      system: read('cc_system_theme','0') === '1',
      accent: /^#[0-9a-f]{6}$/i.test(read('cc_accent','')) ? read('cc_accent','') : '#0ff4c6'
    };
  }
  const style = document.createElement('style');
  style.id = 'cc-appearance-style';
  style.textContent = `
    :root.liquid-glass {
      --bg:#06090b!important;--surface:rgba(34,38,44,.48)!important;
      --surface2:rgba(255,255,255,.06)!important;--border:rgba(239,246,255,.16)!important;
      --text:#f2f3ff!important;--muted:#a0a7b1!important;
      --glass-panel:rgba(34,38,44,.48);--glass-input:rgba(8,12,17,.34);--glass-control:rgba(238,244,255,.085);
      --glass-blur:28px;--glass-optics-blur:18px;--glass-saturation:180%;--glass-shine:rgba(255,255,255,.28);--glass-energy:0;--glass-x:35%;--glass-y:0%;
      --glass-rim:rgba(238,246,255,.20);--glass-shadow:0 20px 60px rgba(0,0,0,.24),0 3px 8px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.30),inset 1px 0 0 rgba(255,255,255,.05),inset -1px -1px 0 rgba(210,236,255,.035);
      --glass-bg:radial-gradient(ellipse 760px 640px at 4% 2%,color-mix(in srgb,var(--conch) 38%,transparent),transparent 72%),radial-gradient(ellipse 430px 320px at 43% 55%,color-mix(in srgb,var(--conch) 17%,transparent),transparent 72%),radial-gradient(ellipse 480px 440px at 74% 37%,rgba(115,53,212,.30),transparent 72%),radial-gradient(ellipse 490px 390px at 68% 66%,rgba(185,37,112,.21),transparent 72%),radial-gradient(ellipse 610px 550px at 101% 94%,rgba(213,63,79,.36),transparent 73%),linear-gradient(#06090b,#05080a);
    }
    :root.liquid-glass.light-mode {
      --bg:#ecf4fc!important;--surface:rgba(255,255,255,.36)!important;
      --surface2:rgba(255,255,255,.42)!important;--border:rgba(42,69,110,.18)!important;
      --text:#10243d!important;--muted:#3f5670!important;
      --glass-panel:rgba(255,255,255,.42);--glass-input:rgba(255,255,255,.38);--glass-control:rgba(255,255,255,.44);--glass-shine:rgba(255,255,255,.90);
      --glass-rim:rgba(255,255,255,.78);--glass-shadow:0 20px 60px rgba(35,71,111,.12),0 3px 8px rgba(43,76,119,.06),inset 0 1px 0 #fff,inset 1px 0 0 rgba(255,255,255,.65),inset -1px -1px 0 rgba(255,255,255,.35);
      --glass-bg:radial-gradient(ellipse 760px 640px at 4% 2%,color-mix(in srgb,var(--conch) 23%,transparent),transparent 72%),radial-gradient(ellipse 430px 320px at 43% 55%,color-mix(in srgb,var(--conch) 12%,transparent),transparent 72%),radial-gradient(ellipse 480px 440px at 74% 37%,rgba(161,127,239,.22),transparent 72%),radial-gradient(ellipse 490px 390px at 68% 66%,rgba(232,130,195,.17),transparent 72%),radial-gradient(ellipse 610px 550px at 101% 94%,rgba(235,147,157,.24),transparent 73%),linear-gradient(#eef5f9,#eaf0f7);
    }
    html.liquid-glass body,html.liquid-glass #auth-wall {
      background:var(--glass-bg)!important;background-attachment:fixed!important;color:var(--text);
    }
    html.liquid-glass :is(nav,.topnav,.sidebar,.drawer,.auth-box,.settings-section,.file-card,.showcase-card,.peek-card,.quiz-card,.legal-card,.feature-card,.cmd-card,.release-card,.ann-card,.status-card,.form-card,.success-card,.report-panel,.report-row,.faq-item,.modal-box,.obox,.intro-box,.profile-modal,.bug-modal,.email-modal,.fav-modal,.msg-modal,.addfriend-modal,.queue-panel,.notif-panel,.toast,.save-toast,.q-panel,.q-thread,.q-post,.cc-theme-picker) {
      background:var(--glass-panel)!important;border-color:var(--glass-rim)!important;
      box-shadow:var(--glass-shadow)!important;
      -webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturation));backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturation));
    }
    html.liquid-glass :is(.auth-box,.settings-section,.file-card,.showcase-card,.feature-card,.q-thread,.q-panel,.q-post,.cc-theme-picker) {
      background-image:radial-gradient(ellipse at var(--glass-x) var(--glass-y),rgba(255,255,255,var(--glass-energy)),transparent 62%),linear-gradient(145deg,rgba(255,255,255,.055),transparent 36%,rgba(199,232,255,.015) 75%,rgba(255,255,255,.035))!important;
      border-radius:26px;
    }
    html.liquid-glass :is(.cc-theme-picker,.q-compose){border-radius:32px}
    html.liquid-glass :is(.settings-section,.q-thread,.q-post,.q-toolbar,.auth-box,.showcase-card,.feature-card,.file-card){position:relative}
    html.liquid-glass :is(.settings-section,.q-thread,.q-post,.q-toolbar,.auth-box,.showcase-card,.feature-card,.file-card,.cc-theme-picker,.q-compose)::after{
      content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;
      background:radial-gradient(ellipse at var(--glass-x) var(--glass-y),rgba(255,255,255,.36),transparent 68%),linear-gradient(145deg,rgba(255,255,255,.32),transparent 34%,transparent 65%,rgba(220,245,255,.16));
      -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
      -webkit-mask-composite:xor;mask-composite:exclude;opacity:.8;
    }
    html.liquid-glass :is(.q-button,.cc-theme-trigger,.connected-save-btn,.cc-theme-choice,.cc-theme-modes button,.cc-theme-done,.nav-back,.icon-btn,.auth-tab,.nav-login,.nav-cta,.btn-primary,.btn-secondary,.burger,.friends-bell,.notif-bell){
      background:radial-gradient(ellipse at var(--glass-x) var(--glass-y),rgba(255,255,255,var(--glass-energy)),transparent 68%),linear-gradient(160deg,rgba(255,255,255,.06),transparent 50%),var(--glass-control)!important;
      border:1px solid var(--glass-rim);color:var(--text);border-radius:999px;
      box-shadow:inset 0 1px 0 var(--glass-shine),inset 0 -1px 0 rgba(255,255,255,.08),0 5px 16px rgba(0,10,30,.10);
      -webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%);transition:transform .28s cubic-bezier(.2,.9,.3,1),box-shadow .28s,border-color .28s,background-color .28s;
    }
    html.liquid-glass .cc-theme-choice{border-radius:20px!important}
    html.liquid-glass .auth-tab.active{background:color-mix(in srgb,var(--conch) 12%,var(--glass-control))!important;border-color:color-mix(in srgb,var(--conch) 55%,transparent)}
    html.liquid-glass :is(.cc-theme-choice[aria-pressed=true],.cc-theme-modes button[aria-pressed=true]){border-color:var(--conch)!important;outline:1px solid var(--conch);outline-offset:1px}
    html.liquid-glass :is(a,button):is(.q-button-primary,.nav-cta){background:radial-gradient(ellipse at var(--glass-x) var(--glass-y),rgba(255,255,255,var(--glass-energy)),transparent 68%),linear-gradient(155deg,color-mix(in srgb,var(--conch) 22%,transparent),color-mix(in srgb,var(--conch) 9%,transparent)),var(--glass-control)!important;border-color:color-mix(in srgb,var(--conch) 56%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--conch) 65%,white 10%),0 0 24px color-mix(in srgb,var(--conch) 10%,transparent)}
    html.liquid-glass :is(a,button).btn-primary{background:radial-gradient(ellipse at var(--glass-x) var(--glass-y),rgba(255,255,255,var(--glass-energy)),transparent 68%),linear-gradient(135deg,var(--conch),color-mix(in srgb,var(--conch) 65%,#07372d))!important;color:var(--glass-accent-ink,#04120e);border-color:color-mix(in srgb,var(--conch) 65%,white 20%);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 30px color-mix(in srgb,var(--conch) 32%,transparent),0 10px 30px rgba(0,0,0,.16)}
    html.liquid-glass :is(.q-button,.cc-theme-trigger,.connected-save-btn,.cc-theme-choice,.cc-theme-modes button,.cc-theme-done,.btn-primary,.btn-secondary,.nav-login,.nav-cta):active{transform:scale(.97)}
    html.liquid-glass .cc-glass-lit{--glass-energy:.085}
    html.liquid-glass .toggle-slider{background:var(--glass-control);box-shadow:inset 0 1px 1px var(--glass-shine),0 3px 10px rgba(0,0,0,.08)}
    html.liquid-glass .toggle-slider::after{background:linear-gradient(150deg,#fff,rgba(224,243,255,.5));box-shadow:0 1px 4px rgba(0,0,0,.2),inset 0 1px 1px #fff}
    html.liquid-glass nav{position:fixed;top:14px;left:50%;right:auto;transform:translateX(-50%);width:min(1280px,calc(100% - 32px));height:62px;padding:10px 22px;border:1px solid var(--glass-rim);border-radius:999px;background:linear-gradient(175deg,rgba(255,255,255,.035),transparent 55%),var(--glass-panel)!important;box-shadow:inset 0 1px 0 var(--glass-shine),0 12px 38px rgba(0,0,0,.20)!important}
    html.liquid-glass .q-page{padding-top:8.3rem}
    html.liquid-glass[data-cc-page="download"] .hero{padding-top:max(9rem,calc(var(--glass-nav-bottom,76px) + 3rem))}
    html.liquid-glass :is(.q-toolbar,.q-owner-controls,.q-tag-choice,.user-badge,.showcase-icon),html.liquid-glass #q-menu{background:var(--glass-control)!important;border:1px solid var(--glass-rim);box-shadow:inset 0 1px 0 var(--glass-shine);-webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%)}
    html.liquid-glass .notif-dropdown{background:linear-gradient(160deg,rgba(255,255,255,.07),transparent 55%),rgba(20,24,31,.92)!important;border:1px solid var(--glass-rim);border-radius:22px;box-shadow:inset 0 1px 0 var(--glass-shine),0 18px 55px rgba(0,0,0,.38);-webkit-backdrop-filter:blur(32px) saturate(150%);backdrop-filter:blur(32px) saturate(150%)}
    html.liquid-glass.light-mode .notif-dropdown{background:linear-gradient(160deg,rgba(255,255,255,.6),transparent 55%),rgba(244,248,253,.94)!important;box-shadow:inset 0 1px 0 var(--glass-shine),0 18px 55px rgba(16,36,61,.18)}
    @media(prefers-reduced-transparency:reduce){html.liquid-glass .notif-dropdown{background:#14181f!important;backdrop-filter:none}html.liquid-glass.light-mode .notif-dropdown{background:#f4f8fd!important}}
    html.liquid-glass :is(.q-toolbar,.q-owner-controls){border-radius:24px}
    html.liquid-glass .q-owner-controls{padding:1rem}
    html.liquid-glass #q-menu{border-radius:20px;background:var(--glass-panel)!important;top:86px;right:max(16px,calc((100vw - 1280px)/2))}
    html.liquid-glass .q-tag-choice:has(input:checked){border-color:var(--conch)}
    html.liquid-glass .showcase-icon{width:60px;height:60px;border-radius:17px}
    html.liquid-glass .sc-c .showcase-icon{background:color-mix(in srgb,var(--conch) 12%,var(--glass-control))!important}
    html.liquid-glass .sc-r .showcase-icon{background:color-mix(in srgb,var(--cmdr) 12%,var(--glass-control))!important}
    html.liquid-glass .sc-s .showcase-icon{background:color-mix(in srgb,var(--sentinel) 12%,var(--glass-control))!important}
    html.liquid-glass[data-cc-page="index"] nav{max-width:1100px}
    html.liquid-glass[data-cc-page="index"] .hero{padding:11.15rem 2.5rem 8rem}
    html.liquid-glass[data-cc-page="index"] .hero::before{display:none}
    html.liquid-glass[data-cc-page="index"] .hero h1{font-size:clamp(2.6rem,7vw,6rem);line-height:1.02;margin-bottom:1.15rem}
    html.liquid-glass[data-cc-page="index"] .hero h1 em{text-shadow:0 0 60px color-mix(in srgb,var(--conch) 13%,transparent)}
    html.liquid-glass[data-cc-page="index"] .hero p{font-size:1rem;margin-bottom:2.35rem}
    html.liquid-glass[data-cc-page="index"] .hero-btns a{font-size:.875rem;padding:.9rem 1.9rem}
    html.liquid-glass[data-cc-page="index"] .hero-tag{background:color-mix(in srgb,var(--conch) 6%,transparent);border-color:color-mix(in srgb,var(--conch) 36%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--conch) 12%,transparent),0 0 24px color-mix(in srgb,var(--conch) 6%,transparent)}
    html.liquid-glass[data-cc-page="index"] .showcase-card{padding:2rem 1.5rem}
    @supports(backdrop-filter:url("#cc-glass-refraction")){
      html.liquid-glass :is(.cc-theme-picker,.q-compose,.cc-theme-trigger,.q-button,.cc-theme-choice){backdrop-filter:blur(var(--glass-optics-blur)) saturate(var(--glass-saturation)) url("#cc-glass-refraction")}
    }
    html.liquid-glass :is(input:not([type=checkbox]):not([type=radio]):not([type=color]),textarea,select,.ver-history,.msg-input) {
      background:var(--glass-input)!important;border-color:var(--border)!important;color:var(--text)!important;
    }
    html.liquid-glass select option {background:var(--bg);color:var(--text)}
    html.liquid-glass :is(.auth-label,.auth-sub,.setting-desc,.page-sub,.section-desc,.q-muted){color:var(--muted)}
    html.liquid-glass.light-mode :is(.nav-logo .c,.q-logo .c,.page-title em,.hero h1 em,.hero-tag,.nav-cta,.cc-theme-modes button[aria-pressed=true]){color:color-mix(in srgb,var(--conch) 45%,#15243a)}
    html.liquid-glass :is(.file-card,.q-thread) {transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
    @media(hover:hover) {
      html.liquid-glass :is(.file-card,.q-thread):hover {transform:translateY(-2px);border-color:var(--conch)!important}
    }
    html.liquid-glass :is(button,a,input,textarea,select):focus-visible,
    .cc-theme-picker :is(button,input):focus-visible {
      outline:2px solid var(--conch);outline-offset:4px;
    }
    .toggle-input:focus-visible+.toggle-slider{outline:2px solid var(--conch);outline-offset:4px}
    html.liquid-glass #auth-wall {overflow-y:auto}
    .cc-theme-trigger{display:block;margin:0 auto 1rem;padding:.45rem .9rem;border:1px solid var(--border);border-radius:999px;background:var(--surface2);color:var(--text);font:inherit;font-size:.75rem;cursor:pointer}
    .cc-theme-picker{margin:auto;width:min(440px,calc(100vw - 2rem));max-height:calc(100dvh - 2rem);overflow:auto;padding:1.4rem;border:1px solid var(--border);border-radius:24px;background:var(--surface,#13151a);color:var(--text,#e8eaf0);font-family:var(--sans,'Space Grotesk',sans-serif);box-shadow:0 24px 90px rgba(0,0,0,.4)}
    .cc-theme-picker::backdrop{background:rgba(5,12,25,.65);backdrop-filter:blur(8px)}
    .cc-theme-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.4rem}
    .cc-theme-heading h2{font-size:1.3rem}
    .cc-theme-picker p{font-size:.8rem;color:var(--muted,#6b7280);line-height:1.6}
    .cc-theme-close{border:1px solid var(--border);border-radius:50%;width:32px;height:32px;background:var(--surface2);color:var(--text);font-size:1.2rem;cursor:pointer}
    .cc-theme-options{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:1.1rem 0}
    .cc-theme-choice{border:1px solid var(--border);padding:.65rem;border-radius:14px;background:var(--surface2);color:var(--text);text-align:left;font:inherit;cursor:pointer}
    .cc-theme-choice[aria-pressed=true]{border-color:var(--conch);box-shadow:0 0 0 1px var(--conch)}
    .cc-theme-sample{height:68px;border-radius:9px;margin-bottom:.6rem;padding:12px;background:#111827;display:flex;gap:6px;align-items:flex-end;overflow:hidden}
    .cc-theme-sample i{display:block;width:65%;height:38px;border:1px solid rgba(255,255,255,.18);border-radius:7px;background:#253045}
    .cc-theme-sample i+i{width:30%;height:28px}
    .cc-theme-sample-glass{background:radial-gradient(at 0% 0%,color-mix(in srgb,var(--conch) 65%,transparent),transparent 70%),radial-gradient(at 100% 100%,#692951,transparent 70%),#070b11}
    .cc-theme-sample-glass i{border-radius:12px;background:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.45);backdrop-filter:blur(5px)}
    .cc-theme-choice strong{font-size:.8rem}
    .cc-theme-modes{display:flex;gap:.4rem;margin:.65rem 0 1rem}
    .cc-theme-modes button{flex:1;border:1px solid var(--border);border-radius:8px;padding:.5rem;background:var(--surface2);color:var(--text);cursor:pointer}
    .cc-theme-modes button[aria-pressed=true]{border-color:var(--conch);color:var(--conch)}
    .cc-theme-colors{display:flex;flex-wrap:wrap;gap:.65rem;margin:.75rem 0}
    .cc-theme-color{width:28px;height:28px;border:2px solid transparent;border-radius:50%;cursor:pointer}
    .cc-theme-color[aria-pressed=true]{border-color:var(--text);outline:2px solid var(--conch);outline-offset:2px}
    .cc-theme-custom{display:flex;align-items:center;gap:.75rem;font-size:.8rem;margin:1rem 0}
    .cc-theme-custom input{width:38px;height:30px;padding:2px;background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer}
    .cc-theme-done{width:100%;padding:.7rem;border:1px solid var(--conch);border-radius:10px;background:var(--surface2);color:var(--text);font:inherit;cursor:pointer}
    :root.liquid-glass[data-glass-strength="subtle"]{--glass-blur:12px;--glass-optics-blur:9px;--glass-saturation:115%;--glass-panel:rgba(27,31,38,.78);--glass-input:rgba(10,14,20,.60);--glass-control:rgba(230,240,255,.06);--glass-rim:rgba(238,246,255,.12);--glass-shine:rgba(255,255,255,.16);--glass-shadow:0 10px 30px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.16)}
    :root.liquid-glass.light-mode[data-glass-strength="subtle"]{--glass-panel:rgba(255,255,255,.78);--glass-input:rgba(255,255,255,.70);--glass-control:rgba(255,255,255,.58);--glass-rim:rgba(255,255,255,.65);--glass-shine:rgba(255,255,255,.65);--glass-shadow:0 10px 30px rgba(35,71,111,.08),inset 0 1px 0 rgba(255,255,255,.7)}
    html.liquid-glass[data-glass-strength="subtle"] :is(.settings-section,.q-thread,.q-post,.q-toolbar,.auth-box,.showcase-card,.feature-card,.file-card,.cc-theme-picker,.q-compose)::after{opacity:.28}
    html.liquid-glass[data-glass-strength="subtle"] .cc-glass-lit{--glass-energy:.035}
    @supports not (backdrop-filter:blur(1px)) {
      :root.liquid-glass[data-glass-strength]{--glass-panel:#1b1f25;--glass-input:#101419;--glass-control:#252b33}
      :root.liquid-glass.light-mode[data-glass-strength]{--glass-panel:#f2f7fd;--glass-input:#fff;--glass-control:#f2f7fd}
    }
    @media(max-width:640px) {
      :root.liquid-glass{--glass-blur:18px;--glass-optics-blur:14px}
      :root.liquid-glass[data-glass-strength="subtle"]{--glass-blur:9px;--glass-optics-blur:7px}
      html.liquid-glass body,html.liquid-glass #auth-wall{background-attachment:scroll!important}
      html.liquid-glass nav{top:10px;width:calc(100% - 20px);height:56px;padding:8px 14px}
      html.liquid-glass .q-page{padding-top:6.8rem}
      html.liquid-glass[data-cc-page="download"] nav{display:block;height:auto;padding:10px 14px;border-radius:28px}
      html.liquid-glass[data-cc-page="download"] .nav-logo{font-size:.95rem;min-height:32px;padding-right:48px}
      html.liquid-glass[data-cc-page="download"] .nav-right{flex-wrap:wrap;justify-content:flex-start;gap:6px;margin-top:7px;min-width:0}
      html.liquid-glass[data-cc-page="download"] .burger{position:absolute;top:10px;right:14px}
      html.liquid-glass[data-cc-page="download"] .user-badge{border-radius:999px}
      html.liquid-glass[data-cc-page="download"] .user-badge-name{max-width:80px}
      html.liquid-glass[data-cc-page="index"] .nav-logo{font-size:.88rem;flex-shrink:0}
      html.liquid-glass[data-cc-page="index"] .nav-links{gap:.45rem}
      html.liquid-glass[data-cc-page="index"] :is(.nav-login,.nav-cta){padding:.5rem .6rem;font-size:.62rem;white-space:nowrap}
      html.liquid-glass[data-cc-page="index"] .hero{padding:9rem 1.25rem 4.5rem}
      html.liquid-glass[data-cc-page="index"] .hero h1{font-size:clamp(2.4rem,10vw,4rem);margin-bottom:1.5rem}
      html.liquid-glass[data-cc-page="index"] .hero p{font-size:.8rem;line-height:1.8}
      html.liquid-glass[data-cc-page="index"] .showcase{padding:0 1.25rem 4rem}
    }
    @media(max-width:360px) {
      html.liquid-glass[data-cc-page="index"] .nav-login{display:none}
    }
    @media(prefers-reduced-transparency:reduce) {
      :root.liquid-glass[data-glass-strength]{--glass-panel:#1b1f25;--glass-input:#101419;--glass-control:#252b33}
      :root.liquid-glass.light-mode[data-glass-strength]{--glass-panel:#f2f7fd;--glass-input:#fff;--glass-control:#f2f7fd}
      html.liquid-glass :is(nav,.drawer,.auth-box,.settings-section,.file-card,.q-panel,.q-thread,.cc-theme-picker,.q-compose,.q-button,.cc-theme-trigger,.cc-theme-choice){backdrop-filter:none!important}
    }
    @media(prefers-reduced-motion:reduce) {
      html.liquid-glass *,html.liquid-glass *::before,html.liquid-glass *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important;scroll-behavior:auto!important}
    }
    html.cc-no-motion *,html.cc-no-motion *::before,html.cc-no-motion *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important;scroll-behavior:auto!important}
    html.cc-no-motion :is(.seasonal-banner,.seasonal-particle,.seasonal-anniversary-card,.seasonal-anniversary-toast){animation:none!important}
    html.cc-no-motion :is(.file-card,.q-thread):hover,html.cc-no-motion :is(.q-button,.cc-theme-trigger,.connected-save-btn,.cc-theme-choice,.cc-theme-modes button,.cc-theme-done,.btn-primary,.btn-secondary,.nav-login,.nav-cta):active{transform:none!important}
  `;
  document.head.appendChild(style);
  const interfaceCSS=document.createElement('link');interfaceCSS.rel='stylesheet';interfaceCSS.href='interface.css';document.head.appendChild(interfaceCSS);
  const interfaceScript=document.createElement('script');interfaceScript.src='interface.js';interfaceScript.async=false;interfaceScript.defer=true;document.head.appendChild(interfaceScript);
  // Displace only the backdrop. Text and controls are rendered above the lens.
  function addLens() {
    if(document.getElementById('cc-glass-optics'))return;
    const optics=document.createElementNS('http://www.w3.org/2000/svg','svg');
    optics.id='cc-glass-optics';optics.setAttribute('aria-hidden','true');
    optics.style.cssText='position:fixed;width:0;height:0;pointer-events:none';
    optics.innerHTML='<defs><filter id="cc-glass-refraction" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="1" seed="3" result="lens"/><feDisplacementMap in="SourceGraphic" in2="lens" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    document.body.appendChild(optics);
  }
  let lit=null,lightingFrame=0;
  function clearLight(){if(lit){lit.classList.remove('cc-glass-lit');lit.style.removeProperty('--glass-x');lit.style.removeProperty('--glass-y');lit=null;}}
  document.addEventListener('pointermove',event=>{
    if(!root.classList.contains('liquid-glass')||root.classList.contains('cc-no-motion')||reducedMotion.matches||event.pointerType==='touch'){clearLight();return;}
    const target=event.target.closest?.('nav,.drawer,.profile-card,.user-card,.cc-social-bell,.q-button,.cc-theme-choice,.cc-theme-modes button,.cc-theme-done,.cc-theme-picker,.settings-section,.q-thread,.q-post,.q-toolbar,.auth-box,.connected-save-btn,.showcase-card,.feature-card,.file-card,.btn-primary,.btn-secondary,.nav-login,.nav-cta');
    if(lightingFrame)cancelAnimationFrame(lightingFrame);
    lightingFrame=requestAnimationFrame(()=>{
      lightingFrame=0;if(lit!==target)clearLight();if(!target)return;
      lit=target;const rect=target.getBoundingClientRect();target.style.setProperty('--glass-x',((event.clientX-rect.left)/rect.width*100)+'%');target.style.setProperty('--glass-y',((event.clientY-rect.top)/rect.height*100)+'%');target.classList.add('cc-glass-lit');
    });
  },{passive:true});
  document.addEventListener('pointerleave',clearLight);
  let dialog;
  function apply() {
    const s = state();
    root.classList.toggle('liquid-glass',s.glass);
    root.dataset.glassStrength=s.glassStrength;
    if(!s.glass||!s.motion){if(lightingFrame)cancelAnimationFrame(lightingFrame);lightingFrame=0;clearLight();}
    root.classList.toggle('light-mode',s.system ? media.matches : s.mode === 'light');
    root.classList.toggle('cc-no-motion',!s.motion);
    document.querySelector('#cc-glass-refraction feDisplacementMap')?.setAttribute('scale',s.glassStrength==='subtle'?'3':'14');
    root.style.setProperty('--conch',s.accent);
    const channels=s.accent.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
    root.style.setProperty('--glass-accent-ink',channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.32?'#04120e':'#fff');
    root.style.setProperty('color-scheme',root.classList.contains('light-mode') ? 'light' : 'dark');
    const icon = document.getElementById('theme-icon');
    if(icon)icon.textContent=s.glass ? '◈' : root.classList.contains('light-mode') ? '☀️' : '🌙';
    if(dialog) syncPicker();
    window.dispatchEvent(new Event('cc:theme-change'));
  }
  function set(values) {
    try {
      Object.entries(values).forEach(([key,value]) => localStorage.setItem(key,String(value)));
      apply();
      return true;
    } catch {
      if(dialog)dialog.querySelector('[data-status]').textContent='Your browser could not save this preference.';
      return false;
    }
  }
  function syncPicker() {
    const s=state();
    dialog.querySelectorAll('[data-glass]').forEach(el=>el.setAttribute('aria-pressed',String(s.glass === (el.dataset.glass === '1'))));
    dialog.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode === (s.system ? 'system' : s.mode))));
    dialog.querySelectorAll('[data-accent]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.accent.toLowerCase() === s.accent.toLowerCase())));
    dialog.querySelector('#cc-custom-accent').value=s.accent;
  }
  function openPicker(trigger) {
    // Only Settings and the visible registration form offer theme changes.
    const page=(location.pathname.split('/').pop()||'index').replace(/\.html$/i,'').toLowerCase();
    if(page!=='settings' && !(page==='download' && trigger?.closest('#form-reg') && document.getElementById('form-reg')?.style.display!=='none'))return;
    if(!dialog) {
      dialog=document.createElement('dialog');
      dialog.className='cc-theme-picker';dialog.setAttribute('aria-labelledby','cc-theme-title');
      dialog.innerHTML=`
        <div class="cc-theme-heading"><h2 id="cc-theme-title" data-t="theme_title">Make it yours</h2><button type="button" class="cc-theme-close" aria-label="Close theme selection" data-t-aria-label="close">×</button></div>
        <p data-t="theme_sub">Choose a finish, then add your color.</p>
        <div class="cc-theme-options" role="group" aria-label="Theme finish" data-t-aria-label="choose_theme">
          <button type="button" class="cc-theme-choice" data-glass="0"><span class="cc-theme-sample" aria-hidden="true"><i></i><i></i></span><strong data-t="classic">Classic</strong></button>
          <button type="button" class="cc-theme-choice" data-glass="1"><span class="cc-theme-sample cc-theme-sample-glass" aria-hidden="true"><i></i><i></i></span><strong>Liquid Glass</strong></button>
        </div>
        <p data-t="appearance">Appearance</p><div class="cc-theme-modes" role="group" aria-label="Color scheme" data-t-aria-label="appearance">
          <button type="button" data-mode="dark" data-t="mode_dark">Dark</button><button type="button" data-mode="light" data-t="mode_light">Light</button><button type="button" data-mode="system" data-t="mode_system">System</button>
        </div>
        <p data-t="accent_color">Accent color</p><div class="cc-theme-colors" role="group" aria-label="Accent color" data-t-aria-label="accent_color">${palette.map(([name,color])=>`<button type="button" class="cc-theme-color" data-accent="${color}" style="background:${color}" aria-label="${name}"></button>`).join('')}</div>
        <label class="cc-theme-custom" for="cc-custom-accent"><input type="color" id="cc-custom-accent"><span data-t="custom_color">Custom color</span></label>
        <p data-status role="status" data-t="saved_browser">Changes are saved in this browser.</p>
        <button type="button" class="cc-theme-done" style="margin-top:1rem" data-t="done">Done</button>`;
      dialog.querySelectorAll('[data-glass]').forEach(el=>el.onclick=()=>set({cc_liquid_glass:el.dataset.glass}));
      dialog.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>set(el.dataset.mode==='system' ? {cc_system_theme:'1'} : {cc_system_theme:'0',cc_theme:el.dataset.mode}));
      dialog.querySelectorAll('[data-accent]').forEach(el=>el.onclick=()=>set({cc_accent:el.dataset.accent}));
      dialog.querySelector('#cc-custom-accent').oninput=event=>set({cc_accent:event.target.value});
      dialog.querySelector('.cc-theme-close').onclick=()=>dialog.close();
      dialog.querySelector('.cc-theme-done').onclick=()=>dialog.close();
      dialog.addEventListener('click',event=>{
        const b=dialog.getBoundingClientRect();
        if(event.target===dialog && (event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom))dialog.close();
      });
      dialog.addEventListener('close',()=>dialog._trigger?.focus());
      document.body.appendChild(dialog);
    }
    dialog._trigger=trigger||document.activeElement;
    window.CC_I18N?.apply(dialog);
    syncPicker();dialog.showModal();
  }
  window.CC_THEME={state,apply,set,openPicker,colorCSS(value){const el=document.createElement('span');el.style.color=value;return el.style.color;}};
  media.addEventListener('change',()=>{if(state().system)apply();});
  reducedMotion.addEventListener('change',apply);
  window.addEventListener('storage',event=>{if(event.key===null||['cc_theme','cc_system_theme','cc_liquid_glass','cc_accent','cc_animations','cc_glass_strength','cc_reduce_motion'].includes(event.key))apply();});
  apply();
  document.addEventListener('DOMContentLoaded',()=>{
    addLens();apply();
    // Account badges and seasonal banners can move or resize the header.
    const nav=document.querySelector('nav');
    if(nav&&root.dataset.ccPage==='download'&&window.ResizeObserver){
      const updateSpace=()=>root.style.setProperty('--glass-nav-bottom',nav.getBoundingClientRect().bottom+'px');
      new ResizeObserver(updateSpace).observe(nav);
      new MutationObserver(updateSpace).observe(nav,{attributes:true,attributeFilter:['style']});
      updateSpace();
    }
  },{once:true});
})();

/* Questions RPC bridge. No password or password hash is persisted by this feature. */
(function () {
  const key='cc_questions_session';
  function saved() {
    try {
      const s=JSON.parse(localStorage.getItem(key)||'null');
      const user=JSON.parse(localStorage.getItem('cc_auth')||'null');
      return s && user && String(s.user_id)===String(user.id) && Date.parse(s.expires_at)>Date.now() ? s : null;
    } catch { return null; }
  }
  function account() {
    try {
      const user=JSON.parse(localStorage.getItem('cc_auth')||'null');
      return user?.id && (user.rawUsername||user.username) && !user.bypassed && !user._ownerTemp ? user : null;
    } catch { return null; }
  }
  async function request(action,data={},token) {
    const sessionToken=token ?? saved()?.token ?? null;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const r=await fetch(window.CC_CONFIG.SB_URL+'/rest/v1/rpc/cc_questions_api',{
        method:'POST',signal:controller.signal,
        headers:{apikey:window.CC_CONFIG.SB_KEY,Authorization:'Bearer '+window.CC_CONFIG.SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_action:action,p_token:sessionToken,p_data:data})
      });
      const body=await r.json().catch(()=>({}));
      if(!r.ok || body.error) {
        const e=new Error(body.error||body.message||'Questions is currently unavailable.');
        e.code=body.code||String(r.status);
        if(e.code==='42501'&&action!=='login'&&action!=='logout'&&saved()?.token===sessionToken) {
          try{localStorage.removeItem(key);}catch{}
        }
        throw e;
      }
      return body;
    } catch(e) {
      if(e.name==='AbortError')throw new Error('The request timed out. Please try again.');
      throw e;
    } finally {clearTimeout(timer);}
  }
  async function login(username,password) {
    logout();
    const session=await request('login',{username,password},'');
    try {localStorage.setItem(key,JSON.stringify(session));} catch {
      throw new Error('Your browser could not save the Questions session.');
    }
    window.dispatchEvent(new Event('cc:community-session'));
    return session;
  }
  function logout() {
    let session;
    try {session=JSON.parse(localStorage.getItem(key)||'null');localStorage.removeItem(key);}catch{}
    if(session?.token)void request('logout',{},session.token).catch(()=>{});
  }
  window.CC_QUESTIONS={request,login,logout,saved,account};
  window.addEventListener('storage',event=>{
    if((event.key==='cc_auth'||event.key===null)&&!account())logout();
  });
  document.addEventListener('DOMContentLoaded',()=>{
    if(!account())logout();
    document.querySelectorAll('.drawer-nav').forEach(menu=>{
      if(menu.querySelector('a[href="questions.html"]'))return;
      const link=document.createElement('a');link.className='drawer-item';link.href='questions.html';
      link.innerHTML='<span class="drawer-icon">💬</span><span data-t="nav_questions">Questions</span>';
      link.onclick=()=>{if(typeof window.closeDrawer==='function')window.closeDrawer();};
      const settings=menu.querySelector('a[href="settings.html"]');
      if(settings)settings.after(link);else menu.appendChild(link);
      window.CC_I18N?.apply(link);
    });
  },{once:true});
})();

/* One release request for downloads and notifications; no cache-busting URLs. */
(function () {
  const TTL=15*60*1000,MIN_REFRESH=60*1000;
  const pending=new Map(),memory=new Map();
  const rateKey='cc_github_rate_v1';
  function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
  function stored(key){return read(key)||memory.get(key)||null;}
  function save(key,value){memory.set(key,value);write(key,value);}
  function valid(rows){return Array.isArray(rows)&&rows.every(row=>row&&typeof row==='object'&&Array.isArray(row.assets)&&row.assets.every(asset=>asset&&typeof asset.name==='string'));}
  function failure(info){return Object.assign(new Error(info.message||'GitHub request failed.'),info);}
  function retryTime(response,now){
    const retry=response.headers.get('retry-after');
    const after=retry?(Number.isFinite(Number(retry))?now+Number(retry)*1000:Date.parse(retry)):0;
    const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;
    return Math.max(now+MIN_REFRESH,Number.isFinite(after)?after:0,Number.isFinite(reset)?reset:0);
  }
  async function releases({repo=window.CC_CONFIG.GITHUB_REPO,perPage=window.CC_CONFIG.MAX_RELEASES,force=false}={}){
    if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw new Error('Invalid GitHub repository.');
    perPage=Math.min(100,Math.max(1,Math.floor(Number(perPage)||20)));
    const key='cc_github_releases_v1:'+repo+':'+perPage;
    if(pending.has(key))return pending.get(key);
    async function load(){
      const now=Date.now(),record=stored(key);
      const cache=record?.version===1&&Number.isFinite(record.fetchedAt)&&record.fetchedAt<=now&&valid(record.releases)?record:null;
      const result=(error=null)=>({releases:cache.releases,fromCache:true,stale:!!error,fetchedAt:cache.fetchedAt,error,retryAt:error?.retryAt||0});
      if(cache&&now-cache.fetchedAt<(force?MIN_REFRESH:TTL))return result();
      const rate=stored(rateKey),attempt=stored(key+':attempt');
      const blocked=rate?.retryAt>now?rate:attempt?.retryAt>now?attempt:null;
      if(blocked){if(cache)return result(blocked);throw failure(blocked);}
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
      try{
        /* Persist a short pause before fetching, so another tab cannot hammer the API. */
        save(key+':attempt',{status:0,message:'Release check already in progress. Please try again shortly.',retryAt:now+MIN_REFRESH});
        const response=await fetch('https://api.github.com/repos/'+repo+'/releases?per_page='+perPage,{headers:{Accept:'application/vnd.github+json'},signal:controller.signal});
        if(!response.ok){
          const body=await response.json().catch(()=>({}));
          const rateLimited=response.status===429||(response.status===403&&(response.headers.get('x-ratelimit-remaining')==='0'||response.headers.has('retry-after')||/rate limit/i.test(body.message||'')));
          const info={status:response.status,rateLimited,message:rateLimited?'GitHub API rate limit reached.':response.status===404?'GitHub repository or releases not found.':'GitHub could not load releases ('+response.status+').',retryAt:rateLimited?retryTime(response,now):now+MIN_REFRESH};
          save(key+':attempt',info);if(rateLimited)save(rateKey,info);
          throw failure(info);
        }
        const rows=await response.json();
        if(!valid(rows))throw new Error('GitHub returned invalid release data.');
        const fresh={version:1,fetchedAt:Date.now(),releases:rows};save(key,fresh);
        save(key+':attempt',{retryAt:0});
        return {releases:rows,fromCache:false,stale:false,fetchedAt:fresh.fetchedAt,error:null,retryAt:0};
      }catch(error){
        const info={status:error.status||0,rateLimited:!!error.rateLimited,message:error.message||'Could not connect to GitHub.',retryAt:error.retryAt||Date.now()+MIN_REFRESH};
        save(key+':attempt',info);if(cache)return result(info);throw failure(info);
      }finally{clearTimeout(timeout);}
    }
    /* Web Locks share the cache between tabs as well as within this page. */
    const request=Promise.resolve().then(()=>navigator.locks?.request?navigator.locks.request(key,load):load());
    pending.set(key,request);
    try{return await request;}finally{pending.delete(key);}
  }
  window.CC_GITHUB={releases};
})();

/* Pages already using i18n.js reuse it; other pages load the shared navigation labels. */
if(!window.CC_I18N&&!document.querySelector('script[src$="i18n.js"]')){
  const languageScript=document.createElement('script');
  languageScript.src=new URL('i18n.js',document.currentScript?.src||location.href).href;
  document.head.appendChild(languageScript);
}



