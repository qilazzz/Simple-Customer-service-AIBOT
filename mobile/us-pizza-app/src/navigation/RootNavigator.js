import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import OutletsScreen from '../screens/OutletsScreen';
import SupportScreen from '../screens/SupportScreen';
import BotChatScreen from '../screens/BotChatScreen';
import LiveSupportScreen from '../screens/LiveSupportScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeHeaderAuth from '../components/HomeHeaderAuth';

const Stack = createNativeStackNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: '#c8102e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={headerOptions}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: 'US Pizza',
            headerRight: () => <HomeHeaderAuth navigation={navigation} />,
            headerRightContainerStyle: { paddingRight: 12 },
          })}
        />
        <Stack.Screen
          name="Outlets"
          component={OutletsScreen}
          options={{
            title: 'Find Outlets',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="Support"
          component={SupportScreen}
          options={{
            title: 'Customer Service',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="BotChat"
          component={BotChatScreen}
          options={({ route }) => ({
            title: route.params?.initialOption || 'Support Assistant',
            headerBackTitle: 'Menu',
          })}
        />
        <Stack.Screen
          name="LiveSupport"
          component={LiveSupportScreen}
          options={{
            title: 'Talk to Support',
            headerBackTitle: 'Menu',
          }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            title: 'Log In',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{
            title: 'Register',
            headerBackTitle: 'Back',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
