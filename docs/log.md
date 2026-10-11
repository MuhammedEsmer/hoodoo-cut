---
type: log
title: log — Değişiklik Günlüğü
description: Bu kasaya yapılan düzenlemelerin append-only kaydı (en yeni en üstte).
tags: [hoodoo, hoodoo-cut, meta, log]
created: 2026-10-11
updated: 2026-10-11
---

# 📓 Değişiklik Günlüğü

> Append-only. En yeni girdi en üstte. Eski girdileri silme — bkz. [[CLAUDE]].

## 2026-10-11 — AGENTS.md ve .codegraph kararı

- Kök `AGENTS.md` (Codex/Cursor/Gemini gibi diğer AI araçlarının talimat dosyası)
  tutuldu; eski ve kırık kopya yerine `CLAUDE.md` ile birebir aynı yapıldı.
  İkisi değiştiğinde birlikte güncellenir.
- `.codegraph/` (yerel kod indeksi, otomatik üretilir) `.gitignore`'a eklendi.

## 2026-10-11 — Kod değişiklikleri commit edildi, Release yok kararı

- `85002f9`: 0.9.3.4 → 0.9.4.0 CEP + UXP motor 0.9.8 + testler/araçlar tek
  commit'te (74 PASS, `node --check` ve `git diff --check` temiz).
- Kasa commit'i `828bdeb` → `08ea798` olarak yeniden yazıldı (push edilmeden):
  AI contributor satırı kaldırıldı. Kalıcı kural: commit/PR'da Claude/AI
  contributor gösterilmez ([[HooDoo Cut Kurulum ve Dağıtım]]).
- **0.9.4.0 için GitHub Release oluşturulmayacak** — kullanıcı otomatik
  güncelleme istemiyor. [[HooDoo Cut Sürüm Geçmişi]], [[HooDoo Cut]] güncellendi.
- `749a6ea..81d5dad` origin/main'e push edildi (Release/tag yok).
- Commit dışı bırakılanlar: `.codegraph/` (yerel kod indeksi) ve kökte
  kaynağı belirsiz yeni `AGENTS.md` (var olmayan `docs/AGENTS.md`'ye işaret ediyor).

## 2026-10-11 — Kasa kuruldu, proje kayıtları buraya toplandı

`docs/` Obsidian kasası yapıldı (`.obsidian` ortak ayarları git'te,
`workspace*.json` ve `.trash/` ignore). Bundan sonra HooDoo Cut'la ilgili tüm
kayıtlar burada tutulur.

- Repo kökündeki `reports/` → `docs/reports/` taşındı (içerik değişmedi);
  `README.md` içindeki iki rapor bağlantısı yeni yola güncellendi.
- Mevcut `docs/plans/` yerinde kaldı, [[index]]'e bağlandı.
- Yeni wiki notları (README, DISTRIBUTION, raporlar, `git log` ve kaynak
  dosyalardan derlendi): [[HooDoo Cut]], [[HooDoo Cut Mimari]],
  [[HooDoo Cut Analiz Motoru]], [[HooDoo Cut Kesim Akışı]],
  [[HooDoo Cut Toplu Motor]], [[HooDoo Cut Kurulum ve Dağıtım]],
  [[HooDoo Cut Test ve Doğrulama]], [[HooDoo Cut Sürüm Geçmişi]],
  [[HooDoo Cut Bilinen Sınırlar]], [[HooDoo Cut Sözlük]].
- Repo köküne kasayı gösteren kısa `CLAUDE.md` eklendi; `.gitignore`'a
  `docs/.obsidian/workspace*.json` ve `docs/.trash/` eklendi.
- Test paketleri çalıştırıldı: **74 geçti, 0 başarısız** ([[HooDoo Cut Test ve Doğrulama]]).
- Kasa kurulurken fark edilenler ([[HooDoo Cut Bilinen Sınırlar]]'a işlendi):
  `install.ps1` hâlâ `D:\PremiereProExtension` yolunu sabit kullanıyor;
  `DISTRIBUTION.md` ilk gönderim örneğinde `<KULLANICI>` yer tutucusu kalmış;
  0.9.3.4 → 0.9.4.0 ve UXP 0.9.5 → 0.9.8 değişiklikleri henüz commit edilmemiş.
