---
type: rapor
title: Sky High riff'i (46 sn sonrası) — CEP 0.9.9.5
description: Kayan synth lead'de geç bulunan güçlü notaları ritim noktasına alma, piyano kanalı eşiği; canlı HDsky.
tags: [hoodoo, hoodoo-cut, tik-ritmi, melodi, sky-high]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/tickplan.js
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/client/js/main.js
  - tools/test-tick.js
created: 2026-10-16
updated: 2026-10-16
---

# Sky High riff'i — CEP 0.9.9.5 (2026-10-16)

## İstek

- Kullanıcı HDmel'i izledi: "Bazı yerlerde nota kaçırıyorsun ama onun harici iyi durmuş."
- Ardından: "Daha iyi anlaşılması için Sky High müziğini kullanarak yap editi. Block vuruşları müziğin 46.
  saniyesinden sonraki kısımda başlasın; orada güzel bir riff var."
- Kullanıcı sordu: "Bunları HooDoo Cut'a yaptırıyorsun değil mi?"
  - Evet. Edit panelin kendi koduyla yapılıyor.
  - Claude yalnız test sequence'ini kuruyor, paneldeki alanları doldurup düğmelere basıyor (CEP hata ayıklama portu) ve sonucu ayrı betiklerle ölçüyor.

## Kaçan notalar (HDmel)

Kong'a göre güçlü (hız ≥ 55) ama tıksız kalan notalar:

| Sebep | Nota |
|---|---|
| Basic Pitch bulmadı (piyano kanalı eşiği 0.4) | 41 |
| Izgara dışı | 14 |
| Bulundu ama tık yok | 2 |

Düzeltme: piyano kanalı eşiği **0.4 → 0.3**. Ritim süzgeci fazlalığı ayıklıyor. In the End'de güçlü notaları yakalama
%75 → %84, isabet %68 → %63 (Kong). Solo piyano (karışım, 0.45) değişmedi; yakalama zaten %98.

## Sky High'da sorun: riff'in ilk ölçüsü eleniyordu

- **İlk deneme** (0.9.9.5 öncesi süzgeç):
  - 141 tık. Beat This sekizliklerine (yanlılık düzeltilmiş) medyan 6.4 ms.
  - **İlk tık 48.85 sn'deydi**; riff 47.0'da başlıyor (G G G D# D# D# C C A#).
- **Sebep:**
  - Sky High'ın lead synth'i notalar arasında kayıyor (portamento) ve sidechain ile nefes alıyor. Belirgin atak yok.
  - Basic Pitch nota başlarını ızgaraya göre 40–100 ms geç (bazen erken) buluyor (47.06, 47.27, 47.99, 48.27, 48.71…).
  - ±35 ms süzgeç bunları eledi.
  - Lead aslında 16'lık çalıyor (~8.5 nota/sn). Tık hızı ~2.5/sn olduğu için riff'in sekizliğe düşen notaları seçiliyor.
- **Ayırt edici:**
  - Sky High'ın kayık riff notaları güçlü (genlik 0.53–0.71).
  - In the End'in ızgara dışı fazla notaları zayıf (0.36–0.50); gerçek riff notaları 0.60–0.71.
- **Kural** (`notesOnGrid`, `melodyFromNoteEvents` artık `amps` da döndürüyor):
  - Bir sekizlikten ±35 ms içindeki nota kendi zamanında kalır.
  - Güçlü nota (≥ 0.52) bir sekizlikten en çok 100 ms **sonra** bulunduysa o sekizliğe alınır.
  - Aynı noktaya düşen ikinci nota alınmaz.
- **Çevrimdışı:**
  - In the End girişi değişmedi (kullanıcının seçimi). Güçlü notaları yakalama %84 → %87, isabet %63 → %60.
  - Sky High 60 sn'de 156 → 194 nota; ilk ölçü geri geldi: 46.98 G, 47.22 G, 47.70 D#, 47.93 C, 48.17 C, 48.64 A#, 48.85 G#.
- **Not zamanı mı ızgara mı:** ±35 ms içindeki notada notanın kendi zamanı daha doğru (In the End'de Kong'a medyan
  6.7 ms, ızgara 7.4 ms). Yalnız kurtarılan geç notalar ızgara zamanını alır.

## Canlı test (HDsky)

- **Kurulum:**
  - Ham videodan kuruldu. A3 kilitli *Elektronomia – Sky High*; müziğin 46. saniyesi timeline 0'da.
  - Premiere giriş noktasını 45.966 sn'ye yuvarladı.
  - Melodi hedefi, "Davulsuz (Demucs)". Lead `other` kanalında; davulsuz kanal karışımdan daha çok lead notası veriyor (333 / 255 nota, 44–112 sn).
- **Analiz:**
  - 900 nota → ritme oturan 509 (127.7 BPM).
  - 158 tıkın 149'u eşleşti, 9 nota atlandı. Donma 5 yerde 0.9 sn (ilk denemede 10 yerde 2.9 sn).
  - 1 fazla tık görünür kalıyor; bölgedeki asıl ses silindiği için sessiz. Süre −34.28 sn.
- **Uygulama:** 227.7 sn. 149 tık sesi A5'te (en büyük sapma 0.00 ms).
- **Bağımsız kontrol:**

| Referans | Medyan sapma | ≤10 ms | ≤20 ms | ≤35 ms |
|---|---|---|---|---|
| Beat This sekizlikleri (ham) | 16.4 ms | %21 | %69 | %100 |
| Beat This sekizlikleri (Beat This'in +14 ms yanlılığı düzeltilmiş) | 5.6 ms | %76 | %97 | %99 |
| Panel ızgarası (tüm şarkı) | 4.8 ms | %79 | %97 | %99 |

- **İlk tık:** müzikte **46.990 sn (G, riff başı)**.
- **46–53 sn:** G G D# C C A# G# G# G# G# D# G# F G G G G G G D# C.
- 67 tık vuruşta, 82'si ara sekizlikte. Ardışık aralıkların 112'si bir sekizlik, 25'i iki sekizlik.
- Tıklar müzikte 46.99–97.37 sn arası; video 87.7 → 53.4 sn.

## Testler

`tools/test-tick.js` +1 (güçlü geç nota ızgara noktasına; zayıf, erken ve ikinci nota alınmaz). Toplam 135 PASS.

## Sınırlar

- 0.52 / 100 ms iki şarkıyla ayarlandı (In the End piyano kanalı, Sky High davulsuz). Başka çalgıda doğrulanmadı.
- Lead 16'lık çaldığında 16'lık notaların çoğu tıksız kalır (tık hızı yetmez). Seçim sekizliklerden.
- Riff'i kulakla kontrol eden olmadı. Notalar Basic Pitch'ten; Sky High için bağımsız nota referansı yok (Kong yalnız piyano).
