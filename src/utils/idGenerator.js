import crypto from 'crypto';

/**
 * Generates a random alphanumeric room ID (uppercase, configurable length).
 * @param {number} length
 * @returns {string}
 */
export function generateRoomId(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  try {
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
  } catch (err) {
    // Fallback if crypto.randomBytes fails or is unavailable
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

/**
 * Generates a random alphanumeric room password (mixed case + digits, configurable length).
 * @param {number} length
 * @returns {string}
 */
export function generateRoomPassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  try {
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
  } catch (err) {
    // Fallback
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

/**
 * Generates a random UUID-style user/connection ID.
 * @returns {string}
 */
export function generateUserId() {
  return crypto.randomUUID();
}
