// screens/ResetPasswordScreen.js
import { useNavigation } from '@react-navigation/native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
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

const { width, height } = Dimensions.get('window');

const ResetPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  const navigation = useNavigation();
  const emailRef = useRef(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  // Initial animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Form validation
  useEffect(() => {
    const newErrors = {};
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    setIsFormValid(
      email.length > 0 && 
      Object.keys(newErrors).length === 0
    );
  }, [email]);

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    if (!email) {
      Alert.alert('Input Required', 'Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        'Success',
        'Password reset email sent! Please check your inbox and follow the instructions.',
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      let errorMessage = 'Failed to send reset email. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many requests. Please try again later.';
          break;
        default:
          errorMessage = error.message;
      }
      
      Alert.alert('Reset Password Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Background gradient effect */}
          <View style={styles.backgroundGradient} />
          
          {/* Background logo watermark */}
          <View style={styles.backgroundLogoContainer}>
            <Image 
              source={require('../../assets/images/OfficialBuyNaBay.png')} 
              style={styles.backgroundLogo}
              resizeMode="contain"
            />
          </View>
          
          {/* Branded logo - upper right */}
          <View style={styles.brandedLogoContainer}>
            <Image 
              source={require('../../assets/images/OfficialBuyNaBay.png')} 
              style={styles.brandedLogoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandedLogoText}>BuyNaBay</Text>
          </View>
          
    
          {/* Animated header */}
          <Animated.View 
            style={[
              styles.header, 
              {
                transform: [{ translateY: headerSlideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.logoContainer}>
              <View style={styles.iconCircle}>
                <Icon name="lock" size={40} color={theme.accent} />
              </View>
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you instructions to reset your password
            </Text>
          </Animated.View>

          {/* Animated form container */}
          <Animated.View
            style={[
              styles.formContainer,
              {
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ],
                opacity: fadeAnim,
              }
            ]}
          >
            {/* Info Box */}
            <View style={styles.infoBox}>
              <Icon name="info-circle" size={16} color={theme.accent} style={styles.infoIcon} />
              <Text style={styles.infoText}>
                We'll send a password reset link to your registered email address
              </Text>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={[
                styles.inputWrapper, 
                errors.email && styles.inputWrapperError,
                email.length > 0 && styles.inputWrapperFocused
              ]}>
                <Icon name="envelope" size={16} color={theme.inputIcon} style={styles.inputIcon} />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor={theme.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="go"
                  onSubmitEditing={handleResetPassword}
                  selectionColor={theme.accent}
                />
                {email.length > 0 && !errors.email && (
                  <Icon name="check-circle" size={16} color={theme.success} />
                )}
              </View>
              {errors.email && (
                <Animated.Text style={styles.errorText}>
                  <Icon name="exclamation-circle" size={12} color={theme.error} /> {errors.email}
                </Animated.Text>
              )}
            </View>

            {/* Reset Password Button */}
            <TouchableOpacity
              style={[
                styles.button,
                isFormValid && !isLoading ? styles.buttonEnabled : styles.buttonDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.buttonText, { marginLeft: 10 }]}>Sending...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            {/* Back to Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>
                Remember your password?{' '}
                <Text
                  style={styles.loginLink}
                  onPress={() => navigation.goBack()}
                >
                  Back to Login
                </Text>
              </Text>
            </View>

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <Icon name="question-circle" size={14} color={theme.textSecondary} style={styles.helpIcon} />
              <Text style={styles.helpText}>
                If you don't receive an email, check your spam folder or contact support
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

// Dark theme colors (matching LoginScreen)
const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  inputBackground: '#fff',
  inputBackgroundFocused: '#fefefe',
  inputBackgroundError: '#fff5f5',
  inputText: '#333',
  inputIcon: '#666',
  placeholder: '#999',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  buttonDisabled: '#4a4a6a',
  error: '#FF6B6B',
  success: '#4CAF50',
  divider: '#333',
  dividerText: '#666',
  infoBackground: 'rgba(253, 173, 0, 0.1)',
  infoBorder: '#FDAD00',
  infoText: '#8a8aa0',
  borderTransparent: 'transparent',
  iconCircleBackground: 'rgba(253, 173, 0, 0.15)',
};

// Light theme colors (matching LoginScreen)
const lightTheme = {
  background: '#f5f7fa',
  gradientBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  inputBackground: '#ffffff',
  inputBackgroundFocused: '#ffffff',
  inputBackgroundError: '#fff5f5',
  inputText: '#1a1a2e',
  inputIcon: '#7a7a9a',
  placeholder: '#9a9ab0',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  buttonDisabled: '#d0d0e0',
  error: '#e74c3c',
  success: '#27ae60',
  divider: '#d0d0e0',
  dividerText: '#9a9ab0',
  infoBackground: 'rgba(243, 156, 18, 0.1)',
  infoBorder: '#f39c12',
  infoText: '#5a5a7a',
  borderTransparent: 'transparent',
  iconCircleBackground: 'rgba(243, 156, 18, 0.15)',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 50 : 90,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 1,
  },
  backgroundLogoContainer: {
    position: 'absolute',
    top: height * 0.45,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.1,
    zIndex: 0,
  },
  backgroundLogo: {
    width: Math.min(width * 0.75, 300),
    height: Math.min(height * 0.2, 250),
  },
  brandedLogoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  brandedLogoImage: {
    width: 30,
    height: 30,
    marginRight: 5,
  },
  brandedLogoText: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    color: theme.accentSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
    letterSpacing: -0.5,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Math.max(width * 0.08, 30),
    marginTop: Platform.OS === 'ios' ? 140 : 140,
    marginBottom: 30,
    zIndex: 2,
  },
  logoContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.iconCircleBackground,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  title: {
    fontSize: Math.min(width * 0.11, 42),
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'Poppins-ExtraBold',
      android: 'Poppins-Black',
      default: 'Poppins-ExtraBold',
    }),
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: Math.min(width * 0.04, 16),
    textAlign: 'center',
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  formContainer: {
    paddingHorizontal: Math.max(width * 0.08, 30),
    paddingTop: 20,
    zIndex: 5,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: theme.infoBackground,
    borderLeftWidth: 3,
    borderLeftColor: theme.infoBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 25,
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    color: theme.infoText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    marginBottom: 8,
    marginLeft: 4,
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
    borderWidth: 1,
    borderColor: theme.borderTransparent,
  },
  inputWrapperFocused: {
    borderColor: theme.accent,
    backgroundColor: theme.inputBackgroundFocused,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  inputWrapperError: {
    borderColor: theme.error,
    backgroundColor: theme.inputBackgroundError,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 16,
    color: theme.inputText,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  errorText: {
    color: theme.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  button: {
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 5,
  },
  buttonEnabled: {
    backgroundColor: theme.accent,
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
  buttonDisabled: {
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
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  divider: {
    flex: 1,
    height: Platform.OS === 'ios' ? 1 : StyleSheet.hairlineWidth,
    backgroundColor: theme.divider,
  },
  dividerText: {
    color: theme.dividerText,
    paddingHorizontal: 15,
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  loginContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loginText: {
    color: theme.textTertiary,
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  loginLink: {
    color: theme.accentSecondary,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    textDecorationLine: 'underline',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  helpIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  helpText: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: Platform.OS === 'android' ? '400' : '300',
    fontFamily: Platform.select({
      ios: 'Poppins-Light',
      android: 'Poppins-Regular',
      default: 'Poppins-Regular',
    }),
  },
});

export default ResetPasswordScreen;