import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function GetVerifiedScreen({ navigation }) {
  const user = auth.currentUser;
  const [studentId, setStudentId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idImage, setIdImage] = useState(null);
  const [corImage, setCorImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [rejected, setRejected] = useState(false);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  useEffect(() => {
    const checkPreviousStatus = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('verifications')
        .select('status')
        .eq('email', user.email)
        .maybeSingle();

      if (!error && data?.status === 'rejected') {
        setRejected(true);
      }
    };

    checkPreviousStatus();
  }, []);

  const pickImage = async (type) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      if (type === 'id') setIdImage(imageUri);
      else setCorImage(imageUri);
    }
  };

  const uploadFile = async (uri, bucketName, filePath) => {
    try {
      const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      throw new Error(`Upload failed for ${bucketName}: ${err.message}`);
    }
  };

  const handleSubmit = async () => {
    if (!studentId || !phoneNumber || !idImage || !corImage) {
      Alert.alert('Missing Fields', 'Please fill out all fields and upload both images.');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Check if a request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('verifications')
        .select('id, status')
        .eq('email', user.email)
        .maybeSingle();

      if (checkError) throw checkError;

      // Step 2: Handle based on current status
      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          Alert.alert('Already Submitted', 'Your verification is still pending. Please wait for approval.');
          setUploading(false);
          return;
        }

        if (existingRequest.status === 'approved') {
          Alert.alert('Already Verified', 'Your account is already verified.');
          setUploading(false);
          return;
        }

        if (existingRequest.status === 'rejected') {
          // Delete the old rejected request to allow re-submission
          await supabase.from('verifications').delete().eq('id', existingRequest.id);
        }
      }

      // Step 3: Upload files to Supabase storage
      const idUrl = await uploadFile(idImage, 'student-ids', `${user.uid}-id.jpg`);
      const corUrl = await uploadFile(corImage, 'cor-images', `${user.uid}-cor.jpg`);

      // Step 4: Insert new verification record
      const { error: insertError } = await supabase.from('verifications').insert([
        {
          user_id: user.uid,
          email: user.email,
          phone_number: phoneNumber,
          student_id: studentId,
          id_image: idUrl,
          cor_image: corUrl,
          status: 'pending',
        },
      ]);

      if (insertError) throw insertError;

      Alert.alert('Submitted', 'Your new verification request has been submitted!');
      navigation.replace('VerificationStatus');
    } catch (err) {
      console.error('Error submitting verification request:', err.message);
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
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
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.headerContainer}>
            {/* Background gradient effect */}
            <View style={styles.backgroundGradient} />

            {/* Branded logo */}
            <View style={styles.brandedLogoContainer}>
              <Image
                source={require('../../assets/images/OfficialBuyNaBay.png')}
                style={styles.brandedLogoImage}
                resizeMode="contain"
              />
              <Text style={styles.brandedLogoText}>BuyNaBay</Text>
            </View>

            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <View style={styles.verificationIconCircle}>
                <Ionicons name="shield-checkmark" size={32} color={theme.accent} />
              </View>
              <Text style={styles.welcomeText}>Account Verification</Text>
              <Text style={styles.userName}>Get Verified</Text>
              <Text style={styles.subtitle}>Submit your documents for verification</Text>
            </View>
          </View>

          {/* Rejection Banner */}
          {rejected && (
            <View style={styles.banner}>
              <View style={styles.bannerHeader}>
                <Icon name="exclamation-circle" size={20} color={theme.error} />
                <Text style={styles.bannerTitle}> Verification Rejected</Text>
              </View>
              <Text style={styles.bannerText}>
                Your previous verification was rejected. Please review your details and resubmit your request below.
              </Text>
            </View>
          )}

          {/* Form Section */}
          <View style={styles.formContainer}>
            {/* Instructions Card */}
            <View style={styles.instructionsCard}>
              <View style={styles.instructionsHeader}>
                <Icon name="info-circle" size={18} color={theme.accent} />
                <Text style={styles.instructionsTitle}> What You'll Need</Text>
              </View>
              <View style={styles.instructionItem}>
                <Icon name="check" size={14} color={theme.success} />
                <Text style={styles.instructionText}> Valid Student ID Number</Text>
              </View>
              <View style={styles.instructionItem}>
                <Icon name="check" size={14} color={theme.success} />
                <Text style={styles.instructionText}> Active Phone Number</Text>
              </View>
              <View style={styles.instructionItem}>
                <Icon name="check" size={14} color={theme.success} />
                <Text style={styles.instructionText}> Clear Student ID Photo</Text>
              </View>
              <View style={styles.instructionItem}>
                <Icon name="check" size={14} color={theme.success} />
                <Text style={styles.instructionText}> Certificate of Registration (COR)</Text>
              </View>
            </View>

            {/* Student ID Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Student ID Number</Text>
              <View style={styles.inputWrapper}>
                <Icon name="id-card" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your Student ID"
                  placeholderTextColor={theme.textSecondary}
                  value={studentId}
                  onChangeText={setStudentId}
                />
              </View>
            </View>

            {/* Phone Number Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Icon name="phone" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your phone number"
                  placeholderTextColor={theme.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Student ID Image Upload */}
            <View style={styles.uploadSection}>
              <Text style={styles.uploadLabel}>Student ID Photo</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage('id')}
                activeOpacity={0.85}
              >
                <Icon
                  name={idImage ? 'refresh' : 'camera'}
                  size={18}
                  color="#fff"
                  style={styles.uploadButtonIcon}
                />
                <Text style={styles.uploadButtonText}>
                  {idImage ? 'Change Photo' : 'Upload Photo'}
                </Text>
              </TouchableOpacity>

              {idImage && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: idImage }} style={styles.preview} />
                  <View style={styles.previewOverlay}>
                    <Icon name="check-circle" size={32} color={theme.success} />
                  </View>
                </View>
              )}
            </View>

            {/* COR Image Upload */}
            <View style={styles.uploadSection}>
              <Text style={styles.uploadLabel}>Certificate of Registration (COR)</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage('cor')}
                activeOpacity={0.85}
              >
                <Icon
                  name={corImage ? 'refresh' : 'camera'}
                  size={18}
                  color="#fff"
                  style={styles.uploadButtonIcon}
                />
                <Text style={styles.uploadButtonText}>
                  {corImage ? 'Change Photo' : 'Upload Photo'}
                </Text>
              </TouchableOpacity>

              {corImage && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: corImage }} style={styles.preview} />
                  <View style={styles.previewOverlay}>
                    <Icon name="check-circle" size={32} color={theme.success} />
                  </View>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? (
                <View style={styles.submitLoadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.submitButtonText, { marginLeft: 10 }]}>Submitting...</Text>
                </View>
              ) : (
                <>
                  <Icon name="send" size={18} color="#fff" style={styles.submitButtonIcon} />
                  <Text style={styles.submitButtonText}>Submit Verification</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Privacy Notice */}
            <View style={styles.privacyNotice}>
              <Icon name="lock" size={14} color={theme.textSecondary} />
              <Text style={styles.privacyText}>
                {' '}Your information is secure and will only be used for verification purposes.
              </Text>
            </View>
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
  success: '#4CAF50',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  inputBackground: '#252550',
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
  success: '#27ae60',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  inputBackground: '#f9f9fc',
};

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      paddingBottom: 40,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: Platform.OS === 'ios' ? 280 : 300,
      backgroundColor: theme.gradientBackground,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      zIndex: 0,
    },
    headerContainer: {
      paddingHorizontal: Math.max(width * 0.05, 20),
      paddingTop: Platform.OS === 'ios' ? 10 : 20,
      paddingBottom: 20,
      zIndex: 1,
    },
    brandedLogoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 30,
    },
    brandedLogoImage: {
      width: 32,
      height: 32,
      marginRight: 8,
    },
    brandedLogoText: {
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      color: theme.accentSecondary,
      letterSpacing: -0.5,
    },
    welcomeSection: {
      alignItems: 'center',
      marginBottom: 20,
    },
    verificationIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.cardBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    welcomeText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      marginBottom: 4,
    },
    userName: {
      fontSize: Math.min(width * 0.08, 32),
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      textAlign: 'center',
    },
    banner: {
      backgroundColor: theme.error + '15',
      borderLeftWidth: 4,
      borderLeftColor: theme.error,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: Math.max(width * 0.05, 20),
      marginBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: theme.error,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    bannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    bannerTitle: {
      fontSize: 16,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.error,
    },
    bannerText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    formContainer: {
      paddingHorizontal: Math.max(width * 0.05, 20),
    },
    instructionsCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    instructionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    instructionsTitle: {
      fontSize: 16,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.text,
    },
    instructionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    instructionText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    inputContainer: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: Platform.OS === 'android' ? '600' : '500',
      color: theme.text,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBackground,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 12,
      paddingHorizontal: 16,
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
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    },
    uploadSection: {
      marginBottom: 24,
    },
    uploadLabel: {
      fontSize: 14,
      fontWeight: Platform.OS === 'android' ? '600' : '500',
      color: theme.text,
      marginBottom: 12,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 14,
      borderRadius: 12,
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    uploadButtonIcon: {
      marginRight: 8,
    },
    uploadButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
    },
    previewContainer: {
      marginTop: 16,
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.success,
    },
    preview: {
      width: '100%',
      height: 200,
      resizeMode: 'cover',
    },
    previewOverlay: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 4,
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
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.success,
      paddingVertical: Platform.OS === 'ios' ? 18 : 16,
      borderRadius: 16,
      marginTop: 8,
      ...Platform.select({
        ios: {
          shadowColor: theme.success,
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
      backgroundColor: theme.textSecondary,
      ...Platform.select({
        ios: {
          shadowOpacity: 0.2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    submitButtonIcon: {
      marginRight: 10,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
    },
    submitLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    privacyNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 20,
      paddingHorizontal: 8,
    },
    privacyText: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
    },
  });