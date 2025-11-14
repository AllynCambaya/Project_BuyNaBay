// screens/tabs/AddRentalScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
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
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width } = Dimensions.get('window');

const fontFamily = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semiBold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
  extraBold: 'Poppins-ExtraBold',
};

const DURATION_OPTIONS = ['per hour', 'per day', 'per week', 'per month'];
const CATEGORY_OPTIONS = ['Electronics', 'Tools', 'Party & Events', 'Sports & Outdoors', 'Apparel', 'Vehicles', 'Other'];
const CONDITION_OPTIONS = ['new', 'used'];

export default function AddRentalScreen({ navigation }) {
  const [images, setImages] = useState([]);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [rentalDuration, setRentalDuration] = useState(DURATION_OPTIONS[0]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [condition, setCondition] = useState(CONDITION_OPTIONS[0]);
  const [quantity, setQuantity] = useState('1');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const pickImages = async () => {
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
      const newImages = result.assets.map(asset => asset.uri);
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
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

        console.log(`📤 Uploading rental image ${i + 1}/${uris.length}: ${filePath}`);

        const { error: uploadError } = await supabase.storage
          .from('rental-images')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw uploadError;
        }

        const { data } = supabase.storage.from('rental-images').getPublicUrl(filePath);
        urls.push(data.publicUrl);
        
        setUploadProgress(((i + 1) / uris.length) * 50); // First 50% for image upload
      }
      return urls;
    } catch (error) {
      console.error("⚠️ Image Upload Error:", error);
      throw error;
    }
  };

  const submit = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Not Logged In", "You must be logged in to list a rental item.");
      return;
    }

    if (!itemName.trim() || !price.trim()) {
      Alert.alert('Missing Information', 'Please enter item name and rental price');
      return;
    }
    
    Keyboard.dismiss();
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const email = user?.email ?? "test@example.com";

      console.log("📝 Inserting rental item data...");
      console.log({
        owner_email: email,
        item_name: itemName.trim(),
        price: parseFloat(price),
        rental_duration: rentalDuration,
        description: description.trim() || null,
        category,
        condition,
        quantity: parseInt(quantity, 10),
      });

      // Upload images first if any
      let imageUrl = null;
      if (images.length > 0) {
        console.log(`📸 Uploading ${images.length} rental images...`);
        const imageUrls = await uploadImages(images);
        // For rental_items, rental_item_image is a single text field, so we'll use the first image
        imageUrl = imageUrls[0];
        console.log("✅ Rental images uploaded:", imageUrls);
      }

      setUploadProgress(60);

      // Insert rental item
      const { data: rentalData, error: insertError } = await supabase
        .from('rental_items')
        .insert([
          {
            owner_email: email,
            rental_item_image: imageUrl,
            item_name: itemName.trim(),
            price: parseFloat(price),
            rental_duration: rentalDuration,
            description: description.trim() || null,
            category,
            condition,
            quantity: parseInt(quantity, 10),
            is_visible: true,
          }
        ])
        .select();

      if (insertError) {
        console.error("❌ Insert Error:", insertError);
        throw insertError;
      }

      if (!rentalData || rentalData.length === 0) {
        throw new Error("Rental item was not created");
      }

      console.log("✅ Rental item created with ID:", rentalData[0].id);

      setUploadProgress(100);

      Alert.alert('Success', 'Your rental item has been published! 🎉', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      
      // Reset form
      setItemName('');
      setDescription('');
      setQuantity('1');
      setPrice('');
      setRentalDuration(DURATION_OPTIONS[0]);
      setCategory(CATEGORY_OPTIONS[0]);
      setCondition(CONDITION_OPTIONS[0]);
      setImages([]);

    } catch (error) {
      console.error("⚠️ Rental Item Publish Error:", error);
      Alert.alert('Error', error.message || 'Failed to publish rental item. Please try again.');
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
      'Electronics': 'mobile',
      'Tools': 'wrench',
      'Party & Events': 'glass',
      'Sports & Outdoors': 'futbol-o',
      'Apparel': 'shopping-bag',
      'Vehicles': 'car',
      'Other': 'ellipsis-h',
    };
    return icons[cat] || 'tag';
  };

  const getDurationIcon = (dur) => {
    const icons = {
      'per hour': 'clock-o',
      'per day': 'sun-o',
      'per week': 'calendar',
      'per month': 'calendar-o',
    };
    return icons[dur] || 'clock-o';
  };

  const Selector = ({ label, value, options, onSelect, getOptionIcon }) => {
    const [open, setOpen] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      setOpen(true);
    };

    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.label}>
          {label} <Text style={styles.requiredStar}>*</Text>
        </Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity style={styles.selector} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.selectorContent}>
              <View style={styles.selectorIconCircle}>
                <Icon name={getOptionIcon ? getOptionIcon(value) : 'chevron-down'} size={16} color={theme.accent} />
              </View>
              <Text style={styles.selectorText}>{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
        
        <Modal visible={open} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <TouchableOpacity onPress={() => setOpen(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsScroll}>
                {options.map((opt) => (
                  <TouchableOpacity 
                    key={opt} 
                    onPress={() => { onSelect(opt); setOpen(false); }} 
                    style={[styles.option, value === opt && styles.optionSelected]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      {getOptionIcon && (
                        <View style={[styles.optionIconCircle, value === opt && styles.optionIconCircleSelected]}>
                          <Icon name={getOptionIcon(opt)} size={16} color={value === opt ? '#fff' : theme.accent} />
                        </View>
                      )}
                      <Text style={[styles.optionText, value === opt && styles.optionTextSelected]}>{opt}</Text>
                    </View>
                    {value === opt && <Icon name="check-circle" size={20} color={theme.accent} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={'padding'}>
          
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.backgroundGradient} />
            
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              
              <View style={styles.headerTitleRow}>
                <View style={styles.iconCircle}>
                  <Icon name="handshake-o" size={22} color="#fff" />
                </View>
                <View style={styles.headerTitles}>
                  <Text style={styles.headerTitle}>List Rental Item</Text>
                  <Text style={styles.headerSubtitle}>Share your items and earn extra income</Text>
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
                    <Icon name="camera" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Item Photos</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{images.length > 0 ? `${images.length}` : 'Optional'}</Text>
                  </View>
                </View>
                
                {images.length > 0 ? (
                  <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScrollContent}>
                      {images.map((uri, index) => (
                        <View key={index} style={styles.imagePreviewContainer}>
                          <Image source={{ uri }} style={styles.imagePreview} />
                          <TouchableOpacity onPress={() => removeImage(index)} style={styles.removeImageButton}>
                            <Ionicons name="close" size={16} color="#fff" />
                          </TouchableOpacity>
                          {index === 0 && (
                            <View style={styles.primaryBadge}>
                              <Icon name="star" size={10} color="#fff" />
                              <Text style={styles.primaryBadgeText}>Cover</Text>
                            </View>
                          )}
                        </View>
                      ))}
                      <TouchableOpacity onPress={pickImages} style={styles.addMoreImagesButton} activeOpacity={0.7}>
                        <Ionicons name="add-circle" size={36} color={theme.accent} />
                        <Text style={styles.addMoreText}>Add More</Text>
                      </TouchableOpacity>
                    </ScrollView>
                    <Text style={styles.imageHintText}>💡 First photo will be your cover image</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.imagePicker} onPress={pickImages} activeOpacity={0.85}>
                    <View style={styles.imagePlaceholder}>
                      <View style={styles.cameraIconContainer}>
                        <Icon name="camera" size={36} color={theme.accent} />
                      </View>
                      <Text style={styles.imagePlaceholderText}>Add Item Photos</Text>
                      <Text style={styles.imagePlaceholderSubtext}>
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
                    <Icon name="info-circle" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Basic Information</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Item Name <Text style={styles.requiredStar}>*</Text></Text>
                  <View style={[styles.inputWrapper, itemName && styles.inputWrapperFocused]}>
                    <Icon name="tag" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      value={itemName} 
                      onChangeText={setItemName} 
                      placeholder="e.g. DSLR Camera, Power Drill"
                      placeholderTextColor={theme.textSecondary}
                      maxLength={100}
                    />
                  </View>
                  {itemName && <Text style={styles.characterCount}>{itemName.length}/100</Text>}
                </View>

                <View style={styles.rowGroup}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Rental Price (₱) <Text style={styles.requiredStar}>*</Text></Text>
                    <View style={[styles.inputWrapper, price && styles.inputWrapperFocused]}>
                      <Icon name="money" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                      <TextInput 
                        style={[styles.input, styles.priceInput]} 
                        value={price} 
                        onChangeText={handlePriceChange} 
                        keyboardType="decimal-pad" 
                        placeholder="0.00"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Quantity <Text style={styles.requiredStar}>*</Text></Text>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity onPress={decreaseQuantity} style={[styles.quantityButton, parseInt(quantity) <= 1 && styles.quantityButtonDisabled]} disabled={parseInt(quantity) <= 1}>
                        <Icon name="minus" size={14} color={parseInt(quantity) <= 1 ? theme.textSecondary : theme.text} />
                      </TouchableOpacity>
                      <TextInput value={quantity} onChangeText={(val) => /^\d*$/.test(val) && setQuantity(val)} keyboardType="numeric" style={styles.quantityInput} textAlign="center" maxLength={3} />
                      <TouchableOpacity onPress={increaseQuantity} style={styles.quantityButton}>
                        <Icon name="plus" size={14} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Selector label="Rental Duration" value={rentalDuration} options={DURATION_OPTIONS} onSelect={setRentalDuration} getOptionIcon={getDurationIcon} />
              </View>

              {/* Item Details Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="list-ul" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Item Details</Text>
                </View>

                <Selector label="Category" value={category} options={CATEGORY_OPTIONS} onSelect={setCategory} getOptionIcon={getCategoryIcon} />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Condition <Text style={styles.requiredStar}>*</Text></Text>
                  <View style={styles.conditionContainer}>
                    {CONDITION_OPTIONS.map((cond) => (
                      <TouchableOpacity
                        key={cond}
                        onPress={() => setCondition(cond)}
                        style={[styles.conditionButton, condition === cond && styles.conditionButtonActive]}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.conditionIconCircle, condition === cond && styles.conditionIconCircleActive]}>
                          <Icon name={cond === 'new' ? 'star' : 'history'} size={16} color={condition === cond ? '#fff' : theme.accent} />
                        </View>
                        <View style={styles.conditionTextContainer}>
                          <Text style={[styles.conditionText, condition === cond && styles.conditionTextActive]}>
                            {cond === 'new' ? 'Brand New' : 'Used'}
                          </Text>
                          <Text style={[styles.conditionSubtext, condition === cond && styles.conditionSubtextActive]}>
                            {cond === 'new' ? 'Unused condition' : 'Pre-owned item'}
                          </Text>
                        </View>
                        {condition === cond && <Icon name="check-circle" size={20} color="#fff" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Description Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="align-left" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Description</Text>
                </View>

                <View style={[styles.inputWrapper, styles.textAreaWrapper, description && styles.inputWrapperFocused]}>
                  <TextInput 
                    style={styles.textArea} 
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
                {description && <Text style={styles.characterCount}>{description.length}/500</Text>}
              </View>

              {/* Upload Progress */}
              {uploading && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Ionicons name="cloud-upload" size={20} color={theme.accent} />
                    <Text style={styles.progressTitle}>Publishing Your Rental</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <Animated.View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {uploadProgress < 100 ? `Uploading... ${Math.round(uploadProgress)}%` : 'Almost done! 🎉'}
                  </Text>
                </View>
              )}

              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <View style={styles.infoBannerIconContainer}>
                  <Icon name="lightbulb-o" size={20} color={theme.accent} />
                </View>
                <Text style={styles.infoBannerText}>
                  Clear photos and detailed descriptions attract more renters!
                </Text>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Fixed Bottom Button */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity style={[styles.publishButton, uploading && styles.publishButtonDisabled]} onPress={submit} disabled={uploading} activeOpacity={0.85}>
              {uploading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.publishButtonText}>Publishing...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Icon name="rocket" size={20} color="#fff" />
                  <Text style={styles.publishButtonText}>Publish Rental Item</Text>
                  <Icon name="arrow-right" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const darkTheme = {
  background: '#1B1B41',
  gradientBackground: '#252550',
  text: '#EEE7DA',
  textSecondary: '#9ca3af',
  cardBackground: '#252550',
  cardBackgroundAlt: '#2d2d5a',
  inputBackground: 'rgba(255,255,255,0.05)',
  accent: '#FDAD00',
  error: '#ef4444',
  success: '#10b981',
  shadowColor: '#000',
  borderColor: 'rgba(255,255,255,0.1)',
  buttonDisabled: '#4b5563',
  overlayBackground: 'rgba(0, 0, 0, 0.85)',
  infoBannerBg: '#2a2a55',
};

const lightTheme = {
  background: '#f8fafc',
  gradientBackground: '#e8ecf1',
  text: '#1e293b',
  textSecondary: '#64748b',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f1f5f9',
  inputBackground: '#ffffff',
  accent: '#f39c12',
  error: '#ef4444',
  success: '#10b981',
  shadowColor: '#000',
  borderColor: '#e2e8f0',
  buttonDisabled: '#cbd5e1',
  overlayBackground: 'rgba(0, 0, 0, 0.5)',
  infoBannerBg: '#fffbf0',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  keyboardView: { flex: 1 },
  headerContainer: { position: 'relative', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, marginBottom: 8 },
  backgroundGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, backgroundColor: theme.gradientBackground, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerContent: { zIndex: 1 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.cardBackground, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginRight: 14, shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 24, color: theme.text, fontWeight: '700', marginBottom: 4, fontFamily: fontFamily.extraBold },
  headerSubtitle: { fontSize: 13, color: theme.textSecondary, fontFamily: fontFamily.regular, lineHeight: 18 },
  scrollView: { flex: 1 },
  container: { padding: 20, paddingBottom: 120 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionIconWrapper: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.cardBackgroundAlt, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text, flex: 1, fontFamily: fontFamily.bold },
  sectionBadge: { backgroundColor: theme.cardBackgroundAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, color: theme.textSecondary, fontFamily: fontFamily.semiBold },
  card: { backgroundColor: theme.cardBackground, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 },
  imagePicker: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  imagePlaceholder: { width: '100%', minHeight: 200, borderRadius: 20, borderWidth: 2, borderColor: theme.borderColor, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackgroundAlt, paddingVertical: 40, paddingHorizontal: 24 },
  cameraIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 3, borderColor: theme.borderColor },
  imagePlaceholderText: { fontSize: 17, fontWeight: '600', color: theme.text, marginTop: 8, fontFamily: fontFamily.semiBold },
  imagePlaceholderSubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18, fontFamily: fontFamily.regular },
  imageScrollContent: { paddingHorizontal: 20, paddingVertical: 4 },
  imagePreviewContainer: { position: 'relative', marginRight: 12 },
  imagePreview: { width: 160, height: 160, borderRadius: 16, backgroundColor: theme.cardBackgroundAlt, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
  removeImageButton: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.error, justifyContent: 'center', alignItems: 'center' },
  primaryBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: theme.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  primaryBadgeText: { fontSize: 11, color: '#fff', fontFamily: fontFamily.bold },
  addMoreImagesButton: { width: 160, height: 160, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.borderColor, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackgroundAlt },
  addMoreText: { fontSize: 13, color: theme.textSecondary, marginTop: 8, fontFamily: fontFamily.semiBold },
  imageHintText: { fontSize: 12, color: theme.textSecondary, marginTop: 12, textAlign: 'center', fontFamily: fontFamily.regular },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 10, fontFamily: fontFamily.semiBold },
  requiredStar: { color: theme.error },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBackground, borderWidth: 1.5, borderColor: theme.borderColor, borderRadius: 14, paddingHorizontal: 16, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  inputWrapperFocused: { borderColor: theme.accent, borderWidth: 2, shadowColor: theme.accent, shadowOpacity: 0.15, shadowRadius: 6 },
  inputIcon: { marginRight: 12, opacity: 0.6 },
  input: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 14, fontFamily: fontFamily.regular },
  characterCount: { fontSize: 11, color: theme.textSecondary, textAlign: 'right', marginTop: 6, fontFamily: fontFamily.regular },
  rowGroup: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  halfWidth: { flex: 1 },
  priceInput: { fontSize: 18, fontWeight: '700', fontFamily: fontFamily.bold },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantityButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.cardBackgroundAlt, borderWidth: 1.5, borderColor: theme.borderColor, justifyContent: 'center', alignItems: 'center', shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  quantityButtonDisabled: { opacity: 0.5 },
  quantityInput: { backgroundColor: theme.inputBackground, borderWidth: 1.5, borderColor: theme.borderColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: theme.text, minWidth: 70, fontFamily: fontFamily.bold },
  textAreaWrapper: { alignItems: 'flex-start', paddingTop: 4 },
  textArea: { flex: 1, width: '100%', fontSize: 15, color: theme.text, paddingVertical: 12, minHeight: 120, fontFamily: fontFamily.regular },
  selectorContainer: { marginBottom: 20 },
  selector: { borderWidth: 1.5, borderColor: theme.borderColor, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.inputBackground, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  selectorContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.cardBackgroundAlt, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  selectorText: { fontSize: 15, color: theme.text, fontWeight: '500', fontFamily: fontFamily.medium },
  modalOverlay: { flex: 1, backgroundColor: theme.overlayBackground, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 400, maxHeight: '75%', backgroundColor: theme.cardBackground, borderRadius: 24, overflow: 'hidden', shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.borderColor, backgroundColor: theme.cardBackgroundAlt },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text, fontFamily: fontFamily.bold },
  modalCloseButton: { padding: 4 },
  optionsScroll: { maxHeight: 400 },
  option: { padding: 16, borderBottomWidth: 1, borderBottomColor: theme.borderColor, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionSelected: { backgroundColor: theme.cardBackgroundAlt },
  optionContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  optionIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionIconCircleSelected: { backgroundColor: theme.accent },
  optionText: { fontSize: 15, color: theme.text, fontWeight: '500', fontFamily: fontFamily.medium },
  optionTextSelected: { fontWeight: '700', color: theme.accent, fontFamily: fontFamily.bold },
  conditionContainer: { gap: 12 },
  conditionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: theme.cardBackgroundAlt, borderWidth: 1.5, borderColor: theme.borderColor, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  conditionButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent, shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 8 },
  conditionIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  conditionIconCircleActive: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  conditionTextContainer: { flex: 1 },
  conditionText: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 2, fontFamily: fontFamily.bold },
  conditionTextActive: { color: '#fff' },
  conditionSubtext: { fontSize: 12, color: theme.textSecondary, fontFamily: fontFamily.regular },
  conditionSubtextActive: { color: 'rgba(255, 255, 255, 0.85)' },
  progressContainer: { backgroundColor: theme.cardBackground, borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  progressTitle: { fontSize: 15, color: theme.text, fontFamily: fontFamily.semiBold },
  progressBar: { height: 10, backgroundColor: theme.cardBackgroundAlt, borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 6 },
  progressText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', fontFamily: fontFamily.regular },
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.infoBannerBg, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.borderColor, marginBottom: 16, shadowColor: theme.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  infoBannerIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.cardBackground, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoBannerText: { flex: 1, fontSize: 13, color: theme.text, lineHeight: 19, fontWeight: '500', fontFamily: fontFamily.medium },
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.cardBackground, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: theme.borderColor, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  publishButton: { backgroundColor: theme.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: theme.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  publishButtonDisabled: { backgroundColor: theme.buttonDisabled, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  publishButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', fontFamily: fontFamily.bold },
});