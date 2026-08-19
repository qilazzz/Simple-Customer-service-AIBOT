# US Pizza — React Native app (with Support navigation)

Runnable Expo app with **Customer Support** wired into stack navigation.

## Quick start

**Terminal 1 — API backend** (project root):

```powershell
cd "C:\QILA FOLDER\Persoanal-project\customer-service"
npm start
```

**Terminal 2 — mobile app**:

```powershell
cd mobile\us-pizza-app
npm install
npm run start:tunnel
```

Scan the QR code with **Expo Go** (not your normal camera app on Android).

If LAN scan fails (common on Windows / guest Wi‑Fi / hotspot), use **tunnel mode** above instead of plain `expo start`.

Press `a` for Android emulator or scan QR with Expo Go on a physical device.

### Can't scan the QR code?

1. **Use Expo Go** — Install [Expo Go](https://expo.dev/go) and scan from inside the app (Android: Projects → Scan QR).
2. **Same network** — Phone and PC must be on the **same Wi‑Fi** for default LAN mode. Guest networks often block device-to-device traffic.
3. **Try tunnel mode** (works across networks):
   ```powershell
   npm run start:tunnel
   ```
4. **Port 8081 busy** — Stop old Metro/Expo windows, or run:
   ```powershell
   npx expo start --port 8082 -c
   ```
5. **Update Expo Go** — This project uses **Expo SDK 54**; older Expo Go versions won't open the app.
6. **Windows Firewall** — Allow **Node.js** on private networks when prompted.
7. **Manual URL** — In Expo Go, enter: `exp://YOUR_PC_IP:8081` (find IP with `ipconfig` → IPv4, e.g. `10.67.147.194`).

## Navigation flow

```
Home  →  tap "Customer Support"  →  Support (AI chat)
```

Files:

| File | Role |
|------|------|
| `App.js` | SafeAreaProvider + navigator |
| `src/navigation/RootNavigator.js` | Stack: Home, Support |
| `src/screens/HomeScreen.js` | Menu + Support button |
| `src/screens/SupportScreen.js` | Wraps chat + success alert |
| `src/support/` | Chat UI + API client |

## API URL (physical device)

Edit `src/support/config.js` and set your PC LAN IP:

```js
return 'http://192.168.1.XX:3000';
```

Find IP: `ipconfig` → IPv4 Address. Phone and PC must be on the same Wi‑Fi.

## Add to your existing app

1. Copy `src/support/` into your project (e.g. `src/support/`).
2. Install deps:

   ```bash
   npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context react-native-image-picker
   npx expo install react-native-screens react-native-safe-area-context
   ```

3. Register the screen in your navigator:

   ```js
   import SupportScreen from './screens/SupportScreen'; // or inline CustomerSupportChat

   <Stack.Screen name="Support" component={SupportScreen} />
   ```

4. Navigate from anywhere:

   ```js
   navigation.navigate('Support');
   ```

5. Set production URL in `src/support/config.js`.

## Android cleartext

`app.json` sets `usesCleartextTraffic: true` for local HTTP in dev. Use HTTPS in production.
