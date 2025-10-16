import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function NotVerifiedScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>You are not Verified</Text>
      <Text style={styles.message}>
        Your account must be verified to use this feature. Please complete the verification process first.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('GetVerified')}
      >
        <Text style={styles.buttonText}>Get Verified</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#2e7d32' },
  message: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#2e7d32', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
});