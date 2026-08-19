import React from 'react';
import { Alert } from 'react-native';
import BotSupportChat from '../support/BotSupportChat';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

export default function BotChatScreen({ navigation, route }) {
  const { user, isAuthenticated } = useCustomerAuth();
  const initialOption = route.params?.initialOption || null;

  return (
    <BotSupportChat
      initialOption={initialOption}
      authUser={isAuthenticated ? user : null}
      onOpenOutlets={() => navigation.navigate('Outlets')}
      onTicketSubmitted={(ticketId) => {
        Alert.alert(
          'Complaint logged',
          `Your ticket #${ticketId} has been sent to our team.`,
          [{ text: 'OK', onPress: () => navigation.navigate('Support') }],
        );
      }}
    />
  );
}
