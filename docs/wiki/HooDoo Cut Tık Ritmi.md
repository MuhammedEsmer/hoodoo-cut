---
type: konsept
title: HooDoo Cut Tık Ritmi
description: Blok koyma/kırma tıklarını sabit aralıklı ızgaraya oturtan mod — tespit, plan, hız değiştirme ve canlı doğrulama.
tags: [hoodoo, hoodoo-cut, tik-ritmi, setSpeed, onset]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/tickplan.js
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/client/js/main.js
  - com.hoodoocut/host/index.jsx
  - tools/test-tick.js
  - tools/test-tick-host.js
created: 2026-10-14
updated: 2026-10-14
---

# HooDoo Cut Tık Ritmi

Minecraft editlerinde blok koyma/kırma sesleri ("tık") müzikle ritim yakalamak
için sabit aralıkla gelmeli. Bu mod (0.9.5.0+) seçili bölgedeki tıkları bulur ve
her tıktan sonraki ara kısmı **hızlandırıp/yavaşlatarak** bir sonraki tıkı tam
bir aralık (T) sonra getirir. Tasarım ve tanı geçmişi:
[[plans/2026-10-14-tik-ritmi|tık ritmi planı]].

```
tık₁ ─[ tık parçası, %100 ]─[ ara, hız s ]─ tık₂      toplam = T
s = (gerçek aralık − tık parçası) / (T − tık parçası)
```

## Kullanım

1. **Mod → Tık ritmi.** Ses eşiği ve şablon kartları gizlenir.
2. **Analiz Sesi:** yalnız oyun sesi track'i (test projesinde A2).
3. **Kapsam → Seçili clipler**, timeline'da inşaat bölümünü seç (zorunlu).
4. Ayarlar: tık aralığı (sn) **veya** BPM + bölüm — iki tık arasında olmasını istediğin
   süre, sonuçtaki "doğal tık aralığı"na yakın seçilmeli; tık parçası (kare, varsayılan 3);
   hassasiyet (dB, 12 = yalnız güçlü tıklar); en kısa tık aralığı (ms, 200, en az 100);
   hız sınırı (%50–%400).
5. **🎵 Tıkları Bul** → tıklar `HooDoo tik` adlı sequence marker'ı olarak konur;
   sonuçta tık/ara sayısı, hız aralığı, süre değişimi.
6. **🎯 Ritme Oturt** (iki tık onay) → razor + yeniden zamanlama; marker'lar silinir.

## Parçalar

| Katman | Fonksiyon | Görev |
|---|---|---|
| Tespit | `ACSAnalyzer.detectOnsets` | (0.9.5.1) Tam bant 60 Hz–15 kHz, 5 ms zarf — Premiere dalga formuyla aynı. Tık = iki yana da ≥12 dB düşen **belirgin tepe**; zaman = tepenin atak başlangıcı (tepe −10 dB). Bölgedeki en güçlü tıkın `relDb` altı elenir; `minGap` (en az 100 ms) içindeki iki tepeden **güçlü olan** kalır. Atak bölgeden önce başlıyorsa sayılmaz |
| Plan | `ACSTickPlan.planTicks` | Kareye hizalar; alt hız sınırına inmeyi gerektiren yakın tık öncekine katılır (`merged`); üst sınırı aşan hız sınıra çekilir (`limited`, fazla kaynak düşer) |
| Uygulama | `ACS_tickRetime` (host) | Tüm içerik track'lerinde: 1) kısalacak parçalar: `end` → `setSpeed`; 2) sola kayanlar soldan, sağa kayanlar sağdan `move`; 3) uzayacak parçalar: `end` → `setSpeed`; sonra yerleşim + hız doğrulaması |
| Önizleme | `ACS_setTickMarkers` / `ACS_clearTickMarkers` | Yalnız `HooDoo tik` adlı marker'lar yönetilir |

## Hedef: Müzik melodisi — güncel yöntem (0.9.9.0)

> 0.9.6.x'teki HPSS yöntemi (aşağıda tarihçe olarak duruyor) piyano riff'ini **takip etmiyordu**;
> 0.9.7.0'da değiştirildi, 0.9.8.0'da solo piyano ile ayarlandı ve seçenek (c) eklendi, 0.9.8.1'de
> donma azaltıldı, **0.9.9.0'da notalar Spotify Basic Pitch ile** bulunuyor. Ölçümler:
> [[reports/2026-10-14-piyano-melodi-ogrenme|solo piyano raporu]],
> [[reports/2026-10-14-donma-azaltma|donma azaltma raporu]],
> [[reports/2026-10-14-acik-kaynak-arastirma|açık kaynak araştırması]],
> [[reports/2026-10-14-basic-pitch-entegrasyon|Basic Pitch entegrasyonu]].

**0.9.9.2 farkları** (kullanıcı: "hepsini yap")

- **Tık sesleri ayrı** (panel: "Tık sesleri → Ayrı yerleştir", varsayılan açık).
  - Eşleşen her tıkın sesi kaynak medyadan %100 hızda yeni ses track'lerine konur: `ACS_prepClickSlices` düzenlemeden önce, `ACS_placeClickSlices` sonra.
  - `overwriteClip` kareye oturtuyor, `move()` ile kare arasına taşınır. Ses, tıkın kendisi değil **notanın kendisi** (`plan.noteTimes`) olacak şekilde yerleşir.
  - Çok akışlı medyada akışlar ardışık track'lere dağılıyor (A1 sessiz akış, A2 oyun sesi). Oyun sesi akışı tutulur, diğerleri silinir.
  - Bölgedeki asıl oyun sesi silinir.
  - Dilim en çok 0.35 sn; bir sonraki notadan ve kaynaktaki bir sonraki tıktan 20 ms önce biter. 0.35 sn sabit dilim yakın tıklarda eşleşmemiş tıkın sesini de taşıyordu.
  - Ağır çekimde perde düşmesi ve kesimlerde tık kuyruğu yok.
- **Vuruşa hızlanarak gir:** eşleşen tıktan önceki son 0.1 sn (`ENTRY`) normal hızda; yavaşlama öncesine düşer (visbeat).
- **Demucs seçeneği** ("Melodi kaynağı: Piyano kanalı / Davulsuz").
  - Yerel Python (`tools/setup-ml.ps1` → `%LOCALAPPDATA%\HooDooCut\ml\venv`); `htdemucs_6s --shifts 0` (rastgele kaydırma yok, aynı müzik → aynı notalar).
  - Piyano kanalında Basic Pitch eşiği 0.4.
  - In the End'in tam bant bölümlerinde riff notaları karışımdan 2–3 kat fazla (518–524 nota / 277).
- Tık atak zamanı 1 ms çözünürlükle (`refineAttacks`); 5 ms pencereler ±2.5 ms belirsizlik bırakıyordu.
- **Canlı, piyano:** tık sesleri panelin notalarına **medyan 0.0 ms** (119 dilimin 118'i 5 ms içinde).
  - Kong referansına göre medyan 6.4 → 5.1 ms, 10 ms içinde %71 → %82.
  - Kalan fark yalnız Basic Pitch'in nota zamanı.
  - Donma 1.7 sn.
- **Canlı, In the End (Demucs piyano, `--shifts 0`):** 524 nota → 136 tık notada (karışımla 84), donma 1.0 sn.
  Tık sesleri notalara **medyan 0.0 ms, en kötü 1.0 ms** (136/136 ≤ 5 ms). Demucs sonucu tekrarlanabilir: panel ve çevrimdışı referans
  aynı 524 notayı buldu.
- **Süre:** tık sesi yerleştirme uygulamayı ~2–3 dk uzatıyor (119–147 dilim).
  - Uzun oturumda Premiere ağırlaştı (8.4 GB, çok sayıda test sequence'i); panel bir kez yanıt vermeyi bıraktı.

**0.9.9.1 farkları**

- Tıkın karesi, *sesinin* notaya düşeceği kareye konur (`hedef = round((nota − kare içi kayma) · fps)`).
  Önceden tık ve nota ayrı ayrı kareye yuvarlanıyordu.
  - Piyano (Kong referansı): medyan hata 8.8 → **5.7 ms**, 10 ms içinde %62 → **%76**.
  - In the End: panel notalarına 10 ms içinde **%99**.
- Müzik dosyası bölge payından kısaysa sessizlik analiz edilmiyor (piyanoda analiz 25.5 → 10.2 sn).

**0.9.9.0 farkları**

- Melodi notaları **Spotify Basic Pitch** ile çıkarılır. Model panelde çalışır (TF.js WASM, Premiere 26 CEP'te
  Node 17.7, 5 sn ses 0.5 sn, Python yok).
  - Paket: `com.hoodoocut/client/lib/basicpitch/` (4.2 MB, `tools/basicpitch` ile üretilir).
  - Nota seçimi: genlik ≥ 0.45, MIDI 40–88, 30 ms içi tek nota (`analyzer.melodyFromNoteEvents`).
  - Ses 22050 Hz mono'ya sinc ile yeniden örneklenir (`analyzer.readMonoResampled`).
  - Paket yüklenemezse eski DSP yöntemi (`detectRiffNotes`) devreye girer, günlüğe yazılır.
- Bağımsız referansla (Kong piyano transkripsiyonu) solo piyano doğruluğu: F1 0.85 → **0.97**; zaman
  hatası 9.9 → **4.4 ms**; 10 ms içinde %51 → %87. In the End girişinde riff notalarının hepsi.
- Canlı:
  - piyano donma 6.5 → 1.1 sn, tıkların %87'si gerçek tuşta;
  - In the End donma 5.4 → 4.1 sn;
  - görünür fazla blok yok;
  - videolar 61 / 70 sn'ye kısaldı (piyanoda atlanan uzun bölümlerde blok tıkı yok).

**0.9.8.1 farkları** (kullanıcı: "donmayı azalt", hafif ağır çekime onay)

- Donmanın asıl sebebi: DP her tıkı bir notaya oturtmak için (ödül 1) melodi tıklardan seyrekken
  boşluğu donmayla dolduruyordu. Donma pahalı yapıldı (0.3 + **2.5/sn**): DP uzun donma yerine bir
  tıkı daha düşürüp keser.
- Temiz görüntü artık iki fazla tık **arasından** da alınır (fazla blok anı kesilir); yetmezse bölümler
  birlikte **hafifçe yavaşlar** (sınır max(minSpeed, **%70**)), en son kısa donma.
- Fazla tıktan önceki bölüm 1 kare erken biter (atağın ilk ms'leri yavaşlayınca tık gibi duyuluyordu);
  fazla tıktan sonraki bölüm **175 ms** sonra başlar (200 ms temiz görüntüyü fazla azaltıp piyanoda
  planı saniyelerce görüntü atlamaya itti).
- Canlı (0.9.8.1): piyano 54 donma / 27.5 sn → **19 / 6.5 sn**, video süresi aynı (−0.15 sn); In the
  End plan 35.7 sn → **16 donma / 5.4 sn**, video −3.7 sn. İkisinde de görünür fazla blok yok; tıkların
  %89 / %90'ı notada. Bedeli: ~45 sn hafif ağır çekim (%67–98), notada tık sayısı azaldı (piyano
  153 → 125, In the End 158 → 114).

**0.9.8.0 farkları**

- Nota tespiti (solo piyano *In the End EASY Piano Tutorial* referansıyla): perde değişiminde ızgara
  noktası atakta değilse nota o perdenin gerçek atağına taşınır, atak yoksa (akorun bir sesi sönerken
  diğeri öne çıkması) nota yazılmaz; aynı perdenin **yeniden vuruşu** da nota (güçlü atak + o perdede
  yükseliş; davul tek başına değil). Atak eşikleri şarkının medyan atağına göre; dB tabanı medyan − 40 dB
  (dijital sessizlikten giriş tempoyu 2/3'e düşürüyordu). Piyano: notaların gerçek tuşa denk gelen oranı
  %74 → %88, yakalanan tuş %53 → %72. In the End: 2 ölçü sonra tekrar eden nota %47 → %73.
- **Seçenek (c)** (kullanıcı kararı): uzun nota aralarında görünür fazla blok ve ağır çekim yerine
  **donma** — a'dan sonraki temiz görüntü oynar, son 2 karesi kalan süre boyunca çok yavaş hızla
  dondurulur, ortası silinir. Donan karenin **sesi silinir** (uzayan 2 karelik ses tık gibi duyuluyordu).
- Fazla tıktan sonraki temiz görüntü **150 ms sonra** başlar (blok sesi ~0.3 sn; kuyruk kesimden sonra
  yeni tık gibi duyuluyordu); fazla tık yoksa donma tıkın sesi bittikten sonra.
- Canlı (HDpiano, 3 tur): son turda tıkların %95'i notada (medyan 5 ms), notaların %97'sinde tık;
  nota dışı 8 tıkın hiçbiri orijinal bir tık değil (görünür fazla blok yok). 54 donma (27.5 sn), 22 yavaş
  ara (%73–94), video +9.45 sn. Premiere %3'e kadar düşük hızları kabul etti, 3 track aynı.
- In the End için plan (canlı uygulanmadı): 158 tık notada, 50 donma (35.7 sn), video +18.3 sn.

**Yöntem**

1. **Melodi notaları** — 0.9.9.0'dan beri Basic Pitch (yukarı). Aşağıdaki DSP yöntemi yalnız yedek —
   `ACSAnalyzer.detectRiffNotes`:
   - Tempo: orta bant (300–3000 Hz) onset gücünde **sekizlik periyodu** doğrudan aranır
     (1, 2 ve 4 katında da güçlü olmalı); vuruş araması düzgün sekizlik akışta 3 sekizliği seçip
     tempoyu 2/3 küçük bulabiliyordu (sentetik 100.4 → 66.9).
   - Sekizlikler **dinamik programlamalı takiple** (Ellis tarzı, sıkılık 100) bulunur; her nokta
     yerel atağa oturur. Sabit (tempo, faz) ızgarası 100 sn'de 50+ ms kayıyordu ve sonuç analiz
     aralığına göre değişiyordu (ortak bölgede 0/52 eşleşme) → takiple 48/49, 50/50, 24/24.
   - Her sekizlikte baskın perde (kromagram 150–2500 Hz); **perde değişimi = melodi notası**
     (0.9.8.0: atağa taşıma / sönüm eleme, yukarı). Aynı perdenin yeniden vuruşu nota (0.9.8.0);
     tutulan nota ve davul nota sayılmaz.
   - In the End: 105.3 BPM, riff D♯ A♯ F♯ F F♯ … 2 ölçüde bir tekrar.
2. **Eşleşme** — `ACSTickPlan.alignToNotes`: her melodi notasına bir tık; arada kalan fazla tıkların
   görüntüsü **silinir** (seçenek b; plan parçası `target 0, speed 0`). Temiz bölümler: baş, fazla tıklar
   arası, yaklaşma (0.1 sn'den kısası kullanılmaz). Adaylar: yaklaşma ≥ D ise son D kare normal hızda;
   yaklaşma hafifçe yavaşlatılır; bölümler toplamı ≥ D ise baş + yaklaşma (+ en uzun aralar) normal
   hızda; değilse bölümler hafifçe yavaşlar, yetmezse ilk bölümde **donma** (seçenek c, plan parçası
   `freeze`); hiçbiri olmazsa fazla tıklar görünür kalır. Yavaşlama sınırı max(minSpeed, %70). Maliyet:
   yavaşlama |ln hız| + kesme 0.1·ln(kaynak/D) + ek kesme 0.05 + donma 0.3 + 2.5/sn + görünür fazla tık
   0.5 + atlanan nota 0.4 + düşen tık 0.02 − ödül 1. Bölge başı da aynı kuralla.
3. **Host** — `ACS_tickRetime` hedefi 0 olan parçayı ve donan parçanın ses kısmını ripple'sız siler
   (önce), sonra kısalt/taşı/uzat. Donma plan satırında 5. alan `f`.

**Fiziksel sınır:** tıklar ~0.4 sn arayla; 0.3 sn'den uzun temiz (blok koymasız) görüntü yok.
Nota arası uzun olduğunda ağır çekim, görünen fazla blok ya da donma gerekir. 0.9.7.0'da minSpeed 0.5 ile
54 görünür fazla tık kalıyordu; kullanıcı **(c) donmayı** seçti (0.9.8.0), donma çok olunca (In the End
planında 35.7 sn) azaltılmasını istedi (0.9.8.1): şimdi önce fazla tık kesilir, sonra hafif ağır çekim,
en son kısa donma.

**Bağımsız son kontrol, 0.9.7.0** (düzenlenmiş HDend'in oyun sesi + müziği dışa aktarılıp sesten):
- İlk deneme (sabit ızgara): plan hedeflerinin 74/76'sında tık vardı (uygulama doğru) ama
  kontrol aralığında notalar farklı çıktı → tutarsızlık bulundu, takiple düzeltildi.
- Son: **riff notalarının 85/89'unda (%96) bir kare içinde tık**, medyan 5 ms, en kötü 15 ms;
  140 tıktan 86'sı notada, 54'ü uzun nota aralarında görünür. 99 ara, 114 parça silindi, 40 sn.

## Hedef: Müzik melodisi (0.9.6.0) — tarihçe, artık kullanılmıyor

Kullanıcı geri bildirimi: sabit BPM ızgarası "arka plandaki sabit davula göre" edit hissi
veriyor; istenen, tıkların **melodinin notalarına** (ör. piyano) oturması. Ayarlarda
**Hedef = Müzik melodisi** + **Müzik track'i** (kilitli) seçilir:

1. Tıklar oyun sesinden bulunur (aynı tespit).
2. Müzik track'i tek başına dışa aktarılır; `ACSAnalyzer.detectNotes` nota başlangıçlarını
   çıkarır: STFT 2048/10 ms, **HPSS** (zaman medyanı = harmonik, frekans medyanı = perküsif;
   ikili maske h > 2p), 150 Hz–4 kHz log-genlikte **kalıcı akış** (60 ms sonraki enerji −
   önceki 60 ms'nin maksimumu; davul ~30 ms'de söner, maske deliği nota sayılmaz), yerel
   eşik + taban 0.2. Yalnız [bölge başı, bölge sonu + uzama payı] okunur.
3. `ACSTickPlan.alignToNotes`: dinamik programlama ile sıralı tık→nota eşleşmesi; geçiş hızı
   sınırlar içinde, maliyet |ln hız| + atlanan nota (0.15) + düşen tık (0.6) − eşleşme ödülü (1).
   Bölge başı da (bölge başı → ilk tık) yeniden zamanlanır ki ilk tık notasına otursun.
4. Uygulama aynı `ACS_tickRetime` (ön ek ara da bir "gap").

Doğrulama (In the End – Linkin Park, instrumental; kullanıcı projeye ekledi):
- Nota tespiti 0–30 sn: 2.8 nota/sn, **%70'i 2 ölçü sonra tekrar ediyor** (riff yakalanıyor).
- Canlı (HDend, video tamamı, A2 oyun sesi, A3 kilitli müzik): 158 tıkın **149'u notaya**,
  105 nota tıksız, hız %50–221 (medyan ~0.94), süre +13.9 sn, 118 sn sürdü, 11 arada hız tavanı.
  **148 tık parçasının 148'i bir nota zamanının 1 kare içinde** (en kötü 8.3 ms); konumlar 3
  track'te aynı, A2 hızı 12 arada ≤0.0007 farklı (<0.3 ms); kilitli müzik dokunulmadı.
- Testler: `detectNotes` (armonikli piyano benzeri notalar + çalarken düşen davul vuruşları),
  `alignToNotes` (sıralı/sınırlı hızlar, ön ek ara).

### Piyano riff'ine odak (0.9.6.1)

Kullanıcı: bu şarkıda takip edilecek ana melodi **piyano riff'i**. İki iyileştirme:

1. **Sönüm ağırlığı** (`detectNotes` `decayK`, varsayılan 1): atak sonrası 60 → 250 ms'de sönen
   sesin (piyano) akışı büyütülür; süren distorsiyonlu gitar/yaylı etkilenmez. Bant daraltma
   denendi (300–4000, 400–2500, 500–5000) — yardımcı olmadı, şarkı sonunu silebildi.
2. **Riff filtresi** (`ACSTickPlan.keepRepeating`): 2–12 sn arası en çok eşleşen gecikme = tekrar
   periyodu (plato ortası); bir periyot önce/sonra karşılığı olan nota kalır. Filtre 1.5 sn'den
   uzun boşluk bırakırsa (riff'siz bölüm) oradaki notalar geri konur.

In the End ölçümü: periyot **2.27 sn** (105 BPM'de 1 ölçü); 533 nota → 390 tekrar eden + boşluk
dolgusu = 426. Eşleşme: 151/158 tık (eskisi 149), atlanan nota 105 → 66, medyan hız 0.94, süre
+2.4 sn. Canlı (HDend, 0.9.6.1): **150/150 tık parçası riff notasının 1 kare içinde** (en kötü
8.3 ms), 3 track konumları aynı, kilitli müzik dokunulmadı, 138 sn, 21 arada hız tavanı.
Karşılaştırma için önceki sürüm projede **"Melodi v1"** adıyla duruyor.

### ⚠️ Gerçek notalarla kontrol (2026-10-14): melodi tespiti UYMUYOR

Kullanıcı: "hiç uymadı". Önceki "150/150 tık parçası riff notasında" doğrulaması **döngüseldi**
(tıklar kendi tespit ettiğimiz notalarla karşılaştırıldı; tespit yanlışsa yakalanamaz).

Bağımsız referans:
- İnternet: Hooktheory — D♯ minör, 4/4, 105 BPM (giriş 106), giriş akorları i → VII → VI → VII
  (D♯m–C♯–B–C♯). Riff notalarının güvenilir transkripsiyonu bulunamadı (kaynaklar çelişkili,
  Ultimate Guitar sayfası JS ile yükleniyor).
- Sesin kendisi (kromagram, sekizlik ızgara, faz 0.059 sn): en güçlü perdeler F, F♯, D♯, A♯
  (D♯ minörle uyumlu); 16 sekizlikte (2 ölçü, 4.57 sn) tekrar eden desen
  **F♯ → D♯ (×3) → A♯ (×2) → F♯ (×2) → uzun F (×8)**. Melodi nota değişimleri ör. 5.49, 5.77,
  6.63, 7.20, 7.77, 10.06 … sn (2–3–2–2–7 sekizlik aralık). Girişte güçlü vuruşlar her vuruşta
  (çeyrek), aradakiler zayıf.
- `detectNotes` sonucu (0–20 sn): tespitlerin yalnız **%24'ü** sekizlik ızgarada, riff
  sekizliklerinin **%14'ü** yakalanmış; yakın olanlar ±70–80 ms kayık, çok sayıda fazladan nota.

Sonuç: HPSS akış tespiti piyano riff'ini takip etmiyor. Gerekli: (1) tempo/faz bulunmuş
sekizlik ızgarada perde değişimi + yeniden vuruş ile riff notaları; (2) doğrulama bağımsız
referansla (kromagram) yapılmalı; (3) melodi notası ~1/sn, tıklar ~2.5/sn → notalar arasındaki
fazla tıkların ne olacağı kullanıcıya soruldu.

## Müzik track'i (0.9.5.2)

Müziği bir ses track'ine koyup **kilitle**: tık ritmi kilitli track'leri tamamen işlem
dışı bırakır (düzenleme oturumu `tick` modunda kilidi hata saymaz, `ACS_tickRetime`
kilitli track'i atlar). QE seq razor kilitli track'i zaten kesmiyor (canlı doğrulandı).
Müzik yerinde kalır; video ızgaraya oturur. Müziği vuruşlar tıka denk gelecek şekilde
kaydırmak için kilidi açıp taşıyıp tekrar kilitle.

## Premiere davranışları (canlı tanı, 2026-10-14)

- **Yüksek hız tavanı:** QE `setSpeed` yüksek hızları sessizce sınırlıyor; tavan konuma
  göre değişiyor (aynı videoda 25 sn'de 3.2773, 40 sn'de ~2.1; 3.0'a kadar tam). Süre yine
  hedefte kalır → tıklar ızgarada; yalnız aranın son kaynak kareleri atlanır. Doğrulama
  plandan düşük hızı kabul edip sayar (`OK|…|capped`); aynı aranın track'leri arasında
  >0.01 fark senkron hatası sayılır. Sebep (VFR değil, medya 60.00024 fps) bulunamadı.

- QE `TrackItem.setSpeed(hız, '', false, false, false)`: hız **oran** (0.5 = %50);
  **timeline süresini asla değiştirmez**, yalnız kaynak aralığını; linkli
  partnerlere yayılmaz → her track'teki parça ayrı.
- `end` önce yazılıp sonra `setSpeed` verilirse kaynak = hedef süre × hız (doğru).
  Ters sıra hızı bozuyor (2 → 1.769, track'ler arası fark, senkron işareti).
- DOM `inPoint/outPoint` hızlı kliplerde **hıza bölünmüş** raporlanır (gerçek
  kaynak = değer × hız).
- DOM `move` yalnız o klibi taşır.

## Canlı doğrulama (test projesi `123tets.prproj`, sequence kopyası)

| Bölge | Ses | T | Sonuç |
|---|---|---|---|
| Yapay tıklar 100–103.35 sn | — | 0.5 | 6 tık 0.5 sn ızgarada, 3 track aynı, kaynak kesintisiz (649 ms) |
| 172–180 sn (panel arayüzü) | A1 | 0.4 | 7–8 tık 0.4 sn ızgarada, 3 track aynı (1.1–1.5 sn) |
| 954.46–961.76 sn, 0.9.5.0 tespiti | A2 | 0.3 | 16 tık ızgarada ama marker'lar 12–62 ms erken ve zayıf sesler de tık sayıldı (aşağıya bkz.) |
| **954.46–961.76 sn, 0.9.5.1 tespiti** | **A2** | **0.4** | **10 tık (doğal aralık 0.40 sn), marker'lar tepe atağının 6–11 ms içinde; yalnız bir çift aralık ×2.14; tıklar tam 0.4 sn arayla, 3 track aynı (1.1 sn)** |

| **Yeni test videosu `2026-10-14 15-11-41` (87.7 sn, tamamı inşaat), 0.9.5.2** | **A2** | **128 BPM, 1 vuruş (0.46875)** | **145 tık / 144 ara; 143 ardışık tık tam bir vuruş arayla (en kötü 2.1 ms); 3 track aynı; kilitli A3 müzik (Elektronomia – Sky High, NCS) dokunulmadı; 16 arada Premiere hız tavanı; 114.6 sn sürdü; video 87.7 → 71.2 sn. Müzik 0.433 sn'ye kaydırıldı → vuruşlar tıklara denk** |

Müzik: `Documents\Adobe\Premiere Pro\26.0\HooDoo test muzik\Elektronomia - Sky High [NCS Release].mp3`
(ncs.io/SkyHigh, kullanıcı onayıyla indirildi). BPM kendi ölçümüyle doğrulandı: zarf
otokorelasyonu 0.470 sn (~128 BPM), vuruş fazı müzik başından 0.21 sn. NCS şartı:
açıklamada parça/sanatçı + "Music provided by NoCopyrightSounds" + bağlantı.

### 0.9.5.1 düzeltmesi (kullanıcı geri bildirimi: "marker'lar asla oturmuyor")

- Bölümde iki ses ailesi var: güçlü blok sesleri (−26…−30 dB, zaten ~0.4 sn ritimde) ve
  12–15 dB zayıf başka bir ses. Eski HPF 1 kHz ikisini eşit gösterip hepsini tık sayıyordu.
- Eski "ani yükseliş" yöntemi dijital sessizlikte tıktan hemen önceki küçük sesi seçiyordu
  (marker 12–62 ms erken). Tepe tabanlı tespitle düzeldi; regresyon testi:
  `a faint sound just before a click does not steal its marker`.
- Kullanıcı ayarı: aralık 0.1 sn (doğal 0.4) → hızlar %400 sınırında, −2.75 sn. Sonuca
  "Doğal tık aralığı" ve çok farklıysa uyarı eklendi; en kısa tık aralığı ≥100 ms
  (tek blok sesinin ~60 ms arayla iki tepesi var).

Testler: `tools/test-tick.js` (plan + tespit, 9), `tools/test-tick-host.js` (host, 5),
`tools/test-panel.js` tık senaryoları (4).

## Sınırlar

- Her `move`/`end`/`setSpeed` ayrı undo adımı → geri almak için yedek sequence önerilir.
- **Yavaş:** 87.7 sn'lik videoda 288 razor + 861 taşıma = 114.6 sn. Razor her sınırda ayrı QE çağrısı; taşımalar tek tek DOM `move`. İyileştirme: taşımaları UXP motorunda tek işleme almak (`createMoveAction`), razor için şimdilik yol yok.
- Tespit tek bir gerçek bölümde ayarlandı; ayak sesi gibi diğer darbeler de tık sayılabilir → hassasiyet / en kısa aralık ile ayarlanır, marker'lardan kontrol edilir.
- Bir kez, yedekli çalışmadan sonra yedek kopyanın sekmesi öne geçti; tekrar denemede (6 sn izleme) **yeniden üretilemedi** — gözlemde kalırsa ele alınacak.
