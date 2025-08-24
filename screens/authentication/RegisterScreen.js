// screens/RegisterScreen.js
import * as ImagePicker from 'expo-image-picker';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [faceImage, setFaceImage] = useState(null);

  // 📸 Face scan with camera
  const handleFaceScan = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Denied", "Camera access is required for face scan.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setFaceImage(result.assets[0].uri);
    }
  };

  // 📤 Upload face image to Supabase Storage
  const uploadFaceToSupabase = async (userId) => {
    if (!faceImage) return null;

    const fileName = `faces/${userId}_${Date.now()}.jpg`;

    const response = await fetch(faceImage);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from("user-faces")
      .upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage.from("user-faces").getPublicUrl(fileName);
    return data.publicUrl;
  };

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

    if (!faceImage) {
      Alert.alert("Face Scan Required", "Please scan your face before registering.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });
      await sendEmailVerification(user);

      const faceUrl = await uploadFaceToSupabase(user.uid);

      const { error } = await supabase.from("users").insert([
        {
          id: user.uid,
          name: name,
          email: email,
          face_url: faceUrl,
          is_verified: false,
        },
      ]);

      if (error) {
        console.error("Supabase Insert Error:", error);
        Alert.alert("Error", "Account created but failed to save profile.");
      }

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
          style={{ borderWidth: 1, borderColor: "#333", borderRadius: 10, padding: 14, marginBottom: 15, backgroundColor: "#1c1a3a", color: "white" }}
        />
        <TextInput
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ borderWidth: 1, borderColor: "#333", borderRadius: 10, padding: 14, marginBottom: 15, backgroundColor: "#1c1a3a", color: "white" }}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#333", borderRadius: 10, padding: 14, marginBottom: 15, backgroundColor: "#1c1a3a", color: "white" }}
        />
        <TextInput
          placeholder="Confirm Password"
          placeholderTextColor="#999"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#333", borderRadius: 10, padding: 14, marginBottom: 15, backgroundColor: "#1c1a3a", color: "white" }}
        />

        {/* Face Scan Button */}
        <TouchableOpacity
          onPress={handleFaceScan}
          style={{ backgroundColor: "#ffcc00", padding: 14, borderRadius: 10, marginBottom: 15 }}
        >
          <Text style={{ color: "#0d0b2d", textAlign: "center", fontWeight: "700" }}>
            {faceImage ? "Retake Face Scan" : "Scan Face"}
          </Text>
        </TouchableOpacity>

        {/* Preview Face */}
        {faceImage && (
          <Image
            source={{ uri: faceImage }}
            style={{ width: 120, height: 120, borderRadius: 60, alignSelf: "center", marginBottom: 20 }}
          />
        )}

        {/* Register Button */}
        <TouchableOpacity
          onPress={handleRegister}
          style={{ backgroundColor: "#ffcc00", padding: 16, borderRadius: 10 }}
        >
          <Text style={{ color: "#0d0b2d", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
            Register
          </Text>
        </TouchableOpacity>

        {/* Login Redirect */}
        <Text style={{ marginTop: 20, textAlign: "center", color: "#ccc" }}>
          Already have an account?{" "}
          <Text style={{ color: "#ffcc00", fontWeight: "700" }} onPress={() => navigation.navigate('Login')}>
            Log in
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}
