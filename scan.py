"""Ana otomasyon scripti.

Akış:
1. Supabase'den aktif kelimeleri oku.
2. Her kelime için serper.dev'den güncel Google TR sonuçlarını çek.
3. Bir önceki snapshot ile karşılaştır.
4. Yeni snapshot'ı kaydet + bir "run" (activity kartı) oluştur.

GitHub Actions bu scripti .github/workflows/scan.yml içindeki cron ile
her 6 saatte bir tetikler. Gerekli ortam değişkenleri (secrets):
  SUPABASE_URL, SUPABASE_SERVICE_KEY, SERPER_API_KEY
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


def get_active_keywords(supabase) -> list[str]:
    res = supabase.table("keywords").select("keyword").eq("active", True).execute()
    return [row["keyword"] for row in res.data]


def get_last_snapshot(supabase, keyword: str) -> dict | None:
    res = (
        supabase.table("keyword_snapshots")
        .select("*")
        .eq("keyword", keyword)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def main():
    serper_key = os.environ.get("SERPER_API_KEY")
    if not serper_key:
        print("HATA: SERPER_API_KEY tanımlı değil.", file=sys.stderr)
        sys.exit(1)

    supabase = get_client()
    keywords = get_active_keywords(supabase)

    if not keywords:
        print("Aktif kelime bulunamadı, çıkılıyor.")
        return

    all_changes = []
    run_details = {}
    new_snapshots = []  # run_id atandıktan sonra yazılacak

    for kw in keywords:
        print(f"Taranıyor: {kw}")
        try:
            new_result = search_keyword(kw, serper_key)
        except Exception as e:  # API hatası, rate limit vb.
            run_details[kw] = {"error": str(e)}
            print(f"  HATA ({kw}): {e}", file=sys.stderr)
            continue

        old_snapshot = get_last_snapshot(supabase, kw)
        changes = compare_results(old_snapshot, new_result)
        run_details[kw] = changes

        if changes.get("has_changes"):
            all_changes.append({"keyword": kw, **changes})

        new_snapshots.append(
            {
                "keyword": kw,
                "organic": new_result.get("organic", []),
                "people_also_ask": new_result.get("peopleAlsoAsk", []),
                "related_searches": new_result.get("relatedSearches", []),
            }
        )

    if all_changes:
        summary = build_summary(all_changes)
        event_type = determine_event_type(all_changes)
    else:
        summary = "Değişiklik tespit edilmedi."
        event_type = "degisiklik_yok"

    run_res = (
        supabase.table("runs")
        .insert(
            {
                "run_time": datetime.datetime.utcnow().isoformat(),
                "event_type": event_type,
                "summary": summary,
                "details": run_details,
            }
        )
        .execute()
    )
    run_id = run_res.data[0]["id"]

    for snap in new_snapshots:
        snap["run_id"] = run_id
        supabase.table("keyword_snapshots").insert(snap).execute()

    print(f"Tamamlandı. run_id={run_id} | {summary}")


if __name__ == "__main__":
    main()
