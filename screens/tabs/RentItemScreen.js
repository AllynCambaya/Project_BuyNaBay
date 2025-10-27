import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const DURATION_OPTIONS = ['perday', 'per week', 'per month'];
const CATEGORY_OPTIONS = ['Electronics', 'Tools', 'Party&Events', 'Sports&outdoors', 'apparel', 'vehicles', 'other'];
const CONDITION_OPTIONS = ['new', 'used'];

export default function RentItemScreen({ navigation }) {
  const user = auth.currentUser;
  const [imageUri, setImageUri] = useState(null);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [rentalDuration, setRentalDuration] = useState(DURATION_OPTIONS[0]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [condition, setCondition] = useState(CONDITION_OPTIONS[0]);
  const [quantity, setQuantity] = useState('1');
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission required', 'We need access to your photos');

    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!res.canceled) {
      setImageUri(res.assets?.[0]?.uri || res.uri);
    }
  };

  const uploadImage = async (uri) => {
    try {
      const resp = await fetch(uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = uri.split('.').pop().split('?')[0];
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `rental-items/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('rental-images').upload(path, arrayBuffer, { contentType: resp.headers.get('content-type') || 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('rental-images').getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (err) {
      console.error('Upload error', err.message || err);
      return null;
    }
  };

  const submit = async () => {
    if (!itemName.trim() || !price.trim()) return Alert.alert('Missing', 'Please enter item name and price');
    setUploading(true);
    try {
      let publicUrl = null;
      if (imageUri) publicUrl = await uploadImage(imageUri);

      const payload = {
        owner_email: user?.email || null,
        rental_item_image: publicUrl,
        item_name: itemName.trim(),
        price: parseFloat(price) || 0,
        rental_duration: rentalDuration,
        description: description.trim() || null,
        category,
        condition,
        quantity: parseInt(quantity) || 1,
      };

      const { error } = await supabase.from('rental_items').insert([payload]);
      if (error) throw error;

      Alert.alert('Published', 'Your rental item has been published.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      console.error('Publish error', err.message || err);
      Alert.alert('Error', 'Failed to publish item');
    } finally {
      setUploading(false);
    }
  };

  // Simple inline selector modal helper
  const Selector = ({ label, value, options, onSelect }) => {
    const [open, setOpen] = useState(false);
    return (
      <View style={{ marginBottom: 10 }}>
        <Text style={{ marginBottom: 6 }}>{label}</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)}>
          <Text>{value}</Text>
          <Ionicons name="chevron-down" size={18} color="#666" />
        </TouchableOpacity>
        <Modal visible={open} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setOpen(false)}>
            <View style={styles.modalBox}>
              <ScrollView>
                {options.map((opt) => (
                  <TouchableOpacity key={opt} onPress={() => { onSelect(opt); setOpen(false); }} style={styles.option}>
                    <Text>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Rental Item</Text>
      </View>

      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.imagePreview} /> : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={36} color="#777" />
            <Text style={{ color: '#777', marginTop: 6 }}>Pick image</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Item name</Text>
      <TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder="e.g. DSLR camera" />

      <Text style={styles.label}>Price</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="e.g. 250" />

      <Selector label="Rental duration" value={rentalDuration} options={DURATION_OPTIONS} onSelect={setRentalDuration} />
      <Selector label="Category" value={category} options={CATEGORY_OPTIONS} onSelect={setCategory} />
      <Selector label="Condition" value={condition} options={CONDITION_OPTIONS} onSelect={setCondition} />

      <Text style={styles.label}>Quantity</Text>
      <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} multiline placeholder="Details, notes, rules..." />

      <TouchableOpacity style={[styles.publish, uploading && { opacity: 0.6 }]} onPress={submit} disabled={uploading}>
        <Text style={styles.publishText}>{uploading ? 'Publishing...' : 'Publish Rent Item'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', marginLeft: 12 },
  imagePicker: { alignItems: 'center', marginBottom: 12 },
  imagePreview: { width: 180, height: 140, borderRadius: 8 },
  imagePlaceholder: { width: 180, height: 140, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  label: { marginBottom: 6, marginTop: 8, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  selector: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '80%', maxHeight: '60%', backgroundColor: '#fff', borderRadius: 8, padding: 8 },
  option: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  publish: { marginTop: 16, backgroundColor: '#1976d2', padding: 14, borderRadius: 10, alignItems: 'center' },
  publishText: { color: '#fff', fontWeight: '700' },
});
