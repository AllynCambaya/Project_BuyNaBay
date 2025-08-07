// screens/AddProductScreen.js
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';

export default function AddProductScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleAddProduct = async () => {
    if (!name || !description) {
      Alert.alert("Incomplete", "Please fill in all fields.");
      return;
    }

    try {
      await addDoc(collection(db, 'products'), {
        name,
        description,
        sellerEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Product added!");
      setName('');
      setDescription('');
      navigation.goBack(); // Return to HomeScreen
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Add Product</Text>
      <TextInput
        placeholder="Product Name"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, padding: 10, marginBottom: 15 }}
      />
      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        style={{ borderWidth: 1, padding: 10, marginBottom: 20, textAlignVertical: 'top' }}
      />
      <Button title="Add Product" onPress={handleAddProduct} />
      <View style={{ marginTop: 15 }}>
        <Button title="Cancel" onPress={() => navigation.goBack()} color="gray" />
      </View>
    </View>
  );
}
