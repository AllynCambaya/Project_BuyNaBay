import { useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function AddProductScreen({ navigation }) {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');

  const handleAddProduct = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Not Logged In", "You must be logged in to add a product.");
      return;
    }

    if (!productName || !description) {
      Alert.alert("Missing Info", "Please enter both name and description.");
      return;
    }

    try {
      // Push to Supabase
      const { data, error } = await supabase.from('products').insert([
        {
          name: productName,
          description: description,
          email: user.email,
        }
      ]);

      if (error) throw error;

      Alert.alert("Success", "Product added successfully!");
      setProductName('');
      setDescription('');
      navigation.goBack();

    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Add Product</Text>
      <TextInput
        placeholder="Product Name"
        value={productName}
        onChangeText={setProductName}
        style={{ borderWidth: 1, marginBottom: 15, padding: 10 }}
      />
      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ borderWidth: 1, marginBottom: 15, padding: 10, height: 100 }}
      />
      <Button title="Add Product" onPress={handleAddProduct} />
    </View>
  );
}