/**
 * Guest Users API Routes
 * Создание и управление гостевыми пользователями для customer journey
 */

import express from 'express';
import axios from 'axios';
import defaultTokenService from '../../services/ai/defaultTokenService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Конфигурация Integram
const INTEGRAM_BASE_URL = 'https://dronedoc.ru';
const DATABASE = 'my';
const USER_TABLE_ID = 18;
const GUEST_ROLE_ID = '209363';

const REQUISITES = {
  EMAIL: '41',
  NAME: '33',
  PASSWORD: '20',
  ROLE: '115',
  DATE: '156',
  REFERRAL_CODE: '209325'
};

/**
 * Авторизация в Integram
 */
async function authenticateIntegram() {
  const formData = new URLSearchParams();
  formData.append('login', process.env.INTEGRAM_REGISTRATION_USERNAME || 'api_reg');
  formData.append('pwd', process.env.INTEGRAM_REGISTRATION_PASSWORD || 'ca84qkcx');

  const response = await axios.post(
    `${INTEGRAM_BASE_URL}/${DATABASE}/auth?JSON_KV`,
    formData,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );

  return {
    token: response.data.token,
    xsrf: response.data._xsrf
  };
}

/**
 * POST /api/guest-users
 * Создает нового гостевого пользователя
 *
 * Body: {
 *   username: string,
 *   browserFingerprint: string,
 *   referralCode?: string
 * }
 */
router.post('/', async (req, res) => {
  console.log('🔵 [GUEST-USERS] POST / request received');
  console.log('   Body:', req.body);
  console.log('   Headers:', req.headers);

  try {
    const { username, browserFingerprint, referralCode } = req.body;

    if (!username || !browserFingerprint) {
      console.error('❌ [GUEST-USERS] Missing username or browserFingerprint');
      return res.status(400).json({
        success: false,
        error: 'Username and browserFingerprint are required'
      });
    }

    console.log('🔐 [GUEST-USERS] Authenticating with Integram...');
    // Авторизация
    const auth = await authenticateIntegram();
    console.log('✅ [GUEST-USERS] Authenticated, token received');

    // Подготовка данных для создания пользователя
    const currentDate = new Date().toISOString().split('T')[0];
    const data = {
      [`t${USER_TABLE_ID}`]: username,
      up: 1,
      [`t${REQUISITES.DATE}`]: currentDate,
      [`t${REQUISITES.ROLE}`]: GUEST_ROLE_ID
    };

    if (referralCode) {
      data[`t${REQUISITES.REFERRAL_CODE}`] = referralCode;
    }

    console.log('📤 Creating guest user:', username);
    console.log('   URL:', `${INTEGRAM_BASE_URL}/${DATABASE}/_m_new/${USER_TABLE_ID}?JSON_KV`);
    console.log('   Data:', data);

    // Prepare URL-encoded form data with _xsrf token
    const formData = new URLSearchParams();
    formData.append('_xsrf', auth.xsrf);
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    }

    // Создание пользователя
    const response = await axios.post(
      `${INTEGRAM_BASE_URL}/${DATABASE}/_m_new/${USER_TABLE_ID}?JSON_KV`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': auth.token
        }
      }
    );

    console.log('✅ Guest user created:', response.data);

    const userId = response.data.obj || response.data.id;

    // Создать AI токен для гостевого пользователя (асинхронно, не блокирующе)
    // Даем пользователю приветственный бонус 1M токенов
    defaultTokenService.ensureDefaultToken(userId, null, {
      description: `Приветственный токен для гостя - ${new Date().toLocaleDateString('ru-RU')}`
    }).catch(error => {
      logger.error('Failed to create AI token for guest user', {
        userId,
        username,
        error: error.message
      });
      // Не прерываем создание пользователя, если токен не создался
    });

    return res.json({
      success: true,
      data: {
        userId,
        username,
        browserFingerprint
      }
    });

  } catch (error) {
    console.error('❌ Error creating guest user:', error.message);
    console.error('   Response:', error.response?.data);

    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

/**
 * PUT /api/guest-users/:userId
 * Обновляет гостевого пользователя реальными данными
 *
 * Body: {
 *   username: string,
 *   email: string,
 *   password: string,
 *   name: string
 * }
 */
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, password, name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    // Авторизация
    const auth = await authenticateIntegram();

    // Подготовка данных для обновления
    const data = {
      [`t${USER_TABLE_ID}`]: username
    };

    if (email) data[`t${REQUISITES.EMAIL}`] = email;
    if (name) data[`t${REQUISITES.NAME}`] = name;
    if (password) data[`t${REQUISITES.PASSWORD}`] = password;

    // Меняем роль с guest на user (ID: 164)
    data[`t${REQUISITES.ROLE}`] = '164';

    console.log('🔄 Updating guest user to real user:', userId);

    // Prepare URL-encoded form data with _xsrf token
    const formData = new URLSearchParams();
    formData.append('_xsrf', auth.xsrf);
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    }

    const response = await axios.post(
      `${INTEGRAM_BASE_URL}/${DATABASE}/_m_save/${userId}?JSON_KV`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': auth.token
        }
      }
    );

    console.log('✅ User updated:', userId, '→', username, '(guest → user)');

    return res.json({
      success: true,
      data: {
        userId,
        username
      }
    });

  } catch (error) {
    console.error('❌ Error updating user:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

/**
 * GET /api/guest-users/:userId
 * Получает данные гостевого пользователя
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const auth = await authenticateIntegram();

    // Use _m_edit endpoint to get object data
    const response = await axios.get(
      `${INTEGRAM_BASE_URL}/${DATABASE}/_m_edit/${userId}?JSON_KV`,
      {
        headers: {
          'X-Authorization': auth.token
        }
      }
    );

    return res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('❌ Error getting user data:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
