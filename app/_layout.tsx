// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Handle user auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user:any) => {
      console.log('User state changed:', user,typeof user);
      setUser(user);
      if (initializing) setInitializing(false);
    });

    // Unsubscribe on cleanup
    return unsubscribe;
  }, []);

  // Show loading indicator while initializing
  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#25292e' }}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#25292e' },
      }}
    >
      {/* Define which screens to show based on authentication state */}
      {user ? (
        // User is signed in
        <>
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
            redirect={!user}
          />
        </>
      ) : (
        // User is not signed in
        <>
        <Stack.Screen
          name="login"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="chat"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
          <Stack.Screen
            name="signup"
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack>
  );
}