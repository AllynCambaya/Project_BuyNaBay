// screens/tabs/NotVerifiedScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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

export default function NotVerifiedScreen({ navigation }) {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('Your documents did not meet our verification requirements.');
  const [canResubmit, setCanResubmit] = useState(false);
  const [verificationData, setVerificationData] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkRejectionStatus();
  }, []);

  useEffect(() => {
    if (!loading) {
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

      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [loading]);

  const checkRejectionStatus = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      navigation.replace('Tabs');
      return;
    }

    try {
      // ✅ Query verifications table for latest rejection
      const { data, error } = await supabase
        .from('verifications')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        Alert.alert(
          'No Verification Found',
          'You haven\'t submitted a verification request yet.',
          [{ text: 'Get Verified', onPress: () => navigation.replace('GetVerified') }]
        );
        return;
      }

      if (data.status === 'pending') {
        Alert.alert(
          'Verification Pending',
          'Your verification is currently under review.',
          [{ text: 'View Status', onPress: () => navigation.replace('VerificationStatus') }]
        );
        return;
      }

      if (data.status === 'approved') {
        Alert.alert(
          'Already Verified',
          'Your account is already verified!',
          [{ text: 'OK', onPress: () => navigation.replace('Tabs') }]
        );
        return;
      }

      if (data.status !== 'rejected') {
        Alert.alert(
          'No Rejection Found',
          'You don\'t have a rejected verification request.',
          [{ text: 'Get Verified', onPress: () => navigation.replace('GetVerified') }]
        );
        return;
      }

      // If we reach here, status is 'rejected' - show the screen
      setCanResubmit(true);
      setVerificationData(data);
      // You can add a 'rejection_reason' column to verifications table if you want custom reasons
      // For now, use a generic message
      setRejectionReason('Your documents did not meet our verification requirements.');

      setLoading(false);
    } catch (error) {
      console.error('Error checking rejection status:', error);
      setLoading(false);
    }
  };

  const handleResubmit = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      // Double-check: ensure no pending verification exists
      const { data: pendingCheck } = await supabase
        .from('verifications')
        .select('id')
        .eq('email', user.email)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingCheck) {
        Alert.alert(
          'Already Submitted',
          'You already have a pending verification request.',
          [{ text: 'View Status', onPress: () => navigation.replace('VerificationStatus') }]
        );
        return;
      }

      // Check if already approved
      const { data: approvedCheck } = await supabase
        .from('verifications')
        .select('id')
        .eq('email', user.email)
        .eq('status', 'approved')
        .maybeSingle();

      if (approvedCheck) {
        Alert.alert(
          'Already Verified',
          'Your account is already verified!',
          [{ text: 'OK', onPress: () => navigation.replace('Tabs') }]
        );
        return;
      }

      // Allow resubmission - navigate to GetVerifiedScreen
      navigation.replace('GetVerified');
    } catch (error) {
      console.error('Error checking resubmit eligibility:', error);
      Alert.alert('Error', 'Failed to check verification status. Please try again.');
    }
  };

  const handleGoBack = () => {
    navigation.navigate('Tabs');
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontFamily.medium }]}>
          Loading verification status...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <View style={styles.headerContainer}>
        <View style={styles.backgroundGradient}>
          <View style={styles.gradientOverlay} />
        </View>

        <View style={styles.topBar}>
          <View style={styles.logoContainer}>
             <View style={styles.logoWrapper}>
                <Image
                  source={require('../../assets/images/OfficialBuyNaBay.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                 />
              </View>
            <View>
              <Text style={[styles.logoText, { fontFamily: fontFamily.extraBold }]}>
                BuyNaBay
              </Text>
              <Text style={[styles.logoSubtext, { fontFamily: fontFamily.medium }]}>
                Verification
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.contentContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.heroSection}>
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ translateX: shakeAnim }] }
              ]}
            >
              <Ionicons name="close-circle" size={80} color={theme.error} />
            </Animated.View>
            
            <Text style={[styles.statusTitle, { fontFamily: fontFamily.extraBold }]}>
              Verification Rejected
            </Text>
            
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: theme.error }]} />
              <Text style={[styles.statusBadgeText, { fontFamily: fontFamily.bold, color: theme.error }]}>
                Not Approved
              </Text>
            </View>
            
            <Text style={[styles.statusDescription, { fontFamily: fontFamily.regular }]}>
              Unfortunately, your verification request was not approved. Please review the reason below and submit a new request.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrapper, { backgroundColor: `${theme.error}15` }]}>
                <Ionicons name="information-circle" size={18} color={theme.error} />
              </View>
              <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
                Rejection Reason
              </Text>
            </View>

            <View style={styles.reasonContainer}>
              <Text style={[styles.reasonText, { fontFamily: fontFamily.medium }]}>
                {rejectionReason}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrapper}>
                <Ionicons name="checkmark-done" size={18} color={theme.accent} />
              </View>
              <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
                What to Do Next
              </Text>
            </View>

            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={[styles.stepNumberText, { fontFamily: fontFamily.bold }]}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { fontFamily: fontFamily.semiBold }]}>
                    Review Requirements
                  </Text>
                  <Text style={[styles.stepDescription, { fontFamily: fontFamily.regular }]}>
                    Make sure your documents meet all requirements
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={[styles.stepNumberText, { fontFamily: fontFamily.bold }]}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { fontFamily: fontFamily.semiBold }]}>
                    Prepare Documents
                  </Text>
                  <Text style={[styles.stepDescription, { fontFamily: fontFamily.regular }]}>
                    Take clear, well-lit photos of your Student ID and COR
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={[styles.stepNumberText, { fontFamily: fontFamily.bold }]}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { fontFamily: fontFamily.semiBold }]}>
                    Submit Again
                  </Text>
                  <Text style={[styles.stepDescription, { fontFamily: fontFamily.regular }]}>
                    Complete the verification form with accurate information
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb" size={20} color={theme.accent} />
              <Text style={[styles.tipsTitle, { fontFamily: fontFamily.bold }]}>
                Tips for Success
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={14} color={theme.success} />
              <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
                Ensure all text in documents is clearly readable
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={14} color={theme.success} />
              <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
                Use good lighting without glare or shadows
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={14} color={theme.success} />
              <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
                Include all corners and edges of documents
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={14} color={theme.success} />
              <Text style={[styles.tipText, { fontFamily: fontFamily.regular }]}>
                Double-check that information matches your account
              </Text>
            </View>
          </View>

          {canResubmit && (
            <TouchableOpacity
              style={styles.resubmitButton}
              onPress={handleResubmit}
              activeOpacity={0.85}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={[styles.resubmitButtonText, { fontFamily: fontFamily.bold }]}>
                  Submit New Verification
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGoBack}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { fontFamily: fontFamily.semiBold }]}>
              Back to Home
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: theme.textSecondary,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 10,
    zIndex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '150%',
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoWrapper: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(253, 173, 0, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
  },
  logoImage: {
    width: 26,
    height: 26,
  },
  logoText: {
    fontSize: 18,
    color: theme.accent,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  logoSubtext: {
    fontSize: 10,
    color: theme.textSecondary,
    letterSpacing: 0.2,
    marginTop: -1,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  contentContainer: {
    gap: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${theme.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 28,
    color: theme.text,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: `${theme.error}20`,
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusBadgeText: {
    fontSize: 16,
  },
  statusDescription: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
  reasonContainer: {
    backgroundColor: theme.cardBackgroundAlt || `${theme.error}08`,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: `${theme.error}30`,
  },
  reasonText: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 22,
  },
  stepsList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    color: '#fff',
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  tipsCard: {
    backgroundColor: theme.cardBackgroundAlt || `${theme.accent}08`,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  resubmitButton: {
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  resubmitButtonText: {
    color: '#fff',
    fontSize: 17,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: theme.cardBackgroundAlt || `${theme.borderColor}30`,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.borderColor || theme.border,
  },
  secondaryButtonText: {
    color: theme.text,
    fontSize: 16,
  },
});