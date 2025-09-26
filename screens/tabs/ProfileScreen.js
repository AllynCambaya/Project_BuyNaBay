import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentId, setStudentId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // User's products and refreshing state
  const [myProducts, setMyProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    if (user?.uid) {
      const { data, error } = await supabase
        .from('users')
        .select('name, phone_number, student_id')
        .eq('id', user.uid)
        .single();

      if (error) console.log('Fetch error:', error.message);

      if (data) {
        if (data.name) setName(data.name);
        if (data.phone_number) setPhoneNumber(data.phone_number);
        if (data.student_id) setStudentId(data.student_id);
      }
    }
  };

  const fetchMyProducts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('email', user.email)
      .order('id', { ascending: false });

    if (error) console.log('Fetch products error:', error.message);
    else setMyProducts(data);
  };

  useEffect(() => {
    fetchProfile();
    fetchMyProducts();
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyProducts();
    setRefreshing(false);
  }, []);

  // Save changes to Supabase
  const handleSave = async () => {
    setLoading(true);
    const updates = { phone_number: phoneNumber, student_id: studentId };
    const { error } = await supabase.from('users').update(updates).eq('id', user.uid);
    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to update profile.');
      console.log('Update error:', error.message);
    } else {
      Alert.alert('Success', 'Profile updated successfully.');
      setEditMode(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.label}>Name:</Text>
      <Text style={styles.value}>{name || 'N/A'}</Text>

      <Text style={styles.label}>Email:</Text>
      <Text style={styles.value}>{email || 'N/A'}</Text>

      <Text style={styles.label}>Phone Number:</Text>
      {editMode ? (
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
        />
      ) : (
        <Text style={styles.value}>{phoneNumber || 'N/A'}</Text>
      )}

      <Text style={styles.label}>Student ID:</Text>
      {editMode ? (
        <TextInput
          style={styles.input}
          value={studentId}
          onChangeText={setStudentId}
          placeholder="Enter student ID"
        />
      ) : (
        <Text style={styles.value}>{studentId || 'N/A'}</Text>
      )}

      {editMode ? (
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => setEditMode(true)}
        >
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>

      {/* User's Products List with pull-to-refresh */}
      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>My Products</Text>
      <FlatList
        data={myProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <Text style={styles.productName}>{item.product_name}</Text>
            <Text>{item.description}</Text>
            <Text>Qty: {item.quantity} | ₱{item.price}</Text>
            <Text>Category: {item.category} | Condition: {item.condition}</Text>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text>No products added yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 18, color: '#555', marginTop: 10 },
  value: { fontSize: 20, color: '#222', fontWeight: '600', marginBottom: 10 },
  input: {
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: 220,
    backgroundColor: '#f9f9f9',
  },
  button: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center' },
  editButton: { backgroundColor: '#1976d2' },
  saveButton: { backgroundColor: '#43a047' },
  logoutButton: { backgroundColor: '#d32f2f' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  productCard: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 10, backgroundColor: '#f9f9f9' },
  productName: { fontSize: 18, fontWeight: 'bold' },
});
