# Design Audit — Единый визуальный скелет

## Что проверяем

Эталон: **FstHub** и **FstCommittee**
Скелет: `layout-main-container` → `padding: 6rem 2rem 0 2rem` везде.

---

## Группа 1: Страницы без FstPageLayout (ручной layout)
Высокий риск — каждая делает своё, могут быть сдвиги.

- [ ] **FstHub** — эталон ✅ (custom topbar, проверен)
- [ ] **FstCommittee** — эталон ✅ (full-bleed, исправлен)
- [ ] **FstTerminal** — full-bleed, нужна проверка `html.terminal-page` padding
- [ ] **FstNetwork** — нет FstPageLayout, проверить отступы
- [ ] **FstSmartContract** — нет FstPageLayout, проверить отступы
- [ ] **FstStartuper** — нет FstPageLayout, проверить отступы
- [ ] **FstMiniApp** — нет FstPageLayout, проверить отступы

_Публичные (без sidebar — ОК пропустить):_ FstLanding, FstLogin, FstRoot

---

## Группа 2: FstPageLayout — проверить внутри компонента

Сам `<FstPageLayout>` должен давать одинаковый заголовок/отступы.
Нужно убедиться что все страницы используют его одинаково.

### Приоритет HIGH (видимые пользователю в demo)
- [ ] **FstPortfolio** — /fst-portfolio, кнопки/header
- [ ] **FstDeal** — /fst-deal, сложный layout (tabs, финмодель)
- [ ] **FstExecution** — /fst-execution, Kanban
- [ ] **FstFundTwin** — /fst-fund, NAV/IRR
- [ ] **FstDigitalTwin** — /fst-twin
- [ ] **FstSourcing** — /fst-sourcing
- [ ] **FstProtocol** — /fst-protocol

### Приоритет MEDIUM
- [ ] **FstDealflow** — воронка
- [ ] **FstDuediligence** — DD
- [ ] **FstAdministration** — бэк-офис
- [ ] **FstCompliance** — compliance
- [ ] **FstGov** — governance
- [ ] **FstLp** — LP кабинет
- [ ] **FstFounders** — основатели
- [ ] **FstExit** — выход
- [ ] **FstCaptable** — cap table
- [ ] **FstAllocation** — аллокация

### Приоритет LOW (вспомогательные)
- [ ] FstBoard, FstBenchmark, FstEsg, FstGlossary
- [ ] FstGrants, FstIlpa, FstIntelligence, FstLegal
- [ ] FstMemo, FstNatproject, FstPitch, FstQuizDemo
- [ ] FstRegistry, FstRoom, FstSecondary, FstSoftModel
- [ ] FstSovereignty, FstSyndication, FstTransparency, FstWaterfall
- [ ] FstAgentSchool, FstApply, FstDevGuide, FstLearning, FstLearningProgress

---

## Что смотреть в каждой странице

1. **Топ страницы** — есть ли видимый зазор ниже AppTopbar? (должен быть ~2rem)
2. **Левый отступ** — контент начинается на одном уровне с Hub? (2rem от sidebar)
3. **Внутренний топбар** — sticky? border-bottom? padding 12px 20px?
4. **Секции** — одинаковые `hub-section-label` или аналог?
5. **Цвета** — нет ли хардкод hex/rgb? только var(--p-*)

---

## Критерии готовности

Страница считается "приведённой к скелету" если:
- Визуально одинаковый отступ сверху и слева с FstHub
- Использует FstPageLayout ИЛИ собственный топбар по образцу Hub
- Нет хардкод цветов и нарушений темы
