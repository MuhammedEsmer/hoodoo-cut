# Toplu silme tasarımı ve uygulama planı

Kullanıcı geliştirme ve yerel kurulumu onayladı. Mevcut CEP analizi ve QE razor korunur. Silme hedefleri tüm video ve ses kanallarından tek UXP seçimine eklenir; ripple kapalı tek createRemoveItemsAction, tek executeTransaction kullanılır. Undo kapatılmaz.

1. Gerçek host planını dışa aktar; proje, sequence, kanal, başlangıç/bitiş ve kaynak in/out bilgileriyle UXP eşleştirmesini test et.
2. Yalnız 127.0.0.1 üzerinde CEP/UXP iş köprüsü kur. Razor öncesinde motor bağlantısını doğrula. İş bir kez alınır; bağlantı kesilince otomatik tekrar silme yok.
3. CEP akışına toplu motor seçeneği ve hazırlık/commit süreleri ekle. Klasik yol açıkça seçilebilir; sessiz geri dönüş yok.
4. Sentetik çok kanallı testleri, mevcut regresyonları ve paket içeriğini doğrula; yerel kurulumu dene. Kullanıcının açık timeline'ını otomatik değiştirme.

Başarı ölçütü: V1+A1+A2 hedefleri aynı native action içinde, komşu klipler korunur, kimlik/hedef uyuşmazlığında silme yok, transaction başarısızlığı başarı diye raporlanmaz. Canlı Premiere hız kazanımı ayrıca ölçülmelidir.
