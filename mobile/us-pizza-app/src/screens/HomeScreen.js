import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FloatingSupportButton from '../components/FloatingSupportButton';
import { promptSupportAccess } from '../components/HomeHeaderAuth';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

export default function HomeScreen({ navigation }) {
  const { isAuthenticated } = useCustomerAuth();

  const openSupport = () => {
    promptSupportAccess(navigation, { isAuthenticated });
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🍕 US Pizza</Text>
          <Text style={styles.heroSub}>Order · Track · Support</Text>
        </View>

        <Pressable
          style={styles.outletsBtn}
          onPress={() => navigation.navigate('Outlets')}
        >
          <Text style={styles.outletsBtnText}>📍 Find Outlets</Text>
          <Text style={styles.outletsBtnSub}>Browse all US Pizza locations in Malaysia</Text>
        </Pressable>

        <Pressable style={styles.supportBtn} onPress={openSupport}>
          <Text style={styles.supportBtnText}>💬 Customer Support</Text>
          <Text style={styles.supportBtnSub}>Report an issue or leave feedback</Text>
        </Pressable>
      </ScrollView>
      <FloatingSupportButton bottomOffset={0} onPress={openSupport} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, overflow: 'visible' },
  container: { flex: 1, backgroundColor: '#f4f4f5' },
  content: { padding: 20, paddingBottom: 40 },
  hero: {
    backgroundColor: '#c8102e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '700' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 4 },
  outletsBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#c8102e',
    alignItems: 'center',
  },
  outletsBtnText: { fontSize: 17, fontWeight: '700', color: '#c8102e' },
  outletsBtnSub: { fontSize: 13, color: '#71717a', marginTop: 6 },
  supportBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 2,
    borderColor: '#c8102e',
    alignItems: 'center',
  },
  supportBtnText: { fontSize: 17, fontWeight: '700', color: '#c8102e' },
  supportBtnSub: { fontSize: 13, color: '#71717a', marginTop: 6 },
});
