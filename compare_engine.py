"""Eski ve yeni serper.dev sonuçlarını karşılaştırıp değişiklikleri çıkarır."""

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


def compare_results(old_snapshot: dict | None, new_result: dict) -> dict:
    """old_snapshot: Supabase'den gelen bir önceki keyword_snapshots satırı (veya None).
    new_result: serper_client.search_keyword'un ham dönüşü.
    """
    new_organic = new_result.get("organic") or []
    new_domains = extract_domains(new_organic)
    new_paa = [q.get("question") for q in (new_result.get("peopleAlsoAsk") or [])]
    new_related = [r.get("query") for r in (new_result.get("relatedSearches") or [])]

    if not old_snapshot:
        return {
            "has_changes": False,
            "first_run": True,
            "new_domains": [],
            "removed_domains": [],
            "position_changes": [],
            "new_paa": [],
            "new_related": [],
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

    has_changes = bool(added_domains or removed_domains or position_changes or new_paa_items or new_related_items)

    return {
        "has_changes": has_changes,
        "first_run": False,
        "new_domains": added_domains,
        "removed_domains": removed_domains,
        "position_changes": position_changes,
        "new_paa": new_paa_items,
        "new_related": new_related_items,
    }


def determine_event_type(all_changes: list) -> str:
    if any(c.get("new_domains") for c in all_changes):
        return "yeni_rakip"
    if any(c.get("position_changes") for c in all_changes):
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
        if c.get("new_paa"):
            bits.append(f"{len(c['new_paa'])} yeni soru")
        if c.get("new_related"):
            bits.append(f"{len(c['new_related'])} yeni ilgili arama")
        if bits:
            parts.append(f"\"{c['keyword']}\": " + ", ".join(bits))
    return " | ".join(parts) if parts else "Değişiklik tespit edilmedi."
