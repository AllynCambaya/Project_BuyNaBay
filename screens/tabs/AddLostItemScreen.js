import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function AddLostItemScreen({ navigation }) {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [itemStatus, setItemStatus] = useState('lost'); // 'lost' or 'found'
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const user = auth.currentUser;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImages(result.assets.map(asset => asset.uri));
    }
  };

  const uploadImagesToSupabase = async (uris) => {
    const uploadedUrls = [];
    for (const uri of uris) {
      // Fetch the file and get an ArrayBuffer for Supabase upload
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = uri.split('.').pop().split('?')[0];
      const fileName = `${user.uid}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('lost-and-found-images')
        .upload(fileName, arrayBuffer, { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('lost-and-found-images').getPublicUrl(fileName);
      uploadedUrls.push(data?.publicUrl || null);
    }
    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!itemName || !location) {
      Alert.alert('Missing Info', 'Please provide the item name and location.');
      return;
    }

    setUploading(true);

    try {
      const { data: userData } = await supabase.from('users').select('name, profile_photo').eq('email', user.email).single();

      let imageUrls = null;
      if (images.length > 0) {
        imageUrls = await uploadImagesToSupabase(images);
      }

      const { error } = await supabase.from('lost_and_found_items').insert([
        {
          user_id: user.uid,
          user_email: user.email,
          user_name: userData?.name || 'Anonymous',
          user_avatar: userData?.profile_photo,
          item_name: itemName,
          description,
          location,
          item_status: itemStatus,
          // store the public URLs in the specified column
          lost_and_found_url: imageUrls,
        },
      ]);

      if (error) throw error;

      // Navigate back to Lost & Found so the new item is visible
      Alert.alert('Success', 'Your item has been listed.', [
        { text: 'OK', onPress: () => navigation.navigate('LostAndFound') },
      ]);
    } catch (error) {
      console.error('Error submitting item:', error);
      Alert.alert('Error', 'There was a problem submitting your item.');
    } finally {
      setUploading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Report Item</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>I have...</Text>
            <View style={styles.statusSelector}>
              <TouchableOpacity
                style={[styles.statusButton, itemStatus === 'lost' && styles.statusButtonActive]}
                onPress={() => setItemStatus('lost')}
              >
                <Text style={[styles.statusText, itemStatus === 'lost' && styles.statusTextActive]}>Lost an Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusButton, itemStatus === 'found' && styles.statusButtonActive]}
                onPress={() => setItemStatus('found')}
              >
                <Text style={[styles.statusText, itemStatus === 'found' && styles.statusTextActive]}>Found an Item</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Item Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Black Wallet, Blue Umbrella"
              placeholderTextColor={theme.textSecondary}
              value={itemName}
              onChangeText={setItemName}
            />

            <Text style={styles.label}>Last Seen/Found Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Library, 2nd floor"
              placeholderTextColor={theme.textSecondary}
              value={location}
              onChangeText={setLocation}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add details like color, brand, or distinguishing features."
              placeholderTextColor={theme.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.label}>Add Photos</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImages}>
              <Ionicons name="camera-outline" size={24} color={theme.accent} />
              <Text style={styles.imagePickerText}>Upload Images</Text>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewContainer}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setImages(images.filter((_, i) => i !== index))}
                  >
                    <Ionicons name="close-circle" size={24} color={theme.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const darkTheme = {
  background: '#0f0f2e',
  cardBackground: '#1e1e3f',
  text: '#fff',
  textSecondary: '#bbb',
  accent: '#FDAD00',
  error: '#d32f2f',
  borderColor: '#2a2a4a',
};

const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  accent: '#f39c12',
  error: '#e74c3c',
  borderColor: '#e0e0ea',
};

const styles = createStyles(lightTheme); // Base theme for styles

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContainer: {
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    backButton: {
      padding: 5,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
    },
    form: {
      padding: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: theme.text,
    },
    textArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    statusSelector: {
      flexDirection: 'row',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.accent,
      overflow: 'hidden',
    },
    statusButton: {
      flex: 1,
      padding: 14,
      alignItems: 'center',
    },
    statusButtonActive: {
      backgroundColor: theme.accent,
    },
    statusText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.accent,
    },
    statusTextActive: {
      color: '#fff',
    },
    imagePicker: {
      backgroundColor: theme.cardBackground,
      borderWidth: 2,
      borderColor: theme.borderColor,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePickerText: {
      marginTop: 8,
      fontSize: 16,
      color: theme.accent,
      fontWeight: '600',
    },
    imagePreviewContainer: {
      flexDirection: 'row',
      marginTop: 16,
    },
    imageWrapper: {
      position: 'relative',
      marginRight: 10,
    },
    previewImage: {
      width: 100,
      height: 100,
      borderRadius: 12,
    },
    removeImageButton: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: theme.background,
      borderRadius: 12,
    },
    submitButton: {
      marginTop: 32,
      backgroundColor: theme.accent,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      backgroundColor: theme.textSecondary,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
  });
}