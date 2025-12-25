/**
 * Simplified Email Verification Template
 *
 * This is a Gmail-friendly version without:
 * - HTML buttons (common phishing pattern)
 * - Complex styling (can trigger filters)
 * - Multiple links (suspicious for new IPs)
 *
 * Based on troubleshooting findings from issue #5005
 */

/**
 * Generate simplified verification email
 * @param {Object} options - Email options
 * @returns {Object} { subject, html, text }
 */
export function generateSimplifiedVerificationEmail({ email, username, displayName, verificationUrl }) {
  // Simplified subject (no emoji at start)
  const subject = 'DronDoc - Подтверждение регистрации';

  // Plain HTML without button, minimal styling
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">

    <h2>Завершите регистрацию на DronDoc</h2>

    <p>Здравствуйте${username ? ', ' + username : ''}!</p>

    <p>Вы зарегистрировались на платформе DronDoc с email: <strong>${email}</strong></p>

    <p>Для завершения регистрации, пожалуйста, перейдите по ссылке:</p>

    <p style="background: #f5f5f5; padding: 15px; border-left: 3px solid #4CAF50; word-break: break-all;">
      <a href="${verificationUrl}" style="color: #4CAF50; text-decoration: none;">${verificationUrl}</a>
    </p>

    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Ссылка действительна в течение 24 часов.
    </p>

    <p style="color: #999; font-size: 12px; margin-top: 20px;">
      Если вы не регистрировались на DronDoc, просто проигнорируйте это письмо.
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="color: #666; font-size: 12px; text-align: center;">
      DronDoc Platform<br>
      info@drondoc.ru
    </p>

  </div>
</body>
</html>
  `.trim();

  // Plain text version (some clients prefer this)
  const text = `
Завершите регистрацию на DronDoc

Здравствуйте${username ? ', ' + username : ''}!

Вы зарегистрировались на платформе DronDoc с email: ${email}

Для завершения регистрации, пожалуйста, перейдите по ссылке:

${verificationUrl}

Ссылка действительна в течение 24 часов.

Если вы не регистрировались на DronDoc, просто проигнорируйте это письмо.

---
DronDoc Platform
info@drondoc.ru
  `.trim();

  return { subject, html, text };
}

/**
 * Alternative ultra-simple template (if simplified still filtered)
 */
export function generateUltraSimpleVerificationEmail({ email, verificationUrl }) {
  const subject = 'Подтвердите регистрацию';

  const html = `
<p>Здравствуйте!</p>
<p>Завершите регистрацию, перейдя по ссылке:</p>
<p><a href="${verificationUrl}">${verificationUrl}</a></p>
<p>С уважением,<br>DronDoc</p>
  `.trim();

  const text = `
Здравствуйте!

Завершите регистрацию, перейдя по ссылке:

${verificationUrl}

С уважением,
DronDoc
  `.trim();

  return { subject, html, text };
}

/**
 * Alternative subject lines (if subject is the trigger)
 */
export const ALTERNATIVE_SUBJECTS = [
  'DronDoc - Подтверждение регистрации',          // Simple, no emoji
  'Подтвердите ваш email на DronDoc',             // Different wording
  'Завершите регистрацию на DronDoc',             // Action-oriented
  'Ваш аккаунт на DronDoc',                       // Neutral
  'DronDoc: Активация аккаунта'                   // Alternative phrasing
];

export default {
  generateSimplifiedVerificationEmail,
  generateUltraSimpleVerificationEmail,
  ALTERNATIVE_SUBJECTS
};
