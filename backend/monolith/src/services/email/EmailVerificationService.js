/**
 * Email Verification Service
 *
 * Handles email-based user registration, verification, and password reset.
 * Integrates with Integram user database (table 18) and EmailService.
 *
 * Features:
 * - Generate verification tokens
 * - Send verification emails
 * - Verify email addresses
 * - Send password reset emails
 * - Manage verification token lifecycle
 *
 * @module EmailVerificationService
 */

import crypto from 'crypto';
import logger from '../../utils/logger.js';
import emailService from './EmailService.js';
import { registerUser } from '../user-sync/userSyncService.js';
import defaultTokenService from '../ai/defaultTokenService.js';
import { createIntegramClient } from '../../utils/IntegramClient.js';
import { generateSimplifiedVerificationEmail } from './templates/simplified-verification-email.js';

/**
 * In-memory token storage
 * In production, this should be stored in Redis or database
 * Structure: { token: { email, type, userId, expiresAt, data } }
 */
const verificationTokens = new Map();

// Token expiration times
const TOKEN_EXPIRY = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 1 * 60 * 60 * 1000, // 1 hour
  MAGIC_LINK: 15 * 60 * 1000 // 15 minutes
};

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} Hex token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Store verification token
 * @param {Object} tokenData - Token data
 * @returns {string} Token
 */
function storeToken(tokenData) {
  const token = generateToken();
  const expiresAt = Date.now() + (tokenData.expiryTime || TOKEN_EXPIRY.EMAIL_VERIFICATION);

  verificationTokens.set(token, {
    ...tokenData,
    expiresAt,
    createdAt: Date.now()
  });

  logger.info({
    token: token.substring(0, 10) + '...',
    type: tokenData.type,
    email: tokenData.email
  }, 'Verification token created');

  return token;
}

/**
 * Get and validate verification token
 * @param {string} token - Token to validate
 * @param {string} expectedType - Expected token type
 * @returns {Object|null} Token data or null if invalid/expired
 */
function getToken(token, expectedType = null) {
  const tokenData = verificationTokens.get(token);

  if (!tokenData) {
    logger.warn({ token: token.substring(0, 10) + '...' }, 'Token not found');
    return null;
  }

  // Check if token expired
  if (Date.now() > tokenData.expiresAt) {
    logger.warn({
      token: token.substring(0, 10) + '...',
      type: tokenData.type
    }, 'Token expired');
    verificationTokens.delete(token);
    return null;
  }

  // Check token type if specified
  if (expectedType && tokenData.type !== expectedType) {
    logger.warn({
      token: token.substring(0, 10) + '...',
      expected: expectedType,
      actual: tokenData.type
    }, 'Token type mismatch');
    return null;
  }

  return tokenData;
}

/**
 * Delete verification token
 * @param {string} token - Token to delete
 */
function deleteToken(token) {
  const deleted = verificationTokens.delete(token);
  if (deleted) {
    logger.info({ token: token.substring(0, 10) + '...' }, 'Token deleted');
  }
}

/**
 * Clean up expired tokens
 * Should be called periodically
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  let count = 0;

  for (const [token, data] of verificationTokens.entries()) {
    if (now > data.expiresAt) {
      verificationTokens.delete(token);
      count++;
    }
  }

  if (count > 0) {
    logger.info({ count }, 'Expired tokens cleaned up');
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

/**
 * Send email verification
 * @param {Object} options - Verification options
 * @param {string} options.email - User email
 * @param {string} options.username - Username (optional)
 * @param {string} options.displayName - Display name (optional)
 * @param {string} options.password - User password
 * @param {string} options.baseUrl - Base URL for verification link
 * @param {string} options.referralCode - Referral code from inviter (optional) - Issue #5112
 * @returns {Promise<Object>} Result with token
 */
export async function sendEmailVerification(options) {
  try {
    const { email, username, displayName, password, baseUrl, referralCode } = options;

    // Initialize email service if not already initialized
    if (!emailService.initialized) {
      await emailService.initialize();
    }

    // Validate email
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }

    // Validate password
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if username or email already exists in Integram
    const client = createIntegramClient('my');
    const systemUsername = process.env.INTEGRAM_REGISTRATION_USERNAME || process.env.INTEGRAM_SYSTEM_USERNAME;
    const systemPassword = process.env.INTEGRAM_REGISTRATION_PASSWORD || process.env.INTEGRAM_SYSTEM_PASSWORD;

    if (systemUsername && systemPassword) {
      try {
        await client.authenticate(systemUsername, systemPassword);
        const userCheck = await client.checkUserExists(username || email.split('@')[0], email);

        if (userCheck.exists) {
          const field = userCheck.matchedField === 'username' ? 'Имя пользователя' : 'Email';
          const value = userCheck.matchedField === 'username' ? (username || email.split('@')[0]) : email;
          throw new Error(`${field} "${value}" уже зарегистрирован. Пожалуйста, используйте другой ${userCheck.matchedField === 'username' ? 'логин' : 'email'} или войдите в существующий аккаунт.`);
        }
      } catch (error) {
        // If error is about duplicate user, re-throw it
        if (error.message.includes('уже зарегистрирован')) {
          throw error;
        }
        // Log but don't block registration if Integram check fails
        logger.warn({ error: error.message, email, username }, 'Failed to check user existence in Integram, allowing registration to continue');
      }
    }

    // Create verification token
    const token = storeToken({
      type: 'EMAIL_VERIFICATION',
      email,
      username,
      displayName,
      password, // Store temporarily until verification
      referralCode, // Store referral code for reward processing - Issue #5112
      expiryTime: TOKEN_EXPIRY.EMAIL_VERIFICATION
    });

    // 🔍 TEMPORARY DEBUG: Log full verification token for testing
    console.log('━'.repeat(80));
    console.log('🔐 VERIFICATION TOKEN GENERATED:');
    console.log('   Email:', email);
    console.log('   Username:', username);
    console.log('   Token:', token);
    console.log('   Verification URL:', `${baseUrl}/email-verify?token=${token}`);
    console.log('━'.repeat(80));

    // Generate verification URL
    const verificationUrl = `${baseUrl}/email-verify?token=${token}`;

    // Use the minimalist email template
    const emailContent = generateSimplifiedVerificationEmail({
      email,
      username,
      displayName,
      verificationUrl
    });

    await emailService._sendEmail({
      from: `DronDoc <${emailService.config.fromEmail}>`,
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html
    });

    logger.info({ email }, 'Email verification sent');

    return {
      success: true,
      message: 'Verification email sent',
      email,
      token // In production, don't return token
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to send email verification');
    throw error;
  }
}

/**
 * Verify email and create user account
 * @param {string} token - Verification token
 * @param {Array<string>} databases - Databases to sync user to (default: ['my'])
 * @returns {Promise<Object>} Verification result with user info
 */
export async function verifyEmail(token, databases = ['my']) {
  try {
    // Get and validate token
    const tokenData = getToken(token, 'EMAIL_VERIFICATION');

    if (!tokenData) {
      throw new Error('Invalid or expired verification token');
    }

    const { email, username, displayName, password, referralCode } = tokenData;

    logger.info({ email, referralCode }, 'Verifying email and creating user');

    // Register user in Integram databases (table 18)
    const registrationResult = await registerUser({
      email,
      username,
      displayName,
      password,
      referralCode // Pass referral code to save in column 209326
    }, databases);

    // Delete token after successful verification
    deleteToken(token);

    logger.info({ email, userId: registrationResult.userId }, 'Email verified and user created');
    console.log('[TOKEN DEBUG] Email verified, starting token creation for:', email, registrationResult);

    // Create default AI token for the new user (Issue #5025, #5047, #5112)
    // Now runs synchronously to ensure token is created before returning
    let tokenResult = null;
    try {
      // Get the Integram recordId from registration result (not UUID!)
      // The token must be linked to the user's Integram object ID (from table 18)
      const myDbRecord = registrationResult.databases?.find(db => db.database === 'my');
      const integramUserId = myDbRecord?.recordId;
      console.log('[TOKEN DEBUG] Found myDbRecord:', myDbRecord, 'integramUserId:', integramUserId);

      if (!integramUserId) {
        logger.warn({ email }, 'No recordId found - skipping token creation');
      } else {
        logger.info({
          uuid: registrationResult.userId,
          integramUserId,
          email
        }, 'Creating default token with Integram user ID');

        // Create default token - defaultTokenService handles its own auth
        console.log('[TOKEN DEBUG] Calling ensureDefaultToken for userId:', integramUserId);
        tokenResult = await defaultTokenService.ensureDefaultToken(integramUserId);
        console.log('[TOKEN DEBUG] ensureDefaultToken result:', tokenResult);

        if (tokenResult.success) {
          logger.info({
            uuid: registrationResult.userId,
            integramUserId,
            email,
            tokenId: tokenResult.tokenId
          }, 'Welcome token created for new user');
        } else {
          logger.warn({
            uuid: registrationResult.userId,
            integramUserId,
            email,
            error: tokenResult.error
          }, 'Failed to create welcome token');
        }
      }
    } catch (err) {
      logger.error({
        uuid: registrationResult.userId,
        email,
        error: err.message,
        stack: err.stack
      }, 'Error creating welcome token');
    }

    // NOTE: Session creation moved to ClaudeCodeService.chat() (Issue #5137)
    // Sessions are created when user starts chat, not at email verification.
    // This ensures sessions are only created when actually needed (when user begins typing).
    // See: backend/monolith/src/services/ClaudeCodeService.js:103-137

    // Process referral rewards - Issue #5112
    if (referralCode) {
      try {
        logger.info({ referralCode, newUserEmail: email }, 'Processing referral reward');

        const client = createIntegramClient('my');
        const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
        const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

        if (systemUsername && systemPassword) {
          await client.authenticate(systemUsername, systemPassword);

          // Find user who has this referral code in column 209325
          const usersUrl = client.buildUrl('_o_list', 18); // table 18 = users
          const usersResponse = await client.axios.get(usersUrl, {
            headers: client.getAuthHeaders(),
            params: { limit: 10000 }
          });

          const users = usersResponse.data?.object || [];
          const referrerUser = users.find(user => {
            const userReqs = usersResponse.data?.reqs?.[user.id];
            return userReqs && userReqs['209325'] === referralCode;
          });

          if (referrerUser) {
            const referrerId = referrerUser.id;
            logger.info({
              referrerId,
              referralCode,
              newUserEmail: email
            }, 'Found referrer, awarding 100,000 tokens');

            // Award 100,000 tokens to referrer
            const bonusAmount = 100000;
            await defaultTokenService.addTokensToUser(referrerId, bonusAmount, {
              reason: 'referral_bonus',
              referredUserEmail: email,
              note: `Bonus for inviting ${email}`
            });

            logger.info({
              referrerId,
              bonusAmount,
              newUserEmail: email
            }, 'Referral bonus awarded successfully');
          } else {
            logger.warn({
              referralCode,
              newUserEmail: email
            }, 'Referrer not found for referral code');
          }
        }
      } catch (error) {
        // Don't fail registration if referral reward fails
        logger.error({
          error: error.message,
          referralCode,
          newUserEmail: email
        }, 'Failed to process referral reward, but user registration succeeded');
      }
    }

    return {
      success: true,
      message: 'Email verified successfully',
      userId: registrationResult.userId,
      email,
      databases: registrationResult.databases
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Email verification failed');
    throw error;
  }
}

/**
 * Send password reset email
 * @param {Object} options - Reset options
 * @param {string} options.email - User email
 * @param {string} options.userId - User ID
 * @param {string} options.baseUrl - Base URL for reset link
 * @returns {Promise<Object>} Result with token
 */
export async function sendPasswordReset(options) {
  try {
    const { email, userId, baseUrl } = options;

    // Create password reset token
    const token = storeToken({
      type: 'PASSWORD_RESET',
      email,
      userId,
      expiryTime: TOKEN_EXPIRY.PASSWORD_RESET
    });

    // Generate reset URL
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send password reset email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #FF9800; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .alert { background: #FFF3CD; border-left: 4px solid #FF9800; padding: 15px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Сброс Пароля</h1>
          </div>
          <div class="content">
            <div class="alert">
              <p><strong>Получен запрос на сброс пароля для вашего аккаунта.</strong></p>
            </div>

            <p>Email: ${email}</p>

            <p>Если вы запрашивали сброс пароля, нажмите кнопку ниже:</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">🔑 Сбросить Пароль</a>
            </div>

            <p style="margin-top: 20px;">Или скопируйте эту ссылку в браузер:</p>
            <p style="background: #fff; padding: 10px; word-break: break-all;">
              <a href="${resetUrl}">${resetUrl}</a>
            </p>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Эта ссылка действительна в течение 1 часа.
            </p>

            <p style="color: #999; font-size: 12px; margin-top: 20px;">
              Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо. Ваш пароль останется без изменений.
            </p>
          </div>
          <div class="footer">
            <p>Это автоматическое письмо от платформы DronDoc</p>
            <p>Если у вас есть вопросы, свяжитесь с нами: support@drondoc.ru</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailService._sendEmail({
      from: `DronDoc <${emailService.config.fromEmail}>`,
      to: email,
      subject: '🔐 Сброс Пароля - DronDoc',
      html: emailHtml
    });

    logger.info({ email, userId }, 'Password reset email sent');

    return {
      success: true,
      message: 'Password reset email sent',
      email,
      token // In production, don't return token
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to send password reset email');
    throw error;
  }
}

/**
 * Verify password reset token
 * @param {string} token - Reset token
 * @returns {Promise<Object>} Token data
 */
export async function verifyPasswordResetToken(token) {
  try {
    const tokenData = getToken(token, 'PASSWORD_RESET');

    if (!tokenData) {
      throw new Error('Invalid or expired password reset token');
    }

    return {
      success: true,
      email: tokenData.email,
      userId: tokenData.userId
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Password reset token verification failed');
    throw error;
  }
}

/**
 * Reset password using token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Reset result
 */
export async function resetPassword(token, newPassword) {
  try {
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Get and validate token
    const tokenData = getToken(token, 'PASSWORD_RESET');

    if (!tokenData) {
      throw new Error('Invalid or expired password reset token');
    }

    const { email, userId } = tokenData;

    logger.info({ email, userId }, 'Resetting password');

    // Update password in all databases
    const { updateUserInAllDatabases } = await import('../user-sync/userSyncService.js');
    const { hashPassword } = await import('../user-sync/passwordSyncService.js');

    const passwordHash = await hashPassword(newPassword);

    await updateUserInAllDatabases(userId, {
      password_hash: passwordHash,
      password_updated_at: new Date().toISOString()
    });

    // Delete token after successful reset
    deleteToken(token);

    logger.info({ email, userId }, 'Password reset successfully');

    return {
      success: true,
      message: 'Password reset successfully',
      email
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Password reset failed');
    throw error;
  }
}

/**
 * Send magic link for passwordless login
 * @param {Object} options - Magic link options
 * @param {string} options.email - User email
 * @param {string} options.userId - User ID
 * @param {string} options.baseUrl - Base URL for magic link
 * @returns {Promise<Object>} Result with token
 */
export async function sendMagicLink(options) {
  try {
    const { email, userId, baseUrl } = options;

    // Create magic link token
    const token = storeToken({
      type: 'MAGIC_LINK',
      email,
      userId,
      expiryTime: TOKEN_EXPIRY.MAGIC_LINK
    });

    // Generate magic link URL
    const magicUrl = `${baseUrl}/magic-login?token=${token}`;

    // Send magic link email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔗 Вход без Пароля</h1>
          </div>
          <div class="content">
            <p>Нажмите кнопку ниже для входа в ваш аккаунт DronDoc:</p>

            <div style="text-align: center;">
              <a href="${magicUrl}" class="button">🚀 Войти в DronDoc</a>
            </div>

            <p style="margin-top: 20px;">Или скопируйте эту ссылку в браузер:</p>
            <p style="background: #fff; padding: 10px; word-break: break-all;">
              <a href="${magicUrl}">${magicUrl}</a>
            </p>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Эта ссылка действительна в течение 15 минут.
            </p>

            <p style="color: #999; font-size: 12px; margin-top: 20px;">
              Если вы не запрашивали вход, просто проигнорируйте это письмо.
            </p>
          </div>
          <div class="footer">
            <p>Это автоматическое письмо от платформы DronDoc</p>
            <p>Если у вас есть вопросы, свяжитесь с нами: support@drondoc.ru</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailService._sendEmail({
      from: `DronDoc <${emailService.config.fromEmail}>`,
      to: email,
      subject: '🔗 Вход в DronDoc',
      html: emailHtml
    });

    logger.info({ email, userId }, 'Magic link sent');

    return {
      success: true,
      message: 'Magic link sent',
      email,
      token // In production, don't return token
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to send magic link');
    throw error;
  }
}

/**
 * Verify magic link token
 * @param {string} token - Magic link token
 * @returns {Promise<Object>} Token data with userId
 */
export async function verifyMagicLink(token) {
  try {
    const tokenData = getToken(token, 'MAGIC_LINK');

    if (!tokenData) {
      throw new Error('Invalid or expired magic link');
    }

    const { email, userId } = tokenData;

    // Delete token after successful verification
    deleteToken(token);

    logger.info({ email, userId }, 'Magic link verified');

    return {
      success: true,
      userId,
      email
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Magic link verification failed');
    throw error;
  }
}

/**
 * Get all pending verification tokens (FOR TESTING ONLY!)
 * @returns {Array} Array of token data
 */
export function getVerificationTokens() {
  const tokens = [];
  for (const [token, data] of verificationTokens.entries()) {
    tokens.push({
      token,
      ...data
    });
  }
  return tokens;
}

export default {
  sendEmailVerification,
  verifyEmail,
  sendPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
  sendMagicLink,
  verifyMagicLink,
  getVerificationTokens
};
