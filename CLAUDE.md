# HooDoo Cut

Proje bilgisi ve tüm kayıtlar `docs/` Obsidian kasasındadır. Başla: `docs/index.md`.
Kasa bakım kuralları: `docs/CLAUDE.md`.

- **Önce kasayı oku:** proje hakkında bir şey aranırken ilk bakılacak yer
  `docs/index.md` ve ilgili `docs/wiki/` notu; kod/git'e sonra geç.
- **Her değişiklik kasaya:** yapılan tüm değişiklikler kaydedilir.
- Her oturum sonunda: etkilenen `docs/wiki/` notlarını güncelle, `docs/log.md`
  en üstüne girdi ekle.
- Yeni rapor → `docs/reports/YYYY-MM-DD-konu.md`, yeni plan/spec →
  `docs/plans/YYYY-MM-DD-konu.md`; ikisi de `docs/index.md`'ye bağlanır.
- Kasa dışında (repo kökü vb.) yeni rapor/not md dosyası açma.

## Test ortamı: HooDoo-Lab

VDS'e gidecek ya da Minecraft sunucusunu, oyuncu verisini veya canlı servisleri etkileyebilecek
her değişiklik önce **HooDoo-Lab**'da test edilir (yerel WSL2 dağıtımı: `\\wsl.localhost\HooDoo-Lab`,
`wsl -d HooDoo-Lab -u root -- …`). VDS'e yalnız Lab'da geçen sürüm gider. Lab testi ve Lab'da
test edilemeyen kısım projenin kasasına yazılır. Ayrıntı: `HooDoo-Panel/obsidian/Ekosistem/HooDoo-Lab Test Ortamı.md`.
