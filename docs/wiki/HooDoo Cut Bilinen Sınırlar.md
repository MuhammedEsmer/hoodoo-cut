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
updated: 2026-11-13
---

# HooDoo Cut Bilinen Sınırlar

## Platform sınırları

- **Scripting API tek thread, işlem başına pahalı.** Optimizasyon azaltır, sıfırlamaz.
- **Undo** ExtendScript'ten kapatılamaz/temizlenemez.
- **Razor baskın maliyet:** her kesim ayrı QE çağrısı; UXP'de razor/split komutu yok (26.5 belgeleri, 2026-11-04). Kullanıcı kararı: clone+trim dolaylı yolu denenmeyecek, razor CEP/QE'de kalır ([[reports/2026-11-04-uxp-api-taramasi|UXP taraması]]).
- Çoklu track'te (bir track'te ses, diğerinde boşluk) boşluk kapatma sınırlı; "boşluk kalsın" ve "sustur" her durumda güvenli.
- Yapısal imza gain/efekt/keyframe ve aynı yoldaki medyanın yeniden yazılmasını izlemez → yeniden analiz.
- Uzun AME aktarımında tamamlanma sinyali dosya boyutunun sabitlenmesi; geçerli ama kısmi WAV bu korumayı aşabilir.
- "Konuşma tespiti" gerçekte enerji sezgisidir (VAD değil).
- Seçili kısa bölge de tüm sequence'i export ettirir; analiz panelin ana iş parçacığında senkron.
- Tık ritmi sınırları: [[HooDoo Cut Tık Ritmi#Sınırlar]] (çok undo adımı, uzun kuyrukta yavaş taşıma).
- ✅ Düzeldi (0.9.5.0): tam sayı olmayan fps'li sequence'lerde (ör. 60.00024, 30 fps timecode gösterimi) razor "seek" moduna düşüp 1 kare erken kesiyordu.

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

## Yapılacaklar (kullanıcı istekleri)

- [ ] **Nefes kesme** — istek 2026-11-11, kullanıcı 2026-11-13'te "daha sonra yapacağız" dedi.
  - **Sorun:** Kesimden sonra cümle başında ve sonunda nefes sesi kalıyor; nefes konuşma payının (Ölçülü'de 300 ms) içine düşüyor. Mikrofon ayrı track'te.
  - **1. adım (kullanıcı kararı):**
    - Panelde "Nefesleri işaretle" kutusu olacak. İşaretliyse "Analiz Et" nefesleri de bulur.
    - Her nefesin başına tek noktalı `HooDoo nefes` marker'ı konur; hiçbir şey kesilmez.
    - Kullanıcı marker'ları izleyip tespiti değerlendirir.
  - **2. adım (1. adım iyi çalışırsa):** Panelde "nefes: sil / sesini kıs / dokunma" seçeneği; nefesler kesim sırasında işlenir.
  - **Durum:**
    - Taslak kod `nefes-isaretleme` dalında (`ad0ceda`). Kural: perdesiz, hışırtılı, konuşmadan kısık, 0.15–1.2 sn; iki yanı sesli konuşmaya yapışık hışırtı (kelime içi "s/ş") sayılmaz.
    - Sentetik testler geçiyor. Gerçek kayıtta ayarlanmadı, canlı denenmedi; `main`'e alınmadı.
  - **Ayar için aday kayıtlar:**
    - `Videos\2026-11-13 13-35-05` (48.7 dk) ve `Videos\2026-11-12 15-20-27` (35.5 dk).
    - İkisinde de iki ses kanalı var; mikrofonun hangisi olduğu belirlenmedi.
