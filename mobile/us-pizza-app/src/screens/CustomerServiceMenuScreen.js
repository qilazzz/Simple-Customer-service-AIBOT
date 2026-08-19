import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

export const SUPPORT_MENU = [
  { id: 'find_outlet', emoji: '📍', label: 'Find an Outlet' },
  { id: 'order_status', emoji: '🛵', label: 'Order Status' },
  { id: 'order_issue', emoji: '🧾', label: 'Order Issue / Complaint' },
  { id: 'menu', emoji: '🍕', label: 'Menu' },
  { id: 'promotions', emoji: '🏷️', label: 'Promotions & Offers' },
  { id: 'other', emoji: '💬', label: 'Other / Talk to Support' },
];

export function promptLiveSupportAccess(navigation, { isAuthenticated }) {
  if (isAuthenticated) {
    navigation.navigate('LiveSupport');
    return;
  }

  Alert.alert(
    'Talk to Support',
    'Sign in to restore your live chat history, or continue as a guest.',
    [
      {
        text: 'Log In',
        onPress: () =>
          navigation.navigate('Login', {
            redirect: 'LiveSupport',
            redirectParams: { guest: false },
          }),
      },
      {
        text: 'Register',
        onPress: () =>
          navigation.navigate('Register', {
            redirect: 'LiveSupport',
            redirectParams: { guest: false },
          }),
      },
      {
        text: 'Continue as Guest',
        onPress: () => navigation.navigate('LiveSupport', { guest: true }),
      },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}

export default function CustomerServiceMenuScreen({ navigation }) {
  const { isAuthenticated } = useCustomerAuth();

  const handleOption = (item) => {
    if (item.id === 'find_outlet') {
      navigation.navigate('Outlets');
      return;
    }

    if (item.id === 'other') {
      promptLiveSupportAccess(navigation, { isAuthenticated });
      return;
    }

    navigation.navigate('BotChat', {
      initialOption: item.label,
      optionId: item.id,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>How can we help?</Text>
        <Text style={styles.heroSub}>US Pizza Malaysia Customer Service</Text>
        <Text style={styles.heroHint}>
          Choose an option below. Live agent chat history is kept separately under Talk to
          Support.
        </Text>
      </View>

      <View style={styles.menuList}>
        {SUPPORT_MENU.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.menuOption, pressed && styles.menuOptionPressed]}
            onPress={() => handleOption(item)}
          >
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <View style={styles.menuCopy}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.id === 'other' ? (
                <Text style={styles.menuMeta}>Opens your saved live agent conversation</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5' },
  content: { padding: 20, paddingBottom: 40 },
  hero: {
    backgroundColor: '#c8102e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '600' },
  heroHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 10, lineHeight: 19 },
  menuList: { gap: 10 },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  menuOptionPressed: { borderColor: '#c8102e', backgroundColor: '#fff5f5' },
  menuEmoji: { fontSize: 22, marginRight: 14, width: 30 },
  menuCopy: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '700', color: '#18181b' },
  menuMeta: { fontSize: 12, color: '#71717a', marginTop: 4 },
});
