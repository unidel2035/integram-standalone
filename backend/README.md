# FST Portfolio Monitor

Автоматическая система мониторинга портфельных компаний для Фонда Суверенных Технологий НТИ.

## 📋 Описание

Система автоматически собирает данные о портфельных компаниях из открытых источников:

- **ЕГРЮЛ/ЕФРСБ** — изменения в реестре юрлиц, банкротства
- **HH.ru** — активность найма как индикатор роста
- **Роспатент (ФИПС)** — патентная активность и защита IP
- **Яндекс.Новости** — медиа-упоминания и sentiment analysis

Результаты мониторинга используются для:
- Обновления светофора рисков на странице `/fst-portfolio`
- Генерации автоматических алертов при обнаружении проблем
- Еженедельных/ежемесячных отчётов AI-инвесткомитета

## 🏗️ Архитектура

```
backend/
├── src/
│   ├── parsers/               # Парсеры внешних источников
│   │   ├── egrulParser.js     # ЕГРЮЛ/ЕФРСБ через SOCKS proxy
│   │   ├── hhParser.js        # HH.ru API (найм)
│   │   ├── rospatentParser.js # Роспатент/ФИПС (патенты)
│   │   └── newsParser.js      # Яндекс.Новости + sentiment
│   └── schedulers/            # Автоматизация
│       └── portfolioMonitor.js # Планировщик (node-cron)
├── package.json
└── README.md
```

## 🚀 Установка

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка окружения

Скопируйте `.env.example` в `.env` и заполните переменные:

```bash
cp ../.env.example ../.env
```

Обязательные переменные:

```env
# Integram (для сохранения результатов)
INTEGRAM_SERVER_URL=ai2o.ru
INTEGRAM_SYSTEM_USERNAME=your-integram-login
INTEGRAM_SYSTEM_PASSWORD=your-integram-password

# SOCKS proxy для ЕГРЮЛ/Роспатента (если есть)
SOCKS_PROXY=socks5://127.0.0.1:9050

# Yandex API для sentiment analysis (опционально)
YANDEX_API_KEY=your-api-key
YANDEX_FOLDER_ID=your-folder-id
```

### 3. Настройка SOCKS proxy (опционально, но рекомендуется)

Для доступа к ЕГРЮЛ и Роспатенту рекомендуется использовать SOCKS5 прокси:

```bash
# Установка и запуск Tor (пример)
sudo apt install tor
sudo systemctl start tor
# По умолчанию Tor слушает на 127.0.0.1:9050
```

Или используйте существующий SOCKS5 сервис:
```bash
# Проверьте, что socks-tunnel.service запущен
sudo systemctl status socks-tunnel.service
```

## 📊 Использование

### Ручной запуск мониторинга

```bash
# Полный мониторинг всех источников
npm run monitor:full

# Только ЕГРЮЛ
npm run monitor:egrul

# Только патенты
npm run monitor:patents

# Только новости
npm run monitor:news
```

### Автоматический планировщик

Запустите планировщик как systemd сервис или в фоне:

```bash
# Запуск планировщика
npm start
```

Расписание по умолчанию:
- **Ежедневно в 09:00** — мониторинг новостей
- **Еженедельно (понедельник 08:00)** — ЕГРЮЛ и HH.ru
- **Ежемесячно (1-го числа, 10:00)** — Роспатент

### Настройка systemd сервиса

Создайте `/etc/systemd/system/fst-portfolio-monitor.service`:

```ini
[Unit]
Description=FST Portfolio Monitor
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/found/backend
ExecStart=/usr/bin/node src/schedulers/portfolioMonitor.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/fst-portfolio-monitor.log
StandardError=append:/var/log/fst-portfolio-monitor-error.log

[Install]
WantedBy=multi-user.target
```

Включите и запустите:

```bash
sudo systemctl enable fst-portfolio-monitor
sudo systemctl start fst-portfolio-monitor
sudo systemctl status fst-portfolio-monitor
```

## 📡 Источники данных

### 1. ЕГРЮЛ / ЕФРСБ

**Что мониторим:**
- Изменение адреса юрлица
- Смена директора
- Изменение уставного капитала
- Процедуры банкротства

**Частота:** 1 раз в неделю

**Алерты:**
- 🟡 Warn: изменения в ЕГРЮЛ
- 🔴 Critical: банкротство обнаружено

### 2. HH.ru API

**Что мониторим:**
- Количество открытых вакансий
- Динамика найма (рост/спад)
- Типы позиций (инженеры, менеджмент, продажи)

**Частота:** 1 раз в неделю

**Алерты:**
- 🟡 Warn: найм замедлился
- 🔴 Critical: найм полностью остановлен

**API:** Бесплатный, без авторизации
- Документация: https://github.com/hhru/api
- Rate limit: ~100 запросов/минуту

### 3. Роспатент (ФИПС)

**Что мониторим:**
- Количество патентов
- Новые заявки
- Статусы патентов (выдан/на рассмотрении/отклонён)

**Частота:** 1 раз в месяц

**Алерты:**
- 🟡 Warn: TRL ≥ 6, но < 3 патентов
- 🔴 Critical: TRL ≥ 6, но 0 патентов

**Примечание:** Парсинг через веб-интерфейс (публичный API ограничен)

### 4. Яндекс.Новости

**Что мониторим:**
- Новостные упоминания компании
- Sentiment analysis (позитивный/негативный/нейтральный)
- Частота упоминаний

**Частота:** Ежедневно

**Алерты:**
- 🟡 Warn: негативный фон (≥3 негативных публикаций)
- 🔴 Critical: медиа-кризис (≥5 негативных публикаций)

**Sentiment:** YandexGPT API (если есть ключ) или эвристика

## 🗄️ Интеграция с Integram

Результаты мониторинга сохраняются в базу `fst` на `ai2o.ru`.

### Структура данных

**Таблица Portfolio (type 1116):**
- `r1124` — riskStatusId (1125=green, 1126=yellow, 1127=red)
- `t1128` — lastMonitored (timestamp)

**Таблица Monitoring Records (type 1130):**
- `t1131` — companyId
- `t1132` — dataType (egrul, hh, patents, news)
- `t1133` — JSON с результатами
- `t1134` — timestamp

### Обновление светофора рисков

Алгоритм определения цвета:
- 🔴 **Red:** ≥1 критический алерт
- 🟡 **Yellow:** ≥2 алерта-предупреждения
- 🟢 **Green:** нет проблем

## 🧪 Тестирование

### Тест парсеров

```bash
# Тест ЕГРЮЛ парсера
node -e "import('./src/parsers/egrulParser.js').then(m => m.fetchEgrulData('7701234567').then(console.log))"

# Тест HH.ru парсера
node -e "import('./src/parsers/hhParser.js').then(m => m.fetchCompanyVacancies('Яндекс').then(console.log))"

# Тест Роспатент
node -e "import('./src/parsers/rospatentParser.js').then(m => m.fetchCompanyPatents('АвиаЛогик').then(console.log))"

# Тест новостей
node -e "import('./src/parsers/newsParser.js').then(m => m.fetchCompanyNews('Сбер', 7).then(console.log))"
```

### Тест полного цикла

```bash
npm run monitor:full
```

Проверьте логи в консоли и убедитесь, что:
1. Компании загружаются из Integram
2. Все парсеры отрабатывают без ошибок
3. Результаты сохраняются в БД
4. Светофор рисков обновляется

## 🔧 Настройка расписания

Измените расписание в `src/schedulers/portfolioMonitor.js`:

```javascript
// Формат cron: минута час день месяц день_недели

// Ежедневно в 09:00
cron.schedule('0 9 * * *', () => { ... })

// Каждый понедельник в 08:00
cron.schedule('0 8 * * 1', () => { ... })

// 1-го числа месяца в 10:00
cron.schedule('0 10 1 * *', () => { ... })
```

Примеры других расписаний:

```javascript
'0 */6 * * *'    // Каждые 6 часов
'0 0 * * *'      // Ежедневно в полночь
'0 12 * * 1-5'   // По будням в 12:00
'0 0 1,15 * *'   // 1-го и 15-го числа
```

## 📈 Мониторинг работы системы

### Логи

```bash
# Логи systemd сервиса
sudo journalctl -u fst-portfolio-monitor -f

# Логи в файл (если настроено)
tail -f /var/log/fst-portfolio-monitor.log
```

### Метрики

В логах отслеживайте:
- Количество обработанных компаний
- Количество алертов по уровням
- Ошибки парсеров (rate limiting, timeout)
- Время выполнения полного цикла

Пример вывода:

```
=== Monitoring Summary ===
Companies monitored: 5
Total alerts: 3
  - Critical: 1
  - Warnings: 2
=== Monitoring Completed ===
```

## 🔒 Безопасность

1. **API ключи** — хранить только в `.env`, не коммитить
2. **SOCKS proxy** — для анонимности при парсинге ЕГРЮЛ/Роспатента
3. **Rate limiting** — задержки между запросами (1-3 сек)
4. **Integram токены** — ротация при каждом запуске

## 🐛 Troubleshooting

### ЕГРЮЛ парсер не работает

**Проблема:** Timeout или блокировка

**Решение:**
- Проверьте SOCKS proxy: `curl --socks5 127.0.0.1:9050 https://egrul.nalog.ru`
- Увеличьте timeout в `egrulParser.js`
- Используйте VPN или другой прокси

### HH.ru возвращает 429 (Too Many Requests)

**Проблема:** Rate limiting

**Решение:**
- Увеличьте задержку между запросами в `hhParser.js` (sleep 2-5 сек)
- Уменьшите частоту мониторинга (раз в 2 недели вместо еженедельно)

### Integram auth failed

**Проблема:** Неверные credentials или токен истёк

**Решение:**
- Проверьте `INTEGRAM_SYSTEM_USERNAME` и `INTEGRAM_SYSTEM_PASSWORD` в `.env`
- Убедитесь, что сервер `ai2o.ru` доступен
- Попробуйте авторизоваться вручную через curl

### Sentiment analysis не работает

**Проблема:** Нет YandexGPT API ключа

**Решение:**
- Система автоматически использует эвристику (ключевые слова)
- Для улучшения точности добавьте `YANDEX_API_KEY` в `.env`
- Альтернатива: интегрируйте другую sentiment модель (DeepSeek, local BERT)

## 📚 Дальнейшее развитие

### Фаза 2: Дополнительные источники

- [ ] **Контур.Фокус** — финансовая отчётность
- [ ] **Госзакупки (zakupki.gov.ru)** — государственные контракты
- [ ] **СберБизнес** — оборот по счетам (с согласия компании)
- [ ] **GitHub/GitLab** — активность разработки (для IT-компаний)

### Фаза 3: AI-анализ

- [ ] Предсказание рисков (ML модель на исторических данных)
- [ ] Автоматическое создание отчётов для ИК
- [ ] Рекомендации по действиям (досрочный транш, поддержка)

### Фаза 4: Интеграция с ИК

- [ ] Автоматический созыв инвесткомитета при критических рисках
- [ ] Dashboard с real-time алертами
- [x] Telegram-бот для уведомлений (Issue #27)

## 📱 Telegram-бот Фонда

### Описание

Telegram-бот для оперативного управления фондом с мобильного устройства. Интегрируется с системой мониторинга портфеля для отправки push-уведомлений и выполнения команд.

### Возможности

**Push-уведомления:**
- 🔴 КРИТИЧНО: Runway компании < 5 мес
- 🟡 ВНИМАНИЕ: KPI не выполнен второй квартал подряд
- ✅ Хорошие новости: Контракт подписан, TRL повышен, транш выплачен
- 📅 Напоминания: заседание ИК завтра, Board Pack не подготовлен
- 📊 Еженедельный дайджест (понедельник 9:00)

**Команды:**
- `/portfolio` — краткий статус всех компаний
- `/company <название>` — детали + последние события
- `/alerts` — активные риски
- `/action warn <название>` — отправить предупреждение компании
- `/kpi` — сводка KPI по портфелю
- `/deal <название>` — статус сделки и транша

### Настройка

1. Создайте бота через [@BotFather](https://t.me/BotFather) в Telegram
2. Получите токен бота
3. Узнайте ваш Chat ID (можно через [@userinfobot](https://t.me/userinfobot))
4. Добавьте в `.env`:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_CHAT_ID=123456789
```

5. Бот автоматически запускается вместе с планировщиком:

```bash
npm start
```

### Использование

1. Откройте диалог с ботом в Telegram
2. Отправьте `/start` для получения списка команд
3. Используйте команды для управления портфелем

**Пример:**
```
/portfolio
📊 Портфель фонда

🟢 АвиаЛогик (TRL 6)
🟢 МикроСхема (TRL 7)
🟡 РоботАгро (TRL 4)
🔴 АэроСпектр (TRL 6)
🟢 НейроДрон (TRL 5)

Всего компаний: 5
```

### Интеграция с мониторингом

Бот автоматически отправляет уведомления при обнаружении рисков в процессе мониторинга:

- Критические алерты → уведомление в Telegram
- Предупреждения → уведомление в Telegram
- Еженедельный дайджест → автоматически по понедельникам в 9:00

## 📞 Контакты

**Issues:** https://github.com/unidel2035/found/issues/11
**Telegram Bot:** https://github.com/unidel2035/found/issues/27
**Roadmap:** https://github.com/unidel2035/found/issues

---

**Статус:** ✅ Реализовано (Issue #11, #27)
**Версия:** 1.1.0
**Дата:** 2026-03-07
