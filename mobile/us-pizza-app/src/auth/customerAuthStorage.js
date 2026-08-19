import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'customer_token';
export const USER_KEY = 'customer_user';

export async function getStoredToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveCustomerSession(token, user) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearCustomerSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
