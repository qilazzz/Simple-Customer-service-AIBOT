import React, { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

export default function LoginScreen({ navigation, route }) {
  const { login } = useCustomerAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Log In' });
  }, [navigation]);

  const finishLogin = () => {
    const redirect = route.params?.redirect;
    if (redirect) {
      navigation.replace(redirect, route.params?.redirectParams || {});
      return;
    }
    navigation.goBack();
  };

  const handleSubmit = async () => {
    setError('');
    if (!identifier.trim() || !password) {
      setError('Email or phone number and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      await login(identifier, password);
      finishLogin();
    } catch (err) {
      setError(err.message || 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🍕</Text>
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSub}>Sign in for faster support and saved details.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.field}>
          <Text style={styles.label}>Email or Phone Number</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com or 0123456789"
            placeholderTextColor="#a1a1aa"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Your password"
            placeholderTextColor="#a1a1aa"
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Log In</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switchLink}
          onPress={() => navigation.navigate('Register', route.params)}
        >
          <Text style={styles.switchText}>
            Don&apos;t have an account?{' '}
            <Text style={styles.switchTextBold}>Create one</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 20, paddingBottom: 40 },
  hero: {
    backgroundColor: '#c8102e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '700' },
  heroSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  error: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
  },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#52525b', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#18181b',
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#c8102e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
  switchLink: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 14, color: '#71717a' },
  switchTextBold: { color: '#c8102e', fontWeight: '700' },
});
