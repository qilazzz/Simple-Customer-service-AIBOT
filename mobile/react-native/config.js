/**
 * API base URL for the customer service backend.
 *
 * Development:
 *   Android emulator → http://10.0.2.2:3000
 *   iOS simulator    → http://localhost:3000
 *   Physical device  → http://YOUR_PC_LAN_IP:3000  (e.g. http://192.168.1.10:3000)
 *
 * Production:
 *   https://api.your-domain.com
 */
export const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000' // change to your LAN IP when testing on a real phone
  : 'https://your-production-api.com';
