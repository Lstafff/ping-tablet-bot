from __future__ import annotations

import html
import re
import urllib.request
from typing import Optional


RATING_TIMEOUT_SECONDS = 8


def parse_manual_rating(raw_text: str) -> Optional[str]:
    rating = raw_text.strip().replace(",", ".")
    if re.fullmatch(r"\d+(?:\.\d+)?", rating):
        return rating
    return None


def fetch_fnt_rating(profile_url: str) -> Optional[str]:
    request = urllib.request.Request(
        profile_url,
        headers={"User-Agent": "Mozilla/5.0 PingTabletBot/1.0"},
    )
    with urllib.request.urlopen(request, timeout=RATING_TIMEOUT_SECONDS) as response:
        content_type = response.headers.get_content_charset() or "utf-8"
        page_html = response.read().decode(content_type, errors="ignore")
    return parse_fnt_rating(page_html)


def parse_fnt_rating(page_html: str) -> Optional[str]:
    normalized_html = html.unescape(page_html)
    points_match = re.search(
        r"Количество\s+очков\s*:\s*(\d+(?:[.,]\d+)?)",
        normalized_html,
        flags=re.IGNORECASE,
    )
    if points_match:
        return points_match.group(1).replace(",", ".")

    active_fnt_tab_match = re.search(
        r"<li[^>]*(?:class=['\"][^'\"]*\bact\b[^'\"]*['\"][^>]*data-tab=['\"]rat_f['\"]|"
        r"data-tab=['\"]rat_f['\"][^>]*class=['\"][^'\"]*\bact\b[^'\"]*['\"])[^>]*>"
        r".*?<dfn>\s*(\d+(?:[.,]\d+)?)\s*</dfn>",
        normalized_html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if active_fnt_tab_match:
        return active_fnt_tab_match.group(1).replace(",", ".")

    fnt_tab_match = re.search(
        r"<li[^>]*data-tab=['\"]rat_f['\"][^>]*>.*?<dfn>\s*(\d+(?:[.,]\d+)?)\s*</dfn>",
        normalized_html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if fnt_tab_match:
        return fnt_tab_match.group(1).replace(",", ".")

    json_match = re.search(
        r"['\"](?:rating|rate|reit|ratingValue)['\"]\s*:\s*['\"]?(\d+(?:[.,]\d+)?)",
        normalized_html,
        flags=re.IGNORECASE,
    )
    if json_match:
        return json_match.group(1).replace(",", ".")

    text = re.sub(r"<[^>]+>", " ", normalized_html)
    text = re.sub(r"\s+", " ", text)
    text_match = re.search(
        r"(?:рейтинг|rating|рейт)[^\d]{0,80}(\d+(?:[.,]\d+)?)",
        text,
        flags=re.IGNORECASE,
    )
    if text_match:
        return text_match.group(1).replace(",", ".")

    return None
