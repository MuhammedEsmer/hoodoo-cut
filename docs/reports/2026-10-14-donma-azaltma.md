---
type: rapor
title: 2026-10-14 Donma azaltma (CEP 0.9.8.1)
description: Seçenek (c)'de uzun donmaların sebebi, maliyet/aday değişikliği ve piyano + In the End canlı kontrolü.
tags: [hoodoo, hoodoo-cut, tik-ritmi, donma, rapor]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/tickplan.js
  - tools/test-tick.js
created: 2026-10-14
updated: 2026-10-14
---

# Donma azaltma (CEP 0.9.8.1)

Kullanıcı: "donmayı azalt" ve "In the End'i de yeni sürümle dene". Bir önceki soruda %70'e kadar hafif
ağır çekim önerilmişti.

## Sebep

0.9.8.0'da DP her eşleşen tık için ödül (−1) alıyor, donma ucuzdu (0.3 + 0.5/sn). Melodi notaları
tıklardan seyrek olunca (tık ~2.5/sn) DP ardışık tıkları eşleyip aradaki boşluğu donmayla dolduruyordu:
video uzadı (piyano +9.4 sn, In the End +18.3 sn). Fazla tıklar arasındaki temiz görüntünün etkisi
ölçüldüğünde neredeyse yoktu; asıl kaldıraç maliyetti.

## Çevrimdışı tarama (gerçek tıklar + iki şarkının notaları)

| Ayar | Piyano donma | In the End donma | Not |
|---|---|---|---|
| 0.9.8.0 | 54 / 27.5 sn | 50 / 35.7 sn | ağır çekim 12–14 sn |
| donma 1.5/sn | 20 / 11.6 sn | 31 / 17.7 sn | ağır çekim %50'ye iniyor |
| donma 2.5/sn + sınır %70 | 32 / 13.7 sn | 28 / 11.3 sn | |
| **+ aralar + birlikte hafif yavaşlama** | **18 / 3.5 sn** | **9 / 3.1 sn** | ~46 sn ağır çekim (%67+) |
| fazla tık sesi 200 ms | 2 / 0.2 sn | 15 / 5.2 sn | piyanoda video 87 → 61 sn (saniyelerce görüntü atlanıyor) → 175 ms seçildi |

## Değişiklik (`alignToNotes`)

- Donma 0.3 + 2.5/sn; yavaşlama sınırı max(minSpeed, %70).
- Temiz bölümler: baş, fazla tıklar arası, yaklaşma (0.1 sn'den kısa olanlar dışarıda). Toplam yeterse
  baş + yaklaşma + en uzun aralar normal hızda; yetmezse hepsi birlikte hafifçe yavaşlar, en son kısa donma.
- Bölüm fazla tıktan 1 kare önce biter; fazla tıktan sonraki bölüm 175 ms sonra başlar.

## Canlı (0.9.8.1)

İlk turda (1 kare pay yok, fazla tık sesi 150 ms) piyanoda 7 fazla blok sesi duyuldu: yavaşlayan bölüm bir sonraki fazla
tıkın atağının ilk milisaniyelerini içeriyordu → 1 kare pay + 175 ms ile düzeldi.

| | Piyano (HDpiano) | In the End (HDend) |
|---|---|---|
| Notada tık | 129 plan; kontrolde 125/140 (%89) | 118 plan; kontrolde 114/126 (%90) |
| Donma | 19 yer / 6.5 sn (önce 27.5 sn) | 16 yer / 5.4 sn (plan önce 35.7 sn) |
| Hafif ağır çekim | 112 parça, 45 sn, %67–94 | 95 parça, 47 sn, %70–98 |
| Video süresi | −0.15 sn | −3.7 sn |
| Görünür fazla blok | 0 | 0 (2 eşleşen tık notadan 25 ms) |
| Diğer nota dışı ses | 15 (kesim çevresinde oyun sesleri) | 10 |
| Süre | 114 sn | 105 sn |

Kontrol notaları panelle aynı aralıktan hesaplanmalı: 0–110 sn ile hesaplanınca In the End'de 16 eşleşen
tık "nota dışı" göründü (göreli atak eşikleri analiz aralığının medyanına bağlı).

Karşılaştırma için projede: "Piyano v1 (0.9.8.0)", "Melodi v3 (0.9.7.0)", yeni HDpiano ve HDend (0.9.8.1).

## Sınırlar

- Hafif ağır çekimde oyun sesi de yavaşlar (perde düşer).
- Nota analizi göreli eşikler yüzünden analiz aralığına biraz bağlı; aynı bölüm farklı seçimle biraz farklı
  notalar verebilir.
