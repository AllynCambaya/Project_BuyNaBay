// screens/RentItemScreen.js
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
  Platform,
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

const { width, height } = Dimensions.get('window');

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

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission Required', 'We need access to your photos to continue');

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
    if (!itemName.trim() || !price.trim()) {
      return Alert.alert('Missing Information', 'Please enter item name and rental price');
    }
    
    Keyboard.dismiss();
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

      Alert.alert('Success', 'Your rental item has been published! 🎉', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      console.error('Publish error', err.message || err);
      Alert.alert('Error', 'Failed to publish item. Please try again.');
    } finally {
      setUploading(false);
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
  const handleQuantityChange = (value) => { 
    if (/^\d*$/.test(value)) setQuantity(value); 
  };

  const getCategoryIcon = (cat) => {
    const icons = {
      'Electronics': 'mobile',
      'Tools': 'wrench',
      'Party&Events': 'glass',
      'Sports&outdoors': 'futbol-o',
      'apparel': 'shopping-bag',
      'vehicles': 'car',
      'other': 'ellipsis-h',
    };
    return icons[cat] || 'tag';
  };

  const getDurationIcon = (dur) => {
    const icons = {
      'perday': 'sun-o',
      'per week': 'calendar',
      'per month': 'calendar-o',
    };
    return icons[dur] || 'clock-o';
  };

  const Selector = ({ label, value, options, onSelect, icon, getOptionIcon }) => {
    const [open, setOpen] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.97,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      setOpen(true);
    };

    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.label}>
          {label} <Text style={styles.requiredStar}>*</Text>
        </Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity 
            style={styles.selector} 
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <View style={styles.selectorContent}>
              <View style={styles.selectorIconCircle}>
                <Icon name={icon} size={16} color={theme.accent} />
              </View>
              <Text style={styles.selectorText}>{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
        
        <Modal visible={open} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setOpen(false)}
          >
            <Animated.View 
              style={[
                styles.modalBox,
                { 
                  opacity: fadeAnim,
                  transform: [{ scale: fadeAnim }]
                }
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <TouchableOpacity 
                  onPress={() => setOpen(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsScroll}>
                {options.map((opt) => (
                  <TouchableOpacity 
                    key={opt} 
                    onPress={() => { onSelect(opt); setOpen(false); }} 
                    style={[
                      styles.option,
                      value === opt && styles.optionSelected
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      {getOptionIcon && (
                        <View style={[
                          styles.optionIconCircle,
                          value === opt && styles.optionIconCircleSelected
                        ]}>
                          <Icon 
                            name={getOptionIcon(opt)} 
                            size={16} 
                            color={value === opt ? '#fff' : theme.accent} 
                          />
                        </View>
                      )}
                      <Text style={[
                        styles.optionText,
                        value === opt && styles.optionTextSelected
                      ]}>
                        {opt}
                      </Text>
                    </View>
                    {value === opt && (
                      <Icon name="check-circle" size={20} color={theme.accent} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.backgroundGradient} />
            
            <View style={styles.headerContent}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              
              <View style={styles.headerTextContainer}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.iconCircle}>
                    <Icon name="handshake-o" size={22} color="#fff" />
                  </View>
                  <View style={styles.headerTitles}>
                    <Text style={styles.headerTitle}>List Rental Item</Text>
                    <Text style={styles.headerSubtitle}>
                      Share your items and earn extra income
                    </Text>
                  </View>
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
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {/* Image Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="camera" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Item Photo</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>
                      {imageUri ? 'Added' : 'Optional'}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.imagePicker} 
                  onPress={pickImage}
                  activeOpacity={0.85}
                >
                  {imageUri ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                      <View style={styles.changeImageOverlay}>
                        <View style={styles.changeImageButton}>
                          <Icon name="camera" size={20} color="#fff" />
                          <Text style={styles.changeImageText}>Change Photo</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <View style={styles.cameraIconContainer}>
                        <Icon name="camera" size={36} color={theme.accent} />
                      </View>
                      <Text style={styles.imagePlaceholderText}>Add Item Photo</Text>
                      <Text style={styles.imagePlaceholderSubtext}>
                        Help renters see what you're offering
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
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
                  <Text style={styles.label}>
                    Item Name <Text style={styles.requiredStar}>*</Text>
                  </Text>
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
                  {itemName && (
                    <Text style={styles.characterCount}>{itemName.length}/100</Text>
                  )}
                </View>

                <View style={styles.rowGroup}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>
                      Rental Price (₱) <Text style={styles.requiredStar}>*</Text>
                    </Text>
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
                    <Text style={styles.label}>
                      Quantity <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity 
                        onPress={decreaseQuantity} 
                        style={[
                          styles.quantityButton,
                          parseInt(quantity) <= 1 && styles.quantityButtonDisabled
                        ]}
                        activeOpacity={0.7}
                        disabled={parseInt(quantity) <= 1}
                      >
                        <Icon 
                          name="minus" 
                          size={14} 
                          color={parseInt(quantity) <= 1 ? theme.textSecondary : theme.text} 
                        />
                      </TouchableOpacity>
                      <TextInput
                        value={quantity}
                        onChangeText={handleQuantityChange}
                        keyboardType="numeric"
                        style={styles.quantityInput}
                        textAlign="center"
                        maxLength={3}
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

                <Selector 
                  label="Rental Duration" 
                  value={rentalDuration} 
                  options={DURATION_OPTIONS} 
                  onSelect={setRentalDuration}
                  icon="clock-o"
                  getOptionIcon={getDurationIcon}
                />
              </View>

              {/* Item Details Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="list-ul" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Item Details</Text>
                </View>

                <Selector 
                  label="Category" 
                  value={category} 
                  options={CATEGORY_OPTIONS} 
                  onSelect={setCategory}
                  icon="folder-open"
                  getOptionIcon={getCategoryIcon}
                />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Condition <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.conditionContainer}>
                    <TouchableOpacity
                      onPress={() => setCondition('new')}
                      style={[
                        styles.conditionButton,
                        condition === 'new' && styles.conditionButtonActive
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.conditionIconCircle,
                        condition === 'new' && styles.conditionIconCircleActive
                      ]}>
                        <Icon 
                          name="star" 
                          size={16} 
                          color={condition === 'new' ? '#fff' : theme.accent} 
                        />
                      </View>
                      <View style={styles.conditionTextContainer}>
                        <Text style={[
                          styles.conditionText,
                          condition === 'new' && styles.conditionTextActive
                        ]}>
                          Brand New
                        </Text>
                        <Text style={[
                          styles.conditionSubtext,
                          condition === 'new' && styles.conditionSubtextActive
                        ]}>
                          Unused condition
                        </Text>
                      </View>
                      {condition === 'new' && (
                        <Icon name="check-circle" size={20} color="#fff" style={styles.checkIcon} />
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => setCondition('used')}
                      style={[
                        styles.conditionButton,
                        condition === 'used' && styles.conditionButtonActive
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.conditionIconCircle,
                        condition === 'used' && styles.conditionIconCircleActive
                      ]}>
                        <Icon 
                          name="history" 
                          size={16} 
                          color={condition === 'used' ? '#fff' : theme.accent} 
                        />
                      </View>
                      <View style={styles.conditionTextContainer}>
                        <Text style={[
                          styles.conditionText,
                          condition === 'used' && styles.conditionTextActive
                        ]}>
                          Used
                        </Text>
                        <Text style={[
                          styles.conditionSubtext,
                          condition === 'used' && styles.conditionSubtextActive
                        ]}>
                          Pre-owned item
                        </Text>
                      </View>
                      {condition === 'used' && (
                        <Icon name="check-circle" size={20} color="#fff" style={styles.checkIcon} />
                      )}
                    </TouchableOpacity>
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
                {description && (
                  <Text style={styles.characterCount}>{description.length}/500</Text>
                )}
              </View>

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
            <TouchableOpacity 
              style={[
                styles.publishButton,
                uploading && styles.publishButtonDisabled
              ]} 
              onPress={submit} 
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.publishButtonText, { marginLeft: 12 }]}>Publishing...</Text>
                </View>
              ) : (
                <View style={styles.publishButtonContent}>
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
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#d1d5db',
  cardBackground: '#1a1a3e',
  cardBackgroundAlt: '#252550',
  inputBackground: '#1a1a3e',
  accent: '#FDAD00',
  accentDark: '#e09b00',
  error: '#ef4444',
  success: '#10b981',
  shadowColor: '#000',
  borderColor: '#2d2d5a',
  buttonDisabled: '#4b5563',
  overlayBackground: 'rgba(0, 0, 0, 0.85)',
  infoBannerBg: '#2a2a55',
};

const lightTheme = {
  background: '#f8fafc',
  gradientBackground: '#e8ecf1',
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#475569',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f1f5f9',
  inputBackground: '#ffffff',
  accent: '#f39c12',
  accentDark: '#d68910',
  error: '#ef4444',
  success: '#10b981',
  shadowColor: '#000',
  borderColor: '#e2e8f0',
  buttonDisabled: '#cbd5e1',
  overlayBackground: 'rgba(0, 0, 0, 0.5)',
  infoBannerBg: '#fffbf0',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardView: {
    flex: 1,
  },
  headerContainer: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 24,
    marginBottom: 8,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 160 : 180,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 0,
  },
  headerContent: {
    zIndex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
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
  headerTextContainer: {
    marginTop: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
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
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
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
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
    fontSize: 17,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  sectionBadgeText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
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
  imagePicker: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 240,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  changeImageText: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  imagePlaceholder: {
    width: '100%',
    height: 240,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundAlt,
  },
  cameraIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: theme.borderColor,
  },
  imagePlaceholderText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginTop: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  imagePlaceholderSubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 10,
    fontFamily: 'Poppins-SemiBold',
  },
  requiredStar: {
    color: theme.error,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
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
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  textArea: {
    flex: 1,
    width: '100%',
    fontSize: 15,
    color: theme.text,
    paddingVertical: 12,
    minHeight: 120,
    fontFamily: 'Poppins-Regular',
  },
  selectorContainer: {
    marginBottom: 20,
  },
  selector: {
    borderWidth: 1.5,
    borderColor: theme.borderColor,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
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
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectorText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlayBackground,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '75%',
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    backgroundColor: theme.cardBackgroundAlt,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  modalCloseButton: {
    padding: 4,
  },
  optionsScroll: {
    maxHeight: 400,
  },
  option: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: theme.cardBackgroundAlt,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIconCircleSelected: {
    backgroundColor: theme.accent,
  },
  optionText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  optionTextSelected: {
    fontWeight: '700',
    color: theme.accent,
    fontFamily: 'Poppins-Bold',
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.infoBannerBg,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  infoBannerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: theme.text,
    lineHeight: 19,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  publishButton: {
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  publishButtonDisabled: {
    backgroundColor: theme.buttonDisabled,
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
  publishButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});