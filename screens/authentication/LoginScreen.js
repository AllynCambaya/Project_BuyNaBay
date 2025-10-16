import { useNavigation } from '@react-navigation/native';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
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
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  const navigation = useNavigation();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  
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
    
    if (password && password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    setIsFormValid(
      email.length > 0 && 
      password.length > 0 && 
      Object.keys(newErrors).length === 0
    );
  }, [email, password]);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email || !password) {
      Alert.alert("Missing Info", "Please fill in both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        Alert.alert(
          "Email Not Verified",
          "Please verify your email before logging in.",
          [
            {
              text: "Resend Email",
              onPress: async () => {
                await sendEmailVerification(user);
                Alert.alert("Verification Sent", "A new verification email has been sent.");
              }
            },
            { text: "OK" }
          ]
        );
        setIsLoading(false);
        return;
      }

      // Fetch role from Supabase 'users' table (by email)
      let role = 'user';
      try {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('email', user.email)
          .single();

        if (!error && data?.role) role = data.role;
      } catch (supError) {
        console.log('Supabase role lookup error:', supError?.message || supError);
        // default to 'user' on error
      }

      // --- NEW: Fetch latest verification status (most recent record)
      let status = 'approved'; // default fallback
      try {
        const { data: vData, error: vError } = await supabase
          .from('verifications')
          .select('status, created_at')
          .eq('email', user.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!vError && vData?.status) {
          status = vData.status; // expected values: 'pending' | 'approved' | 'rejected'
        }
      } catch (vErr) {
        console.log('Supabase verification lookup error:', vErr?.message || vErr);
        // keep default
      }

      // Pass role and status to MainTabs so MainTabNavigator can show/hide tabs
      navigation.replace("MainTabs", { role, status });

    } catch (error) {
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many login attempts. Please try again later.';
          break;
        default:
          errorMessage = error.message;
      }
      
      Alert.alert('Login Error', errorMessage);
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
              <Image 
                source={require('../../assets/images/OfficialBuyNaBay.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>
              Sign in to continue to your account
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
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
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

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={[
                styles.inputWrapper, 
                errors.password && styles.inputWrapperError,
                password.length > 0 && styles.inputWrapperFocused
              ]}>
                <Icon name="lock" size={16} color={theme.inputIcon} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  selectionColor={theme.accent}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon 
                    name={showPassword ? "eye" : "eye-slash"} 
                    size={16} 
                    color={theme.inputIcon} 
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Animated.Text style={styles.errorText}>
                  <Icon name="exclamation-circle" size={12} color={theme.error} /> {errors.password}
                </Animated.Text>
              )}
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('ResetPassword')}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.button,
                isFormValid && !isLoading ? styles.buttonEnabled : styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.buttonText, { marginLeft: 10 }]}>Signing In...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>
                Don't have an account?{' '}
                <Text
                  style={styles.registerLink}
                  onPress={() => navigation.navigate('Register')}
                >
                  Register
                </Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

// Dark theme colors (from ResetPasswordScreen)
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
  infoBackground: 'rgba(255, 215, 0, 0.1)',
  infoBorder: '#f39c12',
  infoText: '#8a8aa0',
  borderTransparent: 'transparent',
};

// Light theme colors (complementary palette)
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
    top: height * 0.4,
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
  logo: {
    width: Math.min(width * 0.3, 120),
    height: Math.min(height * 0.1, 80),
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 25,
  },
  forgotPasswordText: {
    color: theme.accentSecondary,
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  button: {
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 25,
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
  registerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  registerText: {
    color: theme.textTertiary,
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  registerLink: {
    color: theme.accentSecondary,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    textDecorationLine: 'underline',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
});

export default LoginScreen;