---
type: konsept
title: HooDoo Cut Tık Ritmi
description: Blok koyma/kırma tıklarını sabit aralıklı ızgaraya oturtan mod — tespit, plan, hız değiştirme ve canlı doğrulama.
tags: [hoodoo, hoodoo-cut, tik-ritmi, setSpeed, onset]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/tickplan.js
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/client/js/main.js
  - com.hoodoocut/host/index.jsx
  - tools/test-tick.js
  - tools/test-tick-host.js
created: 2026-10-14
updated: 2026-10-14
---

# HooDoo Cut Tık Ritmi

Minecraft editlerinde blok koyma/kırma sesleri ("tık") müzikle ritim yakalamak
için sabit aralıkla gelmeli. Bu mod (0.9.5.0+) seçili bölgedeki tıkları bulur ve
her tıktan sonraki ara kısmı **hızlandırıp/yavaşlatarak** bir sonraki tıkı tam
bir aralık (T) sonra getirir. Tasarım ve tanı geçmişi:
[[plans/2026-10-14-tik-ritmi|tık ritmi planı]].

```
tık₁ ─[ tık parçası, %100 ]─[ ara, hız s ]─ tık₂      toplam = T
s = (gerçek aralık − tık parçası) / (T − tık parçası)
```

## Kullanım

1. **Mod → Tık ritmi.** Ses eşiği ve şablon kartları gizlenir.
2. **Analiz Sesi:** yalnız oyun sesi track'i (test projesinde A2).
3. **Kapsam → Seçili clipler**, timeline'da inşaat bölümünü seç (zorunlu).
4. Ayarlar: tık aralığı (sn) **veya** BPM + bölüm — iki tık arasında olmasını istediğin
   süre, sonuçtaki "doğal tık aralığı"na yakın seçilmeli; tık parçası (kare, varsayılan 3);
   hassasiyet (dB, 12 = yalnız güçlü tıklar); en kısa tık aralığı (ms, 200, en az 100);
   hız sınırı (%50–%400).
5. **🎵 Tıkları Bul** → tıklar `HooDoo tik` adlı sequence marker'ı olarak konur;
   sonuçta tık/ara sayısı, hız aralığı, süre değişimi.
6. **🎯 Ritme Oturt** (iki tık onay) → razor + yeniden zamanlama; marker'lar silinir.

## Parçalar

| Katman | Fonksiyon | Görev |
|---|---|---|
| Tespit | `ACSAnalyzer.detectOnsets` | (0.9.5.1) Tam bant 60 Hz–15 kHz, 5 ms zarf — Premiere dalga formuyla aynı. Tık = iki yana da ≥12 dB düşen **belirgin tepe**; zaman = tepenin atak başlangıcı (tepe −10 dB). Bölgedeki en güçlü tıkın `relDb` altı elenir; `minGap` (en az 100 ms) içindeki iki tepeden **güçlü olan** kalır. Atak bölgeden önce başlıyorsa sayılmaz |
| Plan | `ACSTickPlan.planTicks` | Kareye hizalar; alt hız sınırına inmeyi gerektiren yakın tık öncekine katılır (`merged`); üst sınırı aşan hız sınıra çekilir (`limited`, fazla kaynak düşer) |
| Uygulama | `ACS_tickRetime` (host) | Tüm içerik track'lerinde: 1) kısalacak parçalar: `end` → `setSpeed`; 2) sola kayanlar soldan, sağa kayanlar sağdan `move`; 3) uzayacak parçalar: `end` → `setSpeed`; sonra yerleşim + hız doğrulaması |
| Önizleme | `ACS_setTickMarkers` / `ACS_clearTickMarkers` | Yalnız `HooDoo tik` adlı marker'lar yönetilir |

## Premiere davranışları (canlı tanı, 2026-10-14)

- QE `TrackItem.setSpeed(hız, '', false, false, false)`: hız **oran** (0.5 = %50);
  **timeline süresini asla değiştirmez**, yalnız kaynak aralığını; linkli
  partnerlere yayılmaz → her track'teki parça ayrı.
- `end` önce yazılıp sonra `setSpeed` verilirse kaynak = hedef süre × hız (doğru).
  Ters sıra hızı bozuyor (2 → 1.769, track'ler arası fark, senkron işareti).
- DOM `inPoint/outPoint` hızlı kliplerde **hıza bölünmüş** raporlanır (gerçek
  kaynak = değer × hız).
- DOM `move` yalnız o klibi taşır.

## Canlı doğrulama (test projesi `123tets.prproj`, sequence kopyası)

| Bölge | Ses | T | Sonuç |
|---|---|---|---|
| Yapay tıklar 100–103.35 sn | — | 0.5 | 6 tık 0.5 sn ızgarada, 3 track aynı, kaynak kesintisiz (649 ms) |
| 172–180 sn (panel arayüzü) | A1 | 0.4 | 7–8 tık 0.4 sn ızgarada, 3 track aynı (1.1–1.5 sn) |
| 954.46–961.76 sn, 0.9.5.0 tespiti | A2 | 0.3 | 16 tık ızgarada ama marker'lar 12–62 ms erken ve zayıf sesler de tık sayıldı (aşağıya bkz.) |
| **954.46–961.76 sn, 0.9.5.1 tespiti** | **A2** | **0.4** | **10 tık (doğal aralık 0.40 sn), marker'lar tepe atağının 6–11 ms içinde; yalnız bir çift aralık ×2.14; tıklar tam 0.4 sn arayla, 3 track aynı (1.1 sn)** |

### 0.9.5.1 düzeltmesi (kullanıcı geri bildirimi: "marker'lar asla oturmuyor")

- Bölümde iki ses ailesi var: güçlü blok sesleri (−26…−30 dB, zaten ~0.4 sn ritimde) ve
  12–15 dB zayıf başka bir ses. Eski HPF 1 kHz ikisini eşit gösterip hepsini tık sayıyordu.
- Eski "ani yükseliş" yöntemi dijital sessizlikte tıktan hemen önceki küçük sesi seçiyordu
  (marker 12–62 ms erken). Tepe tabanlı tespitle düzeldi; regresyon testi:
  `a faint sound just before a click does not steal its marker`.
- Kullanıcı ayarı: aralık 0.1 sn (doğal 0.4) → hızlar %400 sınırında, −2.75 sn. Sonuca
  "Doğal tık aralığı" ve çok farklıysa uyarı eklendi; en kısa tık aralığı ≥100 ms
  (tek blok sesinin ~60 ms arayla iki tepesi var).

Testler: `tools/test-tick.js` (plan + tespit, 9), `tools/test-tick-host.js` (host, 5),
`tools/test-panel.js` tık senaryoları (4).

## Sınırlar

- Her `move`/`end`/`setSpeed` ayrı undo adımı → geri almak için yedek sequence önerilir.
- Bölgeden sonraki bütün klipler tek tek taşınır; çok klipli uzun timeline'da yavaşlayabilir (UXP tek işleme taşınabilir).
- Tespit tek bir gerçek bölümde ayarlandı; ayak sesi gibi diğer darbeler de tık sayılabilir → hassasiyet / en kısa aralık ile ayarlanır, marker'lardan kontrol edilir.
- Bir kez, yedekli çalışmadan sonra yedek kopyanın sekmesi öne geçti; tekrar denemede (6 sn izleme) **yeniden üretilemedi** — gözlemde kalırsa ele alınacak.
