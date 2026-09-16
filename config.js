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

  /* ── RELEASE COUNTDOWNS ──
     Set to null to hide a countdown entirely. */
  NEXT_RELEASE_CONCH: '2026-06-01T15:45:00Z',
  NEXT_RELEASE_CMDR: '2026-07-10T15:45:00Z',
  NEXT_RELEASE_SENTINEL: null,

  /* ── ADMIN ── */
  ADMIN_USERNAME: 'max',

  /* ── THIRD-PARTY ── */
  VPNAPI_KEY: '8f961fd03d784466b46546b5aba9ebdb',

  /* ── FEATURE FLAGS ──
     Flip these to turn features on/off site-wide. */
  ENABLE_LIVE_RELEASE_BANNER: true,
  ENABLE_DOWNLOAD_LOGGING: true,
  ENABLE_SNEAK_PEEKS: true,
};
