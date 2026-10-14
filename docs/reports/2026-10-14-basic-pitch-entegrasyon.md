---
type: rapor
title: 2026-10-14 Basic Pitch ile melodi notaları (CEP 0.9.9.0)
description: Açık kaynak modellerin gerçek referansla ölçülmesi, en iyisinin (Spotify Basic Pitch) panele gömülmesi ve canlı test.
tags: [hoodoo, hoodoo-cut, tik-ritmi, basic-pitch, rapor]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/lib/basicpitch/basicpitch.js
  - tools/basicpitch/entry.js
  - tools/basicpitch/build.js
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/client/js/main.js
  - tools/test-tick.js
created: 2026-10-14
updated: 2026-10-14
---

# Basic Pitch ile melodi notaları (CEP 0.9.9.0)

Kullanıcı:
- "lisanslama çok önemli değil, istediğin her şeyi kullanabilirsin, test ediyoruz"
- "en iyi yöntemi panele entegre et ve test et"

Önceki adım: [[reports/2026-10-14-acik-kaynak-arastirma|açık kaynak araştırması]].

## 1. Ölçüm düzeneği (geliştirme makinesi, scratchpad)

Python venv'e kurulanlar (yalnız ölçüm için, kullanıcıya gitmez):
- PyTorch CPU
- `piano_transcription_inference` (Kong ve ark., MAESTRO onset F1 %96.7; model Zenodo'dan elle indirildi, 172 MB; kütüphanenin `wget` indirmesi Windows'ta çalışmıyor)
- `demucs` (htdemucs_6s: 216 sn şarkı CPU'da 40 sn)
- `beat_this`

Node tarafında `@spotify/basic-pitch` + TF.js 4.22 kuruldu.

**Referans:** Kong transkripsiyonu (solo piyano, 108 sn, 254 nota → 195 onset). Bugüne kadar kullanılan spektral akış
referansı zayıftı: zamanı ~6 ms erken, tuşların yalnız %58'i.

## 2. Sonuçlar (solo piyano, Kong referansı, bire bir eşleşme)

| Yöntem | İsabet | Yakalama | F1 (50 ms) | Zaman hatası medyan | 10 ms içinde |
|---|---|---|---|---|---|
| 0.9.7.0 DSP | %82 | %57 | 67 | 10.1 ms (geç) | %50 |
| 0.9.8.1 DSP | %94 | %78 | 85 | 9.9 ms (geç) | %51 |
| Basic Pitch, genlik ≥ 0.4 | %87 | %99 | 93 | 4.4 ms | %86 |
| **Basic Pitch, genlik ≥ 0.45, MIDI 40–88** | **%96** | **%99** | **97** | **4.4 ms** | **%87** |
| Basic Pitch, genlik ≥ 0.5 | %97 | %99 | 98 | 4.3 ms | %88 |
| Basic Pitch, genlik ≥ 0.6 | %98 | %83 | 90 | 4.5 ms | %88 |

Eşik neden 0.45: karışımda piyano daha sessiz. In the End girişinde riff notaları 0.45–0.72, bas/sol el
notaları 0.34–0.44. 0.45 + MIDI 40–88 ile In the End girişinde (4–12 sn) Kong'un piyano stemi üzerindeki
riff'iyle aynı 17 nota çıkıyor:

```
4.36 4.91 5.26 5.49 6.05 6.63 7.20 7.64 7.78 8.34 8.92 9.49 9.78 10.06 10.62 11.20 11.78
riff: F3 F3 F♯3 D♯ A♯3 A♯3 F♯3 …
```

Basic Pitch karışımda, davulsuz stemde ve piyano stemde girişte aynı notaları buldu (davul perdeli nota
üretmiyor). Bu yüzden Demucs panele alınmadı.

In the End'de tam bant bölümlerinde Kong (piyano stemi) referansı güvenilir değil (stem sızıntılı, 410
nota). Karışım için bağımsız sayısal doğruluk ölçülemedi.

**Neden nota olayları:** ham onset haritasından perde başına tepe seçimi denendi;
kare zaman eşlemesi tutmadı (~25 ms kayma). Kütüphanenin nota olayları kullanılıyor.

**Hız:**
- TF.js CPU arka ucu: 60 sn ses 41 sn.
- **WASM arka ucu: 60 sn ses 3.1 sn** (aynı sonuç, 144/145 nota birebir).

## 3. Panele entegrasyon

- `tools/basicpitch/`: esbuild ile tek dosya `com.hoodoocut/client/lib/basicpitch/basicpitch.js` (Node15
  hedefi), yanında model (`model.json` + 725 KB ağırlık) ve 3 WASM ikilisi. Toplam 4.2 MB.
  - `@tensorflow/tfjs` yerine core + converter.
  - Zincir işlemler için `register_all_chained_ops` eklendi; ilk pakette `x.slice` eksikti.
  - ESM girişleri kullanılıyor (`mainFields: module`).
- Arka uç sırası wasm → webgl → cpu. Premiere 26 CEP'te: **Node 17.7.2, wasm**; 5 sn ses 0.54 sn.
- `analyzer.readMonoResampled`: Blackman pencereli sinc, 512 adımlı tablo; 100 sn ses 0.2 sn.
- `analyzer.melodyFromNoteEvents`: genlik ≥ 0.45, MIDI 40–88, 30 ms içindeki notalar tek nota (adı en
  güçlüden).
- `main.js melodyNotes`: Basic Pitch; paket yüklenemez ya da hata verirse eski DSP (`detectRiffNotes`) ve
  günlüğe neden yazılır. Günlük satırı: "Müzik melodisi: N nota, Basic Pitch (wasm, X sn)".

## 4. Canlı (CEP 0.9.9.0)

| | Piyano (HDpiano) | In the End (HDend) |
|---|---|---|
| Plan | 118 tık notada, 40 tık düştü, 1 nota atlandı | 84 tık notada, 74 düştü, 2 nota atlandı |
| Donma | 5 yer / 1.1 sn (0.9.8.1: 6.5 sn) | 8 yer / 4.1 sn (0.9.8.1: 5.4 sn) |
| Hafif ağır çekim | 59 parça, 25 sn | 90 parça, 39 sn |
| Video | 87.7 → 61.1 sn | 87.7 → 70.5 sn |
| Bağımsız kontrol | tıkların %87'si gerçek bir tuşa (Kong) 22 ms içinde, medyan 8.8 ms | tıkların %83'ü Basic Pitch notasında (aynı yöntem), medyan 5.6 ms |
| Görünür fazla blok | 0 (2 tık Kong'da olmayan ama Basic Pitch'in bulduğu notada) | 0 |
| Süre | 58 sn | 66 sn |

**Video kısalması:**
- Piyanoda kaynakta atlanan uzun bölümler (1.7, 1.2, 1.4, 2.9, 4.4 sn) neredeyse hiç blok tıkı içermiyor; yalnız boş görüntü atlanıyor.
- Notalar artık doğru ve daha yoğun; DP tıksız duraklamaları dondurmak yerine kesiyor.

Karşılaştırma için projede:
- "Piyano v1 (0.9.8.0)", "Piyano v2 (0.9.8.1)"
- "Melodi v3 (0.9.7.0)", "Melodi v4 (0.9.8.1)"
- yeni HDpiano / HDend (0.9.9.0)

## 5. 0.9.9.1: kare içi kayma ile hizalama

Kullanıcı: "kesilmesi uygun, devam et".

**Hata bütçesi** (HDpiano 0.9.9.0, 98 eşleşen tık, Kong referansı, mutlak medyan):

| Kaynak | Hata |
|---|---|
| Nota zamanının kareye yuvarlanması | 3.9 ms |
| Tık sesinin karesi içindeki kayması | 3.3 ms |
| Basic Pitch notası − Kong | 5.1 ms (işaretli +1.7) |
| **Toplam** | **8.8 ms** (10 ms içinde %62, 20 ms içinde %100) |

**Düzeltme** (`alignToNotes`): tıkın karesi, *sesinin* notaya düşeceği kareye konur:
`hedef = round((nota − kayma) · fps)`. İki bağımsız yuvarlama teke iniyor; hata ≤ yarım kare.

Basic Pitch'in +1.7 ms gecikmesini düzeltmek denendi, kazanç yok → eklenmedi.

**Canlı:**
- Piyano, Kong referansı: tıkların %87'si bir tuşa 22 ms içinde; medyan **8.8 → 5.7 ms**, 10 ms içinde **%62 → %76**.
- In the End, panel notalarına: medyan 5.6 → **4.5 ms**, q90 8.1 ms, 10 ms içinde **%99**.
- Görünür fazla blok yok. Donma 1.4 / 4.0 sn.

**Analiz süresi:** Bölge uzaması payı müzik dosyasının sonunu aşınca sessizlik de modele veriliyordu.
`readMonoResampled` artık dosya sonunda duruyor; piyanoda analiz 25.5 → 10.2 sn, notalar aynı.

## Sınırlar

- Karışımda piyano maskelendiği bölümlerde Basic Pitch az nota buluyor (In the End: 216 sn'de 277 nota).
  Tıkların çoğu düşüyor, video kısalıyor.
- Genlik eşiği (0.45) iki şarkıyla seçildi; çok farklı miksajda ayar gerekebilir.
- Paket 4.2 MB.
- CEP 11'de (Node 15.9) denenmedi; hedef `node15`.
- Tık tespiti ve yeniden zamanlama biçimi (araştırmadaki SuperFlux / şablon, "vuruşa hızlanarak gir", tık
  sesini ayırma) henüz uygulanmadı.
