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

## 2026-10-16 — Sky High riff'i, kaçan notalar (CEP 0.9.9.5)

- Kullanıcı: HDmel'de "bazı yerlerde nota kaçırıyorsun"; Sky High ile 46. saniyeden sonraki riff'te edit istedi.
  "HooDoo Cut'a mı yaptırıyorsun" sorusuna: evet, panelin kodu yapıyor. Claude sequence kurup düğmelere basıyor ve ölçüyor.
- HDmel'de kaçan güçlü notaların çoğunu Basic Pitch bulmamış → piyano kanalı eşiği 0.4 → 0.3.
- Sky High ilk denemede riff'in ilk ölçüsü elendi (ilk tık 48.85). Sebep: kayan synth lead'de Basic Pitch nota başını
  40–100 ms geç buluyordu. Güçlü (≥ 0.52) geç notalar artık ritim noktasına alınıyor; In the End girişi değişmedi.
- Canlı HDsky:
  - İlk tık 46.99 (riff başı), 149 tık.
  - Beat This sekizliklerine medyan 5.6 ms (yanlılık düzeltilmiş). Donma 0.9 sn.
  - Ayrıntı: [[reports/2026-10-16-sky-high-riff|rapor]].
- Testler 135 PASS. Paket 0.9.9.5. Release yok. Commit `7ffe894`.

## 2026-10-16 — Elle edit kuralları uygulandı (CEP 0.9.9.4)

- Kullanıcı: "evet üçünü de uygula ve dene".
- **Ritimdeki melodi notaları** (`tickplan.notesOnGrid`, melodi hedefinde `detectBeatGrid` ile).
- **İlk tık ilk notaya:** DP başlangıcında atlanan nota cezası.
  - Yan etki: akışta ilk tık sessiz girişe gidiyordu. Izgara ilk belirgin atakta başlıyor.
- **Klip penceresi:** tıktan önce 45 ms / sonra 200 ms normal; kesimde tıktan sonrası tutulur, bölge başında yaklaşma.
- 7 kesim testi yeni kurala göre güncellendi, 3 yeni test; 134 PASS.
- Canlı HDmel (ham videodan; temel sequence'e kullanıcının editi girdiği için dokunulmadı):
  - İlk 6 sn kullanıcının seçimiyle birebir.
  - Kong notasına %74 (HDend %49), ızgarada %100.
  - Pencere: tıktan önce medyan 55 ms, sonra 236 ms.
  - Ayrıntı: [[reports/2026-10-16-elle-edit-analizi|rapor]].
- Paket 0.9.9.4. Release yok. Commit `ebcc6cc`.

## 2026-10-16 — Kullanıcının elle editi analizi (kod değişikliği yok)

- Kullanıcı HDflow'u izledi ("ilerleme çok güzel"). Temel sequence `2026-10-14 15-11-41` üzerinde 10 klipten
  elle bir edit yaptı; "nasıl ve neden yerleştirdiğimi anla" dedi.
- Bulgu: [[reports/2026-10-16-elle-edit-analizi|rapor]].
  - Her tık In the End giriş riff'inin bir piyano notasında (D# A# A# F# F F F F F# D#); marker'lar notalarda.
  - Kaynaktaki hiçbir tık atlanmamış; klip tıktan ~45 ms önce başlayıp ~200 ms sonra bitiyor.
- Panelle farkı:
  - Akış notasız sekizliklere de tık koyuyor.
  - Melodi (0.9.9.2) ilk üç notayı atlıyor ve ızgara dışı Basic Pitch notalarına tık koyuyor.
  - "Izgaradaki melodi notaları" kuralı 0–6.2 sn'de kullanıcının seçimini birebir veriyor.
- Temel sequence artık kullanıcının editini içeriyor: test kopyaları doğrudan videodan kurulacak.

## 2026-10-16 — Müzik ritmi (akış) hedefi (CEP 0.9.9.3)

- Kullanıcı: referans elle yapıldı, kusursuz değil. Blok koymayla ilerle; yönü Claude seçsin.
  Seçim: akış (sabit aralık, müziğin ızgarasından).
- `analyzer.detectBeatGrid`: üç bant onset, sekizlik takibi.
  - `detectRiffNotes`'tan `bandFlux` / `eighthPeriod` / `trackPulse` ayrıldı; riff testleri aynı.
  - Vuruş fazı bant oylamasıyla. Önce alçak + orta bant: Sky High ve referans müzikte faz tersti.
  - Atağa göre yumuşatılmış kayma düzeltmesi. Nokta nokta atağa oturtma aralıkları bozdu, bırakıldı.
- `tickplan.flowTargets` + panelde "Müzik ritmi (akış)" ve "Akış aralığı".
- Ölçüm ve canlı test: [[reports/2026-10-16-muzik-ritmi-akis|rapor]].
  - Canlı HDflow (In the End): 158/158 tık sekizlikte; Beat This'e medyan 3.9 ms; 156/157 aralık tam sekizlik.
- Kurulu panel junction değil, kopya: canlı test için değişen dosyalar `%APPDATA%\Adobe\CEP\extensions\com.hoodoocut`'a kopyalandı.
  Premiere kapalıydı; Claude test projesiyle başlattı.
- Testler 131 PASS. Paket 0.9.9.3. Release yok. Commit `fbc16d8`.

## 2026-10-16 — Referans edit analizi (kod değişikliği yok)

- Kullanıcı bir referans kaydı verdi (`Videos\2026-10-15 11-43-17.mp4`, Rust montajı, oyun sesi + müzik karışık):
  "ilk 20 sn tam istediğim edit, özellikle maden kırarken vuruşlar".
- Ölçüm: [[reports/2026-10-16-referans-edit-analizi|rapor]], zaman çizelgesi `reports/2026-10-16-referans-15-18.png`.
  - Kullanıcı ayrıca "15-18 arasını analiz et" dedi: 9 klip, 10 vuruş.
    - Her klip bir sallama, kalkık kazmayla başlıyor (kaldırma kesilmiş). Taş şekli değişiyor (madenin
      tamamından seçilmiş sallamalar).
  - 15.96'dan sonra vuruşlar 0.30–0.35 sn arayla (ortalama 0.317).
  - Onaltılığa ve bas/gitar notalarına yakınlık tesadüf düzeyinde (kaydırma kontrolü). Bölüm başı vuruşta.
  - Müzik 108.3 BPM (ilk tahmin 107.1 düzeltildi).
- Sonraki adım için yön kullanıcıya soruldu: akış hedefi (sabit aralık, tempodan) ve/veya melodi ile karışık.

## 2026-10-14 — Tık sesleri ayrı, vuruşa giriş, Demucs (CEP 0.9.9.2)

- Kullanıcı: önerilen üç adımın "hepsini yap".
- `alignToNotes`: tıktan önceki son 0.1 sn normal hız ("vuruşa hızlanarak gir"); planda donma piyano 1.6 sn,
  In the End 4.1 → 1.6 sn.
- Demucs: `tools/setup-ml.ps1` (venv `%LOCALAPPDATA%\HooDooCut\ml`), panelde "Melodi kaynağı". `htdemucs_6s
  --shifts 0` (varsayılan rastgele kaydırma notaları her çalıştırmada değiştiriyordu). In the End: 277 → 524 nota,
  84 → 136 tık notada.
- Tık sesleri ayrı: `ACS_prepClickSlices` / `ACS_placeClickSlices`. Canlı yoklama: overwriteClip kareye,
  `move()` kare arasına; çok akışlı medyada akışlar ardışık track'lere. Hatalar ve düzeltmeler: dilim önce
  videonun iniş anına konmuştu → notanın kendisine; 0.35 sn sabit dilim yakın tıkları taşıyordu → kaynaktaki
  sonraki tıktan önce biter.
- Tık atağı 1 ms çözünürlükle (`refineAttacks`).
- Canlı: tık sesleri notalara piyanoda medyan 0.0 ms (118/119 ≤ 5 ms), In the End medyan 0.0 / en kötü 1.0 ms;
  piyano Kong'a göre 10 ms içinde %82. Premiere uzun oturumda ağırlaştı, kullanıcı yeniden başlattı.
- Testler 127 PASS. Paket 0.9.9.2. Release yok.

## 2026-10-14 — Tık sesi notaya hizalanıyor (CEP 0.9.9.1)

- Kullanıcı: videonun kısalması (tıksız anların kesilmesi) uygun, devam.
- Hata bütçesi: kare yuvarlaması 3.9 + tık kare içi kayması 3.3 + Basic Pitch 5.1 ms → toplam medyan 8.8 ms.
  `alignToNotes`: tık karesi, sesinin notaya düşeceği kareye (tek yuvarlama). Basic Pitch gecikme
  düzeltmesi denendi, kazanç yok.
- `readMonoResampled` dosya sonunda durur: piyano analizi 25.5 → 10.2 sn.
- Canlı: piyano (Kong) medyan 5.7 ms, 10 ms içinde %76; In the End (panel notaları) %99; görünür fazla blok
  yok. Önceki sonuçlar projede "Piyano v3 (0.9.9.0)", "Melodi v5 (0.9.9.0)". Testler 126 PASS.
  Paket 0.9.9.1. Release yok.

## 2026-10-14 — Basic Pitch ile melodi notaları (CEP 0.9.9.0)

- Kullanıcı: lisans önemli değil, istediğini kullan; en iyi yöntemi panele entegre et ve test et.
- Ölçüm: Kong piyano transkripsiyonu referans (Python venv, yalnız geliştirme). Solo piyano F1: 0.9.7.0
  0.67, 0.9.8.1 0.85, **Basic Pitch 0.97** (zaman hatası 4.4 ms). Demucs ve Beat This denendi; Basic Pitch
  karışımda da riff'i bulduğu için panele alınmadı.
- Entegrasyon: `tools/basicpitch` (esbuild) → `client/lib/basicpitch/` (4.2 MB, WASM);
  `analyzer.readMonoResampled`, `analyzer.melodyFromNoteEvents`, `main.js melodyNotes` (yedek: DSP).
  Premiere CEP'te Node 17.7.2 + wasm çalıştı.
- Canlı: piyano donma 1.1 sn, tıkların %87'si gerçek tuşta (Kong); In the End donma 4.1 sn; görünür fazla
  blok yok; videolar 61 / 70 sn. Önceki sonuçlar projede "Piyano v2 (0.9.8.1)", "Melodi v4 (0.9.8.1)".
- Testler 125 PASS (gerçek paketle sentetik transkripsiyon dahil). Paket 0.9.9.0. Release yok.
  Rapor: [[reports/2026-10-14-basic-pitch-entegrasyon|Basic Pitch entegrasyonu]].

## 2026-10-14 — Açık kaynak araştırması (kod değişmedi)

- Kullanıcı: benzer işi yapan açık kaynak projeleri tara, çözümlerini araştır, doğruluğu artır.
- Dört konu tarandı: müzikle video eşleme (visbeat, Bellini 2018, MV-Crafter), nota/onset (Basic Pitch,
  Kong, Onsets and Frames, Transkun), kaynak ayrıştırma (Demucs, BS-RoFormer), vuruş/tık (Beat This,
  SuperFlux, şablon eşleme) + Premiere QE `setSpeed`/ses geçişi.
- Öne çıkanlar: ölçüm düzeneği (gerçek referans, 10 ms hedefi), Basic Pitch / Kong ile perde başına onset,
  tüm şarkı tek analiz, tık sesini görüntüden ayırma, "vuruşa hızlanarak gir". Lisans: AGPL/GPL/NC
  bileşenlerden kaçın. Rapor: [[reports/2026-10-14-acik-kaynak-arastirma|açık kaynak araştırması]].

## 2026-10-14 — Donma azaltma + In the End canlı (CEP 0.9.8.1)

- Kullanıcı: "donmayı azalt", "In the End'i de yeni sürümle dene" (hafif ağır çekim önerisi sorulmuştu).
- Sebep: DP her tıkı eşlemek için seyrek melodide boşluğu donmayla dolduruyordu. `alignToNotes`: donma
  0.3 + 2.5/sn, fazla tıklar arası temiz bölümler, birlikte hafif yavaşlama (≥ %70), kısa donma en son;
  bölüm fazla tıktan 1 kare önce biter, 175 ms sonra başlar (canlıda 7 yerde atak ms'leri duyuldu).
- Canlı: piyano donma 27.5 → 6.5 sn, In the End 35.7 (plan) → 5.4 sn; görünür fazla blok yok; tıkların
  %89 / %90'ı notada; ~45 sn hafif ağır çekim. Önceki sonuçlar projede "Piyano v1 (0.9.8.0)" ve
  "Melodi v3 (0.9.7.0)". Testler 122 PASS. Paket 0.9.8.1. Release yok.
  Rapor: [[reports/2026-10-14-donma-azaltma|donma azaltma]].

## 2026-10-14 — Solo piyanodan öğrenme + seçenek (c) donma (CEP 0.9.8.0)

- Kullanıcı: "(c) ile devam et" + yeni şarkı (In the End EASY Piano Tutorial, A3, kaynak 121.65 sn)
  "kolay kısımdan analiz edip öğren".
- Bağımsız referans (spektral akış, 60 sn'de 121 tuş): eski nota tespiti %74 isabet / %53 yakalama.
  Hatalar: ızgara noktası atakta değil (0.2 sn geç), sönümden fazla nota, aynı nota tekrarı yok.
- `detectRiffNotes`: perdeye özgü atak gücü; atağa taşıma / sönüm eleme; yeniden vuruş; göreli atak
  eşikleri; dB tabanı. Piyano %88 / %72; In the End 2 ölçü tekrar %47 → %73.
- `alignToNotes`: aday tabanlı karar (yaklaşma, yavaşlatma, baş + yaklaşma, donma, son çare görünür);
  fazla tık sesi 150 ms. Host: donma satırı `,f`, donan parçanın sesi silinir.
- Canlı HDpiano 3 tur, nota dışı tık 29 → 15 → 8 (hiçbiri orijinal tık değil); tıkların %95'i notada,
  notaların %97'sinde tık. 54 donma 27.5 sn, video +9.45 sn. In the End planı: 35.7 sn donma (canlı yok).
- Testler 119 PASS (sentetik piyanoda aynı tel yeniden vurulunca eski titreşim kesilir). Paket
  0.9.8.0. Release yok. Rapor: [[reports/2026-10-14-piyano-melodi-ogrenme|solo piyano raporu]].

## 2026-10-14 — Riff notaları + seçenek (b) (CEP 0.9.7.0)

- Kullanıcı: yeni yöntem + (b) fazla tıkları kes.
- `detectRiffNotes` (sekizlik periyodu, DP sekizlik takibi, perde değişimi) HPSS'nin yerine; `detectNotes`,
  `keepRepeating` ve testleri kaldırıldı. `alignToNotes` (b) mantığıyla yeniden; host'ta hedef 0 = sil.
- İlk canlı deneme: uygulama doğruydu (plan hedeflerinin 74/76'sı) ama bağımsız kontrol notaların analiz
  aralığına göre değiştiğini gösterdi (sabit ızgara kayması) → DP takibi; sentetik testte 3/2 tempo hatası →
  sekizlik periyodu araması. Aralıklar arası tutarlılık 0/52 → 50/50.
- Son canlı (HDend): riff notalarının %96'sında 1 kare içinde tık (medyan 5 ms); 54 fazla tık uzun nota
  aralarında görünür (0.4 sn blok temposu sınırı). 40 sn. Testler 112 PASS. Paket 0.9.7.0. Release yok.
- Projede karşılaştırma: "Melodi v1" (HPSS), "Melodi v2" (HPSS + riff filtresi), HDend (0.9.7.0).

## 2026-10-14 — Melodi tespiti gerçek notalarla kontrol edildi: uymuyor

- Kullanıcı: HDend "hiç uymadı"; internetten notaları araştırıp kontrol istendi.
- Hooktheory: D♯ minör, 105 BPM, i–VII–VI–VII. Sesin kromagramı: riff F♯ → D♯ → A♯ → F♯ → uzun F,
  2 ölçüde tekrar. `detectNotes` sekizlik ızgarayla %24 hassas, %14 yakalama → uymuyor.
- Önceki doğrulama döngüseldi (kendi tespitimize karşı); kasaya düzeltme yazıldı. Kod değişmedi.
  Ayrıntı: [[HooDoo Cut Tık Ritmi#⚠️ Gerçek notalarla kontrol (2026-10-14): melodi tespiti UYMUYOR]].

## 2026-10-14 — Piyano riff'ine odak (CEP 0.9.6.1)

- Kullanıcı: ana melodi piyano riff'i; iki iyileştirme istendi.
- Ölçüm (2 ölçü tekrar oranı, 20 sn dilimler): bant daraltma yardımcı olmadı; sönüm ağırlığı riff'e uyan
  notayı ~%30 artırdı, şarkı sonunu %22 → %57 yaptı. Riff filtresi periyodu 2.27 sn (1 ölçü) buldu.
- Eklendi: `detectNotes` `decayK` (varsayılan 1), `ACSTickPlan.keepRepeating` (periyot + boşluk dolgusu),
  panelde melodi akışına filtre. Testler +2 (16 tık testi, toplam 111 PASS).
- Canlı: eski HDend "Melodi v1" olarak saklandı; yeni HDend: 151/158 tık, 150/150 tık parçası riff notasında
  (≤8.3 ms), 3 track aynı, müzik kilitli/dokunulmadı, 138 sn.

## 2026-10-14 — Müzik melodisi hedefi (CEP 0.9.6.0)

- Kullanıcı: 128 BPM sonucu oturuyor ama "sabit davula göre" hissettiriyor; tıklar melodiye (piyano)
  otursun. Projeye "In the End (Instrumental) – Linkin Park" eklendi; test HDend kopyasında (HDtest korundu).
- Ölçüm: bant enerjisi onsetleri çok yoğun (6–7/sn, her 16'lık); tempo 105 BPM doğru. HPSS harmonik
  onsetleri riff'i yakaladı (%70–75 iki ölçü tekrarı). Sentetik testte davul sızıntısı: sert kesilen saf
  sinüs gerçekçi değildi → armonikli/sönen notalar; algoritmada ikili maske, 60 ms kalıcı akış,
  önceki 60 ms maksimumu (SuperFlux), taban 0.2.
- DP eşleşme: 149/158 tık notaya, medyan hız ~0.94. Canlı: 148/148 tık parçası notaya 1 kare içinde,
  konumlar 3 track'te aynı, kilitli müzik dokunulmadı (118 sn).
- Testler +5 (109 PASS). Paket `HooDooCut-Kurulum-v0.9.6.0.zip`. Release yok. Ayrıntı: [[HooDoo Cut Tık Ritmi]].

## 2026-10-14 — Müzik track'i, yeni test videosu, hız tavanı (CEP 0.9.5.2)

- Kullanıcı: güçlü sesler kalsın, debug portu açık kalsın; NCS müzik ekle (onaylı indirme:
  Elektronomia – Sky High, ncs.io, 9.0 MB); seçenek (a) = kilitli track işlem dışı; test projesine
  yeni video eklendi (`2026-10-14 15-11-41`, 87.7 sn, oyun sesi A2, A1 sessiz). Eski ep6/HDtest kaldırılmıştı.
- Canlı: QE seq razor kilitli track'i kesmiyor. `ACS_beginEdit(…,'tick')` kilidi hata saymıyor,
  `ACS_tickRetime` kilitli track'i atlıyor.
- Tüm videoda ilk deneme 22.167'de doğrulama hatası: Premiere 3.64 hızı 3.2773'e sınırladı
  (konuma göre değişen tavan; 3.0'a kadar tam). Süre hedefte kaldığı için tıklar yine ızgarada →
  doğrulama düşük hızı kabul edip sayıyor, track'ler arası fark senkron hatası.
- Sonuç: 143 ardışık tık tam 0.46875 sn arayla (en kötü 2.1 ms), 3 track aynı, kilitli müzik dokunulmadı,
  16 arada tavan, 114.6 sn. Müzik 0.433 sn'ye kaydırılıp vuruşlar tıklara denk getirildi (HDtest).
- Testler +4 (106 PASS). Paket `HooDooCut-Kurulum-v0.9.5.2.zip`. Release yok. Ayrıntı: [[HooDoo Cut Tık Ritmi]].

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
