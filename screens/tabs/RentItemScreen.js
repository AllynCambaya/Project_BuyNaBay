import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
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

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Trigger animations on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  // Enhanced selector component
  const Selector = ({ label, value, options, onSelect, icon }) => {
    const [open, setOpen] = useState(false);
    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity 
          style={styles.selector} 
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.selectorContent}>
            {icon && <Icon name={icon} size={16} color={theme.accent} style={{ marginRight: 10 }} />}
            <Text style={styles.selectorText}>{value}</Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <Modal visible={open} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setOpen(false)}
          >
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <TouchableOpacity onPress={() => setOpen(false)}>
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
                    <Text style={[
                      styles.optionText,
                      value === opt && styles.optionTextSelected
                    ]}>
                      {opt}
                    </Text>
                    {value === opt && (
                      <Icon name="check" size={18} color={theme.accent} />
                    )}
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
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Rental Item</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {/* Image Picker Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="camera" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Item Photo</Text>
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
                        <Icon name="camera" size={24} color="#fff" />
                        <Text style={styles.changeImageText}>Change Photo</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <View style={styles.cameraIconContainer}>
                        <Icon name="camera" size={40} color={theme.accent} />
                      </View>
                      <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                      <Text style={styles.imagePlaceholderSubtext}>Show renters what you're offering</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Basic Info Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="info-circle" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Basic Information</Text>
                </View>

                <View style={styles.card}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Item Name *</Text>
                    <TextInput 
                      style={styles.input} 
                      value={itemName} 
                      onChangeText={setItemName} 
                      placeholder="e.g. DSLR Camera, Power Drill"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Rental Price (₱) *</Text>
                    <View style={styles.inputWithIcon}>
                      <Icon name="tag" size={18} color={theme.accent} style={styles.inputIcon} />
                      <TextInput 
                        style={[styles.input, styles.inputWithIconPadding]} 
                        value={price} 
                        onChangeText={setPrice} 
                        keyboardType="numeric" 
                        placeholder="e.g. 250"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>

                  <Selector 
                    label="Rental Duration" 
                    value={rentalDuration} 
                    options={DURATION_OPTIONS} 
                    onSelect={setRentalDuration}
                    icon="clock-o"
                  />
                </View>
              </View>

              {/* Details Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="list" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Item Details</Text>
                </View>

                <View style={styles.card}>
                  <Selector 
                    label="Category" 
                    value={category} 
                    options={CATEGORY_OPTIONS} 
                    onSelect={setCategory}
                    icon="folder-open"
                  />

                  <Selector 
                    label="Condition" 
                    value={condition} 
                    options={CONDITION_OPTIONS} 
                    onSelect={setCondition}
                    icon="certificate"
                  />

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Available Quantity</Text>
                    <View style={styles.inputWithIcon}>
                      <Icon name="cubes" size={18} color={theme.accent} style={styles.inputIcon} />
                      <TextInput 
                        style={[styles.input, styles.inputWithIconPadding]} 
                        value={quantity} 
                        onChangeText={setQuantity} 
                        keyboardType="numeric"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Description Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="align-left" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Description</Text>
                </View>

                <View style={styles.card}>
                  <TextInput 
                    style={styles.textArea} 
                    value={description} 
                    onChangeText={setDescription} 
                    multiline 
                    numberOfLines={6}
                    placeholder="Describe your item, rental terms, and any special instructions..."
                    placeholderTextColor={theme.textSecondary}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <Icon name="lightbulb-o" size={20} color={theme.accent} />
                <Text style={styles.infoBannerText}>
                  Add clear photos and detailed descriptions to attract more renters!
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
                  <Text style={[styles.publishButtonText, { marginLeft: 10 }]}>Publishing...</Text>
                </View>
              ) : (
                <>
                  <Icon name="rocket" size={20} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.publishButtonText}>Publish Rental Item</Text>
                  <Icon name="arrow-right" size={16} color="#fff" style={{ marginLeft: 10 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  inputBackground: '#1e1e3f',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  historyColor: '#4CAF50',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  buttonDisabled: '#555',
  overlayBackground: 'rgba(0,0,0,0.9)',
  infoBannerBg: '#2a2a55',
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
  inputBackground: '#f9f9fc',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  historyColor: '#27ae60',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  buttonDisabled: '#ccc',
  overlayBackground: 'rgba(0,0,0,0.5)',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Math.max(width * 0.04, 16),
    paddingVertical: 16,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    padding: Math.max(width * 0.04, 16),
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
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
  imagePicker: {
    width: '100%',
    borderRadius: 16,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  changeImageText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  imagePlaceholder: {
    width: '100%',
    height: 240,
    borderRadius: 16,
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
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginTop: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  imagePlaceholderSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    color: theme.text,
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.inputBackground,
    fontSize: 15,
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: [{ translateY: -9 }],
    zIndex: 1,
  },
  inputWithIconPadding: {
    paddingLeft: 44,
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.inputBackground,
    fontSize: 15,
    color: theme.text,
    minHeight: 120,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  selectorContainer: {
    marginBottom: 16,
  },
  selector: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    fontSize: 15,
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlayBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
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
  optionText: {
    fontSize: 15,
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  optionTextSelected: {
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.infoBannerBg,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  bottomContainer: {
    backgroundColor: theme.cardBackground,
    paddingHorizontal: Math.max(width * 0.04, 16),
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  publishButton: {
    backgroundColor: theme.accent,
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    borderRadius: 16,
    flexDirection: 'row',
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
        shadowOpacity: 0.2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});