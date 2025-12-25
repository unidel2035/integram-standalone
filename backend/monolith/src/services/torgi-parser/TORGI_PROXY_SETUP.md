# Torgi.gov.ru Proxy Server Setup

## Проблема

torgi.gov.ru блокирует IP адреса серверов и прокси-сервисов. Для парсинга данных нужен VPS с "чистым" российским IP.

## Требования к VPS

- **Локация**: Россия (важно!)
- **Провайдер**: Reg.ru, Selectel, TimeWeb, FirstVDS
- **Минимальные требования**: 1 CPU, 512MB RAM, Ubuntu 22.04
- **Стоимость**: ~150-300 руб/мес

## Установка на VPS

### 1. Подключитесь к VPS

```bash
ssh root@YOUR_VPS_IP
```

### 2. Установите Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### 3. Создайте директорию и файлы

```bash
mkdir -p /opt/torgi-proxy
cd /opt/torgi-proxy
```

### 4. Создайте package.json

```bash
cat > package.json << 'EOF'
{
  "name": "torgi-proxy",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0"
  }
}
EOF
```

### 5. Скопируйте сервер

Скопируйте содержимое `torgi-proxy-server.js` в `/opt/torgi-proxy/server.js`

Или скачайте напрямую:
```bash
# Если файл доступен через URL
curl -o server.js https://your-domain/torgi-proxy-server.js
```

### 6. Установите зависимости

```bash
npm install
```

### 7. Настройте переменные окружения

```bash
cat > .env << 'EOF'
TORGI_PROXY_PORT=3333
TORGI_PROXY_API_KEY=your-secret-api-key-here
EOF
```

### 8. Установите PM2 и запустите

```bash
npm install -g pm2
pm2 start server.js --name torgi-proxy
pm2 save
pm2 startup
```

### 9. Настройте файрвол (опционально)

```bash
ufw allow 3333/tcp
ufw enable
```

## Проверка работы

```bash
# Проверка health
curl http://YOUR_VPS_IP:3333/health

# Проверка с API ключом
curl -H "X-API-Key: your-secret-api-key-here" \
  "http://YOUR_VPS_IP:3333/api/lotcard/22000037040000000056_5"
```

## Использование в DronDoc

### Переменные окружения

Добавьте в `.env` основного приложения:

```bash
TORGI_PROXY_URL=http://YOUR_VPS_IP:3333
TORGI_PROXY_API_KEY=your-secret-api-key-here
```

### Использование в коде

```javascript
import { TorgiProxyClient } from './TorgiProxyClient.js'

const proxyClient = new TorgiProxyClient(
  process.env.TORGI_PROXY_URL,
  process.env.TORGI_PROXY_API_KEY
)

// Получение данных лота
const lotData = await proxyClient.getLotCard('22000037040000000056_5')

// Получение документов
const docs = await proxyClient.getLotDocuments('22000037040000000056_5')

// Поиск лотов
const results = await proxyClient.searchLots({
  bidKindIds: [2],
  lotStatus: ['PUBLISHED'],
  size: 100
})
```

## Рекомендации по VPS провайдерам

### Reg.ru (рекомендуется)
- Cloud VPS от 149 руб/мес
- Российские IP, хорошая репутация
- https://www.reg.ru/vps/cloud

### Selectel
- Cloud Server от 240 руб/мес
- Надёжный провайдер
- https://selectel.ru/services/cloud/servers/

### TimeWeb
- VPS от 159 руб/мес
- Быстрая активация
- https://timeweb.com/ru/services/vps-vds/

### FirstVDS
- VPS от 139 руб/мес
- Бюджетный вариант
- https://firstvds.ru/products/vps

## Troubleshooting

### Прокси не отвечает
```bash
pm2 logs torgi-proxy
```

### torgi.gov.ru блокирует VPS IP
Попробуйте другого провайдера или другой датацентр того же провайдера.

### Медленные запросы
Увеличьте таймауты в конфигурации сервера.

## Безопасность

1. Используйте сложный API ключ
2. Ограничьте доступ по IP через файрвол
3. Используйте HTTPS через nginx reverse proxy
4. Регулярно обновляйте Node.js

## Автоматический деплой

Скрипт для быстрого деплоя:

```bash
#!/bin/bash
VPS_IP="YOUR_VPS_IP"
API_KEY="your-secret-key"

ssh root@$VPS_IP << 'ENDSSH'
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
mkdir -p /opt/torgi-proxy
cd /opt/torgi-proxy
cat > package.json << 'EOF'
{"name":"torgi-proxy","version":"1.0.0","type":"module","dependencies":{"express":"^4.18.2","axios":"^1.6.0"}}
EOF
npm install
npm install -g pm2
# После этого скопируйте server.js
ENDSSH
```
