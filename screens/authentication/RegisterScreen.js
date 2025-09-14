// screens/RegisterScreen.js
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 📝 Register new user
  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Missing Info", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save display name
      await updateProfile(user, { displayName: name });

      // Send verification email
      await sendEmailVerification(user);

      Alert.alert(
        "Verify Your Email",
        "A verification link has been sent to your email. Please verify before logging in."
      );

      navigation.replace("Login");
    } catch (error) {
      Alert.alert("Registration Error", error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: "#0d0b2d" }}>
      <View>
        {/* Title */}
        <Text style={{ fontSize: 26, fontWeight: "bold", marginBottom: 10, textAlign: "center", color: "white" }}>
          Sign up
        </Text>
        <Text style={{ fontSize: 14, color: "#aaa", marginBottom: 20, textAlign: "center" }}>
          Create your account to continue shopping with BuyNaBay
        </Text>

        {/* Input Fields */}
        <TextInput
          placeholder="Full Name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          style={{
            borderWidth: 1,
            borderColor: "#333",
            borderRadius: 10,
            padding: 14,
            marginBottom: 15,
            backgroundColor: "#1c1a3a",
            color: "white",
          }}
        />
        <TextInput
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            borderWidth: 1,
            borderColor: "#333",
            borderRadius: 10,
            padding: 14,
            marginBottom: 15,
            backgroundColor: "#1c1a3a",
            color: "white",
          }}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: "#333",
            borderRadius: 10,
            padding: 14,
            marginBottom: 15,
            backgroundColor: "#1c1a3a",
            color: "white",
          }}
        />
        <TextInput
          placeholder="Confirm Password"
          placeholderTextColor="#999"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: "#333",
            borderRadius: 10,
            padding: 14,
            marginBottom: 15,
            backgroundColor: "#1c1a3a",
            color: "white",
          }}
        />

        {/* Register Button */}
        <TouchableOpacity
          onPress={handleRegister}
          style={{ backgroundColor: "#ffcc00", padding: 16, borderRadius: 10 }}
        >
          <Text
            style={{
              color: "#0d0b2d",
              textAlign: "center",
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            Register
          </Text>
        </TouchableOpacity>

        {/* Login Redirect */}
        <Text style={{ marginTop: 20, textAlign: "center", color: "#ccc" }}>
          Already have an account?{" "}
          <Text
            style={{ color: "#ffcc00", fontWeight: "700" }}
            onPress={() => navigation.navigate("Login")}
          >
            Log in
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}
