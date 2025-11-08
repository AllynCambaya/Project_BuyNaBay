// screens/AddLostItemScreen.js
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

const { width } = Dimensions.get('window');

// Typography system (matching AddRentalScreen.js)
const fontFamily = {
  regular: Platform.select({ ios: 'Poppins-Regular', android: 'Poppins-Regular', default: 'System' }),
  medium: Platform.select({ ios: 'Poppins-Medium', android: 'Poppins-Medium', default: 'System' }),
  semiBold: Platform.select({ ios: 'Poppins-SemiBold', android: 'Poppins-SemiBold', default: 'System' }),
  bold: Platform.select({ ios: 'Poppins-Bold', android: 'Poppins-Bold', default: 'System' }),
  extraBold: Platform.select({ ios: 'Poppins-ExtraBold', android: 'Poppins-ExtraBold', default: 'System' }),
};

export default function AddLostItemScreen({ navigation }) {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [itemStatus, setItemStatus] = useState('lost');
  const [images, setImages] = useState([]);
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

  const handleSubmit = async () => {
    if (!itemName.trim() || !location.trim()) {
      Alert.alert('Missing Information', 'Please provide item name and location');
      return;
    }

    Keyboard.dismiss();
    setUploading(true);
    
    // Simulate upload
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
      Alert.alert('Success', 'Your report has been submitted! 🎉', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      
      // Reset form
      setItemName('');
      setDescription('');
      setLocation('');
      setItemStatus('lost');
      setImages([]);
    }, 2500);
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.backgroundGradient} />
            
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              
              <View style={styles.headerTitleRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="search" size={22} color="#fff" />
                </View>
                <View style={styles.headerTitles}>
                  <Text style={styles.headerTitle}>Report Item</Text>
                  <Text style={styles.headerSubtitle}>Help reunite lost items with their owners</Text>
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
              
              {/* Status Selection */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="question-circle" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>What happened?</Text>
                </View>

                <View style={styles.statusContainer}>
                  <TouchableOpacity
                    onPress={() => setItemStatus('lost')}
                    style={[styles.statusButton, itemStatus === 'lost' && styles.statusButtonActive]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusIconCircle, itemStatus === 'lost' && styles.statusIconCircleActive]}>
                      <Ionicons name="sad-outline" size={20} color={itemStatus === 'lost' ? '#fff' : theme.accent} />
                    </View>
                    <View style={styles.statusTextContainer}>
                      <Text style={[styles.statusText, itemStatus === 'lost' && styles.statusTextActive]}>
                        I Lost Something
                      </Text>
                      <Text style={[styles.statusSubtext, itemStatus === 'lost' && styles.statusSubtextActive]}>
                        Report a missing item
                      </Text>
                    </View>
                    {itemStatus === 'lost' && <Icon name="check-circle" size={20} color="#fff" />}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => setItemStatus('found')}
                    style={[styles.statusButton, itemStatus === 'found' && styles.statusButtonActive]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusIconCircle, itemStatus === 'found' && styles.statusIconCircleActive]}>
                      <Ionicons name="happy-outline" size={20} color={itemStatus === 'found' ? '#fff' : theme.accent} />
                    </View>
                    <View style={styles.statusTextContainer}>
                      <Text style={[styles.statusText, itemStatus === 'found' && styles.statusTextActive]}>
                        I Found Something
                      </Text>
                      <Text style={[styles.statusSubtext, itemStatus === 'found' && styles.statusSubtextActive]}>
                        Help return an item
                      </Text>
                    </View>
                    {itemStatus === 'found' && <Icon name="check-circle" size={20} color="#fff" />}
                  </TouchableOpacity>
                </View>
              </View>

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
                              <Text style={styles.primaryBadgeText}>Main</Text>
                            </View>
                          )}
                        </View>
                      ))}
                      <TouchableOpacity onPress={pickImages} style={styles.addMoreImagesButton} activeOpacity={0.7}>
                        <Ionicons name="add-circle" size={36} color={theme.accent} />
                        <Text style={styles.addMoreText}>Add More</Text>
                      </TouchableOpacity>
                    </ScrollView>
                    <Text style={styles.imageHintText}>💡 Clear photos help identify items faster</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.imagePicker} onPress={pickImages} activeOpacity={0.85}>
                    <View style={styles.imagePlaceholder}>
                      <View style={styles.cameraIconContainer}>
                        <Icon name="camera" size={36} color={theme.accent} />
                      </View>
                      <Text style={styles.imagePlaceholderText}>Add Photos</Text>
                      <Text style={styles.imagePlaceholderSubtext}>
                        Upload images to help identify the item
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Item Details Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="info-circle" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Item Details</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Item Name <Text style={styles.requiredStar}>*</Text></Text>
                  <View style={[styles.inputWrapper, itemName && styles.inputWrapperFocused]}>
                    <Icon name="tag" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      value={itemName} 
                      onChangeText={setItemName} 
                      placeholder="e.g. Black Wallet, Blue Umbrella"
                      placeholderTextColor={theme.textSecondary}
                      maxLength={100}
                    />
                  </View>
                  {itemName && <Text style={styles.characterCount}>{itemName.length}/100</Text>}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {itemStatus === 'lost' ? 'Last Seen Location' : 'Found Location'} <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={[styles.inputWrapper, location && styles.inputWrapperFocused]}>
                    <Icon name="map-marker" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      value={location} 
                      onChangeText={setLocation} 
                      placeholder="e.g. Library 2nd Floor, Main Building Lobby"
                      placeholderTextColor={theme.textSecondary}
                      maxLength={100}
                    />
                  </View>
                  {location && <Text style={styles.characterCount}>{location.length}/100</Text>}
                </View>
              </View>

              {/* Description Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrapper}>
                    <Icon name="align-left" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Additional Details</Text>
                </View>

                <View style={[styles.inputWrapper, styles.textAreaWrapper, description && styles.inputWrapperFocused]}>
                  <TextInput 
                    style={styles.textArea} 
                    value={description} 
                    onChangeText={setDescription} 
                    multiline 
                    numberOfLines={6}
                    placeholder="Add details like color, brand, size, or distinguishing features..."
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
                    <Text style={styles.progressTitle}>Submitting Your Report</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <Animated.View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {uploadProgress < 100 ? `Processing... ${Math.round(uploadProgress)}%` : 'Almost done! 🎉'}
                  </Text>
                </View>
              )}

              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <View style={styles.infoBannerIconContainer}>
                  <Icon name="lightbulb-o" size={20} color={theme.accent} />
                </View>
                <Text style={styles.infoBannerText}>
                  {itemStatus === 'lost' 
                    ? 'Provide detailed information to help others identify your item'
                    : 'Your good deed helps reunite items with their owners!'
                  }
                </Text>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Fixed Bottom Button */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity style={[styles.publishButton, uploading && styles.publishButtonDisabled]} onPress={handleSubmit} disabled={uploading} activeOpacity={0.85}>
              {uploading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.publishButtonText}>Submitting...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Icon name="send" size={20} color="#fff" />
                  <Text style={styles.publishButtonText}>Submit Report</Text>
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
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.cardBackground, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, ...Platform.select({ ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 3 } }) },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginRight: 14, ...Platform.select({ ios: { shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }) },
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
  card: { backgroundColor: theme.cardBackground, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, ...Platform.select({ ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } }) },
  statusContainer: { gap: 12 },
  statusButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: theme.cardBackgroundAlt, borderWidth: 1.5, borderColor: theme.borderColor, ...Platform.select({ ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 }, android: { elevation: 2 } }) },
  statusButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent, ...Platform.select({ ios: { shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 8 }, android: { elevation: 6 } }) },
  statusIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statusIconCircleActive: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  statusTextContainer: { flex: 1 },
  statusText: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 2, fontFamily: fontFamily.bold },
  statusTextActive: { color: '#fff' },
  statusSubtext: { fontSize: 12, color: theme.textSecondary, fontFamily: fontFamily.regular },
  statusSubtextActive: { color: 'rgba(255, 255, 255, 0.85)' },
  imagePicker: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  imagePlaceholder: { width: '100%', minHeight: 200, borderRadius: 20, borderWidth: 2, borderColor: theme.borderColor, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackgroundAlt, paddingVertical: 40, paddingHorizontal: 24 },
  cameraIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 3, borderColor: theme.borderColor },
  imagePlaceholderText: { fontSize: 17, fontWeight: '600', color: theme.text, marginTop: 8, fontFamily: fontFamily.semiBold },
  imagePlaceholderSubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18, fontFamily: fontFamily.regular },
  imageScrollContent: { paddingHorizontal: 20, paddingVertical: 4 },
  imagePreviewContainer: { position: 'relative', marginRight: 12 },
  imagePreview: { width: 160, height: 160, borderRadius: 16, backgroundColor: theme.cardBackgroundAlt, ...Platform.select({ ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 }, android: { elevation: 4 } }) },
  removeImageButton: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.error, justifyContent: 'center', alignItems: 'center' },
  primaryBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: theme.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  primaryBadgeText: { fontSize: 11, color: '#fff', fontFamily: fontFamily.bold },
  addMoreImagesButton: { width: 160, height: 160, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.borderColor, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackgroundAlt },
  addMoreText: { fontSize: 13, color: theme.textSecondary, marginTop: 8, fontFamily: fontFamily.semiBold },
  imageHintText: { fontSize: 12, color: theme.textSecondary, marginTop: 12, textAlign: 'center', fontFamily: fontFamily.regular },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 10, fontFamily: fontFamily.semiBold },
  requiredStar: { color: theme.error },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBackground, borderWidth: 1.5, borderColor: theme.borderColor, borderRadius: 14, paddingHorizontal: 16, ...Platform.select({ ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }) },
  inputWrapperFocused: { borderColor: theme.accent, borderWidth: 2, ...Platform.select({ ios: { shadowColor: theme.accent, shadowOpacity: 0.15, shadowRadius: 6 }, android: { elevation: 3 } }) },
  inputIcon: { marginRight: 12, opacity: 0.6 },
  input: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 14, fontFamily: fontFamily.regular },
  characterCount: { fontSize: 11, color: theme.textSecondary, textAlign: 'right', marginTop: 6, fontFamily: fontFamily.regular },
  textAreaWrapper: { alignItems: 'flex-start', paddingTop: 4 },
  textArea: { flex: 1, width: '100%', fontSize: 15, color: theme.text, paddingVertical: 12, minHeight: 120, fontFamily: fontFamily.regular },
  progressContainer: { backgroundColor: theme.cardBackground, borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  progressTitle: { fontSize: 15, color: theme.text, fontFamily: fontFamily.semiBold },
  progressBar: { height: 10, backgroundColor: theme.cardBackgroundAlt, borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 6 },
  progressText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', fontFamily: fontFamily.regular },
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.infoBannerBg, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.borderColor, marginBottom: 16, ...Platform.select({ ios: { shadowColor: theme.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  infoBannerIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.cardBackground, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoBannerText: { flex: 1, fontSize: 13, color: theme.text, lineHeight: 19, fontWeight: '500', fontFamily: fontFamily.medium },
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.cardBackground, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16, borderTopWidth: 1, borderTopColor: theme.borderColor, ...Platform.select({ ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 }, android: { elevation: 10 } }) },
  publishButton: { backgroundColor: theme.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: theme.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 }, android: { elevation: 8 } }) },
  publishButtonDisabled: { backgroundColor: theme.buttonDisabled, ...Platform.select({ ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  publishButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', fontFamily: fontFamily.bold },
});