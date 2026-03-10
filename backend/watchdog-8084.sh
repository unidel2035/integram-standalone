#!/usr/bin/env bash
# Watchdog: keeps fund-backend (api.mjs) running on port 8084
# Install: crontab -e → */5 * * * * /home/hive/fund/backend/watchdog-8084.sh >> /tmp/watchdog-8084.log 2>&1

LOGFILE="/tmp/fst-api-8084.log"
PIDFILE="/tmp/fst-api-8084.pid"
PORT=8084
DIR="/home/hive/fund/backend"
NODE="/home/hive/.nvm/versions/node/v20.20.0/bin/node"

# Check if process on port 8084 is alive
if lsof -ti:$PORT > /dev/null 2>&1; then
  echo "[$(date '+%H:%M:%S')] OK port $PORT running"
  exit 0
fi

echo "[$(date '+%H:%M:%S')] RESTART fund-backend on port $PORT"
FST_API_PORT=$PORT \
  INTEGRAM_SERVER_URL=https://api.ai2o.ru \
  INTEGRAM_SYSTEM_USERNAME=unidel@yandex.ru \
  INTEGRAM_SYSTEM_PASSWORD=Denver2035 \
  nohup $NODE "$DIR/api.mjs" >> "$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
echo "[$(date '+%H:%M:%S')] Started PID $(cat $PIDFILE)"
