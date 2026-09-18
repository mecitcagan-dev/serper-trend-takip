"""Eski ve yeni serper.dev sonuçlarını karşılaştırıp değişiklikleri çıkarır."""

from __future__ import annotations

from urllib.parse import urlparse

POSITION_CHANGE_THRESHOLD = 2  # bu kadar veya daha fazla sıra değişimi "değişiklik" sayılır
TOP_N = 10  # sadece ilk N organik sonuca bakılır


def extract_domains(organic_list):
    domains = []
    for item in (organic_list or [])[:TOP_N]:
        link = item.get("link", "") or ""
        try:
            domain = link.split("/")[2]
        except IndexError:
            domain = link
        domains.append(domain)
    return domains


def normalize_domain(value: str | None) -> str:
    """Bir domain/URL değerini karşılaştırma için sadeleştirir."""
    raw = (value or "").strip().lower()
    if not raw:
        return ""
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = parsed.hostname or raw.split("/")[0]
    return host.removeprefix("www.").rstrip(".")


def domain_matches(link: str | None, target_domain: str) -> bool:
    target = normalize_domain(target_domain)
    if not target:
        return False
    host = normalize_domain(link)
    return host == target or host.endswith(f".{target}")


def find_domain_position(organic_list, target_domain: str | None) -> int | None:
    """İlk 10 organik sonuçta hedef domainin pozisyonunu bulur."""
    if not normalize_domain(target_domain):
        return None
    for index, item in enumerate((organic_list or [])[:TOP_N], start=1):
        if domain_matches(item.get("link"), target_domain):
            return item.get("position") or index
    return None


def target_rank_details(old_organic, new_organic, target_domain: str | None) -> dict:
    normalized_target = normalize_domain(target_domain)
    current_position = find_domain_position(new_organic, normalized_target)
    previous_position = find_domain_position(old_organic, normalized_target)

    if not normalized_target:
        direction = "not_configured"
    elif current_position is None and previous_position is None:
        direction = "not_in_top_10"
    elif previous_position is None and current_position is not None:
        direction = "entered"
    elif previous_position is not None and current_position is None:
        direction = "left"
    elif current_position < previous_position:
        direction = "improved"
    elif current_position > previous_position:
        direction = "declined"
    else:
        direction = "unchanged"

    return {
        "target_domain": normalized_target or None,
        "target_position": current_position,
        "previous_target_position": previous_position,
        "target_position_change": (
            previous_position - current_position
            if current_position is not None and previous_position is not None
            else None
        ),
        "target_direction": direction,
    }


def compare_results(
    old_snapshot: dict | None,
    new_result: dict,
    target_domain: str | None = None,
) -> dict:
    """old_snapshot: Supabase'den gelen bir önceki keyword_snapshots satırı (veya None).
    new_result: serper_client.search_keyword'un ham dönüşü.
    """
    new_organic = new_result.get("organic") or []
    new_domains = extract_domains(new_organic)
    new_paa = [q.get("question") for q in (new_result.get("peopleAlsoAsk") or [])]
    new_related = [r.get("query") for r in (new_result.get("relatedSearches") or [])]

    old_organic = old_snapshot.get("organic") if old_snapshot else []
    rank_details = target_rank_details(old_organic, new_organic, target_domain)

    if not old_snapshot:
        if rank_details["target_domain"]:
            rank_details["target_direction"] = "baseline"
        return {
            "has_changes": False,
            "first_run": True,
            "new_domains": [],
            "removed_domains": [],
            "position_changes": [],
            "new_paa": [],
            "new_related": [],
            **rank_details,
        }

    old_organic = old_snapshot.get("organic") or []
    old_domains = extract_domains(old_organic)
    old_paa = [q.get("question") for q in (old_snapshot.get("people_also_ask") or [])]
    old_related = [r.get("query") for r in (old_snapshot.get("related_searches") or [])]

    added_domains = [d for d in new_domains if d not in old_domains]
    removed_domains = [d for d in old_domains if d not in new_domains]

    old_positions = {item.get("link"): item.get("position") for item in old_organic}
    position_changes = []
    for item in new_organic:
        link = item.get("link")
        new_pos = item.get("position")
        old_pos = old_positions.get(link)
        if old_pos is not None and new_pos is not None and abs(old_pos - new_pos) >= POSITION_CHANGE_THRESHOLD:
            position_changes.append({"link": link, "old_position": old_pos, "new_position": new_pos})

    new_paa_items = [q for q in new_paa if q and q not in old_paa]
    new_related_items = [r for r in new_related if r and r not in old_related]

    target_changed = rank_details["target_direction"] in {"entered", "left"} or (
        rank_details["target_position_change"] is not None
        and abs(rank_details["target_position_change"]) >= POSITION_CHANGE_THRESHOLD
    )
    has_changes = bool(
        added_domains
        or removed_domains
        or position_changes
        or new_paa_items
        or new_related_items
        or target_changed
    )

    return {
        "has_changes": has_changes,
        "first_run": False,
        "new_domains": added_domains,
        "removed_domains": removed_domains,
        "position_changes": position_changes,
        "new_paa": new_paa_items,
        "new_related": new_related_items,
        **rank_details,
    }


def determine_event_type(all_changes: list) -> str:
    if any(c.get("new_domains") for c in all_changes):
        return "yeni_rakip"
    if any(c.get("position_changes") or c.get("target_direction") in {"entered", "left", "improved", "declined"} for c in all_changes):
        return "siralama_degisti"
    if any(c.get("new_paa") or c.get("new_related") for c in all_changes):
        return "yeni_trend"
    return "degisiklik_yok"


def build_summary(all_changes: list) -> str:
    parts = []
    for c in all_changes:
        bits = []
        if c.get("new_domains"):
            bits.append(f"{len(c['new_domains'])} yeni rakip")
        if c.get("removed_domains"):
            bits.append(f"{len(c['removed_domains'])} rakip çıktı")
        if c.get("position_changes"):
            bits.append(f"{len(c['position_changes'])} sıralama değişimi")
        if c.get("target_direction") in {"entered", "left", "improved", "declined"}:
            rank = c.get("target_position")
            rank_label = f"#{rank}" if rank is not None else "ilk 10 dışında"
            bits.append(f"hedef sıra {rank_label}")
        if c.get("new_paa"):
            bits.append(f"{len(c['new_paa'])} yeni soru")
        if c.get("new_related"):
            bits.append(f"{len(c['new_related'])} yeni ilgili arama")
        if bits:
            parts.append(f"\"{c['keyword']}\": " + ", ".join(bits))
    return " | ".join(parts) if parts else "Değişiklik tespit edilmedi."
