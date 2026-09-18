"""serper.dev API istemcisi."""

from __future__ import annotations

import requests

SERPER_URL = "https://google.serper.dev/search"


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

    response = requests.post(
        SERPER_URL,
        headers={
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=25,
    )
    response.raise_for_status()
    return response.json()
