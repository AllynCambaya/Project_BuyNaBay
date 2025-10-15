import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Button, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function AddProductScreen({ navigation }) {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [condition, setCondition] = useState('New');
  const [images, setImages] = useState([]); // ✅ multiple images
  const [uploading, setUploading] = useState(false);

  // Pick multiple images
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "We need permission to access your gallery!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      allowsMultipleSelection: true, // ✅ multiple images
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(result.assets.map(asset => asset.uri));
    }
  };

  // Upload multiple images to Supabase
  const uploadImages = async (uris, productId) => {
    try {
      const urls = [];
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        const fileExt = uri.split('.').pop();
        const fileName = `${productId}_${i}.${fileExt}`;
        const filePath = `products/${fileName}`;

        let { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
        urls.push(data.publicUrl);
      }
      return urls;
    } catch (error) {
      console.error("⚠️ Image Upload Error:", error);
      throw error;
    }
  };

  // Add product
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

    setUploading(true);

    try {
      const email = user?.email ?? "test@example.com";

      // 1. Insert product first
      const { data: productData, error: insertError } = await supabase
        .from('products')
        .insert([
          {
            product_name: productName,
            description,
            quantity: parseInt(quantity, 10),
            price: parseFloat(price),
            category,
            condition,
            email: email,
          }
        ])
        .select();

      if (insertError) throw insertError;

      const productId = productData[0].id;

      // 2. Upload images if selected
      let imageUrls = [];
      if (images.length > 0) {
        imageUrls = await uploadImages(images, productId);

        // Save as JSON string
        const { error: updateError } = await supabase
          .from('products')
          .update({ product_image_url: JSON.stringify(imageUrls) })
          .eq('id', productId);

        if (updateError) throw updateError;
      }

      Alert.alert("Success", "Product added successfully!");
      
      // Reset fields
      setProductName('');
      setDescription('');
      setQuantity('1');
      setPrice('');
      setCategory('Electronics');
      setCondition('New');
      setImages([]);

      // Navigate back to Home (optional)
      navigation.goBack();

    } catch (error) {
      console.error("⚠️ Insert Exception:", error);
      Alert.alert("Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  // Quantity handlers
  const increaseQuantity = () => setQuantity(String(parseInt(quantity || '0', 10) + 1));
  const decreaseQuantity = () => { if (parseInt(quantity) > 1) setQuantity(String(parseInt(quantity) - 1)); };
  const handleQuantityChange = (value) => { if (/^\d*$/.test(value)) setQuantity(value); };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Add Product</Text>

      {/* Image Picker */}
      <TouchableOpacity onPress={pickImages} style={styles.imagePicker}>
        {images.length > 0 ? (
          <ScrollView horizontal>
            {images.map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.imagePreview} />
            ))}
          </ScrollView>
        ) : (
          <Text>Select Product Images</Text>
        )}
      </TouchableOpacity>

      <TextInput placeholder="Product Name" value={productName} onChangeText={setProductName} style={styles.input} />
      <TextInput placeholder="Description" value={description} onChangeText={setDescription} multiline style={[styles.input, { height: 100 }]} />

      <Text style={{ marginBottom: 5 }}>Quantity:</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
        <TouchableOpacity onPress={decreaseQuantity} style={styles.qtyBtn}><Text style={{ fontSize: 20 }}>-</Text></TouchableOpacity>
        <TextInput value={quantity} onChangeText={handleQuantityChange} keyboardType="numeric" style={styles.qtyInput} />
        <TouchableOpacity onPress={increaseQuantity} style={styles.qtyBtn}><Text style={{ fontSize: 20 }}>+</Text></TouchableOpacity>
      </View>

      <TextInput placeholder="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={styles.input} />

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

      <Button title={uploading ? "Uploading..." : "Add Product"} onPress={handleAddProduct} disabled={uploading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, padding: 20 },
  input: { borderWidth: 1, marginBottom: 15, padding: 10 },
  qtyBtn: { borderWidth: 1, borderRadius: 4, padding: 10, marginRight: 10, backgroundColor: '#eee' },
  qtyInput: { borderWidth: 1, textAlign: 'center', padding: 10, width: 80, marginRight: 10, backgroundColor: '#f9f9f9' },
  dropdown: { borderWidth: 1, marginBottom: 15 },
  imagePicker: { height: 150, borderWidth: 1, borderColor: '#aaa', marginBottom: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f1f1' },
  imagePreview: { width: 150, height: 150, resizeMode: 'contain', marginRight: 10 },
});
