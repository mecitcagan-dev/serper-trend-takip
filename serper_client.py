"""serper.dev API istemcisi."""

from __future__ import annotations

import time

import requests

SERPER_URL = "https://google.serper.dev/search"
MAX_RETRIES = 3
RETRYABLE_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}


def search_keyword(
    keyword: str,
    api_key: str,
    search_config: dict | None = None,
) -> dict:
    """Verilen kelime için proje ayarlarına göre Serper sonucu çeker.

    Dönen dict içinde (varsa): organic, peopleAlsoAsk, relatedSearches, knowledgeGraph.
    """
    config = search_config or {}
    payload = {
        "q": keyword,
        "gl": (config.get("country_code") or "tr").strip().lower(),
        "hl": (config.get("language_code") or "tr").strip().lower(),
    }
    location = (config.get("location") or "").strip()
    device = (config.get("device") or "desktop").strip().lower()
    if location:
        payload["location"] = location
    if device in {"desktop", "mobile"}:
        payload["device"] = device

    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json",
    }
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(
                SERPER_URL,
                headers=headers,
                json=payload,
                timeout=25,
            )
        except requests.RequestException:
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep(2**attempt)
            continue

        if response.status_code in RETRYABLE_STATUS_CODES:
            if attempt == MAX_RETRIES - 1:
                response.raise_for_status()
            retry_after = response.headers.get("Retry-After")
            try:
                wait_seconds = max(1, min(30, int(retry_after))) if retry_after else 2**attempt
            except ValueError:
                wait_seconds = 2**attempt
            time.sleep(wait_seconds)
            continue

        response.raise_for_status()
        return response.json()

    raise RuntimeError("Serper isteği beklenmedik biçimde tamamlanamadı.")
