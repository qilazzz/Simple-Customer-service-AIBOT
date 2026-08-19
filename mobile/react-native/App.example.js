/**
 * Example App entry — wire this into your existing React Native project.
 *
 * With React Navigation (@react-navigation/native + native-stack):
 *
 *   import CustomerSupportChat from './support/CustomerSupportChat';
 *
 *   <Stack.Navigator>
 *     <Stack.Screen name="Home" component={HomeScreen} />
 *     <Stack.Screen
 *       name="Support"
 *       component={CustomerSupportChat}
 *       options={{ title: 'Customer Support' }}
 *     />
 *   </Stack.Navigator>
 *
 *   // Navigate from anywhere:
 *   navigation.navigate('Support');
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import CustomerSupportChat from './CustomerSupportChat';

function HomeScreen({ onOpenSupport }) {
  return (
    <View style={styles.home}>
      <Text style={styles.title}>🍕 US Pizza App</Text>
      <Text style={styles.subtitle}>Order · Track · Support</Text>
      <Pressable style={styles.supportBtn} onPress={onOpenSupport}>
        <Text style={styles.supportBtnText}>💬 Customer Support</Text>
      </Pressable>
    </View>
  );
}

export default function AppExample() {
  const [showSupport, setShowSupport] = React.useState(false);

  if (showSupport) {
    return (
      <CustomerSupportChat
        onTicketSubmitted={(ticketId) => {
          console.log('Complaint logged:', ticketId);
        }}
      />
    );
  }

  return <HomeScreen onOpenSupport={() => setShowSupport(true)} />;
}

const styles = StyleSheet.create({
  home: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#71717a', marginBottom: 32 },
  supportBtn: {
    backgroundColor: '#c8102e',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  supportBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
