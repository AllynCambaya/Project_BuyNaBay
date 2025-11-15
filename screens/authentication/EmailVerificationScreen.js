// screens/authentication/EmailVerificationScreen.js
import { FontAwesome as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { sendEmailVerification } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';

const { width, height } = Dimensions.get('window');

const EmailVerificationScreen = () => {
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const navigation = useNavigation();

  const theme = isDarkMode ? darkTheme : lightTheme;
  const user = auth.currentUser;
  const userEmail = user?.email || 'your email';

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-check verification status every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (user) {
        await user.reload();
        if (user.emailVerified) {
          clearInterval(interval);
          Alert.alert(
            'Success! 🎉',
            'Your email has been verified. Welcome to BuyNaBay!',
            [{ text: 'Continue', onPress: () => navigation.replace('MainTabs') }]
          );
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [user]);

  const handleResendEmail = async () => {
    if (countdown > 0 || !user) return;
    
    setIsResending(true);
    try {
      await sendEmailVerification(user);
      Alert.alert(
        'Email Sent! ✉️',
        'A new verification email has been sent to your inbox.',
        [{ text: 'OK' }]
      );
      setCountdown(60);
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to resend verification email. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      await user.reload();
      
      if (user.emailVerified) {
        Alert.alert(
          'Success! 🎉',
          'Your email has been verified. Welcome to BuyNaBay!',
          [{ text: 'Continue', onPress: () => navigation.replace('MainTabs') }]
        );
      } else {
        Alert.alert(
          'Not Verified Yet',
          'Please check your email and click the verification link. It may take a few minutes to arrive.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check verification status. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? You will need to verify your email before accessing your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await auth.signOut();
            navigation.replace('Login');
          }
        }
      ]
    );
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backgroundGradient} />
          
          <View style={styles.brandedLogoContainer}>
            <Image 
              source={require('../../assets/images/OfficialBuyNaBay.png')} 
              style={styles.brandedLogoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandedLogoText}>BuyNaBay</Text>
          </View>

          <View style={styles.content}>
            {/* Email Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Icon name="envelope" size={64} color={theme.accent} />
              </View>
              <View style={styles.checkmarkBadge}>
                <Icon name="check" size={24} color="#fff" />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Verify Your Email</Text>

            {/* Description */}
            <Text style={styles.description}>
              We've sent a verification link to
            </Text>
            <Text style={styles.email}>{userEmail}</Text>
            <Text style={styles.description}>
              Please check your inbox and click the link to verify your account.
            </Text>

            {/* Instructions Card */}
            <View style={styles.instructionsCard}>
              <View style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>
                  Open the email from BuyNaBay
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Click the verification link
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Return here and click "I've Verified"
                </Text>
              </View>
            </View>

            {/* Check Verification Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCheckVerification}
              disabled={isChecking}
              activeOpacity={0.85}
            >
              {isChecking ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="check-circle" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    I've Verified My Email
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Resend Email Button */}
            <TouchableOpacity
              style={[styles.secondaryButton, (countdown > 0 || isResending) && styles.buttonDisabled]}
              onPress={handleResendEmail}
              disabled={countdown > 0 || isResending}
              activeOpacity={0.7}
            >
              {isResending ? (
                <ActivityIndicator color={theme.accent} size="small" />
              ) : (
                <>
                  <Icon name="refresh" size={18} color={countdown > 0 ? theme.textSecondary : theme.accent} />
                  <Text style={[styles.secondaryButtonText, countdown > 0 && { color: theme.textSecondary }]}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive email? Resend"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Help Card */}
            <View style={styles.helpCard}>
              <Icon name="info-circle" size={20} color={theme.textSecondary} />
              <Text style={styles.helpText}>
                Check your spam folder if you don't see the email within a few minutes.
              </Text>
            </View>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
              <Icon name="sign-out" size={18} color={theme.textSecondary} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#fff',
  textSecondary: '#bbb',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  cardBackground: '#1a1a3e',
  border: '#2a2a4a',
  success: '#4CAF50',
};

const lightTheme = {
  background: '#f5f7fa',
  gradientBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  cardBackground: '#ffffff',
  border: '#d0d0e0',
  success: '#27ae60',
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
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: theme.background,
  },
  title: {
    fontSize: 28,
    color: theme.text,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '500',
  },
  email: {
    fontSize: 16,
    color: theme.accent,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  instructionsCard: {
    width: '100%',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
    fontWeight: '500',
  },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 10,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
  },
});

export default EmailVerificationScreen;