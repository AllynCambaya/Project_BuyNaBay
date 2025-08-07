// screens/LoginScreen.js
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Button, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebase/firebaseConfig';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing Info", "Please fill in both email and password.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        Alert.alert("Email Not Verified", "Please verify your email before logging in.");
        return;
      }

      navigation.replace("Home"); // Replace to avoid back button going to login
    } catch (error) {
      Alert.alert("Login Error", error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Login</Text>
      
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, padding: 10, marginBottom: 15 }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />

      <Button title="Login" onPress={handleLogin} />

      {/* Forgot Password */}
      <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
        <Text style={{ color: '#1976d2', marginTop: 15, textAlign: 'center' }}>
          Forgot Password?
        </Text>
      </TouchableOpacity>

      {/* Register */}
      <Text style={{ marginTop: 25, textAlign: 'center' }}>
        Don't have an account?{' '}
        <Text onPress={() => navigation.navigate('Register')} style={{ color: '#1976d2' }}>
          Register
        </Text>
      </Text>
    </View>
  );
}
