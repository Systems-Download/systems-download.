#!/usr/bin/env python3
"""
Regenerates sitemap.xml for systems-download.github.io.

- Static pages get a fixed priority/changefreq.
- download.html, changelog.html and announcements.html get their
  <lastmod> pulled from the latest GitHub Release date, so the
  sitemap reflects real freshness instead of a hardcoded date.

Run by the "update-sitemap" GitHub Action on every push to main and
once a day on a schedule, so it also picks up new Releases even when
nobody touches the site's source code that day.
"""
import json
import urllib.request
from datetime import datetime, timezone

REPO = "Systems-Download/Systems-Download.github.io"
BASE = "https://systems-download.github.io"

# path -> (changefreq, priority)
PAGES = {
    "": ("weekly", "1.0"),
    "/download.html": ("daily", "0.9"),
    "/announcements.html": ("weekly", "0.7"),
    "/changelog.html": ("weekly", "0.7"),
    "/faq.html": ("monthly", "0.6"),
    "/sneakpeeks.html": ("weekly", "0.5"),
    "/status.html": ("daily", "0.3"),
    "/bugreport.html": ("monthly", "0.3"),
}

# Pages whose content changes whenever a new release drops
RELEASE_DRIVEN = {"/download.html", "/changelog.html", "/announcements.html"}


def get_latest_release_date():
    """Returns the published_at date of the newest GitHub Release, or None."""
    try:
        url = f"https://api.github.com/repos/{REPO}/releases?per_page=1"
        req = urllib.request.Request(url, headers={"User-Agent": "sitemap-bot"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.load(r)
        if data:
            return data[0]["published_at"][:10]  # YYYY-MM-DD
    except Exception as e:
        print(f"Warning: could not fetch latest release date: {e}")
    return None


def main():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    release_date = get_latest_release_date() or today

    urls = []
    for path, (freq, prio) in PAGES.items():
        lastmod = release_date if path in RELEASE_DRIVEN else today
        urls.append(
            f"  <url>\n"
            f"    <loc>{BASE}{path}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <changefreq>{freq}</changefreq>\n"
            f"    <priority>{prio}</priority>\n"
            f"  </url>"
        )

    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )

    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap)

    print(f"sitemap.xml written — release-driven pages dated {release_date}, rest dated {today}")


if __name__ == "__main__":
    main()
