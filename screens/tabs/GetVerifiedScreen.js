// screens/tabs/GetVerifiedScreen.js
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';
import { getVerificationStatus } from '../../utils/verificationHelpers';

const { width } = Dimensions.get('window');

export default function GetVerifiedScreen({ navigation }) {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(auth.currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentIdImage, setStudentIdImage] = useState(null);
  const [corImage, setCorImage] = useState(null);
  const [agreeAccurate, setAgreeAccurate] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [checkingStatus, setCheckingStatus] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkExistingVerification();
  }, []);

  useEffect(() => {
    if (!checkingStatus) {
      Animated.parallel([
        Animated.timing(headerSlideAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
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
    }
  }, [checkingStatus]);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: currentStep,
      tension: 60,
      friction: 10,
      useNativeDriver: false,
    }).start();

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 0, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
      ]),
    ]).start();
  }, [currentStep]);

  const checkExistingVerification = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      navigation.replace('Tabs');
      return;
    }

    try {
      const { status, canSubmit } = await getVerificationStatus(user.email);

      if (status === 'pending') {
        Alert.alert(
          '⏳ Verification Pending',
          'You already have a pending verification request.',
          [{ text: 'View Status', onPress: () => navigation.replace('VerificationStatus') }]
        );
        return;
      }

      if (status === 'approved') {
        Alert.alert(
          '✅ Already Verified',
          'Your account is already verified!',
          [{ text: 'OK', onPress: () => navigation.replace('Tabs') }]
        );
        return;
      }

      if (status === 'rejected') {
        Alert.alert(
          '❌ Previous Request Rejected',
          'Your previous verification was rejected. You can submit a new request.',
          [{ text: 'Continue' }]
        );
      }

      setCheckingStatus(false);
    } catch (error) {
      console.error('Error checking verification:', error);
      setCheckingStatus(false);
    }
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }
      if (!phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (!/^09\d{9}$/.test(phone)) {
        newErrors.phone = 'Use format: 09XXXXXXXXX';
      }
      if (!studentId.trim()) {
        newErrors.studentId = 'Student ID is required';
      } else if (!/^\d{10,}$/.test(studentId.replace(/\s/g, ''))) {
        newErrors.studentId = 'Student ID must be at least 10 digits';
      }
    }
    
    if (step === 2) {
      if (!studentIdImage) newErrors.studentIdImage = 'Please upload your Student ID';
      if (!corImage) newErrors.corImage = 'Please upload your COR';
    }
    
    if (step === 3) {
      if (!agreeAccurate) newErrors.agreeAccurate = 'Please confirm your information is accurate';
      if (!agreeTerms) newErrors.agreeTerms = 'Please accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    Keyboard.dismiss();
    if (!validateStep(currentStep)) return;
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    } else {
      navigation.goBack();
    }
  };

  const pickImage = async (source, imageType) => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera access is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery access is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });
      }

      if (!result.canceled) {
        if (imageType === 'studentId') {
          setStudentIdImage(result.assets[0].uri);
          setErrors({ ...errors, studentIdImage: null });
        } else {
          setCorImage(result.assets[0].uri);
          setErrors({ ...errors, corImage: null });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImageToStorage = async (uri, documentType) => {
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      
      const fileExt = uri.split('.').pop().split('?')[0];
      const fileName = `${auth.currentUser.uid}_${documentType}_${Date.now()}.${fileExt}`;
      const filePath = `verification/${fileName}`;

      let bucketName = 'verification-docs';
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError && uploadError.message.includes('Bucket not found')) {
        bucketName = 'product-images';
        const { error: retryError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });
        
        if (retryError) throw retryError;
      } else if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setUploading(true);
    setUploadProgress(0);
    Keyboard.dismiss();

    try {
      const user = auth.currentUser;
      if (!user?.email || !user?.uid) {
        throw new Error('User not authenticated');
      }

      const { data: existingPending } = await supabase
        .from('verifications')
        .select('id')
        .eq('email', user.email)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingPending) {
        Alert.alert(
          'Already Submitted',
          'You already have a pending verification request.',
          [{ text: 'View Status', onPress: () => navigation.replace('VerificationStatus') }]
        );
        setUploading(false);
        return;
      }

      setUploadProgress(25);
      const studentIdUrl = await uploadImageToStorage(studentIdImage, 'student_id');
      
      setUploadProgress(60);
      const corUrl = await uploadImageToStorage(corImage, 'cor');
      
      setUploadProgress(85);

      const { data: newVerification, error: insertError } = await supabase
        .from('verifications')
        .insert({
          user_id: user.uid,
          email: user.email,
          phone_number: phone,
          student_id: studentId,
          id_image: studentIdUrl,
          cor_image: corUrl,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(insertError.message);
      }

      setUploadProgress(100);

      setTimeout(() => {
        Alert.alert(
          '🎉 Submitted Successfully!',
          'Your verification request has been submitted. We\'ll review it within 1-2 business days.',
          [{ text: 'View Status', onPress: () => navigation.replace('VerificationStatus') }]
        );
      }, 500);
    } catch (error) {
      console.error('Submission error:', error);
      Alert.alert('Submission Failed', error.message || 'Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const openImagePreview = (imageUri) => {
    setPreviewImage(imageUri);
    setShowImagePreview(true);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Personal Information';
      case 2: return 'Upload Documents';
      case 3: return 'Review & Confirm';
      default: return '';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Enter your basic details to get started';
      case 2: return 'Upload clear photos of your Student ID and COR';
      case 3: return 'Review your information before submitting';
      default: return '';
    }
  };

  const styles = createStyles(theme, insets, isDarkMode);

  const renderProgressBar = () => {
    const progressWidth = progressAnim.interpolate({
      inputRange: [1, 2, 3],
      outputRange: ['33.33%', '66.66%', '100%'],
    });

    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
        </View>
        <View style={styles.progressDotsContainer}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.progressDot,
                currentStep >= step && styles.progressDotActive,
                currentStep > step && styles.progressDotCompleted,
              ]}
            >
              {currentStep > step ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={[styles.progressDotText, currentStep >= step && styles.progressDotTextActive]}>
                  {step}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderStep1 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroIconContainer}>
          <Ionicons name="shield-checkmark" size={48} color={theme.accent} />
        </View>
        <Text style={[styles.heroTitle, { fontFamily: fontFamily.extraBold }]}>
          Get Verified
        </Text>
        <Text style={[styles.heroSubtitle, { fontFamily: fontFamily.regular }]}>
          Join our trusted student community
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrapper}>
            <Ionicons name="person" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
            Basic Details
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Full Name <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, fullName && styles.inputWrapperFocused, errors.fullName && styles.inputWrapperError]}>
            <Ionicons name="person-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { fontFamily: fontFamily.regular, color: theme.text }]}
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setErrors({ ...errors, fullName: null });
              }}
              placeholder="Enter your full name"
              placeholderTextColor={theme.textSecondary}
              maxLength={100}
            />
          </View>
          {errors.fullName && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={[styles.errorText, { fontFamily: fontFamily.medium }]}>{errors.fullName}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Email Address <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, styles.inputWrapperDisabled]}>
            <Ionicons name="mail-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputDisabled, { fontFamily: fontFamily.regular, color: theme.textSecondary }]}
              value={email}
              editable={false}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
            />
            <Ionicons name="lock-closed" size={14} color={theme.textSecondary} />
          </View>
          <Text style={[styles.helperText, { fontFamily: fontFamily.regular }]}>This email is linked to your account</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Phone Number <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, phone && styles.inputWrapperFocused, errors.phone && styles.inputWrapperError]}>
            <Ionicons name="call-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { fontFamily: fontFamily.regular, color: theme.text }]}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setErrors({ ...errors, phone: null });
              }}
              placeholder="09XXXXXXXXXX"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              maxLength={13}
            />
          </View>
          {errors.phone ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={[styles.errorText, { fontFamily: fontFamily.medium }]}>{errors.phone}</Text>
            </View>
          ) : (
            <Text style={[styles.helperText, { fontFamily: fontFamily.regular }]}>Format: 09 followed by 9 digits</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Student ID Number <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, studentId && styles.inputWrapperFocused, errors.studentId && styles.inputWrapperError]}>
            <Ionicons name="card-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { fontFamily: fontFamily.regular, color: theme.text }]}
              value={studentId}
              onChangeText={(text) => {
                setStudentId(text);
                setErrors({ ...errors, studentId: null });
              }}
              placeholder="e.g., 2022301320"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={20}
            />
            {studentId.length > 0 && (
              <Text style={[styles.characterCount, { fontFamily: fontFamily.medium }]}>{studentId.length}/20</Text>
            )}
          </View>
          {errors.studentId ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={[styles.errorText, { fontFamily: fontFamily.medium }]}>{errors.studentId}</Text>
            </View>
          ) : (
            <Text style={[styles.helperText, { fontFamily: fontFamily.regular }]}>Enter your student ID number (at least 10 digits)</Text>
          )}
        </View>
      </View>

      {/* Benefits Card */}
      <View style={styles.benefitsCard}>
        <View style={styles.benefitsHeader}>
          <Ionicons name="sparkles" size={20} color={theme.accent} />
          <Text style={[styles.benefitsTitle, { fontFamily: fontFamily.bold }]}>Why Verify?</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.benefitText, { fontFamily: fontFamily.regular }]}>Access exclusive campus marketplace</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.benefitText, { fontFamily: fontFamily.regular }]}>Buy and sell with verified students</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.benefitText, { fontFamily: fontFamily.regular }]}>Safe and secure transactions</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrapper}>
            <Ionicons name="document-text" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
            Upload Documents
          </Text>
        </View>

        {/* Student ID Upload */}
        <View style={styles.uploadSection}>
          <View style={styles.uploadHeader}>
            <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
              Student ID <Text style={styles.requiredStar}>*</Text>
            </Text>
            {studentIdImage && (
              <TouchableOpacity onPress={() => setStudentIdImage(null)} style={styles.clearButton}>
                <Text style={[styles.clearButtonText, { fontFamily: fontFamily.semiBold }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {studentIdImage ? (
            <TouchableOpacity
              style={styles.imagePreviewContainer}
              onPress={() => openImagePreview(studentIdImage)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: studentIdImage }} style={styles.imagePreview} />
              <View style={styles.imagePreviewOverlay}>
                <View style={styles.previewIconContainer}>
                  <Ionicons name="eye" size={28} color="#fff" />
                  <Text style={[styles.previewText, { fontFamily: fontFamily.semiBold }]}>View Full Image</Text>
                </View>
              </View>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.uploadButtonsRow}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage('camera', 'studentId')}
                activeOpacity={0.8}
              >
                <View style={styles.uploadButtonIcon}>
                  <Ionicons name="camera" size={28} color={theme.accent} />
                </View>
                <Text style={[styles.uploadButtonText, { fontFamily: fontFamily.semiBold }]}>
                  Take Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage('gallery', 'studentId')}
                activeOpacity={0.8}
              >
                <View style={styles.uploadButtonIcon}>
                  <Ionicons name="images" size={28} color={theme.accent} />
                </View>
                <Text style={[styles.uploadButtonText, { fontFamily: fontFamily.semiBold }]}>
                  Choose Photo
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {errors.studentIdImage && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={[styles.errorText, { fontFamily: fontFamily.medium }]}>{errors.studentIdImage}</Text>
            </View>
          )}
        </View>

        {/* COR Upload */}
        <View style={styles.uploadSection}>
          <View style={styles.uploadHeader}>
            <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
              Certificate of Registration (COR) <Text style={styles.requiredStar}>*</Text>
            </Text>
            {corImage && (
              <TouchableOpacity onPress={() => setCorImage(null)} style={styles.clearButton}>
                <Text style={[styles.clearButtonText, { fontFamily: fontFamily.semiBold }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {corImage ? (
            <TouchableOpacity
              style={styles.imagePreviewContainer}
              onPress={() => openImagePreview(corImage)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: corImage }} style={styles.imagePreview} />
              <View style={styles.imagePreviewOverlay}>
                <View style={styles.previewIconContainer}>
                  <Ionicons name="eye" size={28} color="#fff" />
                  <Text style={[styles.previewText, { fontFamily: fontFamily.semiBold }]}>View Full Image</Text>
                </View>
              </View>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.uploadButtonsRow}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage('camera', 'cor')}
                activeOpacity={0.8}
              >
                <View style={styles.uploadButtonIcon}>
                  <Ionicons name="camera" size={28} color={theme.accent} />
                </View>
                <Text style={[styles.uploadButtonText, { fontFamily: fontFamily.semiBold }]}>
                  Take Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage('gallery', 'cor')}
                activeOpacity={0.8}
              >
                <View style={styles.uploadButtonIcon}>
                  <Ionicons name="images" size={28} color={theme.accent} />
                </View>
                <Text style={[styles.uploadButtonText, { fontFamily: fontFamily.semiBold }]}>
                  Choose Photo
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {errors.corImage && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={[styles.errorText, { fontFamily: fontFamily.medium }]}>{errors.corImage}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tips Card */}
      <View style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <Ionicons name="bulb" size={20} color={theme.accent} />
          <Text style={[styles.tipsTitle, { fontFamily: fontFamily.bold }]}>
            Photo Tips
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
            Ensure all text is clearly visible
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
            Good lighting, no glare or shadows
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
            Include all corners of the document
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
            Any image size accepted - no cropping needed
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrapper}>
            <Ionicons name="eye" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
            Review Your Information
          </Text>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { fontFamily: fontFamily.medium }]}>Full Name</Text>
            <Text style={[styles.summaryValue, { fontFamily: fontFamily.semiBold }]}>{fullName}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { fontFamily: fontFamily.medium }]}>Email</Text>
            <Text style={[styles.summaryValue, { fontFamily: fontFamily.semiBold }]}>{email}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { fontFamily: fontFamily.medium }]}>Phone</Text>
            <Text style={[styles.summaryValue, { fontFamily: fontFamily.semiBold }]}>{phone}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { fontFamily: fontFamily.medium }]}>Student ID Number</Text>
            <Text style={[styles.summaryValue, { fontFamily: fontFamily.semiBold }]}>{studentId}</Text>
          </View>
        </View>
      </View>

      {/* Document Previews */}
      {studentIdImage && (
        <View style={styles.card}>
          <Text style={[styles.previewLabel, { fontFamily: fontFamily.semiBold }]}>
            Student ID Photo
          </Text>
          <TouchableOpacity 
            onPress={() => openImagePreview(studentIdImage)} 
            activeOpacity={0.9}
            style={styles.summaryImageContainer}
          >
            <Image source={{ uri: studentIdImage }} style={styles.summaryImage} />
            <View style={styles.viewImageBadge}>
              <Ionicons name="expand" size={14} color="#fff" />
              <Text style={[styles.viewImageText, { fontFamily: fontFamily.semiBold }]}>Tap to view</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {corImage && (
        <View style={styles.card}>
          <Text style={[styles.previewLabel, { fontFamily: fontFamily.semiBold }]}>
            Certificate of Registration
          </Text>
          <TouchableOpacity 
            onPress={() => openImagePreview(corImage)} 
            activeOpacity={0.9}
            style={styles.summaryImageContainer}
          >
            <Image source={{ uri: corImage }} style={styles.summaryImage} />
            <View style={styles.viewImageBadge}>
              <Ionicons name="expand" size={14} color="#fff" />
              <Text style={[styles.viewImageText, { fontFamily: fontFamily.semiBold }]}>Tap to view</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Section */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrapper}>
            <Ionicons name="shield-checkmark" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
            Confirmation
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.checkboxContainer, errors.agreeAccurate && styles.checkboxError]}
          onPress={() => {
            setAgreeAccurate(!agreeAccurate);
            setErrors({ ...errors, agreeAccurate: null });
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreeAccurate && styles.checkboxChecked]}>
            {agreeAccurate && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={[styles.checkboxLabel, { fontFamily: fontFamily.regular }]}>
            I confirm that all information provided is accurate and truthful
          </Text>
        </TouchableOpacity>
        {errors.agreeAccurate && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={[styles.errorText, { fontFamily: fontFamily.medium }]}>{errors.agreeAccurate}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.checkboxContainer, errors.agreeTerms && styles.checkboxError]}
          onPress={() => {
            setAgreeTerms(!agreeTerms);
            setErrors({ ...errors, agreeTerms: null });
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
            {agreeTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={[styles.checkboxLabel, { fontFamily: fontFamily.regular }]}>
            I agree to BuyNaBay's Terms of Service and Privacy Policy
          </Text>
        </TouchableOpacity>
        {errors.agreeTerms && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={[styles.errorText, { fontFamily: fontFamily.medium }]}>{errors.agreeTerms}</Text>
          </View>
        )}
      </View>

      {/* Security Banner */}
      <View style={styles.securityBanner}>
        <View style={styles.securityIconContainer}>
          <Ionicons name="lock-closed" size={22} color={theme.accent} />
        </View>
        <View style={styles.securityTextContainer}>
          <Text style={[styles.securityTitle, { fontFamily: fontFamily.bold }]}>
            Secure & Private
          </Text>
          <Text style={[styles.securityText, { fontFamily: fontFamily.regular }]}>
            Your data is encrypted and will only be used for verification purposes
          </Text>
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#3B82F6" />
        <Text style={[styles.infoBannerText, { fontFamily: fontFamily.regular }]}>
          Verification typically takes 24-48 hours. We'll notify you via email once reviewed.
        </Text>
      </View>
    </Animated.View>
  );

  if (checkingStatus) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontFamily.medium }]}>
          Checking verification status...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          { transform: [{ translateY: headerSlideAnim }], opacity: fadeAnim }
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/images/OfficialBuyNaBay.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.headerTitle, { fontFamily: fontFamily.extraBold }]}>
            {getStepTitle()}
          </Text>
          <Text style={[styles.headerSubtitle, { fontFamily: fontFamily.regular }]}>
            {getStepDescription()}
          </Text>
        </View>

        {renderProgressBar()}
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </ScrollView>

      {/* Upload Progress Overlay */}
      {uploading && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Ionicons name="cloud-upload" size={28} color={theme.accent} />
              <Text style={[styles.progressTitle, { fontFamily: fontFamily.bold }]}>
                Submitting Verification
              </Text>
            </View>
            <View style={styles.progressBarUpload}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={[styles.progressText, { fontFamily: fontFamily.medium }]}>
              {uploadProgress < 100 ? `Uploading documents... ${Math.round(uploadProgress)}%` : 'Almost done! 🎉'}
            </Text>
          </View>
        </View>
      )}

      {/* Bottom Action Buttons */}
      <View style={styles.bottomContainer}>
        {currentStep < 3 ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={18} color={theme.text} />
              <Text style={[styles.secondaryButtonText, { fontFamily: fontFamily.semiBold }]}>
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryButtonText, { fontFamily: fontFamily.bold }]}>
                Continue
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.submitButtonText, { fontFamily: fontFamily.bold }]}>
                  Submitting...
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={[styles.submitButtonText, { fontFamily: fontFamily.bold }]}>
                  Submit for Verification
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Image Preview Modal */}
      <Modal visible={showImagePreview} transparent animationType="fade">
        <View style={styles.imagePreviewModal}>
          <TouchableOpacity
            style={styles.imagePreviewModalClose}
            onPress={() => setShowImagePreview(false)}
            activeOpacity={0.9}
          >
            <View style={styles.closeButtonCircle}>
              <Ionicons name="close" size={28} color="#fff" />
            </View>
          </TouchableOpacity>
          <Image
            source={{ uri: previewImage }}
            style={styles.imagePreviewModalImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme, insets, isDarkMode) => StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: theme.background 
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    color: theme.textSecondary,
  },
  
  // Header Styles
  headerContainer: {
    paddingTop: 10,
    paddingHorizontal: 30,
    paddingBottom: 24,
    backgroundColor: isDarkMode 
      ? 'rgba(42, 40, 86, 0.6)' 
      : 'rgba(253, 173, 0, 0.05)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 26,
    color: theme.text,
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Progress Bar
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 3,
  },
  progressDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  progressDotActive: {
    backgroundColor: `${theme.accent}20`,
    borderColor: theme.accent,
  },
  progressDotCompleted: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  progressDotText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: fontFamily.semiBold,
  },
  progressDotTextActive: {
    color: theme.accent,
  },

  // Scroll View
  scrollView: { 
    flex: 1 
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  stepContainer: {
    gap: 16,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  heroIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  heroTitle: {
    fontSize: 28,
    color: theme.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Card Styles
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    color: theme.text,
    letterSpacing: -0.3,
  },

  // Input Styles
  inputGroup: { 
    marginBottom: 20 
  },
  label: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 10,
  },
  requiredStar: { 
    color: '#EF4444' 
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(245, 245, 245, 1)',
    borderWidth: 1.5,
    borderColor: theme.borderColor || theme.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: theme.accent,
    borderWidth: 2,
    backgroundColor: isDarkMode 
      ? 'rgba(253, 173, 0, 0.08)' 
      : 'rgba(253, 173, 0, 0.05)',
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  inputWrapperDisabled: {
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.03)' 
      : 'rgba(0, 0, 0, 0.03)',
    opacity: 0.7,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
  },
  inputDisabled: {
    color: theme.textSecondary,
  },
  characterCount: {
    fontSize: 12,
    color: theme.textSecondary,
    marginLeft: 8,
  },
  helperText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 6,
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
  },

  // Upload Section
  uploadSection: {
    marginBottom: 24,
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${theme.accent}15`,
  },
  clearButtonText: {
    fontSize: 13,
    color: theme.accent,
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: isDarkMode 
      ? 'rgba(253, 173, 0, 0.08)' 
      : 'rgba(253, 173, 0, 0.05)',
    borderWidth: 2,
    borderColor: theme.borderColor || theme.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  uploadButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 14,
    color: theme.text,
    textAlign: 'center',
    marginTop: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  imagePreview: {
    width: '100%',
    height: 220,
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(0, 0, 0, 0.03)',
  },
  imagePreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  previewIconContainer: {
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    color: '#fff',
    fontSize: 13,
  },
  successBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  // Benefits Card
  benefitsCard: {
    backgroundColor: `${theme.accent}10`,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: `${theme.accent}30`,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  benefitsTitle: {
    fontSize: 16,
    color: theme.text,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },

  // Tips Card
  tipsCard: {
    backgroundColor: isDarkMode 
      ? 'rgba(59, 130, 246, 0.1)' 
      : 'rgba(59, 130, 246, 0.08)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: isDarkMode 
      ? 'rgba(59, 130, 246, 0.3)' 
      : 'rgba(59, 130, 246, 0.2)',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  tipsTitle: {
    fontSize: 16,
    color: theme.text,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: theme.text,
    lineHeight: 19,
  },

  // Summary Section
  summarySection: {
    gap: 0,
  },
  summaryItem: {
    paddingVertical: 16,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.borderColor || theme.border,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    color: theme.text,
  },
  previewLabel: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 12,
  },
  summaryImageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  summaryImage: {
    width: '100%',
    height: 180,
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(0, 0, 0, 0.03)',
  },
  viewImageBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  viewImageText: {
    color: '#fff',
    fontSize: 12,
  },

  // Checkbox
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  checkboxError: {
    opacity: 0.8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.borderColor || theme.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },

  // Banners
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  securityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 4,
  },
  securityText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode 
      ? 'rgba(59, 130, 246, 0.1)' 
      : 'rgba(59, 130, 246, 0.08)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 19,
  },

  // Upload Progress Overlay
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  progressContainer: {
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 20,
    width: width - 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  progressTitle: {
    fontSize: 18,
    color: theme.text,
  },
  progressBarUpload: {
    height: 8,
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Bottom Container
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Math.max(insets.bottom, 16),
    borderTopWidth: 1,
    borderTopColor: theme.borderColor || theme.border,
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: isDarkMode 
      ? 'rgba(255, 255, 255, 0.08)' 
      : 'rgba(0, 0, 0, 0.05)',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: theme.borderColor || theme.border,
  },
  secondaryButtonText: {
    color: theme.text,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Image Preview Modal
  imagePreviewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  closeButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewModalImage: {
    width: width - 40,
    height: width - 40,
  },
});