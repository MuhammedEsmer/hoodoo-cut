---
type: rapor
title: Müzik ritmi (akış) hedefi — CEP 0.9.9.3
description: Tıkları müziğin ritim ızgarasında sabit aralıkla oturtan yeni hedef; ızgara doğruluğu ve canlı HDflow sonucu.
tags: [hoodoo, hoodoo-cut, tik-ritmi, akis, beat-tracking]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/client/js/tickplan.js
  - com.hoodoocut/client/js/main.js
  - com.hoodoocut/client/index.html
  - tools/test-tick.js
created: 2026-10-16
updated: 2026-10-16
---

# Müzik ritmi (akış) hedefi — CEP 0.9.9.3 (2026-10-16)

## İstek

- Kullanıcı bir referans edit verdi; analizi: [[reports/2026-10-16-referans-edit-analizi|referans edit analizi]].
- Kullanıcı: "elle edit yapıldığı için hatasız ayar yapılamaz zaten o videoda. Kırmadan değil block koymadan
  ilerleyebilirsin. Hangi yönde ilerleyeceğini sen seç."
- Seçilen yön: **akış**. Referanstaki sabit, hızlı vuruş ritmi alınır ama aralık ve faz müziğin kendisinden gelir.
  Elle yapılan editin kayması (0.317 sn aralık, 0.277 sn sekizlik) olmaz.

## Yöntem

**1. Ritim ızgarası** — `ACSAnalyzer.detectBeatGrid`, panelde, Python yok.
- Onset gücü üç bantta: ≤200 Hz kick, 200–2000 Hz trampet/gövde, 2–12 kHz zil.
  - 5 ms log-enerji yükselişi, bant başına sd ile ölçeklenip toplanır.
- Sekizlik periyodu ve takip melodi analiziyle aynı kod.
  - Ortak yardımcılar: `bandFlux`, `eighthPeriod`, `trackPulse` (detectRiffNotes'tan ayrıldı, davranış aynı, testler geçti).
  - Periyot aramasına 0.27 sn (~110 BPM) çevresine log-Gauss öncelik eklendi.
- **Vuruş fazı:** her bant çift/tek sekizlik farkını göreli oylar.
  - Tek bant yetmiyor: In the End'de vuruşu orta/tiz bant ayırıyor, Sky High'da (EDM, ara vuruşta bas/zil) yalnız alçak bant.
  - Önce yalnız alçak + orta bant toplamı kullanıldı: Sky High ve referans müzikte faz tersti (%0 / %2 doğru).
- **Atağa göre kayma düzeltmesi:**
  - Belirgin atağın başı (tam bant 1 ms, tepe − 10 dB; tıklarla aynı ölçüt) ile takip noktası arasındaki fark, ±8 noktalık medyanla yumuşatılıp eklenir.
  - Noktaları tek tek atağa oturtmak denendi, bırakıldı: aralıklar düzensizleşti (In the End ardışık aralık farkı medyanı 5 → 16 ms; ±25 ms içinde bazen sonraki çalgının atağı seçiliyordu).
  - Zarf tepesinde pencere içi konum parabolle bulunur.

**2. Hedefler** — `ACSTickPlan.flowTargets`.
- Seçenekler: onaltılık (sekizlik ortaları da), sekizlik, vuruş (fazdaki sekizlikler).
- Otomatik seçim: doğal tık aralığının %55'inden kısa olmayan en kısa seçenek, yani tıktan tıka görüntünün en çok ~%45'i kesilir. Hiçbiri olmazsa vuruş.

**3. Eşleşme** — mevcut `alignToNotes`, nota yerine ritim noktaları verilir.
- Kaynak hedeften uzunsa görüntü kesilir (vuruştan önceki son kısım normal hızda), kısaysa hafif ağır çekim.
- Atlanan nokta 0.4 maliyetli olduğundan tıklar ardışık noktalara oturur: sabit akış.
- Ayrı tık sesi (A5), kare içi hassasiyet ve kesim kuralları melodi hedefiyle aynı.

**4. Panel** — Hedef → **Müzik ritmi (akış)**, "Akış aralığı: Otomatik / 1/16 / 1/8 / 1/4".
- Müzik track'i ve "Tık sesleri" alanları paylaşılır. Demucs seçeneği yalnız melodide.

## Izgara doğruluğu (çevrimdışı)

Bağımsız referans Beat This (CPJKU). 20 ms nicemlemesi ±4 vuruşluk yerel doğruyla yumuşatıldı.

| Müzik | Tempo (biz / BT) | Sekizlik sapma medyanı | ≤10 ms | ≤20 ms | Vuruş fazı doğru | Atağa göre (çeyrekler arası) |
|---|---|---|---|---|---|---|
| In the End | 105.3 / 103.9 | 5.7 ms | %75 | %90 | %95 | +0.5 ms (−7…+6) |
| Sky High (EDM) | 127.7 / 128.2 | 17.0 ms* | %11 | %69 | %99 | 0.0 ms (−3…+1) |
| Referans (oyun sesi karışık) | 108.6 / 105.9 | 10.9 ms | %47 | %81 | %92 | +1.3 ms (−8…+5) |

\* Sky High'da Beat This'in kendisi atakların ~14 ms gerisinde (tam bant atağa göre medyan +14 ms). Bizim ızgara
atağa medyan 0 ms. Yani bu fark Beat This'in yanlılığı.

- Analiz süresi 236 sn'lik şarkıda ~0.65 sn.
- Solo piyanoda (vurmalı yok) Beat This de kararsız (50.9/63.5 BPM). Piyano için melodi hedefi kullanılmalı.

## Canlı test (HDflow, 2026-10-16)

- Sequence: `2026-10-14 15-11-41` kopyası (blok koyma, 87.7 sn). A3 kilitli *In the End (Instrumental)*.
  Analiz sesi A2, kapsam seçili klipler.
- Kurulu panel kopyası (`%APPDATA%\Adobe\CEP\extensions\com.hoodoocut`, junction değil) repodan güncellendi.
  Premiere'i Claude başlattı.
- **Analiz:**
  - 105.3 BPM, 757 sekizlik, otomatik hedef **sekizlik (0.285 sn)**; ızgara 0.8 sn'de çıktı.
  - 158 tık, 158'i eşleşti, 1 ritim noktası atlandı, 152 ara. Hız %71–89 (51 ara hafif yavaş), görüntüden 39.2 sn kesilecek, süre −37.95 sn.
- **Uygulama:** 204.6 sn.
  - 304 razor, 51 hız değişimi, 504 taşıma, 405 parça silindi.
  - 158 tık sesi A5'e kondu (en büyük sapma 0.00 ms), bölgedeki asıl ses silindi (336 parça).
- **Bağımsız kontrol:**
  - Yöntem: A5 dilimlerinin medya aralığındaki kaynak tık (orijinal oyun sesinden, panelle aynı algılayıcı); çıktıdaki yeri = klip başı + (tık − medya in).

| Referans | Medyan sapma | İşaretli medyan | q90 | En kötü | ≤10 ms | ≤20 ms |
|---|---|---|---|---|---|---|
| Beat This sekizlikleri (bağımsız) | 3.9 ms | −0.7 ms | 9.7 ms | 35.5 ms | %91 | %97 |
| Panel ızgarası (aynı analiz aralığı) | 0.00 ms | — | — | 1.0 ms | %100 | %100 |

- **Düzen:** 157 ardışık aralığın 156'sı tam bir sekizlik, 1'i iki sekizlik. Tıklar 45.1 sn'ye yayılıyor (önceden 87.7 sn).
- BT'den >20 ms sapanlar şarkı başında (3.2–3.5 sn, BT yumuşatma kenarı) ve 17.5–18.1 sn'de (geçiş, iki yöntem 25–35 ms ayrılıyor).

## Testler

`tools/test-tick.js` +4:
- Rock davulunda sekizlikler 10 ms içinde, tempo, faz.
- Ara vuruşta güçlü zilli four-on-the-floor'da vuruş kick'te.
- Otomatik adım seçimi.
- Düzensiz doğal aralıkta tıklar ardışık sekizliklere, görüntü yalnız kesilir.

Toplam 131 PASS, 0 FAIL.

## Sınırlar

- Izgara tek tempo varsayımıyla takip ediliyor. Tempo değişimini takip yerel olarak izler, ama büyük değişimde (ör. yarı tempoya geçiş) aralık seçimi bütün bölge için tek.
- Otomatik adım yalnız doğal tık aralığına bakıyor; müziğin yoğunluğuna bakmıyor.
- Kullanıcının izlemesi gerekiyor: 0.285 sn'lik sabit akışın görüntüde nasıl durduğu (kesilen kısımlar kamera sıçraması yapabilir) ölçülmedi, yalnız ses zamanlaması ölçüldü.
- Lab: bu iş Minecraft sunucusunu/VDS'i etkilemiyor; HooDoo-Lab testi gerekmedi.
