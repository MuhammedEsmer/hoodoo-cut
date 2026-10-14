---
type: log
title: log — Değişiklik Günlüğü
description: Bu kasaya yapılan düzenlemelerin append-only kaydı (en yeni en üstte).
tags: [hoodoo, hoodoo-cut, meta, log]
created: 2026-10-11
updated: 2026-10-11
---

# 📓 Değişiklik Günlüğü

> Append-only. En yeni girdi en üstte. Eski girdileri silme — bkz. [[CLAUDE]].

## 2026-10-14 — Tık marker'ları oturmuyordu: tepe tabanlı tespit (CEP 0.9.5.1)

- Kullanıcı (ekran görüntüsü, ayarlar: aralık 0.1, hassasiyet 10, en kısa 50 ms): "marker'lar asla oturmuyor".
- Ölçüm (HDtest A2 dışa aktarımı + 19 marker): marker'lar dalga formu tepelerinden 12–62 ms erken;
  bölümde güçlü (zaten ~0.4 sn ritim) ve 12–15 dB zayıf iki ses ailesi; HPF 1 kHz ikisini eşitliyordu.
- Düzeltme: `detectOnsets` tam bant + belirgin tepe + atak başlangıcı; minGap'te güçlü olan kalır;
  `tickplan.medianInterval` ile "doğal tık aralığı" ve uyarı; en kısa aralık ≥100 ms.
  +3 test (stronger-of-two, faint precursor, median), toplam **102 PASS**.
- Canlı (yeni `HDcheck` kopyası, kullanıcının HDtest'ine dokunulmadı): 10 tık, doğal 0.40 sn,
  marker'lar atağın 6–11 ms içinde; T 0.4 ile uygulandı, tıklar tam ızgarada, 3 track aynı.
  Ayrıntı: [[HooDoo Cut Tık Ritmi]].

## 2026-10-14 — Tık ritmi modu çalışıyor (CEP 0.9.5.0)

- Kullanıcı izniyle canlı testler Claude tarafından yapıldı: CEP debug portu (`.debug` kurulu panele
  kopyalandı, `localhost:8088`) + scratchpad sürücüleri. Kullanıcı ayrı test projesi açtı (`123tets.prproj`).
- Bulgular: önce `end`, sonra `setSpeed` doğru sonucu veriyor; DOM in/out hıza bölünmüş raporlanıyor.
  Razor "seek" modunda 1 kare erken kesiyordu (fps 60.00024) → tam kare tick'iyle seek (düzeldi).
  ES3'te `final` ayrılmış kelime, host'u tamamen bozdu → regresyon testi eklendi.
  Bölge başında yavaş kabaran ses tık sanılıyordu → yükseliş 15 ms'de, taban bölge içinde.
- Yeni: [[HooDoo Cut Tık Ritmi]] (`tickplan.js`, `detectOnsets`, `ACS_tickRetime`, marker'lar, panel modu).
  Geçici hız testi (UI + `ACS_speedProbe` + test) kaldırıldı; yedek kutusu `backupRow`'a taşındı (iki modda ortak).
- Canlı sonuç (kullanıcının seçtiği 15:54:32–16:01:29 bölümü, A2, T 0.3): 16 tık tam 0.3 sn arayla, 3 track aynı.
- Testler **100 PASS**. Paket `dist/HooDooCut-Kurulum-v0.9.5.0.zip`; panel kurulu klasöre kopyalandı
  (`.debug` dahil, port açık). Release yok.
- Açık: yedek sekmesinin bir kez öne geçmesi tekrar üretilemedi; gerçek projede tespit ayarı kullanıcıda.

## 2026-10-14 — DOM end çalışıyor ama hızı bozuyor; ters sıra denemesi (CEP 0.9.4.7)

- `2 e` canlı: süre yarıya indi, hız 1.769'a kaydı, A2 farklı → senkron işaretleri. Başlangıç kirliydi (hız 0.5).
- 0.9.4.7: `b` eki (önce end, sonra setSpeed) + raporda kaynak in/out. Test 8 senaryo, toplam **88 PASS**.
  CEP kopyalandı. Release yok.

## 2026-10-14 — setSpeed süreyi asla değiştirmiyor; DOM end denemesi (CEP 0.9.4.6)

- `0.5 d` canlı: süre aynı → setSpeed yalnız hız. Süre ayrı ayarlanacak.
- 0.9.4.6: hız testine `e` eki (DOM `end` yazma). `host-fixture.js` start/end özellikleri
  `configurable` yapıldı (test için). Test 7 senaryo, toplam **87 PASS**. CEP kopyalandı. Release yok.

## 2026-10-14 — setSpeed: süre değişmiyor, p1 süre denemesi (CEP 0.9.4.5)

- Ekran görüntüsü: `0.5 r` sonrası klip `[50%]`, boyu ve sonraki klip aynı → setSpeed süreyi korur, p4 ripple değil.
- 0.9.4.5: hız testine `d` eki — p1 metnine hedef süre timecode'u. Test 6 senaryo, toplam **86 PASS**.
  CEP kurulu klasöre kopyalandı. Release yok.

## 2026-10-14 — setSpeed üçüncü sonuç

- `0.5 r` (p4 = true): çağrılar `true`, raporda süre/sonraki klip değişmedi. p4'ün ripple olmadığı
  ya da DOM'un hemen güncellenmediği ihtimali; kullanıcıdan timeline gözlemi + ayrı "incele" istendi.

## 2026-10-14 — setSpeed ikinci sonuç

- 0.9.4.4 canlı: hız tüm linkli parçalara uygulanıyor (0.5 ve 2 denendi). p4 = false iken süre sabit,
  yalnız kaynak aralığı değişiyor. `0.5 r` (ripple adayı) henüz denenmedi.
  Ayrıntı: [[plans/2026-10-14-tik-ritmi|tık ritmi planı]].

## 2026-10-14 — setSpeed ilk sonuç, ikinci tanı (CEP 0.9.4.4)

- Canlı: `setSpeed(0.5, '', false, false, false)` çalıştı; hız oran, yalnız V1 değişti (A1/A2 1),
  süre ve sonraki klip aynı kaldı. Ayrıntı: [[plans/2026-10-14-tik-ritmi|tık ritmi planı]].
- 0.9.4.4: hız testi tüm seçili parçalara uygular; `0.5 r` son boolean'ı (ripple adayı) true yapar.
  Test 5 senaryo, toplam **85 PASS**. CEP kurulu klasöre kopyalandı. Release yok.
- Kullanıcının ep6 sequence'inde V1#77 (523.6 sn) şu an 0.5 hızda, sesleri 1'de → Ctrl+Z ile geri alınmalı.
- Global kural eklendi: dosya düzenlemede Python/sed kaçış sorunları yerine Edit aracı.

## 2026-10-14 — Hız testi linkli seçim düzeltmesi (CEP 0.9.4.3)

- Canlı ilk deneme: `ERR|Timeline'da tek klip secin` — linkli klip tıklanınca V + A1 + A2 birlikte seçiliyor.
- `ACS_speedProbe` artık linkli seçimi kabul eder: `setSpeed` video parçasına uygulanır, seçili tüm
  parçaların hız/süre/başlangıç/sonraki klip bilgisi önce/sonra raporlanır (link + ripple davranışı görünür).
- Test: `tools/test-speed-probe.js` 4 senaryo; toplam **84 PASS**. CEP dosyaları kurulu klasöre kopyalandı
  (motor değişmedi, 0.9.9). Release yok.

## 2026-10-14 — 0.9.4.2 yerel kurulum

- Premiere kapalıyken `HooDooCut-Kurulum-v0.9.4.2.zip` → `kurulum.ps1` çalıştırıldı.
- UPIA `/list all`: yalnız **HooDoo Cut Toplu Motor 0.9.9** (eski 0.9.8 kaydı kalmadı).
- CEP: kaynakla 0 dosya farkı (SHA-256), `ExtensionBundleVersion="0.9.4.2"`.
- UXP External `com.hoodoocut.bulk_0.9.9`: JS/HTML hash eşit; `manifest.json` yalnız biçimce farklı, JSON içeriği aynı.
- Canlı ripple ve setSpeed testi henüz yapılmadı.

## 2026-10-14 — Tık ritmi tasarımı, setSpeed tanısı (CEP 0.9.4.2)

- Yeni istek: Minecraft blok tıklarını sabit ızgaraya oturtmak. Kullanıcı kararları ve
  tasarım: [[plans/2026-10-14-tik-ritmi|tık ritmi planı]] (ara kısım hızlandır/yavaşlat, tık %100;
  T saniye/kare + BPM; oyun sesi ayrı track).
- UXP'de hız değiştirme API'si yok (yalnız `getSpeed`); QE `setSpeed` belgelenmemiş →
  0.9.4.2'ye geçici "🧪 Hız testi" butonu (`ACS_speedProbe`) eklendi. Test: `tools/test-speed-probe.js`.
- Testler **83 PASS, 0 FAIL**. Paket `dist/HooDooCut-Kurulum-v0.9.4.2.zip` (motor 0.9.9 dahil). Kurulmadı, Release yok.
- Açık: ripple canlı testi ve setSpeed tanısı kullanıcıda.

## 2026-10-14 — Ripple ile boşluk kapatma (CEP 0.9.4.1, motor 0.9.9)

- Kullanıcının canlı logu (STT EP6, 37 dk sequence, seçili 4.9 sn bölge, 12 kesim): razor 1.7 sn,
  toplu silme 0.8 sn (native 9 ms), CEP kompaksiyonu **753 klip / 24.8 sn** → toplam 27.4 sn.
  Ekran görüntüsündeki kırmızı +N senkron işaretleri işlem *sırasında* alınmıştı (geçici).
- Karar (kullanıcı): razor şimdilik kalsın; boşluk kapatma için A seçeneği = ripple.
- Uygulandı: [[HooDoo Cut Toplu Motor]] (`engine.js` ripple + tüm track konum doğrulaması),
  panel (`main.js`) plana `ripple`/`cuts` ekler, `rippled` gelirse kompaksiyonu atlar, gelmezse klasik yola düşer.
- Testler: +3 motor (`test-bulk.js`), +3 panel (`test-panel.js`); toplam **80 PASS, 0 FAIL**.
- Paket: `dist/HooDooCut-Kurulum-v0.9.4.1.zip` (CCX içinde motor 0.9.9 doğrulandı). Kurulum yapılmadı
  (Premiere açıktı); **Release yok**.
- Açık: ripple canlı Premiere'de denenmedi.

## 2026-10-11 — AGENTS.md ve .codegraph kararı

- Kök `AGENTS.md` (Codex/Cursor/Gemini gibi diğer AI araçlarının talimat dosyası)
  tutuldu; eski ve kırık kopya yerine `CLAUDE.md` ile birebir aynı yapıldı.
  İkisi değiştiğinde birlikte güncellenir.
- `.codegraph/` (yerel kod indeksi, otomatik üretilir) `.gitignore`'a eklendi.

## 2026-10-11 — Kod değişiklikleri commit edildi, Release yok kararı

- `85002f9`: 0.9.3.4 → 0.9.4.0 CEP + UXP motor 0.9.8 + testler/araçlar tek
  commit'te (74 PASS, `node --check` ve `git diff --check` temiz).
- Kasa commit'i `828bdeb` → `08ea798` olarak yeniden yazıldı (push edilmeden):
  AI contributor satırı kaldırıldı. Kalıcı kural: commit/PR'da Claude/AI
  contributor gösterilmez ([[HooDoo Cut Kurulum ve Dağıtım]]).
- **0.9.4.0 için GitHub Release oluşturulmayacak** — kullanıcı otomatik
  güncelleme istemiyor. [[HooDoo Cut Sürüm Geçmişi]], [[HooDoo Cut]] güncellendi.
- `749a6ea..81d5dad` origin/main'e push edildi (Release/tag yok).
- Commit dışı bırakılanlar: `.codegraph/` (yerel kod indeksi) ve kökte
  kaynağı belirsiz yeni `AGENTS.md` (var olmayan `docs/AGENTS.md`'ye işaret ediyor).

## 2026-10-11 — Kasa kuruldu, proje kayıtları buraya toplandı

`docs/` Obsidian kasası yapıldı (`.obsidian` ortak ayarları git'te,
`workspace*.json` ve `.trash/` ignore). Bundan sonra HooDoo Cut'la ilgili tüm
kayıtlar burada tutulur.

- Repo kökündeki `reports/` → `docs/reports/` taşındı (içerik değişmedi);
  `README.md` içindeki iki rapor bağlantısı yeni yola güncellendi.
- Mevcut `docs/plans/` yerinde kaldı, [[index]]'e bağlandı.
- Yeni wiki notları (README, DISTRIBUTION, raporlar, `git log` ve kaynak
  dosyalardan derlendi): [[HooDoo Cut]], [[HooDoo Cut Mimari]],
  [[HooDoo Cut Analiz Motoru]], [[HooDoo Cut Kesim Akışı]],
  [[HooDoo Cut Toplu Motor]], [[HooDoo Cut Kurulum ve Dağıtım]],
  [[HooDoo Cut Test ve Doğrulama]], [[HooDoo Cut Sürüm Geçmişi]],
  [[HooDoo Cut Bilinen Sınırlar]], [[HooDoo Cut Sözlük]].
- Repo köküne kasayı gösteren kısa `CLAUDE.md` eklendi; `.gitignore`'a
  `docs/.obsidian/workspace*.json` ve `docs/.trash/` eklendi.
- Test paketleri çalıştırıldı: **74 geçti, 0 başarısız** ([[HooDoo Cut Test ve Doğrulama]]).
- Kasa kurulurken fark edilenler ([[HooDoo Cut Bilinen Sınırlar]]'a işlendi):
  `install.ps1` hâlâ `D:\PremiereProExtension` yolunu sabit kullanıyor;
  `DISTRIBUTION.md` ilk gönderim örneğinde `<KULLANICI>` yer tutucusu kalmış;
  0.9.3.4 → 0.9.4.0 ve UXP 0.9.5 → 0.9.8 değişiklikleri henüz commit edilmemiş.
