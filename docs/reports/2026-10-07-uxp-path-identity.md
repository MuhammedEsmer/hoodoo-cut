# UXP 0.9.8: Windows proje yolu kimliği

## Canlı neden

CEP ve UXP aynı STTEP2test2.prproj / sequence kimliğini görüyordu. Ancak CEP `C:\Users\...\STTEP2test2.prproj`, UXP ise `\\?\C:\Users\...\STTEP2test2.prproj` döndürüyordu. Eşitlik kontrolü Windows extended-path önekini farklı dosya sandığı için razor öncesinde duruyordu.

Geçici, yalnız okuyan CEP tanısıyla iki çalışma zamanından gerçek değerler alındı; sequence UUID birebir aynıydı. Tanı kodu kurulu ana panelden sonra kaldırıldı ve dosyanın yedekle hash eşitliği doğrulandı.

## Düzeltme ve doğrulama

- UXP aktif proje yolu ve silme planı karşılaştırmalarında Windows drive/UNC extended-path önekleri sıradan yol biçimine çevriliyor.
- Aynı fark medya yollarında da gideriliyor. Sequence, kaynak, zaman ve farklı proje kontrolleri korunuyor.
- Önce eklenen test `Proje veya sequence degisti` ile başarısız oldu; düzeltmeden sonra 32 ilgili senaryo geçti (bulk 14, companion 2, network 2, panel 12, host 2).
- Resmi Adobe UPIA ile 0.9.7 kaldırılıp 0.9.8 kuruldu. Kurulum listesinde yalnız 0.9.8 var; beş kurulu dosya CCX ile SHA-256 karşılaştırmasından geçti. Dağıtım ZIP'i yeniden üretildi.
- Premiere açıkken yeni motor yüklendi; panelde `Motor 0.9.8 / Toplu motor hazır` görüldü. 12:29:14 canlı kimlik yakalamasında hem proje yolu hem sequence eşitliği **true** oldu; eski CEP ön kontrolü artık bu kimlikleri kabul ediyor.
- Bu kontrolde analiz, razor, silme veya undo çalıştırılmadı. Gerçek silme performansı doğrulanmış değildir. Açık proje yeniden başlatılmadı ve kaydedilmedi.
