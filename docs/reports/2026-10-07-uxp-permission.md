# UXP 0.9.7 izin ve eski kurulum kaydı düzeltmesi

## Canlı kullanıcı bulgusu

0.9.6 wildcard port değişikliği başarısız. 7 Ekim ekran görüntüsü aynı `Permission denied ... Manifest entry not found` hatasını gösteriyor. Önceki sabit dizeyi karşılaştıran Node testi UXP izin eşleştiricisini doğrulamıyordu; bu test kaldırıldı. Kurulu 0.9.6 manifesti ve Adobe kurulum kaydı bu turda tekrar okundu. Kontrol anında Premiere çalışmıyordu; CEP yerel sunucusu da kapalıydı.

## Hazırlanan değişiklik

- Adobe'nin belgelenmiş `requiredPermissions.network.domains: "all"` biçimi kullanılır. Bu manifest yetkisi geniştir; kod kısıtlaması aynı şey değildir.
- `network.js` yalnız `/hello`, `/poll`, `/result` yollarını sabit `http://127.0.0.1:51373` adresine gönderir. Başka URL/yol fetch çağrısından önce reddedilir. Redirect modu `error` olarak sabitlenir.
- Yardımcı panel çalışan sürümünü gösterir; cache/eski sürüm karışıklığı görünür olur.
- Mevcut başarılı/sorunlu sonuç onayı senaryoları gerçek yeni ağ modülüyle test edilir.

## Kurulum durumu

Kullanıcı geniş manifest ağ iznini açıkça onayladı. Resmi Adobe UPIA ile 0.9.7 kuruldu; paketteki beş dosyanın kurulu kopyaları SHA-256 ile doğrulandı. İlk canlı açılış hâlâ eski paneli gösterdi: yeni `Motor 0.9.7` etiketi yoktu. UPIA `/list all`, 0.9.6 ve 0.9.7'nin aynı adla birlikte etkin olduğunu gösterdi.

Premiere normal şekilde kapatıldı. UPIA `/remove "HooDoo Cut Toplu Motor"` eski 0.9.6 kaydını kaldırdı. Sonraki liste ve External klasörü yalnız 0.9.7 içeriyordu; kalan beş dosya paketle yeniden hash karşılaştırmasından geçti. Dağıtım ZIP'i 0.9.7 CCX içerecek şekilde yeniden üretildi. Ağ, sonuç onayı ve toplu silme mock testlerindeki 14 senaryo geçti; bunlar gerçek Premiere silme performansı ölçümü değildir.

## Canlı doğrulama sonucu

7 Ekim'de Premiere 26.5.2 içinde `STTEP2test2.prproj` açıldı. Yeni panel önce `Motor 0.9.7` etiketiyle, ana CEP paneli henüz yüklenmediği için `TypeError: Network request failed` gösterdi. Premiere proje açılışında geçici olarak yanıt vermedi; zorla sonlandırılmadan toparlandı. Ardından ana CEP paneli yüklendi ve UXP panelinde doğrudan şu durum gözlendi:

```text
Motor 0.9.7
Toplu motor hazır.
Kesimi HooDoo Cut panelinden başlatın.
```

Yerel 51373 portunda CEP sürecinin dinlediği ve bağlantı kurulduğu ayrıca doğrulandı. Böylece izin hatasının kalktığı ve gerçek UXP → CEP el sıkışmasının başarılı olduğu doğrulandı. Timeline'da analiz/kesim/silme başlatılmadı; gerçek toplu silme, undo ve performans doğrulaması bu bağlantı kontrolünün kapsamı dışındadır.

Kurulum dersi: yalnız `/install` sonucuna güvenilmemeli; bu makinede farklı sürümler yan yana kalabiliyor. `/list all`, kurulu dosya hash'leri ve panelin gösterdiği çalışan sürüm birlikte kontrol edilmeli. `/remove` burada eski sürümü kaldırdı; aynı komutun her kurulumda hangi kaydı seçeceği varsayılmamalı.

Kaynaklar: [Adobe NetworkPermission](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/#networkpermission), [aynı hatanın geliştirici raporu ve all izniyle bağlantı kanıtı](https://github.com/leancoderkavy/premiere-pro-mcp/issues/132). Dış rapor aynı hata için kanıt sağlar; bu bilgisayardaki runtime doğrulamasının yerine geçmez.
