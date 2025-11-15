// screens/EditProductScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

const categories = [
  { label: 'Electronics', value: 'Electronics', icon: 'phone-portrait' },
  { label: 'Books', value: 'Books', icon: 'book' },
  { label: 'Clothes', value: 'Clothes', icon: 'shirt' },
  { label: 'Food', value: 'Food', icon: 'fast-food' },
  { label: 'Beauty & Personal Care', value: 'Beauty and Personal Care', icon: 'sparkles' },
  { label: 'Toys & Games', value: 'Toys and Games', icon: 'game-controller' },
  { label: 'Automotive', value: 'Automotive', icon: 'car' },
  { label: 'Sports', value: 'Sports', icon: 'football' },
  { label: 'Others', value: 'Others', icon: 'ellipsis-horizontal' },
];

export default function EditProductScreen({ navigation, route }) {
  const { product } = route.params;

  const [productName, setProductName] = useState(product.product_name || '');
  const [description, setDescription] = useState(product.description || '');
  const [quantity, setQuantity] = useState(product.quantity?.toString() || '1');
  const [price, setPrice] = useState(product.price?.toString() || '');
  const [category, setCategory] = useState(product.category || 'Electronics');
  const [condition, setCondition] = useState(product.condition || 'Brand New');
  const [conditionOptions, setConditionOptions] = useState(['Brand New', 'Preloved']);
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const imageUrls = product.product_image_url
      ? Array.isArray(product.product_image_url)
        ? product.product_image_url
        : (() => {
            try {
              return JSON.parse(product.product_image_url);
            } catch {
              return [product.product_image_url];
            }
          })()
      : [];
    setExistingImages(imageUrls);
  }, [product]);

  useEffect(() => {
    switch (category) {
      case 'Food':
        setConditionOptions(['Fresh', 'Packaged']);
        if (!['Fresh', 'Packaged'].includes(condition)) setCondition('Fresh');
        break;
      case 'Clothes':
        setConditionOptions(['Brand New', 'Preloved']);
        if (!['Brand New', 'Preloved'].includes(condition)) setCondition('Brand New');
        break;
      case 'Books':
        setConditionOptions(['New', 'Used']);
        if (!['New', 'Used'].includes(condition)) setCondition('New');
        break;
      default:
        setConditionOptions(['Brand New', 'Preloved']);
        if (!['Brand New', 'Preloved'].includes(condition)) setCondition('Brand New');
    }
  }, [category]);

  const pickImages = async () => {
    const totalImages = existingImages.length + newImages.length;
    if (totalImages >= 10) {
      Alert.alert("Limit Reached", "You can only have up to 10 images per product.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "We need permission to access your gallery!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const imagesToAdd = result.assets.map(asset => asset.uri);
      setNewImages([...newImages, ...imagesToAdd]);
    }
  };

  const removeExistingImage = (index) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const uploadImages = async (uris, productId) => {
    try {
      const urls = [];
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        const fileExt = uri.split('.').pop().split('?')[0];
        const fileName = `${productId}_${i}_${Date.now()}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
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
      throw error;
    }
  };

  const handleUpdateProduct = async () => {
    if (!productName || !description || !quantity || !price || !category || !condition) {
      Alert.alert("Missing Info", "Please fill out all required fields.");
      return;
    }

    Keyboard.dismiss();
    setUploading(true);
    setUploadProgress(0);

    try {
      let uploadedImageUrls = [];
      if (newImages.length > 0) {
        uploadedImageUrls = await uploadImages(newImages, product.id);
      }

      const allImageUrls = [...existingImages, ...uploadedImageUrls];

      const { error: updateError } = await supabase
        .from('products')
        .update({
          product_name: productName,
          description,
          quantity: parseInt(quantity, 10),
          price: parseFloat(price),
          category,
          condition,
          product_image_url: JSON.stringify(allImageUrls),
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      setUploadProgress(100);

      Alert.alert("Success", "Product updated successfully! 🎉", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update product. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const increaseQuantity = () => setQuantity(String(parseInt(quantity || '0', 10) + 1));
  const decreaseQuantity = () => { 
    if (parseInt(quantity) > 1) setQuantity(String(parseInt(quantity) - 1)); 
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

  const getConditionSubtext = (condition, selectedCategory) => {
    if (selectedCategory === 'Food') {
      if (condition === 'Fresh') return 'Organic/Homemade';
      if (condition === 'Packaged') return 'Sealed & unopened';
    }
    if (condition === 'New' || condition === 'Brand New') return 'Unused item';
    if (condition === 'Used') return 'Previously owned';
    if (condition === 'Preloved') return 'Gently used';
    return 'Good condition';
  };

  const getCategoryIcon = (categoryValue) => {
    const cat = categories.find(c => c.value === categoryValue);
    return cat?.icon || 'pricetag';
  };

  const getConditionIcon = (cond) => {
    if (cond.includes('New') || cond === 'Fresh') return 'sparkles';
    if (cond === 'Packaged') return 'cube';
    return 'heart';
  };

  const CategorySelector = () => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      setShowCategoryModal(true);
    };

    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
          Category <Text style={styles.requiredStar}>*</Text>
        </Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity style={styles.selector} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.selectorContent}>
              <View style={styles.selectorIconCircle}>
                <Ionicons name={getCategoryIcon(category)} size={18} color={theme.accent} />
              </View>
              <Text style={[styles.selectorText, { fontFamily: fontFamily.medium }]}>
                {categories.find(c => c.value === category)?.label || category}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
        
        <Modal visible={showCategoryModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCategoryModal(false)}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontFamily: fontFamily.bold }]}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsScroll}>
                {categories.map((cat) => (
                  <TouchableOpacity 
                    key={cat.value} 
                    onPress={() => { setCategory(cat.value); setShowCategoryModal(false); }} 
                    style={[styles.option, category === cat.value && styles.optionSelected]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      <View style={[styles.optionIconCircle, category === cat.value && styles.optionIconCircleSelected]}>
                        <Ionicons name={cat.icon} size={18} color={category === cat.value ? '#fff' : theme.accent} />
                      </View>
                      <Text style={[styles.optionText, category === cat.value && styles.optionTextSelected, { fontFamily: category === cat.value ? fontFamily.bold : fontFamily.medium }]}>
                        {cat.label}
                      </Text>
                    </View>
                    {category === cat.value && <Ionicons name="checkmark-circle" size={22} color={theme.accent} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const allImages = [...existingImages, ...newImages];
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <KeyboardAvoidingView style={styles.keyboardView} behavior={'padding'}>
        
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerBackground}>
            <View style={styles.gradientOverlay} />
          </View>
          
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            
            <View style={styles.headerTitleContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="create" size={22} color="#fff" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { fontFamily: fontFamily.extraBold }]}>Edit Product</Text>
                <Text style={[styles.headerSubtitle, { fontFamily: fontFamily.medium }]}>Update your listing</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            {/* Image Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="image" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Product Photos</Text>
                <View style={styles.sectionBadge}>
                  <Text style={[styles.sectionBadgeText, { fontFamily: fontFamily.semiBold }]}>{allImages.length > 0 ? `${allImages.length}` : 'Optional'}</Text>
                </View>
              </View>
              
              {allImages.length > 0 ? (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScrollContent}>
                    {existingImages.map((uri, index) => (
                      <View key={`existing-${index}`} style={styles.imagePreviewContainer}>
                        <Image source={{ uri }} style={styles.imagePreview} />
                        <TouchableOpacity onPress={() => removeExistingImage(index)} style={styles.removeImageButton}>
                          <Ionicons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                        {index === 0 && (
                          <View style={styles.primaryBadge}>
                            <Ionicons name="star" size={10} color="#fff" />
                            <Text style={[styles.primaryBadgeText, { fontFamily: fontFamily.bold }]}>Cover</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    {newImages.map((uri, index) => (
                      <View key={`new-${index}`} style={styles.imagePreviewContainer}>
                        <Image source={{ uri }} style={styles.imagePreview} />
                        <TouchableOpacity onPress={() => removeNewImage(index)} style={styles.removeImageButton}>
                          <Ionicons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {allImages.length < 10 && (
                      <TouchableOpacity onPress={pickImages} style={styles.addMoreImagesButton} activeOpacity={0.7}>
                        <Ionicons name="add-circle" size={36} color={theme.accent} />
                        <Text style={[styles.addMoreText, { fontFamily: fontFamily.semiBold }]}>Add More</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                  <Text style={[styles.imageHintText, { fontFamily: fontFamily.regular }]}>💡 First photo will be your cover image</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePicker} onPress={pickImages} activeOpacity={0.85}>
                  <View style={styles.imagePlaceholder}>
                    <View style={styles.cameraIconContainer}>
                      <Ionicons name="camera" size={36} color={theme.accent} />
                    </View>
                    <Text style={[styles.imagePlaceholderText, { fontFamily: fontFamily.semiBold }]}>Add Product Photos</Text>
                    <Text style={[styles.imagePlaceholderSubtext, { fontFamily: fontFamily.regular }]}>
                      Upload up to 10 images to showcase your product
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Basic Info Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="information-circle" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Basic Information</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Product Name <Text style={styles.requiredStar}>*</Text></Text>
                <View style={[styles.inputWrapper, productName && styles.inputWrapperFocused]}>
                  <Ionicons name="pricetag-outline" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput 
                    style={[styles.input, { fontFamily: fontFamily.regular }]} 
                    value={productName} 
                    onChangeText={setProductName} 
                    placeholder="e.g. iPhone 13 Pro Max 256GB"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={100}
                  />
                </View>
                {productName && <Text style={[styles.characterCount, { fontFamily: fontFamily.regular }]}>{productName.length}/100</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Description <Text style={styles.requiredStar}>*</Text></Text>
                <View style={[styles.inputWrapper, styles.textAreaWrapper, description && styles.inputWrapperFocused]}>
                  <TextInput 
                    style={[styles.textArea, { fontFamily: fontFamily.regular }]} 
                    value={description} 
                    onChangeText={setDescription} 
                    multiline 
                    numberOfLines={6}
                    placeholder="Describe condition, features, and any defects..."
                    placeholderTextColor={theme.textSecondary}
                    textAlignVertical="top"
                    maxLength={500}
                  />
                </View>
                {description && <Text style={[styles.characterCount, { fontFamily: fontFamily.regular }]}>{description.length}/500</Text>}
              </View>

              <View style={styles.rowGroup}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Price (₱) <Text style={styles.requiredStar}>*</Text></Text>
                  <View style={[styles.inputWrapper, price && styles.inputWrapperFocused]}>
                    <Ionicons name="cash-outline" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput 
                      style={[styles.input, styles.priceInput, { fontFamily: fontFamily.bold }]} 
                      value={price} 
                      onChangeText={handlePriceChange} 
                      keyboardType="decimal-pad" 
                      placeholder="0.00"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Stock <Text style={styles.requiredStar}>*</Text></Text>
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity onPress={decreaseQuantity} style={[styles.quantityButton, parseInt(quantity) <= 1 && styles.quantityButtonDisabled]} disabled={parseInt(quantity) <= 1}>
                      <Ionicons name="remove" size={16} color={parseInt(quantity) <= 1 ? theme.textSecondary : theme.text} />
                    </TouchableOpacity>
                    <TextInput value={quantity} onChangeText={(val) => /^\d*$/.test(val) && setQuantity(val)} keyboardType="numeric" style={[styles.quantityInput, { fontFamily: fontFamily.bold }]} textAlign="center" maxLength={4} />
                    <TouchableOpacity onPress={increaseQuantity} style={styles.quantityButton}>
                      <Ionicons name="add" size={16} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Item Details Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="list" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Item Details</Text>
              </View>

              <CategorySelector />

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Condition <Text style={styles.requiredStar}>*</Text></Text>
                <View style={styles.conditionContainer}>
                  {conditionOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setCondition(option)}
                      style={[styles.conditionButton, condition === option && styles.conditionButtonActive]}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.conditionIconCircle, condition === option && styles.conditionIconCircleActive]}>
                        <Ionicons name={getConditionIcon(option)} size={18} color={condition === option ? '#fff' : theme.accent} />
                      </View>
                      <View style={styles.conditionTextContainer}>
                        <Text style={[styles.conditionText, condition === option && styles.conditionTextActive, { fontFamily: fontFamily.bold }]}>
                          {option}
                        </Text>
                        <Text style={[styles.conditionSubtext, condition === option && styles.conditionSubtextActive, { fontFamily: fontFamily.regular }]}>
                          {getConditionSubtext(option, category)}
                        </Text>
                      </View>
                      {condition === option && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Upload Progress */}
            {uploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Ionicons name="cloud-upload" size={20} color={theme.accent} />
                  <Text style={[styles.progressTitle, { fontFamily: fontFamily.semiBold }]}>Updating Your Product</Text>
                </View>
                <View style={styles.progressBar}>
                  <Animated.View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                </View>
                <Text style={[styles.progressText, { fontFamily: fontFamily.regular }]}>
                  {uploadProgress < 100 ? `Uploading... ${Math.round(uploadProgress)}%` : 'Almost done! 🎉'}
                </Text>
              </View>
            )}

            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <View style={styles.infoBannerIconContainer}>
                <Ionicons name="bulb" size={20} color={theme.accent} />
              </View>
              <Text style={[styles.infoBannerText, { fontFamily: fontFamily.medium }]}>
                Keep your listing updated to attract more buyers!
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Fixed Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity style={[styles.publishButton, uploading && styles.publishButtonDisabled]} onPress={handleUpdateProduct} disabled={uploading} activeOpacity={0.85}>
            {uploading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.publishButtonText, { fontFamily: fontFamily.bold }]}>Updating...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={[styles.publishButtonText, { fontFamily: fontFamily.bold }]}>Save Changes</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  keyboardView: { flex: 1 },
  headerContainer: { position: 'relative', marginBottom: 16 },
  headerBackground: { height: 60, backgroundColor: theme.gradientBackground || theme.headerBackground, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  gradientOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.08 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.cardBackground, justifyContent: 'center', alignItems: 'center', shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 12 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: theme.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  headerTitle: { fontSize: 18, color: theme.text, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  scrollView: { flex: 1 },
  container: { padding: 20, paddingBottom: 120 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionIconWrapper: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${theme.accent}15`, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sectionTitle: { fontSize: 17, color: theme.text, flex: 1, letterSpacing: -0.2 },
  sectionBadge: { backgroundColor: theme.cardBackgroundAlt || `${theme.accent}15`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, color: theme.textSecondary },
  card: { backgroundColor: theme.cardBackground, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor || theme.border, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 },
  imagePicker: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  imagePlaceholder: { width: '100%', minHeight: 200, borderRadius: 20, borderWidth: 2, borderColor: theme.borderColor || theme.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08`, paddingVertical: 40, paddingHorizontal: 24 },
  cameraIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${theme.accent}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  imagePlaceholderText: { fontSize: 17, color: theme.text, marginTop: 8 },
  imagePlaceholderSubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  imageScrollContent: { paddingRight: 20 },
  imagePreviewContainer: { position: 'relative', marginRight: 12 },
  imagePreview: { width: 160, height: 160, borderRadius: 16, backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08`, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
  removeImageButton: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center' },
  primaryBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: theme.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  primaryBadgeText: { fontSize: 11, color: '#fff' },
  addMoreImagesButton: { width: 160, height: 160, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.borderColor || theme.border, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08` },
  addMoreText: { fontSize: 13, color: theme.textSecondary, marginTop: 8 },
  imageHintText: { fontSize: 12, color: theme.textSecondary, marginTop: 12, textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: theme.text, marginBottom: 10 },
  requiredStar: { color: '#FF3B30' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBackground || theme.cardBackground, borderWidth: 1.5, borderColor: theme.borderColor || theme.border, borderRadius: 14, paddingHorizontal: 16, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  inputWrapperFocused: { borderColor: theme.accent, borderWidth: 2, shadowColor: theme.accent, shadowOpacity: 0.15, shadowRadius: 6 },
  inputIcon: { marginRight: 12, opacity: 0.6 },
  input: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 14 },
  characterCount: { fontSize: 11, color: theme.textSecondary, textAlign: 'right', marginTop: 6 },
  rowGroup: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  halfWidth: { flex: 1 },
  priceInput: { fontSize: 18 },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantityButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.cardBackgroundAlt || `${theme.accent}15`, borderWidth: 1.5, borderColor: theme.borderColor || theme.border, justifyContent: 'center', alignItems: 'center', shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  quantityButtonDisabled: { opacity: 0.5 },
  quantityInput: { backgroundColor: theme.inputBackground || theme.cardBackground, borderWidth: 1.5, borderColor: theme.borderColor || theme.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 18, color: theme.text, minWidth: 70 },
  textAreaWrapper: { alignItems: 'flex-start', paddingTop: 4 },
  textArea: { flex: 1, width: '100%', fontSize: 15, color: theme.text, paddingVertical: 12, minHeight: 120 },
  selector: { borderWidth: 1.5, borderColor: theme.borderColor || theme.border, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.inputBackground || theme.cardBackground, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  selectorContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${theme.accent}15`, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  selectorText: { fontSize: 15, color: theme.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 400, maxHeight: '75%', backgroundColor: theme.cardBackground, borderRadius: 24, overflow: 'hidden', shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.borderColor || theme.border, backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08` },
  modalTitle: { fontSize: 18, color: theme.text },
  modalCloseButton: { padding: 4 },
  optionsScroll: { maxHeight: 400 },
  option: { padding: 16, borderBottomWidth: 1, borderBottomColor: theme.borderColor || theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionSelected: { backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08` },
  optionContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  optionIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${theme.accent}15`, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionIconCircleSelected: { backgroundColor: theme.accent },
  optionText: { fontSize: 15, color: theme.text },
  optionTextSelected: { color: theme.accent },
  conditionContainer: { gap: 12 },
  conditionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08`, borderWidth: 1.5, borderColor: theme.borderColor || theme.border, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  conditionButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent, shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 8 },
  conditionIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  conditionIconCircleActive: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  conditionTextContainer: { flex: 1 },
  conditionText: { fontSize: 16, color: theme.text, marginBottom: 2 },
  conditionTextActive: { color: '#fff' },
  conditionSubtext: { fontSize: 12, color: theme.textSecondary },
  conditionSubtextActive: { color: 'rgba(255, 255, 255, 0.85)' },
  progressContainer: { backgroundColor: theme.cardBackground, borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor || theme.border },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  progressTitle: { fontSize: 15, color: theme.text },
  progressBar: { height: 10, backgroundColor: theme.cardBackgroundAlt || `${theme.accent}15`, borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 6 },
  progressText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.cardBackground, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.borderColor || theme.border, marginBottom: 16, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  infoBannerIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${theme.accent}15`, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoBannerText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.cardBackground, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: theme.borderColor || theme.border, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  publishButton: { backgroundColor: theme.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: theme.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  publishButtonDisabled: { backgroundColor: theme.buttonDisabled || '#9ca3af', shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  publishButtonText: { color: '#fff', fontSize: 17 },
});