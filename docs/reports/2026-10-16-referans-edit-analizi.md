---
type: rapor
title: Referans edit analizi (Rust montajı, maden kırma)
description: Kullanıcının "tam istediğim edit" dediği kaydın ilk 20 sn'sinde, özellikle 15–18 sn maden bölümünde vuruşların müzikle ilişkisi ölçüldü.
tags: [hoodoo, hoodoo-cut, tik-ritmi, referans, analiz]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/lib/basicpitch/basicpitch.js
  - com.hoodoocut/client/js/analyzer.js
created: 2026-10-16
updated: 2026-10-16
---

# Referans edit analizi (2026-10-16)

Kullanıcı: "ilk 20 sn'sindeki edit benim yapmak istediğim edit tam olarak. Özellikle o maden kırarken
müziğe uygun gelecek şekilde vurması." Ardından: "saniye 15-18 arasını analiz et". Kod değişikliği yok;
yalnız ölçüm.

## Kaynak

- `C:\Users\Muhammed\Videos\2026-10-15 11-43-17.mp4`: OBS ile kaydedilmiş bir YouTube videosu (Rust montajı).
  - 30.6 sn, 1920×1080, 60 fps.
  - İki ses akışı: akış 0 tamamen sessiz, akış 1 oyun sesi + müzik karışık.
- Oyun **Minecraft değil, Rust**:
  - 0–3 sn oynatıcı/envanter;
  - 3–14.9 sn yapı (çekiçle duvar yükseltme, parça koyma; çok sayıda kısa klip);
  - **15.0–18.43 sn kazmayla taş madeni kırma**;
  - 18.43 sn'den sonra yine yapı.
- Müzik: rap/trap, **108.3 BPM**.
  - Beat This vuruşlarına doğru uydurma: vuruş 0.5543 sn, faz 3.342 sn, artık ±20 ms.
  - 1 ölçü = 2.217 sn; karışımın tekrar periyodu da 2.22 sn.

## Yöntem

- PyAV ile çözme. Ses kanalları için Demucs `htdemucs_6s --shifts 0` (davul / bas / gitar / vokal / diğer).
- Vuruş ızgarası için Beat This. Melodi notaları panelin kendi Basic Pitch paketiyle, davulsuz kanallardan.
  Bas ve gitar nota başları, kendi kanallarında onset tespitiyle.
- Kesmeler: kare farkı tepeleri. Her aday için önceki/sonraki kare yan yana bakıldı (kamera konumu ve taşın
  şekli değişiyorsa kesme).
- Vuruşlar:
  - Görüntü: kazmanın taşa değdiği ilk kare, 60 fps kareler tek tek.
  - Ses: davul kanalının 1.5 kHz üstü 1 ms atakları ve mel şablon eşleşmesi.
  - Ses zamanı, görüntüyle en çok 46 ms içinde uyuşan atak.
- Tekrar eden müziği ayırma (REPET, 2.217 sn periyot) denendi. Oyun vuruşlarını müzikten temiz ayırmadı;
  aynı ataklar iki tarafta da kaldı.

## 15–18 sn: klip klip

![[2026-10-16-referans-15-18.png]]

Mavi noktalar kazma vuruşları (ses zamanı); altlarındaki sayı en yakın onaltılığa sapma. Koyu dikey çizgiler
vuruş, açık çizgiler sekizlik, kesikli çizgiler onaltılık. Turuncu bas, yeşil gitar nota başları.

| # | Klip (sn) | Süre | İçerik | Vuruş: görüntü / ses (sn) |
|---|---|---|---|---|
| 1 | 15.000–15.583 | 0.58 | Geniş açı, taşa yaklaşma, kazma kalkar ve iner, kıvılcım 15.517 | 15.350 / 15.304 |
| 2 | 15.583–15.800 | 0.22 | Kalkık kazmayla başlar, 1 karede iner, bekler | 15.617 / 15.632 |
| 3 | 15.800–15.900 | 0.10 | Başka kamera (ağaçlar), kazma zaten taşta, beyaz çarpma parlaması | 15.817 / 15.814 |
| 4 | 15.900–16.233 | 0.33 | Kalkık kazma; taş daha yassı (madenin ilerisinden), işaret parıltısı | 15.950 / 15.964 |
| 5 | 16.233–16.567 | 0.33 | Kalkık kazma, iner; sıcak noktaya sarı kıvılcım 16.467 | 16.250 / 16.262 |
| 6 | 16.567–16.833 | 0.27 | Kalkık kazma, iner | 16.600 / 16.568 |
| 7 | 16.833–17.117 | 0.28 | Kalkık kazma 4 kare bekler, iner | 16.917 / 16.887 |
| 8 | 17.117–17.467 | 0.35 | Kalkık kazma 6 kare bekler, iner | 17.233 / 17.204 |
| 9 | 17.467–18.433 | 0.97 | Kalkık kazma 5 kare, iner; ikinci vuruşta taş kırılır, büyük kıvılcım 17.83–18.1; 18.35'te parlama geçişiyle yapıya | 17.567 / 17.551 ve 17.800 / 17.800 |

Teknik:
- Her klip **bir sallama**. Klip kazmanın kalkık anıyla başlıyor, yani kaldırma hareketi kesilmiş.
  İniş 1–2 kare (17–33 ms) sürüyor; vuruştan sonra kısa bir bekleme, sonra bir sonraki sallamaya kesme.
- Taşın şekli klipten klibe değişiyor: büyük yuvarlak → yassı → küçük → kırık. Klipler madenin tamamına
  yayılan sallamalardan seçilmiş. Gerçekte çok daha uzun süren kazma 3.4 sn'ye sıkıştırılmış.
- Kesme ile vuruş arası 17–117 ms. Kesme hep vuruştan hemen önce.

## Vuruşların müzikle ilişkisi

**Aralık:** 15.96'dan sonra vuruşlar 0.30–0.35 sn arayla, ortalama 0.317 sn (5 aralık). Başta düzensiz:
0.33, 0.18, 0.15 (3. klip yalnız 0.10 sn).

**Izgara:** en yakın onaltılığa sapmalar +46, −42, +2, +13, +34, +63, −34, +6, −63, +48 ms.

| Hedef | Ortalama mutlak sapma | Rastgele beklenen |
|---|---|---|
| Onaltılık | 35 ms | 35 ms |

**Notalar:** 10 vuruşun 3'ü bir bas/gitar nota başına 25 ms içinde (15.304, 15.814, 15.964).
- Kontrol: vuruş dizisinin tamamı ±0.3 sn kaydırılınca ortalama 2.5 vuruş tesadüfen notaya düşüyor.
  Kaydırmaların %51'i 3 ya da fazlasını veriyor. Yani 3/10 tesadüf düzeyi.
- 15.0–16.05'te 4 vuruşun 3'ü notada. Burada nota çok sık (1 sn'de 8), tesadüfen ≥3/4 olasılığı ~%18.

**Müzik o anda ne yapıyor:**
- 15.0–16.1: bas ve gitar sekizlik akışta.
- 15.97–16.6: bas tek uzun nota.
- 16.6–17.1: bas susuyor (ara), birkaç gitar notası.
- 17.1'den itibaren bas geri geliyor.
- Vuruşlar bu değişimlere aldırmadan aynı ritimde devam ediyor.

**Sınırlar:** klip 15.000'da vuruşta başlıyor (+19 ms). Taş 17.800'de kırılıyor (vuruşa +48 ms). Yapıya geçiş
18.433 vuruşta değil (+127 ms).

## Bulgular

1. **Maden bölümünde vuruşlar tek tek müziğe kilitli değil.** Izgaraya ve notalara olan yakınlık tesadüf
   düzeyinde. A/V kayması bunu değiştirmez: sabit bir kayma, aralık farkını kapatamaz.
2. **"Müziğe uygun" hissini veren:**
   - Hızlı ve sabit sallama ritmi: ~3 vuruş/sn, aralık 0.317 sn. Müziğin sekizliği 0.277 sn, yakın.
   - Her sallamanın kalkık andan başlaması ve 1–2 karede inmesi; sert, net vuruşlar.
   - Bölümün vuruşta başlaması.
   - Müziğin yoğun olması: her vuruş bir müzik sesine onaltılık mesafesinde düşüyor.
3. **Melodi çok seyrek.** Basic Pitch bu müzikte 2–22 sn'de 28 melodi notası buldu (1.4/sn); vuruşlar 3/sn.
4. **Yapı bölümü** (3–14.9 sn): büyük görüntü olaylarının (yükseltme, parça koyma) bir kısmı vuruşta.
   - Vuruşa ±60 ms: 5.0, 5.6, 6.12, 8.3, 8.85, 9.4, 13.3, 15.0 sn.
   - Diğerleri vuruşta değil (görsel okuma, yaklaşık).

## Bizim yöntemle fark

| | `alignToNotes` (0.9.9.2) | Referans maden bölümü |
|---|---|---|
| Tık seçimi | Her tutulan tık bir melodi notasında; arada kalan tıklar kesilir | Tüm vuruşlar tutulur |
| Boşluklar | Notasız uzun aralarda hafif ağır çekim / kısa donma | Uzun nota ve arada vuruş ritmi aynen sürer |
| Sallama | Kaldırma hareketi görüntüde kalır | Kaldırma hareketi kesilir |
| Bu müzikte | ~1.4 hedef/sn, maden vuruşlarının çoğu düşerdi | 3 vuruş/sn |

## Sınırlar

- Ses karışık; oyun vuruşları müzikten temiz ayrılamadı.
- Vuruş zamanları görüntü (±17 ms) + davul kanalı atakları. 15.964 ve 16.887 yalnız şablon eşleşmesiyle doğrulandı.
- Tek maden bölümü (10 vuruş). Başka referansla teyit edilmedi.
- Kullanıcının kendi oyunu Minecraft. Minecraft kazma sesi (blok kırarken ~0.25 sn arayla) farklı bir doğal ritim.

## Öneri (kullanıcıya soruldu)

> Karar (aynı gün): kullanıcı "elle edit yapıldığı için hatasız ayar yapılamaz; block koymadan ilerle, yönü sen seç"
> dedi. Akış hedefi uygulandı: [[reports/2026-10-16-muzik-ritmi-akis|akış raporu]].

- **Akış hedefi:**
  - Ardışık vuruş dizisi tek hızla sabit aralığa getirilir.
  - Aralık müziğin temposundan seçilir (doğal ritme en yakın sekizlik/çeyrek).
  - Dizinin ilk vuruşu vuruş ızgarasına oturur.
  - Referanstan bir adım ileri: aralık müzikle aynı olduğu için faz kaymaz.
- **Karışık:** melodi notası yoğunsa notalar, yoğun vuruş dizilerinde (maden) akış.
- Kaldırma hareketini kesip her klibi kalkık andan başlatmak ayrı bir adım. Minecraft'ta kol sallama
  animasyonu kısa olduğundan gerekmeyebilir.
