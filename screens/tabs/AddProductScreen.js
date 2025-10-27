import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function AddProductScreen({ navigation }) {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [condition, setCondition] = useState('New');

  const handleAddProduct = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Not Logged In", "You must be logged in to add a product.");
      return;
    }

    if (!productName || !description || !quantity || !price || !category || !condition) {
      Alert.alert("Missing Info", "Please fill out all fields.");
      return;
    }

    try {
      const { error } = await supabase.from('products').insert([
        {
          product_name: productName,
          description,
          quantity: parseInt(quantity, 10),
          price: parseFloat(price),
          category,
          condition,
          email: user.email,
        }
      ]);

      if (error) throw error;

      Alert.alert("Success", "Product added successfully!");
      setProductName('');
      setDescription('');
      setQuantity('1');
      setPrice('');
      setCategory('Electronics');
      setCondition('New');
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const increaseQuantity = () => {
    const current = parseInt(quantity || '0', 10);
    setQuantity(String(current + 1));
  };

  const decreaseQuantity = () => {
    const current = parseInt(quantity || '0', 10);
    if (current > 1) setQuantity(String(current - 1));
  };

  const handleQuantityChange = (value) => {
    if (/^\d*$/.test(value)) {
      setQuantity(value);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Add Product</Text>

      <TextInput
        placeholder="Product Name"
        value={productName}
        onChangeText={setProductName}
        style={styles.input}
      />

      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        style={[styles.input, { height: 100 }]}
      />

      <Text style={{ marginBottom: 5 }}>Quantity:</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
        <TouchableOpacity onPress={decreaseQuantity} style={styles.qtyBtn}>
          <Text style={{ fontSize: 20 }}>-</Text>
        </TouchableOpacity>

        <TextInput
          value={quantity}
          onChangeText={handleQuantityChange}
          keyboardType="numeric"
          style={styles.qtyInput}
        />

        <TouchableOpacity onPress={increaseQuantity} style={styles.qtyBtn}>
          <Text style={{ fontSize: 20 }}>+</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Price"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={{ marginBottom: 5 }}>Category:</Text>
      <View style={styles.dropdown}>
        <Picker selectedValue={category} onValueChange={(itemValue) => setCategory(itemValue)}>
          <Picker.Item label="Electronics" value="Electronics" />
          <Picker.Item label="Books" value="Books" />
          <Picker.Item label="Clothes" value="Clothes" />
          <Picker.Item label="Food" value="Food" />
          <Picker.Item label="Beauty and Personal Care" value="Beauty and Personal Care" />
          <Picker.Item label="Toys and Games" value="Toys and Games" />
          <Picker.Item label="Automotive" value="Automotive" />
          <Picker.Item label="Sports" value="Sports" />
          <Picker.Item label="Others" value="Others" />
        </Picker>
      </View>

      <Text style={{ marginBottom: 5 }}>Condition:</Text>
      <View style={styles.dropdown}>
        <Picker selectedValue={condition} onValueChange={(itemValue) => setCondition(itemValue)}>
          <Picker.Item label="New" value="New" />
          <Picker.Item label="Pre-Loved" value="Pre-Loved" />
        </Picker>
      </View>

      <Button title="Add Product" onPress={handleAddProduct} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    marginBottom: 15,
    padding: 10,
  },
  qtyBtn: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  qtyInput: {
    borderWidth: 1,
    textAlign: 'center',
    padding: 10,
    width: 80,
    marginRight: 10,
    backgroundColor: '#f9f9f9',
  },
  dropdown: {
    borderWidth: 1,
    marginBottom: 15,
  },
});
