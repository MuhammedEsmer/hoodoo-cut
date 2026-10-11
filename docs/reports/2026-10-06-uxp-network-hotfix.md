# UXP 0.9.6 bağlantı izni düzeltmesi

Kullanıcı Premiere 26.5.2'de yardımcı panel açıkken `Permission denied to the url http://127.0.0.1:51373/hello. Manifest entry not found.` hatasını bildirdi. CEP, yardımcı bağlantı gelmediği için razor öncesinde durdu. Bu denemede silme yapılmadı.

Önceki otomatik testler UXP ağ izni eşleştiricisini çalıştırmıyordu; bu hatayı kapsamıyordu. Yerel Adobe Premiere kurulumundaki `UXP/plugins/com.adobe.dva.creative-copilot/manifest.json`, manifest v5 altında `http://localhost:*` ve `https://localhost:*` yerel port desenlerini kullanıyor. Aynı desen IP tabanlı bağlantımıza uygulanarak izin `http://127.0.0.1:*` yapıldı. Runtime bağlantı adresi hâlâ sabit `http://127.0.0.1:51373`; sunucu yalnız 127.0.0.1'e bağlanıyor ve token doğruluyor. Dış domain veya dosya erişim izni eklenmedi.

Bu değişiklik izin eşleştirme sorununa yönelik düzeltmedir; gerçek UXP matcher davranışı otomatik Node testiyle doğrulanamaz. `tools/test-bulk-permissions.js` dağıtım yapılandırması için regresyon kontrolüdür; yeni izin öncesinde başarısız, sonrasında başarılıdır. Mevcut motor/köprü testleri de çalıştırılır. Son kabul kontrolü Premiere yeniden yüklenen yardımcı panelde "Toplu motor hazır" görülmesidir.

Yardımcı motor sürümü 0.9.6, CEP sürümü 0.9.4.0 olarak kalır. Adobe UPIA üzerinden güncelleme ve kurulu CCX dosyaları hash doğrulaması yapılır. Premiere'nin açık projesi değiştirilmez veya uygulama otomatik yeniden başlatılmaz.

[Adobe UXP ağ izinleri](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/#networkpermission), [Adobe ağ işlemleri](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/network/).
