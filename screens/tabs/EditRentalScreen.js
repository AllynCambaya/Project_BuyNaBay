// screens/EditRentalScreen.js
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
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

const DURATION_OPTIONS = ['per hour', 'per day', 'per week', 'per month'];
const CATEGORY_OPTIONS = ['Electronics', 'Tools', 'Party & Events', 'Sports & Outdoors', 'Apparel', 'Vehicles', 'Other'];
const CONDITION_OPTIONS = ['new', 'used'];

export default function EditRentalScreen({ navigation, route }) {
  const { rentalItem } = route.params;

  const [itemName, setItemName] = useState(rentalItem.item_name || '');
  const [description, setDescription] = useState(rentalItem.description || '');
  const [price, setPrice] = useState(rentalItem.price?.toString() || '');
  const [rentalDuration, setRentalDuration] = useState(rentalItem.rental_duration || DURATION_OPTIONS[0]);
  const [category, setCategory] = useState(rentalItem.category || CATEGORY_OPTIONS[0]);
  const [condition, setCondition] = useState(rentalItem.condition || CONDITION_OPTIONS[0]);
  const [quantity, setQuantity] = useState(rentalItem.quantity?.toString() || '1');
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDurationModal, setShowDurationModal] = useState(false);
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
    const imageUrl = rentalItem.rental_item_image || rentalItem.image;
    const imageUrls = imageUrl ? [imageUrl] : [];
    setExistingImages(imageUrls);
  }, [rentalItem]);

  const pickImages = async () => {
    const totalImages = existingImages.length + newImages.length;
    if (totalImages >= 10) {
      Alert.alert("Limit Reached", "You can only have up to 10 images per rental item.");
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

  const uploadImages = async (uris) => {
    try {
      const urls = [];
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        const fileExt = uri.split('.').pop().split('?')[0];
        const fileName = `rental_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `rental-items/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('rental-images')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('rental-images').getPublicUrl(filePath);
        urls.push(data.publicUrl);
        
        setUploadProgress(((i + 1) / uris.length) * 100);
      }
      return urls;
    } catch (error) {
      throw error;
    }
  };

  const handleUpdateRental = async () => {
    if (!itemName.trim() || !price.trim()) {
      Alert.alert('Missing Information', 'Please enter item name and rental price');
      return;
    }
    
    Keyboard.dismiss();
    setUploading(true);
    setUploadProgress(0);
    
    try {
      let uploadedImageUrls = [];
      if (newImages.length > 0) {
        uploadedImageUrls = await uploadImages(newImages);
      }

      const allImageUrls = [...existingImages, ...uploadedImageUrls];
      const imageUrl = allImageUrls.length > 0 ? allImageUrls[0] : null;

      const { error: updateError } = await supabase
        .from('rental_items')
        .update({
          item_name: itemName.trim(),
          description: description.trim() || null,
          price: parseFloat(price),
          rental_duration: rentalDuration,
          category,
          condition,
          quantity: parseInt(quantity, 10),
          rental_item_image: imageUrl,
        })
        .eq('id', rentalItem.id);

      if (updateError) throw updateError;

      setUploadProgress(100);

      Alert.alert('Success', 'Rental item updated successfully! 🎉', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update rental item. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
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

  const increaseQuantity = () => setQuantity(String(parseInt(quantity || '0', 10) + 1));
  const decreaseQuantity = () => { 
    if (parseInt(quantity) > 1) setQuantity(String(parseInt(quantity) - 1)); 
  };

  const getCategoryIcon = (cat) => {
    const icons = {
      'Electronics': 'phone-portrait',
      'Tools': 'construct',
      'Party & Events': 'gift',
      'Sports & Outdoors': 'basketball',
      'Apparel': 'shirt',
      'Vehicles': 'car',
      'Other': 'ellipsis-horizontal',
    };
    return icons[cat] || 'pricetag';
  };

  const getDurationIcon = (dur) => {
    const icons = {
      'per hour': 'time',
      'per day': 'sunny',
      'per week': 'calendar',
      'per month': 'calendar-number',
    };
    return icons[dur] || 'time';
  };

  const Selector = ({ label, value, options, onSelect, getOptionIcon, showModal, setShowModal }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      setShowModal(true);
    };

    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
          {label} <Text style={styles.requiredStar}>*</Text>
        </Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity style={styles.selector} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.selectorContent}>
              <View style={styles.selectorIconCircle}>
                <Ionicons name={getOptionIcon ? getOptionIcon(value) : 'chevron-down'} size={18} color={theme.accent} />
              </View>
              <Text style={[styles.selectorText, { fontFamily: fontFamily.medium }]}>{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
        
        <Modal visible={showModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontFamily: fontFamily.bold }]}>Select {label}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsScroll}>
                {options.map((opt) => (
                  <TouchableOpacity 
                    key={opt} 
                    onPress={() => { onSelect(opt); setShowModal(false); }} 
                    style={[styles.option, value === opt && styles.optionSelected]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      {getOptionIcon && (
                        <View style={[styles.optionIconCircle, value === opt && styles.optionIconCircleSelected]}>
                          <Ionicons name={getOptionIcon(opt)} size={18} color={value === opt ? '#fff' : theme.accent} />
                        </View>
                      )}
                      <Text style={[styles.optionText, value === opt && styles.optionTextSelected, { fontFamily: value === opt ? fontFamily.bold : fontFamily.medium }]}>{opt}</Text>
                    </View>
                    {value === opt && <Ionicons name="checkmark-circle" size={22} color={theme.accent} />}
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
                <Text style={[styles.headerTitle, { fontFamily: fontFamily.extraBold }]}>Edit Rental</Text>
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
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Item Photos</Text>
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
                    <Text style={[styles.imagePlaceholderText, { fontFamily: fontFamily.semiBold }]}>Add Item Photos</Text>
                    <Text style={[styles.imagePlaceholderSubtext, { fontFamily: fontFamily.regular }]}>
                      Upload up to 10 images to showcase your rental item
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
                <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Item Name <Text style={styles.requiredStar}>*</Text></Text>
                <View style={[styles.inputWrapper, itemName && styles.inputWrapperFocused]}>
                  <Ionicons name="pricetag-outline" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput 
                    style={[styles.input, { fontFamily: fontFamily.regular }]} 
                    value={itemName} 
                    onChangeText={setItemName} 
                    placeholder="e.g. DSLR Camera, Power Drill"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={100}
                  />
                </View>
                {itemName && <Text style={[styles.characterCount, { fontFamily: fontFamily.regular }]}>{itemName.length}/100</Text>}
              </View>

              <View style={styles.rowGroup}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Rental Price (₱) <Text style={styles.requiredStar}>*</Text></Text>
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
                  <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Quantity <Text style={styles.requiredStar}>*</Text></Text>
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity onPress={decreaseQuantity} style={[styles.quantityButton, parseInt(quantity) <= 1 && styles.quantityButtonDisabled]} disabled={parseInt(quantity) <= 1}>
                      <Ionicons name="remove" size={16} color={parseInt(quantity) <= 1 ? theme.textSecondary : theme.text} />
                    </TouchableOpacity>
                    <TextInput value={quantity} onChangeText={(val) => /^\d*$/.test(val) && setQuantity(val)} keyboardType="numeric" style={[styles.quantityInput, { fontFamily: fontFamily.bold }]} textAlign="center" maxLength={3} />
                    <TouchableOpacity onPress={increaseQuantity} style={styles.quantityButton}>
                      <Ionicons name="add" size={16} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Selector 
                label="Rental Duration" 
                value={rentalDuration} 
                options={DURATION_OPTIONS} 
                onSelect={setRentalDuration} 
                getOptionIcon={getDurationIcon} 
                showModal={showDurationModal}
                setShowModal={setShowDurationModal}
              />
            </View>

            {/* Item Details Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="list" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Item Details</Text>
              </View>

              <Selector 
                label="Category" 
                value={category} 
                options={CATEGORY_OPTIONS} 
                onSelect={setCategory} 
                getOptionIcon={getCategoryIcon} 
                showModal={showCategoryModal}
                setShowModal={setShowCategoryModal}
              />

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Condition <Text style={styles.requiredStar}>*</Text></Text>
                <View style={styles.conditionContainer}>
                  {CONDITION_OPTIONS.map((cond) => (
                    <TouchableOpacity
                      key={cond}
                      onPress={() => setCondition(cond)}
                      style={[styles.conditionButton, condition === cond && styles.conditionButtonActive]}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.conditionIconCircle, condition === cond && styles.conditionIconCircleActive]}>
                        <Ionicons name={cond === 'new' ? 'sparkles' : 'time'} size={18} color={condition === cond ? '#fff' : theme.accent} />
                      </View>
                      <View style={styles.conditionTextContainer}>
                        <Text style={[styles.conditionText, condition === cond && styles.conditionTextActive, { fontFamily: fontFamily.bold }]}>
                          {cond === 'new' ? 'Brand New' : 'Used'}
                        </Text>
                        <Text style={[styles.conditionSubtext, condition === cond && styles.conditionSubtextActive, { fontFamily: fontFamily.regular }]}>
                          {cond === 'new' ? 'Unused condition' : 'Pre-owned item'}
                        </Text>
                      </View>
                      {condition === cond && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Description Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="document-text" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Description</Text>
              </View>

              <View style={[styles.inputWrapper, styles.textAreaWrapper, description && styles.inputWrapperFocused]}>
                <TextInput 
                  style={[styles.textArea, { fontFamily: fontFamily.regular }]} 
                  value={description} 
                  onChangeText={setDescription} 
                  multiline 
                  numberOfLines={6}
                  placeholder="Describe your item, rental terms, and any special instructions..."
                  placeholderTextColor={theme.textSecondary}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>
              {description && <Text style={[styles.characterCount, { fontFamily: fontFamily.regular }]}>{description.length}/500</Text>}
            </View>

            {/* Upload Progress */}
            {uploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Ionicons name="cloud-upload" size={20} color={theme.accent} />
                  <Text style={[styles.progressTitle, { fontFamily: fontFamily.semiBold }]}>Updating Your Rental</Text>
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
                Keep your listing updated to attract more renters!
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Fixed Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity style={[styles.publishButton, uploading && styles.publishButtonDisabled]} onPress={handleUpdateRental} disabled={uploading} activeOpacity={0.85}>
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