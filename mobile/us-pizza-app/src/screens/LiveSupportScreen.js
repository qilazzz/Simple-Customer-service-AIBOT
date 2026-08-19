import React from 'react';
import LiveSupportChat from '../support/LiveSupportChat';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

export default function LiveSupportScreen({ navigation, route }) {
  const { user, isAuthenticated, logout } = useCustomerAuth();
  const isGuest = route.params?.guest === true && !isAuthenticated;

  return (
    <LiveSupportChat
      guestMode={isGuest}
      authUser={isAuthenticated ? user : null}
      onRequestLogin={() =>
        navigation.navigate('Login', {
          redirect: 'LiveSupport',
          redirectParams: { guest: false },
        })
      }
      onLogout={logout}
    />
  );
}
