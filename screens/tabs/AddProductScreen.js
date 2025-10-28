// screens/AddProductScreen.js
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function AddProductScreen({ navigation }) {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [condition, setCondition] = useState('New');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

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
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(result.assets.map(asset => asset.uri));
    }
  };

  // Remove image from selection
  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
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

      // Navigate back to Home
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
  const decreaseQuantity = () => { 
    if (parseInt(quantity) > 1) setQuantity(String(parseInt(quantity) - 1)); 
  };
  const handleQuantityChange = (value) => { 
    if (/^\d*$/.test(value)) setQuantity(value); 
  };

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.headerContainer}>
            {/* Background gradient effect */}
            <View style={styles.backgroundGradient} />

            {/* Header Title */}
            <View style={styles.headerTitleContainer}>
              <Icon name="plus-circle" size={28} color={theme.accent} />
              <Text style={styles.headerTitle}>Add New Product</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Fill in the details to list your product
            </Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Image Selection Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Icon name="image" size={20} color={theme.text} />
                <Text style={styles.sectionTitle}>Product Images</Text>
              </View>

              <TouchableOpacity 
                onPress={pickImages} 
                style={styles.imagePicker}
                activeOpacity={0.85}
              >
                {images.length > 0 ? (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.imageScrollContent}
                  >
                    {images.map((uri, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image source={{ uri }} style={styles.imagePreview} />
                        <TouchableOpacity
                          onPress={() => removeImage(index)}
                          style={styles.removeImageButton}
                          activeOpacity={0.85}
                        >
                          <Icon name="times-circle" size={24} color={theme.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity 
                      onPress={pickImages}
                      style={styles.addMoreImagesButton}
                      activeOpacity={0.85}
                    >
                      <Icon name="plus" size={32} color={theme.textSecondary} />
                      <Text style={styles.addMoreText}>Add More</Text>
                    </TouchableOpacity>
                  </ScrollView>
                ) : (
                  <View style={styles.emptyImagePicker}>
                    <Icon name="camera" size={48} color={theme.textSecondary} />
                    <Text style={styles.imagePickerText}>Tap to select images</Text>
                    <Text style={styles.imagePickerSubtext}>You can select multiple images</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Product Information */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Icon name="info-circle" size={20} color={theme.text} />
                <Text style={styles.sectionTitle}>Product Information</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name</Text>
                <TextInput
                  placeholder="Enter product name"
                  placeholderTextColor={theme.textSecondary}
                  value={productName}
                  onChangeText={setProductName}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  placeholder="Describe your product"
                  placeholderTextColor={theme.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={[styles.input, styles.textArea]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <View style={styles.quantityContainer}>
                  <TouchableOpacity 
                    onPress={decreaseQuantity} 
                    style={styles.quantityButton}
                    activeOpacity={0.85}
                  >
                    <Icon name="minus" size={18} color={theme.text} />
                  </TouchableOpacity>
                  <TextInput
                    value={quantity}
                    onChangeText={handleQuantityChange}
                    keyboardType="numeric"
                    style={styles.quantityInput}
                    textAlign="center"
                  />
                  <TouchableOpacity 
                    onPress={increaseQuantity} 
                    style={styles.quantityButton}
                    activeOpacity={0.85}
                  >
                    <Icon name="plus" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price (₱)</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Product Details */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Icon name="tags" size={20} color={theme.text} />
                <Text style={styles.sectionTitle}>Product Details</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={category}
                    onValueChange={(itemValue) => setCategory(itemValue)}
                    style={styles.picker}
                    dropdownIconColor={theme.text}
                  >
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
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Condition</Text>
                <View style={styles.conditionContainer}>
                  <TouchableOpacity
                    onPress={() => setCondition('New')}
                    style={[
                      styles.conditionButton,
                      condition === 'New' && styles.conditionButtonActive
                    ]}
                    activeOpacity={0.85}
                  >
                    <Icon 
                      name="star" 
                      size={18} 
                      color={condition === 'New' ? '#fff' : theme.text} 
                    />
                    <Text style={[
                      styles.conditionText,
                      condition === 'New' && styles.conditionTextActive
                    ]}>
                      New
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCondition('Pre-Loved')}
                    style={[
                      styles.conditionButton,
                      condition === 'Pre-Loved' && styles.conditionButtonActive
                    ]}
                    activeOpacity={0.85}
                  >
                    <Icon 
                      name="heart" 
                      size={18} 
                      color={condition === 'Pre-Loved' ? '#fff' : theme.text} 
                    />
                    <Text style={[
                      styles.conditionText,
                      condition === 'Pre-Loved' && styles.conditionTextActive
                    ]}>
                      Pre-Loved
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                uploading && styles.submitButtonDisabled
              ]}
              onPress={handleAddProduct}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.submitButtonText, { marginLeft: 10 }]}>
                    Adding Product...
                  </Text>
                </View>
              ) : (
                <>
                  <Icon name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Add Product</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// Dark theme colors (matching CartScreen)
const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  inputBackground: '#1e1e3f',
  buttonDisabled: '#555',
};

// Light theme colors (matching CartScreen)
const lightTheme = {
  background: '#f5f7fa',
  gradientBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  inputBackground: '#ffffff',
  buttonDisabled: '#ccc',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 200 : 220,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 0,
  },
  headerContainer: {
    paddingHorizontal: Math.max(width * 0.05, 20),
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 30,
    zIndex: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 64,
  },
  headerTitle: {
    fontSize: Math.min(width * 0.07, 28),
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    fontFamily: Platform.select({
      ios: 'Poppins-ExtraBold',
      android: 'Poppins-Black',
      default: 'Poppins-ExtraBold',
    }),
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  formContainer: {
    paddingHorizontal: Math.max(width * 0.05, 20),
    marginTop: 10,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    marginLeft: 10,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  imagePicker: {
    minHeight: 180,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderRadius: 16,
    backgroundColor: theme.cardBackground,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyImagePicker: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  imagePickerText: {
    fontSize: 16,
    color: theme.text,
    marginTop: 12,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  imagePickerSubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  imageScrollContent: {
    padding: 12,
    alignItems: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 140,
    height: 140,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: theme.cardBackgroundAlt,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  addMoreImagesButton: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.borderColor,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundAlt,
  },
  addMoreText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 8,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: theme.cardBackground,
    borderWidth: 2,
    borderColor: theme.borderColor,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quantityInput: {
    backgroundColor: theme.inputBackground,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderRadius: 12,
    marginHorizontal: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    minWidth: 80,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  pickerContainer: {
    backgroundColor: theme.inputBackground,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  picker: {
    color: theme.text,
    ...Platform.select({
      android: {
        backgroundColor: 'transparent',
      },
    }),
  },
  conditionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  conditionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.cardBackground,
    borderWidth: 2,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  conditionButtonActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  conditionText: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginLeft: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  conditionTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: theme.accent,
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  submitButtonDisabled: {
    backgroundColor: theme.buttonDisabled,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});