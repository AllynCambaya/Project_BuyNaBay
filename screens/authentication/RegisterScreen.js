// screens/authentication/RegisterScreen.js
import { FontAwesome as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
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
import { getAuthErrorMessage } from '../../utils/authErrorMessages';


const { width, height } = Dimensions.get('window');

const RegisterScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  const navigation = useNavigation();
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;

  const theme = isDarkMode ? darkTheme : lightTheme;

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

  useEffect(() => {
    const newErrors = {};
    
    if (name && name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (password && password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    setIsFormValid(
      name.trim().length > 0 && 
      email.length > 0 && 
      password.length > 0 && 
      confirmPassword.length > 0 &&
      Object.keys(newErrors).length === 0
    );
  }, [name, email, password, confirmPassword]);

    const handleRegister = async () => {
      Keyboard.dismiss();
      if (!name || !email || !password || !confirmPassword) {
        Alert.alert("Missing Info", "Please fill in all fields.");
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert("Password Mismatch", "Passwords do not match.");
        return;
      }

      setIsLoading(true);

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: name.trim() });

        // Send verification email
        await sendEmailVerification(user);

        const { error } = await supabase.from("users").insert([
          {
            id: user.uid,
            name: name.trim(),
            email: email.trim(),
            is_verified: false,
          },
        ]);

        if (error) {
          console.error("Supabase Insert Error:", error);
        }

        // Show success alert - the auth listener will handle navigation
        Alert.alert(
          "Registration Successful! 📧",
          "A verification email has been sent to your inbox. Please verify your email to continue.",
          [{ text: "OK" }]
        );

        // The auth state listener in App.js will automatically redirect to EmailVerification

      } catch (error) {
        console.error('Registration error:', error);
        
        // Use friendly error messages
        const errorMessage = getAuthErrorMessage(error.code);
        Alert.alert('Registration Error', errorMessage);
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
            <Text style={styles.title}>Sign Up</Text>
            <Text style={styles.subtitle}>
              Create your account to continue shopping with BuyNaBay
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
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={[
                styles.inputWrapper, 
                errors.name && styles.inputWrapperError,
                name.length > 0 && styles.inputWrapperFocused
              ]}>
                <Icon name="user" size={16} color={theme.inputIcon} style={styles.inputIcon} />
                <TextInput
                  ref={nameRef}
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  selectionColor={theme.accent}
                />
                {name.length > 0 && !errors.name && (
                  <Icon name="check-circle" size={16} color={theme.success} />
                )}
              </View>
              {errors.name && (
                <View style={styles.errorRow}>
                  <Icon name="exclamation-circle" size={12} color={theme.error} />
                  <Text style={styles.errorText}>{errors.name}</Text>
                </View>
              )}
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
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  selectionColor={theme.accent}
                />
                {email.length > 0 && !errors.email && (
                  <Icon name="check-circle" size={16} color={theme.success} />
                )}
              </View>
              {errors.email && (
                <View style={styles.errorRow}>
                  <Icon name="exclamation-circle" size={12} color={theme.error} />
                  <Text style={styles.errorText}>{errors.email}</Text>
                </View>
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
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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
                <View style={styles.errorRow}>
                  <Icon name="exclamation-circle" size={12} color={theme.error} />
                  <Text style={styles.errorText}>{errors.password}</Text>
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={[
                styles.inputWrapper, 
                errors.confirmPassword && styles.inputWrapperError,
                confirmPassword.length > 0 && styles.inputWrapperFocused
              ]}>
                <Icon name="lock" size={16} color={theme.inputIcon} style={styles.inputIcon} />
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.placeholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleRegister}
                  selectionColor={theme.accent}
                />
                <TouchableOpacity 
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon 
                    name={showConfirmPassword ? "eye" : "eye-slash"} 
                    size={16} 
                    color={theme.inputIcon} 
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <View style={styles.errorRow}>
                  <Icon name="exclamation-circle" size={12} color={theme.error} />
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                </View>
              )}
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[
                styles.button,
                isFormValid && !isLoading ? styles.buttonEnabled : styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.buttonText, { marginLeft: 10 }]}>Creating Account...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Register</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text
                  style={styles.loginLink}
                  onPress={() => navigation.navigate('Login')}
                >
                  Log in
                </Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

// Dark theme colors
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

// Light theme colors 
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
    height: 50,
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
    top: 10,
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
    fontWeight: '900',
    color: theme.accentSecondary,
    letterSpacing: -0.5,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Math.max(width * 0.08, 30),
    marginTop: 120,
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
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: Math.min(width * 0.04, 16),
    textAlign: 'center',
    fontWeight: '500',
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
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: theme.borderTransparent,
  },
  inputWrapperFocused: {
    borderColor: theme.accent,
    backgroundColor: theme.inputBackgroundFocused,
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    paddingVertical: 16,
    fontSize: 16,
    color: theme.inputText,
    fontWeight: '500',
  },
  errorText: {
    color: theme.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 5,
  },
  buttonEnabled: {
    backgroundColor: theme.accent,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  buttonDisabled: {
    backgroundColor: theme.buttonDisabled,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
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
    height: 1,
    backgroundColor: theme.divider,
  },
  dividerText: {
    color: theme.dividerText,
    paddingHorizontal: 15,
    fontSize: 14,
    fontWeight: '500',
  },
  loginContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loginText: {
    color: theme.textTertiary,
    fontSize: 16,
    fontWeight: '500',
  },
  loginLink: {
    color: theme.accentSecondary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;