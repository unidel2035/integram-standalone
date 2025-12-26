// Минимальный сервер только для API v2
import express from 'express';
import cors from 'cors';
import apiV2Router from './api/v2/index.cjs';

const app = express();
const PORT = process.env.API_V2_PORT || 3001;

app.use(cors());
// Парсить как JSON и application/vnd.api+json
app.use(express.json({ type: ['application/json', 'application/vnd.api+json'] }));

app.use('/api/v2', apiV2Router);

app.listen(PORT, () => {
  console.log(`✅ API v2 server listening on port ${PORT}`);
});
