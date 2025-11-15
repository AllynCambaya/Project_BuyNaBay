// screens/tabs/AddLostItemScreen.js
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
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

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

  const uploadImages = async (uris) => {
    try {
      const uploadedUrls = [];
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        const fileExt = uri.split('.').pop().split('?')[0];
        const fileName = `lost_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `lost-and-found/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('lost-and-found-images')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('lost-and-found-images').getPublicUrl(filePath);
        uploadedUrls.push(data?.publicUrl || null);
        
        setUploadProgress(((i + 1) / uris.length) * 50);
      }
      return uploadedUrls;
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Not Logged In", "You must be logged in to report an item.");
      return;
    }

    if (!itemName.trim() || !location.trim()) {
      Alert.alert('Missing Information', 'Please provide item name and location');
      return;
    }

    Keyboard.dismiss();
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const email = user?.email ?? "test@example.com";

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, profile_photo')
        .eq('email', email)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.warn("⚠️ User data fetch error:", userError);
      }

      setUploadProgress(10);

      let imageUrls = null;
      if (images.length > 0) {
        imageUrls = await uploadImages(images);
      }

      setUploadProgress(60);

      const { data: lostItemData, error: insertError } = await supabase
        .from('lost_and_found_items')
        .insert([
          {
            user_id: user.uid,
            user_email: email,
            user_name: userData?.name || 'Anonymous',
            user_avatar: userData?.profile_photo || null,
            item_name: itemName.trim(),
            description: description.trim() || null,
            location: location.trim(),
            item_status: itemStatus,
            lost_and_found_url: imageUrls,
          },
        ])
        .select();

      if (insertError) throw insertError;

      if (!lostItemData || lostItemData.length === 0) {
        throw new Error("Lost item report was not created");
      }

      setUploadProgress(100);

      Alert.alert('Success', 'Your report has been submitted! 🎉', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      
      setItemName('');
      setDescription('');
      setLocation('');
      setItemStatus('lost');
      setImages([]);

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

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
                <Ionicons name="search" size={22} color="#fff" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { fontFamily: fontFamily.extraBold }]}>Report Item</Text>
                <Text style={[styles.headerSubtitle, { fontFamily: fontFamily.medium }]}>Lost & Found</Text>
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
                  <Ionicons name="help-circle" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>What happened?</Text>
                <View style={styles.sectionBadge}>
                  <Text style={[styles.sectionBadgeText, { fontFamily: fontFamily.semiBold }]}>Required</Text>
                </View>
              </View>

              <View style={styles.statusContainer}>
                <TouchableOpacity
                  onPress={() => setItemStatus('lost')}
                  style={[styles.statusButton, itemStatus === 'lost' && styles.statusButtonActive]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusIconCircle, itemStatus === 'lost' && styles.statusIconCircleActive]}>
                    <Ionicons name="sad-outline" size={22} color={itemStatus === 'lost' ? '#fff' : theme.accent} />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={[styles.statusText, itemStatus === 'lost' && styles.statusTextActive, { fontFamily: fontFamily.bold }]}>
                      I Lost Something
                    </Text>
                    <Text style={[styles.statusSubtext, itemStatus === 'lost' && styles.statusSubtextActive, { fontFamily: fontFamily.regular }]}>
                      Report a missing item
                    </Text>
                  </View>
                  {itemStatus === 'lost' && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setItemStatus('found')}
                  style={[styles.statusButton, itemStatus === 'found' && styles.statusButtonActive]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusIconCircle, itemStatus === 'found' && styles.statusIconCircleActive]}>
                    <Ionicons name="happy-outline" size={22} color={itemStatus === 'found' ? '#fff' : theme.accent} />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={[styles.statusText, itemStatus === 'found' && styles.statusTextActive, { fontFamily: fontFamily.bold }]}>
                      I Found Something
                    </Text>
                    <Text style={[styles.statusSubtext, itemStatus === 'found' && styles.statusSubtextActive, { fontFamily: fontFamily.regular }]}>
                      Help return an item
                    </Text>
                  </View>
                  {itemStatus === 'found' && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Image Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="image" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Item Photos</Text>
                <View style={styles.sectionBadge}>
                  <Text style={[styles.sectionBadgeText, { fontFamily: fontFamily.semiBold }]}>{images.length > 0 ? `${images.length}` : 'Optional'}</Text>
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
                            <Ionicons name="star" size={10} color="#fff" />
                            <Text style={[styles.primaryBadgeText, { fontFamily: fontFamily.bold }]}>Main</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity onPress={pickImages} style={styles.addMoreImagesButton} activeOpacity={0.7}>
                      <Ionicons name="add-circle" size={36} color={theme.accent} />
                      <Text style={[styles.addMoreText, { fontFamily: fontFamily.semiBold }]}>Add More</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  <Text style={[styles.imageHintText, { fontFamily: fontFamily.regular }]}>💡 Clear photos help identify items faster</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePicker} onPress={pickImages} activeOpacity={0.85}>
                  <View style={styles.imagePlaceholder}>
                    <View style={styles.cameraIconContainer}>
                      <Ionicons name="camera" size={36} color={theme.accent} />
                    </View>
                    <Text style={[styles.imagePlaceholderText, { fontFamily: fontFamily.semiBold }]}>Add Photos</Text>
                    <Text style={[styles.imagePlaceholderSubtext, { fontFamily: fontFamily.regular }]}>
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
                  <Ionicons name="information-circle" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Item Details</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>Item Name <Text style={styles.requiredStar}>*</Text></Text>
                <View style={[styles.inputWrapper, itemName && styles.inputWrapperFocused]}>
                  <Ionicons name="pricetag-outline" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput 
                    style={[styles.input, { fontFamily: fontFamily.regular }]} 
                    value={itemName} 
                    onChangeText={setItemName} 
                    placeholder="e.g. Black Wallet, Blue Umbrella"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={100}
                  />
                </View>
                {itemName && <Text style={[styles.characterCount, { fontFamily: fontFamily.regular }]}>{itemName.length}/100</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
                  {itemStatus === 'lost' ? 'Last Seen Location' : 'Found Location'} <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={[styles.inputWrapper, location && styles.inputWrapperFocused]}>
                  <Ionicons name="location-outline" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput 
                    style={[styles.input, { fontFamily: fontFamily.regular }]} 
                    value={location} 
                    onChangeText={setLocation} 
                    placeholder="e.g. Library 2nd Floor, Main Building Lobby"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={100}
                  />
                </View>
                {location && <Text style={[styles.characterCount, { fontFamily: fontFamily.regular }]}>{location.length}/100</Text>}
              </View>
            </View>

            {/* Description Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="document-text" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Additional Details</Text>
              </View>

              <View style={[styles.inputWrapper, styles.textAreaWrapper, description && styles.inputWrapperFocused]}>
                <TextInput 
                  style={[styles.textArea, { fontFamily: fontFamily.regular }]} 
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
              {description && <Text style={[styles.characterCount, { fontFamily: fontFamily.regular }]}>{description.length}/500</Text>}
            </View>

            {/* Upload Progress */}
            {uploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Ionicons name="cloud-upload" size={20} color={theme.accent} />
                  <Text style={[styles.progressTitle, { fontFamily: fontFamily.semiBold }]}>Submitting Your Report</Text>
                </View>
                <View style={styles.progressBar}>
                  <Animated.View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                </View>
                <Text style={[styles.progressText, { fontFamily: fontFamily.regular }]}>
                  {uploadProgress < 100 ? `Processing... ${Math.round(uploadProgress)}%` : 'Almost done! 🎉'}
                </Text>
              </View>
            )}

            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <View style={styles.infoBannerIconContainer}>
                <Ionicons name="bulb" size={20} color={theme.accent} />
              </View>
              <Text style={[styles.infoBannerText, { fontFamily: fontFamily.medium }]}>
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
                <Text style={[styles.publishButtonText, { fontFamily: fontFamily.bold }]}>Submitting...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={[styles.publishButtonText, { fontFamily: fontFamily.bold }]}>Submit Report</Text>
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
  statusContainer: { gap: 12 },
  statusButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08`, borderWidth: 1.5, borderColor: theme.borderColor || theme.border, shadowColor: theme.shadowColor || '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  statusButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent, shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 8 },
  statusIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  statusIconCircleActive: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  statusTextContainer: { flex: 1 },
  statusText: { fontSize: 16, color: theme.text, marginBottom: 2 },
  statusTextActive: { color: '#fff' },
  statusSubtext: { fontSize: 12, color: theme.textSecondary },
  statusSubtextActive: { color: 'rgba(255, 255, 255, 0.85)' },
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
  textAreaWrapper: { alignItems: 'flex-start', paddingTop: 4 },
  textArea: { flex: 1, width: '100%', fontSize: 15, color: theme.text, paddingVertical: 12, minHeight: 120 },
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