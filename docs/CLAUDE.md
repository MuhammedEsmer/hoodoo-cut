---
type: kılavuz
title: CLAUDE — HooDoo Cut Kasası Bakım Kılavuzu
description: docs/ Obsidian kasasının bir LLM tarafından nasıl güncelleneceğini tanımlayan kurallar.
tags: [hoodoo, hoodoo-cut, meta, kılavuz]
created: 2026-10-11
updated: 2026-10-11
---

# CLAUDE.md — Bu Kasa Nasıl Bakılır

`docs/` klasörü HooDoo Cut'ın **Obsidian kasasıdır** ve projeyle ilgili tüm
kayıtların tek yeridir. Obsidian'da "Open folder as vault" → `docs/`.
Desen HooDoo-Network-Bridge kasasıyla aynıdır
([Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)):
kasa kalıcı, biriken bir eserdir — her oturum onu bozmadan büyütür.

## Omurga

1. **[[index]]** — içerik kataloğu. Yeni not/belge eklenince buraya bağlantı ekle.
2. **[[log]]** — append-only günlük. Her oturum sonunda en üste bir girdi ekle.
3. **CLAUDE.md** (bu dosya) — kurallar.

## Klasörler

| Klasör | İçerik | Dil |
|---|---|---|
| `wiki/` | Atomik bilgi notları: mimari, özellikler, kurulum, sürüm geçmişi, kararlar | Türkçe |
| `reports/` | Tarihli geliştirme/doğrulama/hotfix raporları ve ham ölçüm JSON'ları | Mevcut dil korunur |
| `plans/` | Tasarım ve uygulama planları (superpowers akışı buraya yazar) | Mevcut dil korunur |

Yeni rapor ve planlar `YYYY-MM-DD-konu.md` adlandırmasıyla kalır ve
[[index]]'e eklenir. Rapor = o günün olay kaydı (değişmez); wiki notu = güncel
gerçek (düzenlenir). Bir rapordaki bilgi kalıcıysa ilgili wiki notuna da işlenir.

> [!warning] Altın kural
> **Kod tek gerçektir.** Not yazmadan/güncellemeden önce kaynak dosyayı oku,
> gerekirse `git log` bak. Emin değilsen "(doğrulanmadı)" yaz.
> Canlı Premiere'de ölçülmemiş hız/doğruluk iddiası "ölçülmedi" diye işaretlenir.

## Not yazım kuralları (`wiki/`)

- **Dil:** Türkçe; jargonu ilk geçtiği yerde bir cümleyle açıkla (bkz. [[HooDoo Cut Sözlük]]).
- **Atomik:** bir not = bir konu; şişince böl.
- **Frontmatter zorunlu:**

```yaml
---
type: proje | konsept | referans | kılavuz | moc
title: <başlık>
description: <tek satırlık özet>
tags: [hoodoo, hoodoo-cut, konu-etiketleri]
proje: [hoodoo-cut]
sources:            # repo köküne göre yollar
  - com.hoodoocut/...
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

- **Ad:** kasa genelinde benzersiz, `HooDoo Cut …` ön ekiyle.
- **Bağlan:** `[[Not Adı]]`; rapor/plan için yol ile:
  `[[reports/2026-10-06-toplu-motor|Toplu motor raporu]]`.
- **Kaynak göster:** yollar backtick'le; uzun kod dökümü yerine dosya yolu.
- Sürüm/yayın kayıtlarında sürüm numarası, commit, paket adı/SHA-256 ve
  canlı doğrulamanın yapılıp yapılmadığı yazılır.

## Güncelleme akışı (her oturum)

1. İlgili kaynak dosyaları ve `git log`'u oku.
2. Etkilenen notları düzenle; `updated` tarihini güncelle.
3. Sürüm değiştiyse [[HooDoo Cut Sürüm Geçmişi]]'ne satır ekle.
4. Yeni not/rapor/plan → [[index]].
5. [[log]] en üstüne `## YYYY-MM-DD — <ne değişti>`.
6. Not ↔ kod çelişkisinde kodu esas al, notu düzelt, kararı log'a yaz.

## Kapsam dışı

- Sırlar (`tools/hoodoo-cert.p12` parolası, köprü token'ı, kişisel yollar dışı
  kimlik bilgileri) **asla** yazılmaz — yalnız nerede tutulduğu anlatılır.
- Geçici hata çıktıları ve tek seferlik sohbet detayları kasaya girmez.
