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

from __future__ import annotations

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


def get_all_projects(supabase) -> list[dict]:
    """Aktif olsun olmasın tüm proje kayıtlarını döner.
    Proje sahipliği RLS ile değil service_role kullanan bu scriptte
    user_id üzerinden ayrıca korunur."""
    res = (
        supabase.table("projects")
        .select("id, user_id, name, target_domain, is_active")
        .order("id")
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


def get_user_last_run_time(supabase, user_id: str, project_id: int):
    res = (
        supabase.table("runs")
        .select("run_time")
        .eq("user_id", user_id)
        .eq("project_id", project_id)
        .order("run_time", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    raw = res.data[0]["run_time"].replace("Z", "+00:00")
    return datetime.datetime.fromisoformat(raw)


def get_user_keywords(supabase, user_id: str, project_id: int) -> list[dict]:
    res = (
        supabase.table("keywords")
        .select("keyword, target_domain")
        .eq("user_id", user_id)
        .eq("project_id", project_id)
        .eq("active", True)
        .execute()
    )
    return res.data or []


def get_last_snapshot(
    supabase, user_id: str, project_id: int, keyword: str
) -> dict | None:
    res = (
        supabase.table("keyword_snapshots")
        .select("*")
        .eq("user_id", user_id)
        .eq("project_id", project_id)
        .eq("keyword", keyword)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def scan_for_project(
    supabase,
    user_id: str,
    project_id: int,
    project_name: str,
    project_target_domain: str | None,
    serper_key: str,
) -> bool:
    """Tek bir proje için tarama yapar. Taramanın fiilen yapılıp
    yapılmadığını (True/False) döner — paylaşımlı key kotası sadece
    gerçekten bir tarama yapıldığında düşülür."""
    short_id = user_id[:8]
    project_label = f"{short_id}/{project_name}"

    # Sıklık kontrolü
    interval_str = get_user_setting(supabase, user_id, "scan_interval_minutes", "360")
    try:
        interval_minutes = int(interval_str)
    except ValueError:
        interval_minutes = 360

    last_run = get_user_last_run_time(supabase, user_id, project_id)
    if last_run is not None:
        now = datetime.datetime.now(datetime.timezone.utc)
        elapsed_minutes = (now - last_run).total_seconds() / 60
        if elapsed_minutes < interval_minutes:
            print(
                f"  [{project_label}] Henüz zamanı gelmedi "
                f"({elapsed_minutes:.1f}/{interval_minutes} dk). Atlanıyor."
            )
            return False

    keywords = get_user_keywords(supabase, user_id, project_id)
    if not keywords:
        print(f"  [{project_label}] Aktif kelime yok, atlanıyor.")
        return False

    all_changes = []
    run_details = {}
    new_snapshots = []

    for keyword_config in keywords:
        kw = keyword_config["keyword"]
        target_domain = (
            keyword_config.get("target_domain") or project_target_domain or ""
        ).strip()
        print(f"  [{project_label}] Taranıyor: {kw}")
        try:
            new_result = search_keyword(kw, serper_key)
        except Exception as e:
            run_details[kw] = {"error": str(e)}
            print(f"    HATA ({kw}): {e}", file=sys.stderr)
            continue

        old_snapshot = get_last_snapshot(supabase, user_id, project_id, kw)
        changes = compare_results(old_snapshot, new_result, target_domain)
        run_details[kw] = changes

        if changes.get("has_changes"):
            all_changes.append({"keyword": kw, **changes})

        new_snapshots.append({
            "keyword": kw,
            "user_id": user_id,
            "project_id": project_id,
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
            "project_id": project_id,
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

    print(f"  [{project_label}] Tamamlandı. run_id={run_id} | {summary}")
    return True


def main():
    trigger = os.environ.get("GITHUB_EVENT_NAME", "manual/local")
    workflow_run = os.environ.get("GITHUB_RUN_ID", "n/a")
    started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    print(f"Tarama başladı: {started_at} | tetikleyici={trigger} | workflow_run={workflow_run}")

    supabase = get_client()
    print("Supabase istemcisi hazır; profiller okunuyor.")
    shared_key = get_shared_serper_key()

    try:
        profiles = get_all_profiles(supabase)
    except Exception as e:
        print(
            "HATA: Supabase profilleri okunamadı. service_role GRANT'larını "
            f"kontrol edin. Ayrıntı: {e}",
            file=sys.stderr,
        )
        raise

    if not profiles:
        print("Kayıtlı profil bulunamadı. Çıkılıyor.")
        return

    projects = get_all_projects(supabase)
    projects_by_user: dict[str, list[dict]] = {}
    for project in projects:
        if not project.get("is_active", True):
            continue
        projects_by_user.setdefault(project["user_id"], []).append(project)

    print(f"{len(profiles)} profil ve {len(projects)} proje değerlendirilecek.")

    for profile in profiles:
        user_id = profile["id"]
        short_id = user_id[:8]

        user_projects = projects_by_user.get(user_id, [])
        if not user_projects:
            print(f"  [{short_id}] Aktif proje yok, atlanıyor.")
            continue

        api_key, using_shared = resolve_api_key(profile, shared_key)
        if not api_key:
            print(
                f"  [{short_id}] Kendi key'i yok ve paylaşımlı deneme hakkı "
                f"bitmiş ({profile.get('shared_key_scans_used') or 0}/{SHARED_KEY_LIMIT}). "
                f"Atlanıyor."
            )
            continue

        for project in user_projects:
            print(
                f"Kullanıcı: {short_id}… | Proje: {project['name']} "
                + (
                    f"(paylaşımlı deneme key'i — {profile.get('shared_key_scans_used') or 0}/{SHARED_KEY_LIMIT} kullanılmış)"
                    if using_shared
                    else "(kendi key'i)"
                )
            )
            try:
                did_scan = scan_for_project(
                    supabase,
                    user_id,
                    project["id"],
                    project["name"],
                    project.get("target_domain"),
                    api_key,
                )
                if did_scan and using_shared:
                    current_used = profile.get("shared_key_scans_used") or 0
                    increment_shared_key_usage(supabase, user_id, current_used)
                    profile["shared_key_scans_used"] = current_used + 1
            except Exception as e:
                print(
                    f"  [{short_id}/{project['name']}] HATA: {e}",
                    file=sys.stderr,
                )

    print("Tüm profiller işlendi.")


if __name__ == "__main__":
    main()
