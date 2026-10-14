---
type: referans
title: HooDoo Cut Bilinen Sınırlar
description: Teknik sınırlar, açık riskler, doğrulanmamış iddialar ve yol haritası.
tags: [hoodoo, hoodoo-cut, sınırlar, risk, yol-haritası]
proje: [hoodoo-cut]
sources:
  - README.md
  - docs/reports/2026-10-05-teknik-analiz.md
  - install.ps1
  - DISTRIBUTION.md
created: 2026-10-11
updated: 2026-10-11
---

# HooDoo Cut Bilinen Sınırlar

## Platform sınırları

- **Scripting API tek thread, işlem başına pahalı.** Optimizasyon azaltır, sıfırlamaz.
- **Undo** ExtendScript'ten kapatılamaz/temizlenemez.
- **Razor baskın maliyet:** her kesim ayrı QE çağrısı; UXP SequenceEditor'da genel razor/split action yok (clone+trim prototip gerekir).
- Çoklu track'te (bir track'te ses, diğerinde boşluk) boşluk kapatma sınırlı; "boşluk kalsın" ve "sustur" her durumda güvenli.
- Yapısal imza gain/efekt/keyframe ve aynı yoldaki medyanın yeniden yazılmasını izlemez → yeniden analiz.
- Uzun AME aktarımında tamamlanma sinyali dosya boyutunun sabitlenmesi; geçerli ama kısmi WAV bu korumayı aşabilir.
- "Konuşma tespiti" gerçekte enerji sezgisidir (VAD değil).
- Seçili kısa bölge de tüm sequence'i export ettirir; analiz panelin ana iş parçacığında senkron.

## Doğrulanmamış (canlı Premiere)

- Toplu motorla gerçek undo. (Silme süresi ölçüldü: 36 klip 9 ms, 2026-10-14.)
- **Ripple (0.9.9) canlı davranışı:** sync lock kapalı / boş alanlı track'lerde Premiere'in kaydırıp kaydırmadığı; doğrulama uyuşmazlığı yakalar ama sonucu ancak canlı test gösterir.
- Geçişli / nested / multicam sequence davranışı.
- 0.9.3.4 güvenlik kontrollerinin toplam süreye maliyeti.

## Repo hijyeni (2026-10-11)

- `install.ps1` kaynak yolu `D:\PremiereProExtension` sabit; repo artık `Documents\GitHub\hoodoo-cut`.
- `DISTRIBUTION.md` "ilk gönderim" örneğinde `<KULLANICI>` yer tutucusu; ayrıca `cd D:\PremiereProExtension`.
- `update.js` baş yorumu hâlâ "indirme kullanıcıya bırakılır (.zxp)" diyor; davranış tek-tık kuruluma geçti.
- 0.9.3.4 → 0.9.4.0 / UXP 0.9.8 işi `85002f9` ile commit edildi; GitHub Release bilinçli olarak yayınlanmadı (otomatik güncelleme istenmiyor).

## Yol haritası (teknik analizden, öncelik sırası)

1. ✅ Kare bazlı sınırlar, stereo enerji, sequence/revizyon kontrolü, kısmi hata yönetimi (0.9.3.4)
2. Aynı proje kopyasında faz bazlı canlı ölçüm
3. XML (yeni sequence) ve UXP prototiplerini aynı kesim listesiyle karşılaştırma — toplu silme kısmen yapıldı (0.9.4.0)
4. Doğrudan ses çözme, 16 kHz mono analiz kopyası, dB önbelleği
5. Silero / WebRTC / enerji kalite karşılaştırması (etiketli Türkçe ses)
6. Önizleme, dinleme, iptal, kısa fade

Ayrıntı: [[reports/2026-10-05-teknik-analiz|teknik analiz]] §6–7 (Yol A: XML, Yol B: CEP iyileştirme, Yol C: UXP).
