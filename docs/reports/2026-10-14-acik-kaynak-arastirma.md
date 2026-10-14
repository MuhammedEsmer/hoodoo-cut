---
type: rapor
title: 2026-10-14 Açık kaynak araştırması — müzikle video eşleme, nota/vuruş/tık tespiti
description: Tık ritmine benzer işi yapan açık kaynak projeler ve bizim sorunlarımıza buldukları çözümler; lisans, JS/Node uygunluğu ve doğruluk yol haritası.
tags: [hoodoo, hoodoo-cut, tik-ritmi, araştırma, rapor]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/client/js/tickplan.js
  - com.hoodoocut/host/index.jsx
created: 2026-10-14
updated: 2026-10-14
---

# Açık kaynak araştırması: müzikle video eşleme, nota/vuruş/tık tespiti

Kullanıcı: "internette yapmaya çalıştığımız şeyi yapan açık kaynak projeleri tara, sorunlarımıza buldukları
çözümleri araştır; doğruluğu artırmamız gerekiyor". Dört konu paralel tarandı. Sayılar kaynakların kendi
beyanıdır; canlı ölçülmedi.

## 1. Sorunlarımız → bulunan çözümler

| Sorunumuz | Bulunan çözüm | Kaynak |
|---|---|---|
| Nota tespiti %88 isabet / %72 yakalama; aynı notanın tekrarı, ızgara arası notalar | Perde başına **onset haritası** veren sinir ağı transkripsiyonu; ızgarayı sabit yuva değil, yumuşak öncül olarak kullanmak | Basic Pitch, Kong piano transcription, Onsets and Frames |
| Karışımda piyano yeniden vuruşu ile davul ayrılamıyor | Riff'in perde kümesine göre **harmonik tarak akışı** (davul geniş bantlı, kontrastla söner); isteğe bağlı kaynak ayrıştırma (davulsuz stem) | FMP, Demucs, Sheet Sage değerlendirmesi |
| Sonuç analiz aralığına bağlı (göreli eşikler) | **Tüm şarkıyı bir kez** analiz edip önbelleğe almak, mutlak olasılık eşikleri | Beat This, Basic Pitch notları |
| Tempo 2/3 – 3/2 hataları | DNN vuruş izleyici (Beat This, MIT) ya da {T, 2T/3, 3T/2, T/2, 2T} adaylarını tempo öncülüyle puanlamak | Beat This (ISMIR 2024), librosa |
| Tık zamanı "tepe −10 dB" ile; ayak sesi gibi sesler | Log-mel **SuperFlux** + uyarlamalı tepe seçimi + enerji minimumuna **geri izleme**; 300 ms'lik blok sesi **şablonuyla çapraz korelasyon** ve kümeleme | SuperFlux (DAFx 2013), DCASE few-shot taban çizgisi, librosa |
| Kesimde tık kuyruğu, yavaşlayan sesin perdesi düşüyor | Tık **sesini görüntüden ayırmak**: eşleşen tıkın sesi %100 hızda, örnek hassasiyetiyle notaya; yavaşlama yalnız görüntüde. Ya da Volume keyframe ile kısa fade | visbeat ilkesi, algı çalışmaları, Premiere DOM |
| Kare yuvarlaması (60 fps'te ±8 ms, 30 fps'te ±17 ms) | Algı eşiği ~10 ms (10–20 ms kaynaşır, 20–40 ms "flam"). Hedef metrik: **notaların % kaçı 10 ms içinde** | PMC6561579 |
| Yavaşlama/donma vuruşun etkisini zayıflatıyor | **"Vuruşa hızlanarak gir"**: tık öncesi birkaç kare ve tık %100 (ya da hızlı), yavaşlama aranın ortasında, tercihen az hareketli karelerde | visbeat (Davis & Agrawala 2018), MV-Crafter 2025 |
| DP maliyetleri sezgisel | Birikmiş aralıkların log oranı / min-max oranı; asimetrik sınır (hızlanma ≤ 1.25×, yavaşlama ≥ 0.7×); nota atlama maliyeti nota gücüne göre | visbeat, Bellini 2018 (26 kişilik kör test), MV-Crafter |
| QE `setSpeed` belgesiz | arg3 = ters (doğrulanmış), arg4 muhtemelen "ses perdesini koru", arg5 muhtemelen ripple; hız tavanı kaynak medyada kalan süreyle sınırlanıyor olabilir | premiere-cli `BUILD_FINDINGS.md`, types-for-adobe-extras |

## 2. Müzikle video eşleme / yeniden zamanlama

- **visbeat — Visual Rhythm and Beat** (SIGGRAPH 2018). https://github.com/abedavis/visbeat
  - Lisans: Stanford, ticari olmayan, yeniden dağıtım yok. Fikir alınabilir, kod alınamaz.
  - Görsel vuruş: optik akıştan "directogram"; Ellis DP, maliyet `-(log(T/T0))²`.
  - Eşleme: 1:1 sıralı; yoğunluk farkı için ½, ⅓, 2× seçenekleri.
  - Bükme: hız vuruş dışında sürekli. Ani hız değişimi sahte vuruş yaratır, bu yüzden vuruşa ivmelenerek girilir.
  - Yazarlar da bizim "görünür fazla tık" sorunumuzu çözülmemiş olarak belirtiyor.
- **Dance to the beat** (Bellini, Kleiman, Cohen-Or 2018). https://link.springer.com/content/pdf/10.1007/s41095-018-0115-y.pdf
  - DP `F(i,j) = max F(i−k, j−l) + min(La, Lv)/max(La, Lv)`, birikmiş aralıklar üzerinden; bant k, l ≤ 2.
  - Hızlanma ≤ %25, yavaşlama daha serbest ("daha doğal görünüyor").
  - 26 kişilik kör testte yeniden zamanlanmış video tercih edildi.
- **MV-Crafter** (2025, arXiv 2504.17267).
  - Seyrek dizideki her vuruş eşlenir, yoğun dizide atlama serbest.
  - "Zarf kaynaklı bükme": az hareketli yerde yavaşlar.
  - Hizalama puanı 0.699 (visbeat 0.528, DTW 0.481).
- **Yalnız kesen editörler** (MIT): mugen, beat-synced-edit, av-sync. Yalnız yoğunluk/gruplama fikirleri işe yarar (vuruşların ½'si, bölüme göre hız).
- **Ticari:** BeatEdit (yalnız marker koyar), Resolve "Show Music Beats". Yeniden zamanlama yapan yok.
- Adobe patenti US11682238B2 (poz → hareket vuruşu, açgözlü eşleme). Yalnız referans.

## 3. Nota / onset tespiti

| Sistem | Lisans | Doğruluk (onset F1) | JS/Node |
|---|---|---|---|
| **Spotify Basic Pitch** | Apache-2.0 | MAESTRO nota F1 %70.9 (makale, piyano onseti zayıf); her enstrüman | `@spotify/basic-pitch`, ~2 MB, TF.js; 86 kare/sn |
| **Kong piano transcription** (ByteDance) | Kod Apache-2.0, ağırlık doğrulanmadı | **MAESTRO onset F1 %96.7**, kare içi zaman (100 fps), tekrar notalar ≥40 ms ayrı | PyTorch, 172 MB; bir kez ONNX'e çevrilip onnxruntime-web ile çalışır (fp16 ~86 MB) |
| Onsets and Frames (Magenta) | Apache-2.0 | MAESTRO 95.3, MAPS 86.4 | `@magenta/music`, 60 MB, 32 ms kare (bizim için kaba), ~0.5× gerçek zaman |
| Transkun ONNX | MIT | nota F1 0.984 (beyan) | 53 MB, FFT ön ucu ve kod çözücü bizde yazılmalı |
| Onsets & Velocities | **GPL-3.0** | %96.8, 3.1M param | lisans engeli |
| MT3, Omnizart | — | — | JS'de pratik değil |
| essentia.js | **AGPL-3.0** | SuperFlux, Melodia, pYIN | WASM ~10 MB; lisans engeli |
| aubio / madmom | GPL / modeller CC BY-NC-SA | madmom CNN onset F ~0.89 | lisans engeli |
| librosa | ISC | onset_detect + backtrack | algoritma kolayca JS'e taşınır |

Melodi çıkarma (Melodia, deep salience) perde eğrisi verir, **onset vermez**. Yeniden vuruş için ayrı onset
dedektörü gerekir (CREPE Notes yaklaşımı).

Teknikler:
- Perde başına onset eğrisinde tepe arama.
- Sönüm eğrisinin (dB'de doğrusal) üstüne çıkış = yeni vuruş (Marolt & Divjak 2002).
- Tepe çevresinde karesel ara değerleme.
- ≤30 ms geri izleme.

## 4. Kaynak ayrıştırma (karışımdan piyano)

- **htdemucs_6s** piyano stemi zayıf (SDR 2.23 dB, "çok sızıntı"). En iyisi BS-RoFormer SW (piyano 7.83 dB), ama ağır ve ağırlıklarının lisansı belirsiz.
- htdemucs 4 stem: davul ~10 dB.
  - **"piano + guitar + other" toplamı davulsuz stem** olarak kullanılabilir.
  - Davul stemi, yalnız geniş bantlı atakları elemek için veto olarak kullanılabilir.
- Python'suz çalıştırma: ONNX + küçük C++ CLI (ONNX Runtime DLL ~10–20 MB, model 136 MB fp16).
  - 3–4 dk şarkıda masaüstü CPU'da ~70–90 sn, dizüstünde 2–4 dk (tahmin).
  - WASM yolu çok yavaş (~5–20 dk).
  - CEP'in Node sürümü (CEP 11 → Node 15.9) `onnxruntime-node` için sınırda.
- **Lisans:** Demucs kodu MIT; ağırlıklar "araştırma amaçlı" / CC BY-NC tartışmalı, repo arşivlendi. Dağıtımdan önce netleşmeli.
- Ayrıştırmanın onset'e etkisi doğrudan ölçülmemiş. Dolaylı: pop melodide Spleeter + Tony onset F1 34, ham karışımda Melodia 20.
- HPSS: piyano çekiç atağı *perküsif* tarafa gider. Harmonik kısım onset için kullanılmamalı, yalnız perde için.

## 5. Vuruş ve tık tespiti

- **Beat This!** (CPJKU, ISMIR 2024, MIT kod + ağırlık).
  - GTZAN F1 89.1, küçük model 88.8 (2.1M param), Ballroom 97.5.
  - ONNX `small0.onnx` ~10 MB (üçüncü taraf).
  - Ön işleme birebir uymalı: 22.05 kHz, n_fft 1024, hop 441, 128 mel, `log1p(1000x)`.
  - Montaj müziği genelde sabit tempolu: tek global ızgara oturtulabilir.
- madmom RNN+DBN (modeller NC), BeatNet (CC-BY), Essentia (AGPL).
- **Minecraft gerçeği:**
  - Koyma/kırma sesi ses düzeyi 1.0, perde 0.8.
  - Kazma "hit" sesi 0.25 düzey, perde 0.5 (~12 dB düşük, bir oktav aşağı).
  - Ayak sesi 0.15 (~16 dB düşük).
  - Malzeme başına birkaç varyant var; düzey + spektral şekil sınıfları ayırır.
- **Önerilen tık hattı:**
  1. Log-mel SuperFlux, uyarlamalı tepe seçimi (librosa `peak_pick`).
  2. Hop ≤ 3 ms ile enerji minimumuna geri izleme.
  3. 300 ms log-mel şablonla normalize çapraz korelasyon + kümeleme.
  - Hazır SED modelleri (YAMNet, PANNs) zaman çözünürlüğü kaba; gereksiz.

## 6. Premiere API

- Hız için resmi bir ayarlayıcı yok; QE `setSpeed` belgesiz. Bir forum raporuna göre 26.3'te QE devre dışı → **sürüm riski**.
- `setSpeed(hız, ticks, ters, ?, ?)`:
  - Topluluk ve bir canlı test: arg2 geçerli bir ticks dizesi olmalı, arg3 ters.
  - arg4/arg5 muhtemelen "perdeyi koru" / ripple (doğrulanmadı).
- Ses geçişi: QE `getAudioTransitionByName("Constant Power")` + `addTransition`.
  - Adlar yerelleştirilmiş (Türkçe arayüz!).
  - Çapraz geçiş kesilen sesi geri getirir.
  - Daha iyisi: resmi DOM'da Volume keyframe ile kısa fade-out / fade-in.

## 7. Lisans özeti (repo herkese açık, lisans dosyası yok; kurulum paketi dağıtılıyor)

- **Kullanılabilir:** Basic Pitch (Apache-2.0), Beat This (MIT), Transkun ONNX (MIT), librosa/SuperFlux fikirleri, Meyda (MIT), Signalsmith Stretch (MIT).
- **Kaçınılmalı** (lisans alınmadıkça): essentia.js (AGPL), aubio (GPL), madmom modelleri (NC), Onsets & Velocities (GPL), visbeat kodu (NC), Demucs ağırlıkları (belirsiz).

## 8. Doğruluk yol haritası (öneri, ölçülebilir)

1. **Ölçüm düzeneği** (her şeyin önkoşulu).
   - Gerçek referans: tutorial'ın MIDI'si ya da güçlü bir çevrimdışı transkripsiyon (Kong, yerel Python, yalnız geliştirme için).
   - Metrikler:
     - onset F1 (50 ms);
     - "notaların % kaçında 10 ms içinde tık";
     - dakikada duyulan fazla tık;
     - donma/kesim sayısı;
     - ortalama |log hız|.
   - Bugünkü spektral akış referansı zayıf.
2. **Nota tespiti:**
   - Basic Pitch'in perde başına onset haritası + bizim atak/sönüm mantığımız, riff perde kümesiyle süzülür.
   - Yetmezse Kong modelini ONNX ile denemek (piyano için en iyi).
3. **Tüm şarkı tek analiz + önbellek.** Aralık bağımlılığı kalkar; ızgara yumuşak öncül olur.
4. **Tık tespiti:** SuperFlux + geri izleme + şablon/kümeleme.
5. **Ses:** eşleşen tık sesini görüntüden ayırıp %100 hızda örnek hassasiyetiyle yerleştirmek; kesimlerde Volume fade. Perde düşmesi ve kuyruk sorunu biter.
6. **Yeniden zamanlama biçimi:** tık çevresi %100, yavaşlama aranın ortasında (az hareketli karelerde); asimetrik hız sınırları; nota gücüne göre atlama maliyeti.
7. **Karışım için:** önce harmonik tarak akışı (ücretsiz, hızlı). Demucs isteğe bağlı "doğru mod", lisans netleşince.
