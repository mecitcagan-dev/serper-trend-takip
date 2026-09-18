"""Ana otomasyon scripti — çok kullanıcılı sürüm.

Her kullanıcı öncelikle kendi Serper API key'iyle taranır. Kendi key'ini
girmemiş kullanıcılar, GitHub Secrets'taki ortak/paylaşımlı "deneme" key'i
üzerinden SHARED_KEY_LIMIT kadar (kişi başı) ücretsiz tarama hakkı alır.
Bu hak `profiles.shared_key_scans_used` sayacıyla takip edilir ve sadece bu
script (service_role ile, RLS'i bypass ederek) artırabilir — Supabase
tarafında bir trigger bu sayacın kullanıcı tarafından değiştirilmesini
engeller (bkz. schema.sql).

Veriler user_id ile izole edilir; kullanıcılar birbirinin verilerini göremez.
"""
import os
import sys
import datetime

from supabase import create_client

from serper_client import search_keyword
from compare_engine import compare_results, determine_event_type, build_summary

# Kendi key'ini girmeyen her kullanıcının ortak/paylaşımlı deneme key'iyle
# yapabileceği toplam tarama (run) sayısı. app.js'teki SHARED_KEY_LIMIT ile
# aynı tutulmalı (orası sadece görüntüleme, gerçek limit burada uygulanır).
SHARED_KEY_LIMIT = 10


def get_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("HATA: SUPABASE_URL / SUPABASE_SERVICE_KEY tanımlı değil.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def get_shared_serper_key() -> str | None:
    """Ortak/paylaşımlı deneme key'i — GitHub Secrets'tan gelir.
    SHARED_SERPER_API_KEY yoksa eski SERPER_API_KEY secret'ına düşer."""
    return os.environ.get("SHARED_SERPER_API_KEY") or os.environ.get("SERPER_API_KEY")


def get_all_profiles(supabase) -> list[dict]:
    """Aktif kelimesi olsun olmasın tüm profilleri döner — key kararı
    (kendi key'i / paylaşımlı key / hiçbiri) burada, koddan sonra verilir."""
    res = (
        supabase.table("profiles")
        .select("id, serper_api_key, shared_key_scans_used")
        .execute()
    )
    return res.data or []


def resolve_api_key(profile: dict, shared_key: str | None) -> tuple[str | None, bool]:
    """Bu kullanıcı için hangi Serper key'in kullanılacağına karar verir.
    Döner: (api_key veya None, paylaşımlı_key_mi)."""
    own_key = (profile.get("serper_api_key") or "").strip()
    if own_key:
        return own_key, False

    if shared_key:
        used = profile.get("shared_key_scans_used") or 0
        if used < SHARED_KEY_LIMIT:
            return shared_key, True

    return None, False


def increment_shared_key_usage(supabase, user_id: str, current_used: int):
    supabase.table("profiles").update(
        {"shared_key_scans_used": (current_used or 0) + 1}
    ).eq("id", user_id).execute()


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


def scan_for_user(supabase, user_id: str, serper_key: str) -> bool:
    """Tek bir kullanıcı için tarama yapar. Taramanın fiilen yapılıp
    yapılmadığını (True/False) döner — paylaşımlı key kotası sadece
    gerçekten bir tarama yapıldığında düşülür."""
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
            return False

    keywords = get_user_keywords(supabase, user_id)
    if not keywords:
        print(f"  [{short_id}] Aktif kelime yok, atlanıyor.")
        return False

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
    return True


def main():
    supabase = get_client()
    shared_key = get_shared_serper_key()

    profiles = get_all_profiles(supabase)

    if not profiles:
        print("Kayıtlı profil bulunamadı. Çıkılıyor.")
        return

    print(f"{len(profiles)} profil değerlendirilecek.")

    for profile in profiles:
        user_id = profile["id"]
        short_id = user_id[:8]

        api_key, using_shared = resolve_api_key(profile, shared_key)
        if not api_key:
            print(
                f"  [{short_id}] Kendi key'i yok ve paylaşımlı deneme hakkı "
                f"bitmiş ({profile.get('shared_key_scans_used') or 0}/{SHARED_KEY_LIMIT}). "
                f"Atlanıyor."
            )
            continue

        print(
            f"Kullanıcı: {short_id}… "
            + (
                f"(paylaşımlı deneme key'i — {profile.get('shared_key_scans_used') or 0}/{SHARED_KEY_LIMIT} kullanılmış)"
                if using_shared
                else "(kendi key'i)"
            )
        )
        try:
            did_scan = scan_for_user(supabase, user_id, api_key)
            if did_scan and using_shared:
                increment_shared_key_usage(
                    supabase, user_id, profile.get("shared_key_scans_used") or 0
                )
        except Exception as e:
            print(f"  [{short_id}] HATA: {e}", file=sys.stderr)

    print("Tüm profiller işlendi.")


if __name__ == "__main__":
    main()