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

## Hedef: Müzik melodisi (0.9.6.0)

Kullanıcı geri bildirimi: sabit BPM ızgarası "arka plandaki sabit davula göre" edit hissi
veriyor; istenen, tıkların **melodinin notalarına** (ör. piyano) oturması. Ayarlarda
**Hedef = Müzik melodisi** + **Müzik track'i** (kilitli) seçilir:

1. Tıklar oyun sesinden bulunur (aynı tespit).
2. Müzik track'i tek başına dışa aktarılır; `ACSAnalyzer.detectNotes` nota başlangıçlarını
   çıkarır: STFT 2048/10 ms, **HPSS** (zaman medyanı = harmonik, frekans medyanı = perküsif;
   ikili maske h > 2p), 150 Hz–4 kHz log-genlikte **kalıcı akış** (60 ms sonraki enerji −
   önceki 60 ms'nin maksimumu; davul ~30 ms'de söner, maske deliği nota sayılmaz), yerel
   eşik + taban 0.2. Yalnız [bölge başı, bölge sonu + uzama payı] okunur.
3. `ACSTickPlan.alignToNotes`: dinamik programlama ile sıralı tık→nota eşleşmesi; geçiş hızı
   sınırlar içinde, maliyet |ln hız| + atlanan nota (0.15) + düşen tık (0.6) − eşleşme ödülü (1).
   Bölge başı da (bölge başı → ilk tık) yeniden zamanlanır ki ilk tık notasına otursun.
4. Uygulama aynı `ACS_tickRetime` (ön ek ara da bir "gap").

Doğrulama (In the End – Linkin Park, instrumental; kullanıcı projeye ekledi):
- Nota tespiti 0–30 sn: 2.8 nota/sn, **%70'i 2 ölçü sonra tekrar ediyor** (riff yakalanıyor).
- Canlı (HDend, video tamamı, A2 oyun sesi, A3 kilitli müzik): 158 tıkın **149'u notaya**,
  105 nota tıksız, hız %50–221 (medyan ~0.94), süre +13.9 sn, 118 sn sürdü, 11 arada hız tavanı.
  **148 tık parçasının 148'i bir nota zamanının 1 kare içinde** (en kötü 8.3 ms); konumlar 3
  track'te aynı, A2 hızı 12 arada ≤0.0007 farklı (<0.3 ms); kilitli müzik dokunulmadı.
- Testler: `detectNotes` (armonikli piyano benzeri notalar + çalarken düşen davul vuruşları),
  `alignToNotes` (sıralı/sınırlı hızlar, ön ek ara).

## Müzik track'i (0.9.5.2)

Müziği bir ses track'ine koyup **kilitle**: tık ritmi kilitli track'leri tamamen işlem
dışı bırakır (düzenleme oturumu `tick` modunda kilidi hata saymaz, `ACS_tickRetime`
kilitli track'i atlar). QE seq razor kilitli track'i zaten kesmiyor (canlı doğrulandı).
Müzik yerinde kalır; video ızgaraya oturur. Müziği vuruşlar tıka denk gelecek şekilde
kaydırmak için kilidi açıp taşıyıp tekrar kilitle.

## Premiere davranışları (canlı tanı, 2026-10-14)

- **Yüksek hız tavanı:** QE `setSpeed` yüksek hızları sessizce sınırlıyor; tavan konuma
  göre değişiyor (aynı videoda 25 sn'de 3.2773, 40 sn'de ~2.1; 3.0'a kadar tam). Süre yine
  hedefte kalır → tıklar ızgarada; yalnız aranın son kaynak kareleri atlanır. Doğrulama
  plandan düşük hızı kabul edip sayar (`OK|…|capped`); aynı aranın track'leri arasında
  >0.01 fark senkron hatası sayılır. Sebep (VFR değil, medya 60.00024 fps) bulunamadı.

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

| **Yeni test videosu `2026-10-14 15-11-41` (87.7 sn, tamamı inşaat), 0.9.5.2** | **A2** | **128 BPM, 1 vuruş (0.46875)** | **145 tık / 144 ara; 143 ardışık tık tam bir vuruş arayla (en kötü 2.1 ms); 3 track aynı; kilitli A3 müzik (Elektronomia – Sky High, NCS) dokunulmadı; 16 arada Premiere hız tavanı; 114.6 sn sürdü; video 87.7 → 71.2 sn. Müzik 0.433 sn'ye kaydırıldı → vuruşlar tıklara denk** |

Müzik: `Documents\Adobe\Premiere Pro\26.0\HooDoo test muzik\Elektronomia - Sky High [NCS Release].mp3`
(ncs.io/SkyHigh, kullanıcı onayıyla indirildi). BPM kendi ölçümüyle doğrulandı: zarf
otokorelasyonu 0.470 sn (~128 BPM), vuruş fazı müzik başından 0.21 sn. NCS şartı:
açıklamada parça/sanatçı + "Music provided by NoCopyrightSounds" + bağlantı.

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
- **Yavaş:** 87.7 sn'lik videoda 288 razor + 861 taşıma = 114.6 sn. Razor her sınırda ayrı QE çağrısı; taşımalar tek tek DOM `move`. İyileştirme: taşımaları UXP motorunda tek işleme almak (`createMoveAction`), razor için şimdilik yol yok.
- Tespit tek bir gerçek bölümde ayarlandı; ayak sesi gibi diğer darbeler de tık sayılabilir → hassasiyet / en kısa aralık ile ayarlanır, marker'lardan kontrol edilir.
- Bir kez, yedekli çalışmadan sonra yedek kopyanın sekmesi öne geçti; tekrar denemede (6 sn izleme) **yeniden üretilemedi** — gözlemde kalırsa ele alınacak.
