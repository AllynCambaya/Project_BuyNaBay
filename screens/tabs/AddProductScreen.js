// screens/AddProductScreen.js
import { FontAwesome as Icon } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [uploadProgress, setUploadProgress] = useState(0);

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

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

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

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
        
        setUploadProgress(((i + 1) / uris.length) * 100);
      }
      return urls;
    } catch (error) {
      console.error("⚠️ Image Upload Error:", error);
      throw error;
    }
  };

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

    Keyboard.dismiss();
    setUploading(true);
    setUploadProgress(0);

    try {
      const email = user?.email ?? "test@example.com";

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

      let imageUrls = [];
      if (images.length > 0) {
        imageUrls = await uploadImages(images, productId);

        const { error: updateError } = await supabase
          .from('products')
          .update({ product_image_url: JSON.stringify(imageUrls) })
          .eq('id', productId);

        if (updateError) throw updateError;
      }

      Alert.alert("Success", "Product added successfully! 🎉", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
      
      setProductName('');
      setDescription('');
      setQuantity('1');
      setPrice('');
      setCategory('Electronics');
      setCondition('New');
      setImages([]);

    } catch (error) {
      console.error("⚠️ Insert Exception:", error);
      Alert.alert("Error", error.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const increaseQuantity = () => setQuantity(String(parseInt(quantity || '0', 10) + 1));
  const decreaseQuantity = () => { 
    if (parseInt(quantity) > 1) setQuantity(String(parseInt(quantity) - 1)); 
  };
  const handleQuantityChange = (value) => { 
    if (/^\d*$/.test(value)) setQuantity(value); 
  };

  const formatPrice = (value) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return numericValue;
  };

  const handlePriceChange = (value) => {
    setPrice(formatPrice(value));
  };

  const categories = [
    { label: 'Electronics', value: 'Electronics', icon: 'mobile' },
    { label: 'Books', value: 'Books', icon: 'book' },
    { label: 'Clothes', value: 'Clothes', icon: 'shopping-bag' },
    { label: 'Food', value: 'Food', icon: 'cutlery' },
    { label: 'Beauty & Personal Care', value: 'Beauty and Personal Care', icon: 'heart' },
    { label: 'Toys & Games', value: 'Toys and Games', icon: 'gamepad' },
    { label: 'Automotive', value: 'Automotive', icon: 'car' },
    { label: 'Sports', value: 'Sports', icon: 'futbol-o' },
    { label: 'Others', value: 'Others', icon: 'ellipsis-h' },
  ];

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerContainer}>
              <View style={styles.backgroundGradient} />

              <View style={styles.headerContent}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.iconCircle}>
                    <Icon name="plus" size={24} color="#fff" />
                  </View>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>List Your Product</Text>
                    <Text style={styles.headerSubtitle}>
                      Share what you're selling with the community
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="camera" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Product Photos</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>
                      {images.length > 0 ? `${images.length} photo${images.length > 1 ? 's' : ''}` : 'Optional'}
                    </Text>
                  </View>
                </View>

                {images.length > 0 ? (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.imageScrollContent}
                    style={styles.imageScrollContainer}
                  >
                    {images.map((uri, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image source={{ uri }} style={styles.imagePreview} />
                        <TouchableOpacity
                          onPress={() => removeImage(index)}
                          style={styles.removeImageButton}
                          activeOpacity={0.7}
                        >
                          <Icon name="times" size={14} color="#fff" />
                        </TouchableOpacity>
                        {index === 0 && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>Cover</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity 
                      onPress={pickImages}
                      style={styles.addMoreImagesButton}
                      activeOpacity={0.7}
                    >
                      <Icon name="plus" size={28} color={theme.textSecondary} />
                      <Text style={styles.addMoreText}>Add More</Text>
                    </TouchableOpacity>
                  </ScrollView>
                ) : (
                  <TouchableOpacity 
                    onPress={pickImages} 
                    style={styles.imagePicker}
                    activeOpacity={0.7}
                  >
                    <View style={styles.emptyImagePicker}>
                      <View style={styles.cameraIconContainer}>
                        <Icon name="camera" size={36} color={theme.accent} />
                      </View>
                      <Text style={styles.imagePickerText}>Add Photos</Text>
                      <Text style={styles.imagePickerSubtext}>
                        Upload images to showcase your product
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="info-circle" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Basic Information</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Product Name <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={[styles.inputWrapper, productName && styles.inputWrapperFocused]}>
                    <Icon name="tag" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      placeholder="e.g. iPhone 13 Pro Max"
                      placeholderTextColor={theme.textSecondary}
                      value={productName}
                      onChangeText={setProductName}
                      style={styles.input}
                      maxLength={100}
                    />
                  </View>
                  {productName && (
                    <Text style={styles.characterCount}>{productName.length}/100</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Description <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={[styles.inputWrapper, styles.textAreaWrapper, description && styles.inputWrapperFocused]}>
                    <TextInput
                      placeholder="Describe your product in detail..."
                      placeholderTextColor={theme.textSecondary}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      style={[styles.input, styles.textArea]}
                      maxLength={500}
                    />
                  </View>
                  {description && (
                    <Text style={styles.characterCount}>{description.length}/500</Text>
                  )}
                </View>

                <View style={styles.rowGroup}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>
                      Price (₱) <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={[styles.inputWrapper, price && styles.inputWrapperFocused]}>
                      <Icon name="money" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        placeholder="0.00"
                        placeholderTextColor={theme.textSecondary}
                        value={price}
                        onChangeText={handlePriceChange}
                        keyboardType="decimal-pad"
                        style={[styles.input, styles.priceInput]}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>
                      Quantity <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity 
                        onPress={decreaseQuantity} 
                        style={[styles.quantityButton, parseInt(quantity) <= 1 && styles.quantityButtonDisabled]}
                        activeOpacity={0.7}
                        disabled={parseInt(quantity) <= 1}
                      >
                        <Icon name="minus" size={14} color={parseInt(quantity) <= 1 ? theme.textSecondary : theme.text} />
                      </TouchableOpacity>
                      <TextInput
                        value={quantity}
                        onChangeText={handleQuantityChange}
                        keyboardType="numeric"
                        style={styles.quantityInput}
                        textAlign="center"
                        maxLength={4}
                      />
                      <TouchableOpacity 
                        onPress={increaseQuantity} 
                        style={styles.quantityButton}
                        activeOpacity={0.7}
                      >
                        <Icon name="plus" size={14} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="list-ul" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Category & Condition</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Category <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.pickerContainer}>
                    <Icon name="tag" size={16} color={theme.textSecondary} style={styles.pickerIcon} />
                    <Picker
                      selectedValue={category}
                      onValueChange={(itemValue) => setCategory(itemValue)}
                      style={styles.picker}
                      dropdownIconColor={theme.text}
                    >
                      {categories.map((cat) => (
                        <Picker.Item key={cat.value} label={cat.label} value={cat.value} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Condition <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.conditionContainer}>
                    <TouchableOpacity
                      onPress={() => setCondition('New')}
                      style={[
                        styles.conditionButton,
                        condition === 'New' && styles.conditionButtonActive
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.conditionIconCircle, condition === 'New' && styles.conditionIconCircleActive]}>
                        <Icon 
                          name="star" 
                          size={16} 
                          color={condition === 'New' ? '#fff' : theme.accent} 
                        />
                      </View>
                      <View style={styles.conditionTextContainer}>
                        <Text style={[
                          styles.conditionText,
                          condition === 'New' && styles.conditionTextActive
                        ]}>
                          Brand New
                        </Text>
                        <Text style={[
                          styles.conditionSubtext,
                          condition === 'New' && styles.conditionSubtextActive
                        ]}>
                          Unused item
                        </Text>
                      </View>
                      {condition === 'New' && (
                        <Icon name="check-circle" size={20} color="#fff" style={styles.checkIcon} />
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => setCondition('Pre-Loved')}
                      style={[
                        styles.conditionButton,
                        condition === 'Pre-Loved' && styles.conditionButtonActive
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.conditionIconCircle, condition === 'Pre-Loved' && styles.conditionIconCircleActive]}>
                        <Icon 
                          name="heart" 
                          size={16} 
                          color={condition === 'Pre-Loved' ? '#fff' : theme.accent} 
                        />
                      </View>
                      <View style={styles.conditionTextContainer}>
                        <Text style={[
                          styles.conditionText,
                          condition === 'Pre-Loved' && styles.conditionTextActive
                        ]}>
                          Pre-Loved
                        </Text>
                        <Text style={[
                          styles.conditionSubtext,
                          condition === 'Pre-Loved' && styles.conditionSubtextActive
                        ]}>
                          Gently used
                        </Text>
                      </View>
                      {condition === 'Pre-Loved' && (
                        <Icon name="check-circle" size={20} color="#fff" style={styles.checkIcon} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {uploading && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {uploadProgress < 100 ? `Uploading... ${Math.round(uploadProgress)}%` : 'Finalizing...'}
                  </Text>
                </View>
              )}

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
                    <Text style={[styles.submitButtonText, { marginLeft: 12 }]}>
                      Publishing...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.submitButtonContent}>
                    <Icon name="check-circle" size={22} color="#fff" />
                    <Text style={styles.submitButtonText}>Publish Product</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.footerNote}>
                By publishing, you agree to BuyNaBay's terms of service
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#d1d5db',
  cardBackground: '#1a1a3e',
  cardBackgroundAlt: '#252550',
  accent: '#FDAD00',
  accentDark: '#e09b00',
  accentLight: '#ffc233',
  error: '#ef4444',
  success: '#10b981',
  shadowColor: '#000',
  borderColor: '#2d2d5a',
  inputBackground: '#1a1a3e',
  buttonDisabled: '#4b5563',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const lightTheme = {
  background: '#f8fafc',
  gradientBackground: '#e8ecf1',
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#475569',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f1f5f9',
  accent: '#f39c12',
  accentDark: '#d68910',
  accentLight: '#f5b041',
  error: '#ef4444',
  success: '#10b981',
  shadowColor: '#000',
  borderColor: '#e2e8f0',
  inputBackground: '#ffffff',
  buttonDisabled: '#cbd5e1',
  overlay: 'rgba(0, 0, 0, 0.3)',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 32,
    marginBottom: 8,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 180 : 200,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 0,
  },
  headerContent: {
    zIndex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 48,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    color: theme.text,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  sectionBadge: {
    backgroundColor: theme.cardBackgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  imagePicker: {
    minHeight: 200,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderRadius: 20,
    borderStyle: 'dashed',
    backgroundColor: theme.cardBackground,
    overflow: 'hidden',
  },
  emptyImagePicker: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  cameraIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  imagePickerText: {
    fontSize: 17,
    color: theme.text,
    marginTop: 8,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  imagePickerSubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  imageScrollContainer: {
    marginHorizontal: -20,
  },
  imageScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 160,
    height: 160,
    borderRadius: 16,
    backgroundColor: theme.cardBackgroundAlt,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: theme.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  primaryBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  addMoreImagesButton: {
    width: 160,
    height: 160,
    borderRadius: 16,
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
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 10,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  requiredStar: {
    color: theme.error,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:theme.inputBackground,
    borderWidth: 1.5,
    borderColor: theme.borderColor,
    borderRadius: 14,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  inputWrapperFocused: {
    borderColor: theme.accent,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputIcon: {
    marginRight: 12,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    paddingVertical: 14,
    fontFamily: 'Poppins-Regular',
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  characterCount: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'right',
    marginTop: 6,
    fontFamily: 'Poppins-Regular',
  },
  rowGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  priceInput: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.cardBackgroundAlt,
    borderWidth: 1.5,
    borderColor: theme.borderColor,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityInput: {
    backgroundColor: theme.inputBackground,
    borderWidth: 1.5,
    borderColor: theme.borderColor,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    minWidth: 70,
    fontFamily: 'Poppins-Bold',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderWidth: 1.5,
    borderColor: theme.borderColor,
    borderRadius: 14,
    paddingLeft: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  pickerIcon: {
    marginRight: 12,
    opacity: 0.6,
  },
  picker: {
    flex: 1,
    color: theme.text,
    fontFamily: 'Poppins-Regular',
    ...Platform.select({
      android: {
        backgroundColor: 'transparent',
      },
    }),
  },
  conditionContainer: {
    gap: 12,
  },
  conditionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.cardBackgroundAlt,
    borderWidth: 1.5,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
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
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  conditionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conditionIconCircleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  conditionTextContainer: {
    flex: 1,
  },
  conditionText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
    fontFamily: 'Poppins-Bold',
  },
  conditionTextActive: {
    color: '#fff',
  },
  conditionSubtext: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'Poppins-Regular',
  },
  conditionSubtextActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  checkIcon: {
    marginLeft: 8,
  },
  progressContainer: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.cardBackgroundAlt,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  submitButton: {
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
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
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    fontFamily: 'Poppins-Regular',
  },
});