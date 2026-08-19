import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * API URL for the customer service backend (npm start in customer-service/).
 *
 * Physical phone (Expo Go): uses the same LAN IP as Metro (from debuggerHost).
 * Android emulator: 10.0.2.2 → PC localhost
 * iOS simulator: localhost
 */
/**
 * Optional manual override when auto-detection fails (same Wi‑Fi still required unless using tunnel).
 * Example: 'http://192.168.1.25:3000'
 */
const MANUAL_DEV_API_URL = null;

function getHostFromConstants() {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.linkingUri,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const cleaned = String(value).replace(/^https?:\/\//, '').split('/')[0];
    const host = cleaned.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }
  return null;
}

function getDevApiUrl() {
  if (MANUAL_DEV_API_URL) return MANUAL_DEV_API_URL;

  const host = getHostFromConstants();
  if (host) {
    return `http://${host}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

export const API_BASE_URL = __DEV__
  ? getDevApiUrl()
  : 'https://your-production-api.com';
