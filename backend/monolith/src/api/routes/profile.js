/**
 * Profile API Routes
 *
 * Provides REST API endpoints for user profile management
 * with Integram backend integration.
 *
 * Issue #5139: Created to avoid CORS issues with direct Integram API calls
 *
 * Endpoints:
 * - GET /api/profile/organizations/list - Get all organizations for dropdown
 * - GET /api/profile/:userId - Get user profile from Integram
 * - PUT /api/profile/:userId - Update user profile in Integram
 * - PUT /api/profile/:userId/password - Change user password
 * - PUT /api/profile/:userId/photo-url - Save OAuth profile photo by URL
 * - GET /api/profile/:userId/organizations - Get user's organizations (multiselect)
 * - POST /api/profile/:userId/organizations - Add organization to user
 * - DELETE /api/profile/:userId/organizations/:itemId - Remove organization from user
 */

import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import logger from '../../utils/logger.js';

const router = express.Router();

// Integram API configuration
const INTEGRAM_URL = process.env.INTEGRAM_URL || 'https://dronedoc.ru';
const DATABASE = 'my';

// User table requisite IDs
const REQUISITE_IDS = {
  name: 33,
  email: 41,
  phone: 30,
  photo: 38,        // Photo field (type FILE) - requires multipart/form-data upload
  notes: 39,
  password: 20,
  organization: 197015,
  balance: 285,
  bonus: 287,
  referrals: 289,
  telegram_id: 207236,
  google_id: 207232,
  yandex_id: 207230,
  vk_id: 207234,
  github_id: 207923
};

/**
 * Extract Integram auth token from request headers
 */
function getIntegramToken(req) {
  // Try X-Authorization header first, then Authorization Bearer
  const xAuth = req.headers['x-authorization'];
  if (xAuth) return xAuth;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Extract XSRF token from request headers or cookies
 */
function getXsrfToken(req) {
  // Try X-XSRF-Token header first
  const xsrfHeader = req.headers['x-xsrf-token'];
  if (xsrfHeader) return xsrfHeader;

  // Try cookies
  const cookies = req.cookies || {};
  if (cookies._xsrf) return cookies._xsrf;

  return null;
}

/**
 * Build headers for Integram API requests
 * @param {string} token - Auth token
 * @param {string} xsrf - XSRF token (optional for GET requests)
 * @returns {object} Headers object
 */
function buildIntegramHeaders(token, xsrf) {
  const headers = {
    'X-Authorization': token
  };

  if (xsrf) {
    headers['Cookie'] = `_xsrf=${xsrf}`;
  }

  return headers;
}

/**
 * GET /api/profile/organizations/list
 * Get list of all organizations for dropdown
 * NOTE: This route MUST be before /:userId to avoid matching "organizations" as userId
 */
router.get('/organizations/list', async (req, res) => {
  try {
    const token = getIntegramToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    // Use object endpoint (works without CSRF, unlike _m_lst)
    const response = await axios.get(
      `${INTEGRAM_URL}/${DATABASE}/object/197000?JSON_KV&limit=100`,
      {
        headers: { 'X-Authorization': token }
      }
    );

    // Extract organizations from object response
    const objData = response.data?.['&main.a.&uni_obj.&uni_obj_all'];
    const organizations = [];

    if (objData?.id) {
      for (let i = 0; i < objData.id.length; i++) {
        organizations.push({
          id: parseInt(objData.id[i]),
          name: (objData.val[i] || '').replace(/&quot;/g, '"')
        });
      }
    }

    res.json({
      success: true,
      data: organizations
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get organizations list');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get organizations list'
    });
  }
});

/**
 * GET /api/profile/:userId
 * Get user profile from Integram using edit_obj endpoint (avoids CSRF issues)
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const token = getIntegramToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    logger.info({ userId }, 'Fetching user profile from Integram via edit_obj');

    // Use edit_obj endpoint - it works without CSRF token (unlike _m_lst)
    const response = await axios.get(
      `${INTEGRAM_URL}/${DATABASE}/edit_obj/${userId}?JSON_KV`,
      {
        headers: { 'X-Authorization': token }
      }
    );

    const data = response.data;

    // Check if user exists
    if (!data.obj || data.obj.id !== String(userId)) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Extract requisites from edit_obj response
    const reqs = data.reqs || {};

    // Helper to get requisite value
    const getReqValue = (reqId) => {
      const req = reqs[reqId];
      return req?.value || '';
    };

    // Helper to extract photo URL from FILE type field (returns HTML link)
    const getPhotoUrl = () => {
      const photoValue = getReqValue(REQUISITE_IDS.photo);
      if (!photoValue) return '';

      logger.debug({ photoValue: photoValue.substring(0, 200) }, 'Raw photo field value');

      // Photo field returns HTML: <a target="_blank" href="/download/...">filename</a>
      const hrefMatch = photoValue.match(/href="([^"]+)"/);
      if (hrefMatch) {
        // Return full URL to the file
        const photoUrl = `${INTEGRAM_URL}${hrefMatch[1]}`;
        logger.debug({ photoUrl }, 'Extracted photo URL');
        return photoUrl;
      }

      // If no href found, might be a direct URL or filename
      logger.warn({ photoValue: photoValue.substring(0, 100) }, 'Could not extract photo URL from HTML');
      return photoValue;
    };

    // Map requisites to profile data
    const profile = {
      id: userId,
      name: getReqValue(REQUISITE_IDS.name) || data.obj.val || '',
      email: getReqValue(REQUISITE_IDS.email),
      phone: getReqValue(REQUISITE_IDS.phone),
      notes: getReqValue(REQUISITE_IDS.notes),
      photo: getPhotoUrl(),
      balance: parseFloat(getReqValue(REQUISITE_IDS.balance)) || 0,
      bonus: parseFloat(getReqValue(REQUISITE_IDS.bonus)) || 0,
      referrals: parseInt(getReqValue(REQUISITE_IDS.referrals)) || 0,
      telegram_id: getReqValue(REQUISITE_IDS.telegram_id),
      google_id: getReqValue(REQUISITE_IDS.google_id),
      yandex_id: getReqValue(REQUISITE_IDS.yandex_id),
      vk_id: getReqValue(REQUISITE_IDS.vk_id),
      github_id: getReqValue(REQUISITE_IDS.github_id)
    };

    // Handle organization multiselect from edit_obj response
    const orgReq = reqs[REQUISITE_IDS.organization];
    if (orgReq?.multiselect?.id) {
      const ms = orgReq.multiselect;
      profile.organizationItems = ms.id.map((itemId, index) => ({
        itemId: parseInt(itemId),
        orgId: parseInt(ms.val[index]),
        name: (ms.ref_val?.[index] || '').replace(/&quot;/g, '"')
      }));
      profile.organizationIds = profile.organizationItems.map(item => item.orgId);
    } else {
      profile.organizationItems = [];
      profile.organizationIds = [];
    }

    logger.debug({ userId, profile: { ...profile, photo: profile.photo ? '[PHOTO]' : '' } }, 'Profile loaded');

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId }, 'Failed to fetch profile');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch profile'
    });
  }
});

/**
 * PUT /api/profile/:userId
 * Update user profile in Integram
 * Handles photo upload via multipart/form-data for FILE type field
 */
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, notes, photo } = req.body;
    const token = getIntegramToken(req);
    const xsrf = req.headers['x-xsrf-token'] || req.body._xsrf;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    logger.info({ userId, hasPhoto: !!photo, photoLength: photo?.length }, 'Updating user profile in Integram');

    // Check if we need to upload a photo (base64 data URL)
    const hasPhotoUpload = photo && photo.startsWith('data:');
    logger.info({ hasPhotoUpload, photoPrefix: photo?.substring(0, 50) }, 'Photo upload check');

    if (hasPhotoUpload) {
      // Use multipart/form-data for file upload
      const formData = new FormData();
      if (xsrf) formData.append('_xsrf', xsrf);

      // Add text fields
      if (name !== undefined) formData.append(`t${REQUISITE_IDS.name}`, name);
      if (email !== undefined) formData.append(`t${REQUISITE_IDS.email}`, email);
      if (phone !== undefined) formData.append(`t${REQUISITE_IDS.phone}`, phone);
      if (notes !== undefined) formData.append(`t${REQUISITE_IDS.notes}`, notes);

      // Convert base64 to buffer for file upload
      const matches = photo.match(/^data:([^;]+);base64,(.+)$/);
      logger.info({ matchesFound: !!matches, mimeType: matches?.[1] }, 'Base64 regex match');

      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = mimeType.split('/')[1] || 'png';

        logger.info({ mimeType, ext, bufferSize: buffer.length }, 'Creating file upload');

        formData.append(`t${REQUISITE_IDS.photo}`, buffer, {
          filename: `photo.${ext}`,
          contentType: mimeType
        });
      }

      const headers = {
        'X-Authorization': token,
        ...formData.getHeaders()
      };
      if (xsrf) headers['Cookie'] = `_xsrf=${xsrf}`;

      await axios.post(
        `${INTEGRAM_URL}/${DATABASE}/_m_set/${userId}?JSON_KV`,
        formData,
        { headers }
      );
    } else {
      // Use URL-encoded form for text-only updates
      const formData = new URLSearchParams();
      if (xsrf) formData.append('_xsrf', xsrf);

      if (name !== undefined) formData.append(`t${REQUISITE_IDS.name}`, name);
      if (email !== undefined) formData.append(`t${REQUISITE_IDS.email}`, email);
      if (phone !== undefined) formData.append(`t${REQUISITE_IDS.phone}`, phone);
      if (notes !== undefined) formData.append(`t${REQUISITE_IDS.notes}`, notes);
      // For clearing photo or non-file photo value
      if (photo !== undefined && !hasPhotoUpload) {
        formData.append(`t${REQUISITE_IDS.photo}`, photo);
      }

      const headers = {
        'X-Authorization': token,
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      if (xsrf) headers['Cookie'] = `_xsrf=${xsrf}`;

      await axios.post(
        `${INTEGRAM_URL}/${DATABASE}/_m_set/${userId}?JSON_KV`,
        formData,
        { headers }
      );
    }

    logger.info({ userId }, 'Profile updated successfully');

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId }, 'Failed to update profile');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update profile'
    });
  }
});

/**
 * PUT /api/profile/:userId/password
 * Change user password in Integram
 */
router.put('/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const token = getIntegramToken(req);
    const xsrf = req.headers['x-xsrf-token'] || req.body._xsrf;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    logger.info({ userId }, 'Changing user password');

    const formData = new URLSearchParams();
    if (xsrf) formData.append('_xsrf', xsrf);
    formData.append(`t${REQUISITE_IDS.password}`, newPassword);

    const headers = {
      'X-Authorization': token,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    if (xsrf) headers['Cookie'] = `_xsrf=${xsrf}`;

    await axios.post(
      `${INTEGRAM_URL}/${DATABASE}/_m_set/${userId}?JSON_KV`,
      formData,
      { headers }
    );

    logger.info({ userId }, 'Password changed successfully');

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId }, 'Failed to change password');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to change password'
    });
  }
});

/**
 * GET /api/profile/:userId/organizations
 * Get user's organizations (multiselect items)
 */
router.get('/:userId/organizations', async (req, res) => {
  try {
    const { userId } = req.params;
    const token = getIntegramToken(req);
    const xsrf = getXsrfToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    // Get multiselect items for organization field
    const response = await axios.get(
      `${INTEGRAM_URL}/${DATABASE}/_m_multi/${userId}/${REQUISITE_IDS.organization}?JSON_KV`,
      {
        headers: buildIntegramHeaders(token, xsrf)
      }
    );

    const items = response.data?.object || [];
    const organizations = items.map(item => ({
      itemId: parseInt(item.id),
      orgId: parseInt(item.val_id || item.val),
      name: item.ref_val || item.val
    }));

    res.json({
      success: true,
      data: organizations
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId }, 'Failed to get organizations');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get organizations'
    });
  }
});

/**
 * POST /api/profile/:userId/organizations
 * Add organization to user
 */
router.post('/:userId/organizations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { orgId } = req.body;
    const token = getIntegramToken(req);
    const xsrf = req.headers['x-xsrf-token'] || req.body._xsrf;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required'
      });
    }

    const formData = new URLSearchParams();
    if (xsrf) formData.append('_xsrf', xsrf);
    formData.append('val', orgId.toString());

    await axios.post(
      `${INTEGRAM_URL}/${DATABASE}/_m_add/${userId}/${REQUISITE_IDS.organization}?JSON_KV`,
      formData,
      {
        headers: {
          'X-Authorization': token,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    res.json({
      success: true,
      message: 'Organization added successfully'
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId }, 'Failed to add organization');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to add organization'
    });
  }
});

/**
 * PUT /api/profile/:userId/photo-url
 * Save OAuth profile photo by URL (Google, Yandex, VK)
 * Downloads the image from URL and uploads to Integram as file
 */
router.put('/:userId/photo-url', async (req, res) => {
  try {
    const { userId } = req.params;
    const { photoUrl } = req.body;
    const token = getIntegramToken(req);
    const xsrf = req.headers['x-xsrf-token'] || req.body._xsrf;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    if (!photoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Photo URL is required'
      });
    }

    logger.info({ userId, photoUrl: photoUrl.substring(0, 100) }, 'Saving OAuth profile photo from URL');

    // Download image from OAuth provider
    let imageBuffer;
    let contentType = 'image/jpeg';
    let extension = 'jpg';

    try {
      const imageResponse = await axios.get(photoUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'DronDoc/1.0',
          'Accept': 'image/*'
        }
      });

      imageBuffer = Buffer.from(imageResponse.data);

      // Detect content type from response headers
      const responseContentType = imageResponse.headers['content-type'];
      if (responseContentType) {
        contentType = responseContentType.split(';')[0].trim();
        if (contentType.includes('png')) {
          extension = 'png';
        } else if (contentType.includes('gif')) {
          extension = 'gif';
        } else if (contentType.includes('webp')) {
          extension = 'webp';
        }
      }

      logger.info({
        bufferSize: imageBuffer.length,
        contentType,
        extension
      }, 'Downloaded OAuth photo');

    } catch (downloadError) {
      logger.error({ error: downloadError.message, photoUrl }, 'Failed to download OAuth photo');
      return res.status(400).json({
        success: false,
        error: 'Failed to download photo from URL'
      });
    }

    // Upload to Integram using multipart/form-data
    const formData = new FormData();
    if (xsrf) formData.append('_xsrf', xsrf);

    formData.append(`t${REQUISITE_IDS.photo}`, imageBuffer, {
      filename: `oauth_photo.${extension}`,
      contentType: contentType
    });

    const headers = {
      'X-Authorization': token,
      ...formData.getHeaders()
    };
    if (xsrf) headers['Cookie'] = `_xsrf=${xsrf}`;

    await axios.post(
      `${INTEGRAM_URL}/${DATABASE}/_m_set/${userId}?JSON_KV`,
      formData,
      { headers }
    );

    logger.info({ userId }, 'OAuth photo saved successfully');

    res.json({
      success: true,
      message: 'Photo saved successfully'
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId }, 'Failed to save OAuth photo');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to save photo'
    });
  }
});

/**
 * POST /api/profile/:userId/fetch-oauth-photo
 * Fetch and save user's OAuth provider photo from connected accounts
 * Checks which OAuth providers are connected and attempts to fetch photo from each
 */
router.post('/:userId/fetch-oauth-photo', async (req, res) => {
  try {
    const { userId } = req.params;
    const token = getIntegramToken(req);
    const xsrf = req.headers['x-xsrf-token'] || req.body._xsrf;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    logger.info({ userId }, 'Fetching OAuth provider photos for user');

    // Get user profile to check which OAuth providers are connected
    const profileResponse = await axios.get(
      `${INTEGRAM_URL}/${DATABASE}/edit_obj/${userId}?JSON_KV`,
      {
        headers: { 'X-Authorization': token }
      }
    );

    const reqs = profileResponse.data.reqs || {};
    const getReqValue = (reqId) => reqs[reqId]?.value || '';

    // Check connected OAuth providers
    const connectedProviders = [];
    const providerPhotos = {};

    // Yandex
    const yandexId = getReqValue(REQUISITE_IDS.yandex_id);
    if (yandexId) {
      connectedProviders.push('yandex');
      // Construct Yandex avatar URL from user ID
      providerPhotos.yandex = `https://avatars.yandex.net/get-yapic/${yandexId}/islands-200`;
    }

    // Google - we don't store the photo URL, only the user ID
    const googleId = getReqValue(REQUISITE_IDS.google_id);
    if (googleId) {
      connectedProviders.push('google');
      // Can't fetch Google photo without re-authentication
      logger.debug({ userId, googleId }, 'Google connected but photo URL not available without re-auth');
    }

    // VK
    const vkId = getReqValue(REQUISITE_IDS.vk_id);
    if (vkId) {
      connectedProviders.push('vk');
      // Can't fetch VK photo without access token
      logger.debug({ userId, vkId }, 'VK connected but requires access token');
    }

    // Telegram - we might have the photo URL
    const telegramId = getReqValue(REQUISITE_IDS.telegram_id);
    if (telegramId) {
      connectedProviders.push('telegram');
      // Telegram photo URLs are typically saved during auth
      logger.debug({ userId, telegramId }, 'Telegram connected but photo URL not persistently stored');
    }

    if (connectedProviders.length === 0) {
      return res.json({
        success: false,
        error: 'No OAuth providers connected',
        connectedProviders: []
      });
    }

    // Try to fetch and save photos
    let photoSaved = false;
    const results = [];

    for (const provider of Object.keys(providerPhotos)) {
      const photoUrl = providerPhotos[provider];
      try {
        logger.info({ userId, provider, photoUrl: photoUrl.substring(0, 100) }, 'Downloading OAuth provider photo');

        // Download image
        const imageResponse = await axios.get(photoUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'DronDoc/1.0',
            'Accept': 'image/*'
          }
        });

        const imageBuffer = Buffer.from(imageResponse.data);

        // Detect content type
        let contentType = 'image/jpeg';
        let extension = 'jpg';
        const responseContentType = imageResponse.headers['content-type'];
        if (responseContentType) {
          contentType = responseContentType.split(';')[0].trim();
          if (contentType.includes('png')) extension = 'png';
          else if (contentType.includes('gif')) extension = 'gif';
          else if (contentType.includes('webp')) extension = 'webp';
        }

        logger.info({ userId, provider, bufferSize: imageBuffer.length, contentType }, 'Downloaded OAuth photo');

        // Upload to Integram
        const formData = new FormData();
        if (xsrf) formData.append('_xsrf', xsrf);
        formData.append(`t${REQUISITE_IDS.photo}`, imageBuffer, {
          filename: `oauth_${provider}_photo.${extension}`,
          contentType: contentType
        });

        const headers = {
          'X-Authorization': token,
          ...formData.getHeaders()
        };
        if (xsrf) headers['Cookie'] = `_xsrf=${xsrf}`;

        await axios.post(
          `${INTEGRAM_URL}/${DATABASE}/_m_set/${userId}?JSON_KV`,
          formData,
          { headers }
        );

        logger.info({ userId, provider }, 'OAuth photo saved successfully');
        photoSaved = true;
        results.push({ provider, success: true });
      } catch (error) {
        logger.warn({ userId, provider, error: error.message }, 'Failed to save OAuth photo');
        results.push({ provider, success: false, error: error.message });
      }
    }

    res.json({
      success: photoSaved,
      message: photoSaved ? 'Photo fetched and saved successfully' : 'Failed to fetch photo from available providers',
      connectedProviders,
      results
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId }, 'Failed to fetch OAuth photo');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch OAuth photo'
    });
  }
});

/**
 * DELETE /api/profile/:userId/organizations/:itemId
 * Remove organization from user
 */
router.delete('/:userId/organizations/:itemId', async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    const token = getIntegramToken(req);
    const xsrf = req.headers['x-xsrf-token'] || req.query._xsrf;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const formData = new URLSearchParams();
    if (xsrf) formData.append('_xsrf', xsrf);

    await axios.post(
      `${INTEGRAM_URL}/${DATABASE}/_m_del/${itemId}?JSON_KV`,
      formData,
      {
        headers: {
          'X-Authorization': token,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    res.json({
      success: true,
      message: 'Organization removed successfully'
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.params.userId, itemId: req.params.itemId }, 'Failed to remove organization');

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to remove organization'
    });
  }
});

export default router;
