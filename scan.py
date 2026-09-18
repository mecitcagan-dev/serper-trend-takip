"""Ana otomasyon scripti — çok kullanıcılı sürüm.

Her kullanıcı kendi Serper API key'iyle ve kendi kelime listesiyle taranır.
Veriler user_id ile izole edilir; kullanıcılar birbirinin verilerini göremez.
"""
import os
import sys
import datetime

from supabase import create_client

from serper_client import search_keyword
from compare_engine import compare_results, determine_event_type, build_summary


def get_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("HATA: SUPABASE_URL / SUPABASE_SERVICE_KEY tanımlı değil.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def get_all_users_with_serper_key(supabase) -> list[dict]:
    """Serper API key'i kayıtlı tüm kullanıcıları döner."""
    res = (
        supabase.table("profiles")
        .select("id, serper_api_key")
        .not_.is_("serper_api_key", "null")
        .neq("serper_api_key", "")
        .execute()
    )
    return res.data or []


def get_user_setting(supabase, user_id: str, key: str, default: str) -> str:
    try:
        res = (
            supabase.table("settings")
            .select("value")
            .eq("user_id", user_id)
            .eq("key", key)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]["value"]
    except Exception as e:
        print(f"UYARI: '{key}' ayarı okunamadı ({e}). Varsayılan ({default}) kullanılıyor.", file=sys.stderr)
    return default


def get_user_last_run_time(supabase, user_id: str):
    res = (
        supabase.table("runs")
        .select("run_time")
        .eq("user_id", user_id)
        .order("run_time", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    raw = res.data[0]["run_time"].replace("Z", "+00:00")
    return datetime.datetime.fromisoformat(raw)


def get_user_keywords(supabase, user_id: str) -> list[str]:
    res = (
        supabase.table("keywords")
        .select("keyword")
        .eq("user_id", user_id)
        .eq("active", True)
        .execute()
    )
    return [row["keyword"] for row in res.data]


def get_last_snapshot(supabase, user_id: str, keyword: str) -> dict | None:
    res = (
        supabase.table("keyword_snapshots")
        .select("*")
        .eq("user_id", user_id)
        .eq("keyword", keyword)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def scan_for_user(supabase, user_id: str, serper_key: str):
    """Tek bir kullanıcı için tarama yapar."""
    short_id = user_id[:8]

    # Sıklık kontrolü
    interval_str = get_user_setting(supabase, user_id, "scan_interval_minutes", "360")
    try:
        interval_minutes = int(interval_str)
    except ValueError:
        interval_minutes = 360

    last_run = get_user_last_run_time(supabase, user_id)
    if last_run is not None:
        now = datetime.datetime.now(datetime.timezone.utc)
        elapsed_minutes = (now - last_run).total_seconds() / 60
        if elapsed_minutes < interval_minutes:
            print(
                f"  [{short_id}] Henüz zamanı gelmedi "
                f"({elapsed_minutes:.1f}/{interval_minutes} dk). Atlanıyor."
            )
            return

    keywords = get_user_keywords(supabase, user_id)
    if not keywords:
        print(f"  [{short_id}] Aktif kelime yok, atlanıyor.")
        return

    all_changes = []
    run_details = {}
    new_snapshots = []

    for kw in keywords:
        print(f"  [{short_id}] Taranıyor: {kw}")
        try:
            new_result = search_keyword(kw, serper_key)
        except Exception as e:
            run_details[kw] = {"error": str(e)}
            print(f"    HATA ({kw}): {e}", file=sys.stderr)
            continue

        old_snapshot = get_last_snapshot(supabase, user_id, kw)
        changes = compare_results(old_snapshot, new_result)
        run_details[kw] = changes

        if changes.get("has_changes"):
            all_changes.append({"keyword": kw, **changes})

        new_snapshots.append({
            "keyword": kw,
            "user_id": user_id,
            "organic": new_result.get("organic", []),
            "people_also_ask": new_result.get("peopleAlsoAsk", []),
            "related_searches": new_result.get("relatedSearches", []),
        })

    if all_changes:
        summary = build_summary(all_changes)
        event_type = determine_event_type(all_changes)
    else:
        summary = "Değişiklik tespit edilmedi."
        event_type = "degisiklik_yok"

    run_res = (
        supabase.table("runs")
        .insert({
            "user_id": user_id,
            "run_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "event_type": event_type,
            "summary": summary,
            "details": run_details,
        })
        .execute()
    )
    run_id = run_res.data[0]["id"]

    for snap in new_snapshots:
        snap["run_id"] = run_id
        supabase.table("keyword_snapshots").insert(snap).execute()

    print(f"  [{short_id}] Tamamlandı. run_id={run_id} | {summary}")


def main():
    supabase = get_client()

    users = get_all_users_with_serper_key(supabase)

    if not users:
        print("Serper API key'i kayıtlı kullanıcı bulunamadı. Çıkılıyor.")
        return

    print(f"{len(users)} kullanıcı taranacak.")

    for user in users:
        user_id = user["id"]
        serper_key = user["serper_api_key"]
        print(f"Kullanıcı: {user_id[:8]}…")
        try:
            scan_for_user(supabase, user_id, serper_key)
        except Exception as e:
            print(f"  [{user_id[:8]}] HATA: {e}", file=sys.stderr)

    print("Tüm kullanıcılar işlendi.")


if __name__ == "__main__":
    main()