from __future__ import annotations

import html
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional


RATING_TIMEOUT_SECONDS = 8
MAX_RATING_URL_LENGTH = 2048
MAX_RATING_RESPONSE_BYTES = 2 * 1024 * 1024
ALLOWED_RATING_HOSTS = frozenset({"ttfr.ru", "www.ttfr.ru", "rttf.ru", "www.rttf.ru"})


class RatingRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not is_allowed_rating_url(newurl):
            raise urllib.error.HTTPError(
                req.full_url,
                code,
                "Rating redirect target is not allowed",
                headers,
                fp,
            )
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def parse_manual_rating(raw_text: str) -> Optional[str]:
    rating = raw_text.strip().replace(",", ".")
    if re.fullmatch(r"\d+(?:\.\d+)?", rating):
        return rating
    return None


def is_allowed_rating_url(raw_url: str) -> bool:
    if len(raw_url) > MAX_RATING_URL_LENGTH:
        return False

    parsed_url = urllib.parse.urlparse(raw_url.strip())
    hostname = parsed_url.hostname.lower() if parsed_url.hostname else ""
    return parsed_url.scheme == "https" and hostname in ALLOWED_RATING_HOSTS


def fetch_fnt_rating(profile_url: str) -> Optional[str]:
    if not is_allowed_rating_url(profile_url):
        raise ValueError("Недопустимая ссылка на рейтинг.")

    request = urllib.request.Request(
        profile_url,
        headers={"User-Agent": "Mozilla/5.0 PingTabletBot/1.0"},
    )
    opener = urllib.request.build_opener(RatingRedirectHandler)
    with opener.open(request, timeout=RATING_TIMEOUT_SECONDS) as response:
        content_type = response.headers.get_content_charset() or "utf-8"
        page_html = read_limited_response(response).decode(content_type, errors="ignore")
    return parse_fnt_rating(page_html)


def read_limited_response(response) -> bytes:
    content = response.read(MAX_RATING_RESPONSE_BYTES + 1)
    if len(content) > MAX_RATING_RESPONSE_BYTES:
        raise ValueError("Страница рейтинга слишком большая.")
    return content


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
