# UI Context

## Tema

Koyu/açık iki tema destekleniyor, `<html data-theme="dark|light">`
attribute'u ile kontrol ediliyor, varsayılan koyu. Tema tercihi
`localStorage['stt-theme']` içinde kalıcı. Görsel dil: koyu teknik bir
"activity feed" arayüzü — neredeyse siyah/gri paneller, ince
kenarlıklar, mavi vurgu rengi ve olay tipine göre renklendirilmiş ikon
rozetleri.

## Renkler

Tüm renkler `:root` (koyu, varsayılan) ve `:root[data-theme='light']`
(açık) altında CSS custom property olarak tanımlı; component'ler asla
hardcoded hex kullanmaz, hep bu token'ları referans alır.

| Rol | CSS Değişkeni | Koyu | Açık |
| --- | --- | --- | --- |
| Sol/orta panel arka planı | `--bg-rail` | `#0b0c0e` | `#eef0f4` |
| Ana panel arka planı | `--bg-panel` | `#131417` | `#ffffff` |
| Yükseltilmiş yüzey (kart, modal) | `--bg-elevated` | `#1b1c20` | `#f6f7f9` |
| Hover durumu | `--bg-elevated-hover` | `#232428` | `#ebedf1` |
| Kenarlık | `--border` | `#2a2b30` | `#dfe2e8` |
| İnce kenarlık | `--border-soft` | `#202126` | `#e8eaee` |
| Ana metin | `--text-primary` | `#edecea` | `#16171a` |
| İkincil metin | `--text-secondary` | `#93949a` | `#6b6d76` |
| Üçüncül/soluk metin | `--text-tertiary` | `#5e5f66` | `#9a9ca6` |
| Vurgu (accent) | `--accent` | `#5b8cff` | `#3d6df2` |
| Vurgu (yumuşak zemin) | `--accent-soft` | `rgba(91,140,255,.14)` | `rgba(61,109,242,.1)` |
| Hata/tehlike | `--danger` | `#ef6a63` | `#d9463f` |
| Hata (yumuşak zemin) | `--danger-soft` | `rgba(239,106,99,.12)` | `rgba(217,70,63,.08)` |
| Olay: yeni rakip | `--ev-rakip` / `--ev-rakip-soft` | `#ff9f4a` | `#d97a1f` |
| Olay: sıralama değişimi | `--ev-siralama` / `--ev-siralama-soft` | `#5b8cff` | `#3d6df2` |
| Olay: yeni trend | `--ev-trend` / `--ev-trend-soft` | `#b487ff` | `#8354dd` |
| Olay: değişiklik yok | `--ev-none` / `--ev-none-soft` | `#93949a` | `#6b6d76` |

## Tipografi

| Rol | Font | Not |
| --- | --- | --- |
| UI metni | Inter (400/500/600/700) | Google Fonts üzerinden yükleniyor |
| Mono/kod | JetBrains Mono (400/500) | `.mono` class'ı ve detay panelindeki sıralama listeleri (`detail-keyword-block li`) için kullanılır |

## Border Radius

| Bağlam | Yaklaşık değer |
| --- | --- |
| Küçük buton/ikon buton | 6–9px |
| Sekme (tab) | 20px (pill) |
| Kart (feed-card-icon, quota-badge) | 8–9px |
| Panel/modal | 12–16px |
| Avatar | 50% (tam yuvarlak) |

## Component Kütüphanesi

Yok — hiçbir UI kütüphanesi (shadcn, MUI vb.) kullanılmıyor. Tüm
component'ler elle yazılmış CSS class'ları ile (BEM'e yakın,
kebab-case: `feed-card`, `feed-card-icon`, `modal-header` vb.). Yeni
bir component eklenirken bu isimlendirme deseni ve token kullanımı
korunmalı.

## Layout Desenleri

- **Ana uygulama**: `.app` — CSS grid, 2 kolon
  (`minmax(320px,400px) 1fr`): sol/orta "feed-panel" + sağ
  "detail-panel". 900px altında tek kolona düşer, detay paneli
  mobilde tamamen gizlenir (`display: none`) — henüz mobil detay
  görünümü yok.
- **Modallar**: Ortalanmış overlay + yarı saydam siyah backdrop
  (`rgba(0,0,0,.55)`), `.modal-overlay.open` ile açılır/kapanır
  (class toggle, animasyon yok — sadece auth-box'ta giriş animasyonu
  var).
- **Profil menüsü**: Sayfanın sağ üstüne `position: fixed` ile
  sabitlenmiş avatar + açılır dropdown.
- **Auth ekranı**: Tam ekran overlay (`.auth-gate`,
  `position: fixed; inset: 0`), üç farklı görünüm (form / email
  doğrulama bekleniyor / doğrulandı) aynı DOM'da, `.hidden` class'ı
  ile geçiş yapılıyor.

## İkonlar

Kütüphane yok — tüm ikonlar elle yazılmış inline SVG, stroke tabanlı,
`stroke="currentColor"` ile tema rengini otomatik alıyor. Google logosu
istisna, marka renkleriyle sabit. Yeni ikon eklerken aynı stil (ince
stroke, ~1.4–1.6 stroke-width, 18–20 viewBox) korunmalı.
