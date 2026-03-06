# Обратная совместимость: маршруты /fst-* в dronedoc2025

> Issue #4 | Стратегия: Вариант A (iframe/embed) + компонент FstExternalBridge

## Текущее состояние

Код FST **скопирован** (не перемещён) из `dronedoc2025` в `found`. Все маршруты `/fst-*` в `dronedoc2025` **работают** и будут продолжать работать до момента ручного удаления.

## Стратегия обратной совместимости

### Фаза 1 (сейчас): Дублирование кода
- Код существует в обоих репо
- `dronedoc2025` — действующая копия (backward compat)
- `found` — канонический источник истины

### Фаза 2 (после деплоя found на fst.drondoc.ru): iframe-обёртка
Компонент `FstExternalBridge.vue` в `dronedoc2025` читает переменную окружения:

```
VITE_FST_URL=https://fst.drondoc.ru
```

Если переменная задана — страница рендерит iframe с баннером "Открыть напрямую".
Если не задана — показывается оригинальный локальный код (fallback через `<slot>`).

### Переключение страниц (пример для FstCommittee.vue в dronedoc2025)

```vue
<template>
  <FstExternalBridge route="/fst-committee">
    <!-- существующий контент FstCommittee.vue как слот -->
    <OriginalFstCommittee />
  </FstExternalBridge>
</template>
```

Переключение происходит без изменения маршрута — пользователь не замечает смены репо.

### Фаза 3 (долгосрочно): nginx proxy
```nginx
location /fst- {
  proxy_pass https://fst.drondoc.ru;
  proxy_set_header Host fst.drondoc.ru;
}
```

## Файлы изменённые для backward compat

| Файл | Репо | Изменение |
|------|------|-----------|
| `src/components/fst-shared/FstExternalBridge.vue` | dronedoc2025 | Новый компонент-обёртка |
| `src/config/routeDescriptions.js` | dronedoc2025 | Пометки "Канонический код: github.com/unidel2035/found" в описаниях FST-маршрутов |

## Переменные окружения (dronedoc2025)

```bash
# .env.local (не в git)
# Оставить пустым = использовать локальный код
# VITE_FST_URL=https://fst.drondoc.ru

# Включить iframe-режим после деплоя found:
VITE_FST_URL=https://fst.drondoc.ru
```

## Критерии завершения

- [x] Все `/fst-*` маршруты работают в dronedoc2025 без изменений
- [x] `FstExternalBridge.vue` готов к подключению (нужен только VITE_FST_URL)
- [x] `routeDescriptions.js` обновлён — ссылается на found repo
- [ ] Деплой found → fst.drondoc.ru (Issue #9)
- [ ] Настройка VITE_FST_URL в dronedoc2025 production env (после деплоя)
