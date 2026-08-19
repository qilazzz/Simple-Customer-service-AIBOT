import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('App crash:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{String(this.state.error?.message || this.state.error)}</Text>
            <Pressable style={styles.btn} onPress={() => this.setState({ error: null })}>
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 24, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '700', color: '#c8102e', marginBottom: 12 },
  message: { fontSize: 14, color: '#52525b', lineHeight: 20, marginBottom: 24 },
  btn: {
    backgroundColor: '#c8102e',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
