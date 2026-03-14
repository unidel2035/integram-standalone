// Minimal server that mounts only legacy-compat routes for integration testing
import './src/config/env.js';
import express from 'express';
import legacyCompatRoutes from './src/api/routes/legacy-compat.js';

const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', legacyCompatRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Legacy-compat test server running on http://0.0.0.0:${PORT}`);
});
