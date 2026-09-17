"""serper.dev API istemcisi."""
import requests

SERPER_URL = "https://google.serper.dev/search"


def search_keyword(keyword: str, api_key: str) -> dict:
    """Verilen kelime için Google TR sonuçlarını serper.dev üzerinden çeker.

    Dönen dict içinde (varsa): organic, peopleAlsoAsk, relatedSearches, knowledgeGraph.
    """
    response = requests.post(
        SERPER_URL,
        headers={
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
        },
        json={"q": keyword, "gl": "tr", "hl": "tr"},
        timeout=25,
    )
    response.raise_for_status()
    return response.json()
