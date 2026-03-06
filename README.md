# Фонд Суверенных Технологий НТИ — Платформа AI-инвесткомитета

> Репозиторий: `unidel2035/found`
> Статус: В разработке | Март 2026

---

## О проекте

Цифровая платформа Фонда Суверенных Технологий НТИ для автоматизации инвестиционного процесса в суверенные технологии (БПЛА, робототехника, микроэлектроника).

### Модули

| Маршрут | Модуль | Описание |
|---------|--------|----------|
| `/fst-committee` | AI-инвесткомитет | 6 AI-агентов дебатируют проект, голосуют, люди утверждают |
| `/fst-deal` | Доведение сделки | Смарт-контракт, SPV, транши, Term Sheet |
| `/fst-portfolio` | Портфельный монитор | KPI, светофор рисков, AI-отчёты |
| `/fst-twin` | Цифровой двойник компании | Симуляция выручки, burn rate, TRL/MRL |
| `/fst-fund` | Цифровой двойник фонда | NAV, ROI, IRR, 3 субфонда |

---

## Стек

- **Frontend:** Vue 3 + PrimeVue + Pinia
- **Backend:** Node.js монолит
- **AI:** KodaAgent (бесплатно) + DeepSeek + Claude
- **База данных:** Integram (ai2o.ru/fst)
- **Прокси:** SOCKS5 порт 9050 для российских гос. источников

---

## Быстрый старт

```bash
# Установка
npm install

# Запуск dev-сервера
npm run dev

# Тесты
npm run test:unit
npm run test:e2e
```

---

## База данных

Схема БД: [`docs/database.md`](docs/database.md)

База данных: `https://ai2o.ru/fst` (Integram)

```bash
# Проверка доступа
curl -X POST 'https://ai2o.ru/fst/auth?JSON_KV' -d 'login=d&pwd=d'
```

---

## Issues и Roadmap

[GitHub Issues](https://github.com/unidel2035/found/issues) — 12 задач по миграции и разработке платформы.

Полный план: [`docs/plans/FST_MIGRATION_PLAN.md`](docs/plans/FST_MIGRATION_PLAN.md)

---

## Лицензия

Внутренний проект ФСТ НТИ. Конфиденциально.
