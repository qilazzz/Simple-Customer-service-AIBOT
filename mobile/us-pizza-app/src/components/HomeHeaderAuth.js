import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

function getFirstName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

export default function HomeHeaderAuth({ navigation }) {
  const { user, isAuthenticated, initializing, logout } = useCustomerAuth();

  if (initializing) {
    return <ActivityIndicator color="#fff" size="small" />;
  }

  if (isAuthenticated && user) {
    return (
      <Pressable
        style={styles.profileBadge}
        onPress={() => {
          Alert.alert(
            `Hi, ${getFirstName(user.name)}`,
            user.email || user.phone_number || 'US Pizza member',
            [
              { text: 'Log Out', style: 'destructive', onPress: () => logout() },
              { text: 'OK', style: 'cancel' },
            ],
          );
        }}
        accessibilityRole="button"
        accessibilityLabel={`Signed in as ${user.name}`}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {getFirstName(user.name).charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileText} numberOfLines={1}>
          Hi, {getFirstName(user.name)}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.loginBtn}
      onPress={() => navigation.navigate('Login')}
      accessibilityRole="button"
      accessibilityLabel="Login or Register"
    >
      <Text style={styles.loginBtnText}>Login / Register</Text>
    </Pressable>
  );
}

export function promptSupportAccess(navigation, { isAuthenticated }) {
  if (isAuthenticated) {
    navigation.navigate('Support');
    return;
  }

  Alert.alert(
    'Customer Support',
    'Sign in for faster support and saved details, or continue as a guest.',
    [
      {
        text: 'Log In',
        onPress: () =>
          navigation.navigate('Login', {
            redirect: 'Support',
            redirectParams: { guest: false },
          }),
      },
      {
        text: 'Register',
        onPress: () =>
          navigation.navigate('Register', {
            redirect: 'Support',
            redirectParams: { guest: false },
          }),
      },
      {
        text: 'Continue as Guest',
        onPress: () => navigation.navigate('Support', { guest: true }),
      },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}

const styles = StyleSheet.create({
  loginBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 160,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  avatarText: {
    color: '#c8102e',
    fontSize: 13,
    fontWeight: '800',
  },
  profileText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
});
