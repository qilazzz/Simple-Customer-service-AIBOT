import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { CustomerAuthProvider } from './src/auth/CustomerAuthContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CustomerAuthProvider>
          <ErrorBoundary>
            <StatusBar style="light" />
            <RootNavigator />
          </ErrorBoundary>
        </CustomerAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
