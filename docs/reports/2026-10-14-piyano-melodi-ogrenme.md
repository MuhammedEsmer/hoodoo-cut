---
type: rapor
title: 2026-10-14 Solo piyanodan melodi tespiti öğrenme + seçenek (c) donma
description: In the End piyano tutorial ile nota tespitinin ölçülüp düzeltilmesi, uzun nota aralarında donma (CEP 0.9.8.0) ve canlı bağımsız kontrol.
tags: [hoodoo, hoodoo-cut, tik-ritmi, melodi, rapor]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/client/js/tickplan.js
  - com.hoodoocut/host/index.jsx
  - tools/test-tick.js
  - tools/test-tick-host.js
created: 2026-10-14
updated: 2026-10-14
---

# Solo piyanodan melodi tespiti öğrenme + seçenek (c) donma

Kullanıcı istekleri: "c seçeneğiyle devam et" ve "yeni bir şarkı ekledim, kolay olabilecek bir kısımdan
başlattım; oradan analizini yaparak öğren". Şarkı: *Linkin Park – In The End EASY Piano Tutorial*
(solo piyano), temel sequence `2026-10-14 15-11-41` A3, kaynakta 121.65 sn'den başlıyor.

## 1. Bağımsız referans

Solo piyanoda her tuş basışı net bir atak. Referans, panel kodundan farklı bir özellikle çıkarıldı:
spektral akış (log genlik, 100–5000 Hz, FFT 2048 / 5 ms, yerel eşik), 90 ms içindeki tepeler tek tuş.
İlk 60 sn'de **121 tuş** (2.02/sn, aralık medyanı 0.305 sn ≈ 100 BPM sekizlik). Her tuşun perdesi
kromagramdan alındı (tutorial transpoze: A, D, E, C, C♯, G…). Referans zamanı pencere merkezi kuralıyla
~15–20 ms erken; karşılaştırma toleransı 35 ms.

## 2. Eski yöntemin (0.9.7.0) hataları

`detectRiffNotes`: 86 nota; **%74'ü** gerçek bir tuşa denk, tuşların **%53'ü** yakalanıyor. Üç hata türü:

| Tür | Örnek | Sebep |
|---|---|---|
| Nota geç | tuş 3.17, nota 3.37 (aynı 12.77 → 12.96) | Ritim noktalı; sekizlik takibi düzenli kalıp tuşun 0.2 sn sonrasına düşüyor, nota o noktaya yazılıyordu |
| Fazla nota | 6.65 C♯ (o anda tuş yok) | Akorun G'si sönerken sessiz C♯ baskın perde oldu |
| Eksik nota | E E E tekrarları | Yalnız perde değişimi nota sayılıyordu |

## 3. Değişiklikler (`detectRiffNotes`, 0.9.8.0)

1. **Perdeye özgü atak gücü:** 5 ms'de kromagram; bir perdenin enerjisinin önceki 20 ms'nin en
   yükseğine göre log yükselişi, eksi 12 perdenin medyan yükselişi (davul bütün perdeleri birlikte
   yükseltir). Solo piyanoda gerçek tuşlarda medyan 0.93, atak olmayan anlarda 0.27.
2. **Perde değişiminde nokta atakta değilse** nota o perdenin en güçlü atağına taşınır
   (`[t − 0.75·sekizlik, t + 0.15]`, eşik 0.45); atak yoksa sönümdür, nota yazılmaz.
3. **Yeniden vuruş:** aynı perde, güçlü atak (≥ 1.4 × medyan) ve o perdede yükseliş ≥ 0.2, ya da orta
   atak (≥ 0.8 ×) ve belirgin yükseliş ≥ 0.6. Tutulan nota ve davul nota sayılmaz.
4. **Atak eşikleri şarkıya göre:** noktaların medyan atak gücüne oranla; sessizlikten ilk giriş gibi
   tek bir dev atak ölçeği bozmasın.
5. **dB tabanı (medyan − 40 dB):** dijital sessizlikten giriş tempo aramasını bozuyordu
   (sentetik solo piyano 100 → 66.7 BPM).

Denenip bırakılanlar: salt olay tabanlı akış (piyanoda %96 ama In the End'de davul/vokal de nota oldu),
"en çok yükselen perde" şartı (gerçek yeniden vuruşları da eledi), doğrusal enerji payı (fark yok),
her notayı yakın atağa kaydırma (piyanoda kazanç yok, In the End riff tutarlılığı %81 → %56).

## 4. Sonuç (çevrimdışı)

| | Eski | Yeni |
|---|---|---|
| Piyano 0–60 sn: notaların gerçek tuşa denk gelen oranı | 64/86 (%74) | 87/99 (**%88**) |
| Piyano: yakalanan tuş | 64/121 (%53) | 87/121 (**%72**) |
| In the End (tüm şarkı): 2 ölçü sonra tekrar eden nota | %47 | %73 |
| In the End: eski notalardan korunan | — | 155/181 |

In the End için tekrar oranı dolaylı bir ölçü: davul da periyodik. Davul/yeniden vuruş ayrımı yalnız
sentetik testlerle ve perdeye özgü ölçüyle güvenceye alındı.

## 5. Seçenek (c): uzun nota aralarında donma (`alignToNotes`)

Temiz görüntü: "baş" (a'dan sonraki ilk fazla tıka kadar) ve "yaklaşma" (son fazla tıkın sesi bittikten
sonra b'ye kadar). Yetmezse baş normal hızda oynar, son 2 karesi kalan süre boyunca dondurulur (çok yavaş
hız), ortası silinir. Görünür fazla blok ve ağır çekim yok. Kısa açıklar için yavaşlatma hâlâ daha ucuz
(maliyet: donma 0.3 + 0.5/sn, yavaşlama |ln hız|).

## 6. Canlı (HDpiano, A3 kilitli piyano, video tamamı, A2 oyun sesi)

Üç tur. Her turda bağımsız kontrol yapıldı: düzenlenen A2 ve A3 dışa aktarıldı, tıklar sesten bulundu,
nota dışı tıklar kaynağa eşlenip orijinal bir tık mı diye bakıldı.

| Tur | Nota dışı tık | Bulgu → düzeltme |
|---|---|---|
| 1 | 29 / 171 | 15'i donma parçasında: 2 karelik ses %3–18 hızda uzayıp tık gibi duyuluyor → **donan karenin sesi silinir** (host) |
| 2 | 15 / 159 | 11'i kesimden 20–30 ms sonra: blok sesi ~0.3 sn, ilk 60 ms tepeye yakın; tık parçasından (3 kare) sonra başlayan görüntü kuyruğu yeni tık gibi getiriyordu → **yaklaşma fazla tıktan 150 ms sonra**; fazla tık yoksa donma **tıkın sesi bittikten sonra** |
| 3 | **8 / 159** | 1'i eşleşen tık (notadan 25 ms), 7'si kesim çevresinde başka oyun sesleri; **hiçbiri orijinal bir tık değil** |

Son tur: plan 153 tık notada, 2 nota tıksız, 54 donma (toplam 27.5 sn), 22 yavaş ara (%73–94),
20.4 sn kesildi, video +9.45 sn, 75 sn sürdü. Premiere %3'e kadar düşük hızları kabul etti; V1/A1/A2
konumları ve hızları aynı. Bağımsız: **tıkların %95'i bir notada** (medyan 5 ms), **notaların %97'sinde
tık**, tıkların %85'i gerçek bir tuşa 35 ms içinde.

## 7. In the End (çevrimdışı plan, canlı uygulanmadı)

| | Notada tık | Yavaş ara | Donma | Süre |
|---|---|---|---|---|
| 0.9.7.0 | 89 | 61 | — (54 görünür fazla tık) | +9.6 sn |
| 0.9.8.0 | 158 | 27 | 50 (35.7 sn) | +18.3 sn |

## Sınırlar

- Uzun notalı şarkıda donma toplamı yüksek (In the End'de videonun ~1/3'ü). Tıklar ~0.4 sn arayla olduğu
  için 0.3 sn'den uzun temiz görüntü yok; seçenek (c)'nin bedeli bu.
- Hemen ardışık aynı nota tekrarı (0.3 sn) her zaman ayrılamıyor (piyanoda 8.14 E kaçtı).
- Davullu karışımda yeniden vuruşlar dolaylı doğrulandı (yukarı).
- Lab: bu iş Minecraft sunucusunu/VDS'i etkilemiyor; HooDoo-Lab testi gerekmedi. Testler yerel Premiere
  test projesinde (`123tets.prproj`) yapıldı.
