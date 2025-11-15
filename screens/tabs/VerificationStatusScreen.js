// screens/tabs/VerificationStatusScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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

export default function VerificationStatusScreen({ navigation }) {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [status, setStatus] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const statusIconAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchVerificationData();
  }, []);

  useEffect(() => {
    if (!loading) {
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

      // Status-specific animations
      if (status === 'pending') {
        // Continuous rotation for pending
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          })
        ).start();
      } else if (status === 'approved') {
        // Bounce animation for approved
        Animated.sequence([
          Animated.spring(statusIconAnim, {
            toValue: 1,
            tension: 50,
            friction: 4,
            useNativeDriver: true,
          }),
        ]).start();

        // Continuous pulse for approved
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else if (status === 'rejected') {
        // Shake animation for rejected
        Animated.sequence([
          Animated.timing(statusIconAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
          Animated.timing(statusIconAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
          Animated.timing(statusIconAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
          Animated.timing(statusIconAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]).start();
      }
    }
  }, [loading, status]);

  const fetchVerificationData = async (isRefreshing = false) => {
    const user = auth.currentUser;
    if (!user?.email) {
      navigation.replace('Tabs');
      return;
    }

    if (!isRefreshing) setLoading(true);

    try {
      const { status: verifyStatus } = await getVerificationStatus(user.email);
      
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

      setVerificationData(data);
      setStatus(data.status);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching verification data:', error);
      Alert.alert('Error', 'Failed to load verification status. Please try again.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVerificationData(true);
  };

  const handleResubmit = () => {
    navigation.replace('GetVerified');
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: 'time',
          color: '#F59E0B',
          title: 'Under Review',
          badge: 'Pending',
          gradient: ['#F59E0B', '#D97706'],
        };
      case 'approved':
        return {
          icon: 'checkmark-circle',
          color: '#10B981',
          title: 'Verified',
          badge: 'Approved',
          gradient: ['#10B981', '#059669'],
        };
      case 'rejected':
        return {
          icon: 'close-circle',
          color: '#EF4444',
          title: 'Not Approved',
          badge: 'Rejected',
          gradient: ['#EF4444', '#DC2626'],
        };
      default:
        return {
          icon: 'help-circle',
          color: theme.textSecondary,
          title: 'Unknown',
          badge: 'Unknown',
          gradient: [theme.textSecondary, theme.textSecondary],
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = (text) => {
    // In a real app, you'd use Clipboard API
    Alert.alert('Copied', 'Student ID copied to clipboard');
  };

  const statusConfig = getStatusConfig();
  const styles = createStyles(theme, insets, isDarkMode, statusConfig.color);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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

      {/* Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          { transform: [{ translateY: headerSlideAnim }], opacity: fadeAnim }
        ]}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { fontFamily: fontFamily.bold }]}>
              Verification Status
            </Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            style={styles.refreshButton}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <Animated.View
          style={[
            styles.contentContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Status Hero Card */}
          <View style={[styles.statusHeroCard, { borderColor: statusConfig.color }]}>
            <Animated.View
              style={[
                styles.statusIconContainer,
                { 
                  backgroundColor: `${statusConfig.color}15`,
                  transform: [
                    { scale: status === 'approved' ? pulseAnim : 1 },
                    { rotate: status === 'pending' ? rotate : '0deg' },
                    { translateX: status === 'rejected' ? statusIconAnim : 0 },
                  ]
                }
              ]}
            >
              <Ionicons name={statusConfig.icon} size={64} color={statusConfig.color} />
            </Animated.View>

            <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusBadgeText, { fontFamily: fontFamily.bold, color: statusConfig.color }]}>
                {statusConfig.badge}
              </Text>
            </View>

            <Text style={[styles.statusTitle, { fontFamily: fontFamily.extraBold }]}>
              {statusConfig.title}
            </Text>

            <Text style={[styles.statusTimestamp, { fontFamily: fontFamily.medium }]}>
              Submitted on {formatDate(verificationData?.created_at)}
            </Text>
          </View>

          {/* Timeline (for pending status) */}
          {status === 'pending' && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="git-network" size={18} color={theme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
                  Verification Timeline
                </Text>
              </View>

              <View style={styles.timelineContainer}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineIcon, styles.timelineIconCompleted]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTitle, { fontFamily: fontFamily.semiBold }]}>
                      Submitted
                    </Text>
                    <Text style={[styles.timelineDescription, { fontFamily: fontFamily.regular }]}>
                      Your documents have been received
                    </Text>
                  </View>
                </View>

                <View style={styles.timelineLine} />

                <View style={styles.timelineItem}>
                  <View style={[styles.timelineIcon, styles.timelineIconActive]}>
                    <Animated.View style={{ transform: [{ rotate }] }}>
                      <Ionicons name="refresh" size={16} color="#fff" />
                    </Animated.View>
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTitle, { fontFamily: fontFamily.semiBold }]}>
                      Under Review
                    </Text>
                    <Text style={[styles.timelineDescription, { fontFamily: fontFamily.regular }]}>
                      Our team is verifying your information
                    </Text>
                  </View>
                </View>

                <View style={styles.timelineLine} />

                <View style={styles.timelineItem}>
                  <View style={[styles.timelineIcon, styles.timelineIconPending]}>
                    <Ionicons name="hourglass-outline" size={16} color={theme.textSecondary} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTitle, { fontFamily: fontFamily.semiBold, color: theme.textSecondary }]}>
                      Decision
                    </Text>
                    <Text style={[styles.timelineDescription, { fontFamily: fontFamily.regular }]}>
                      Approval or feedback on your submission
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.estimatedTimeCard}>
                <Ionicons name="time-outline" size={20} color={theme.accent} />
                <Text style={[styles.estimatedTimeText, { fontFamily: fontFamily.medium }]}>
                  Estimated review time: 24-48 hours
                </Text>
              </View>
            </View>
          )}

          {/* Submitted Information */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrapper}>
                <Ionicons name="document-text" size={18} color={theme.accent} />
              </View>
              <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
                Submitted Information
              </Text>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoItem}>
                <View style={styles.infoLabelRow}>
                  <Ionicons name="card-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.infoLabel, { fontFamily: fontFamily.medium }]}>
                    Student ID
                  </Text>
                </View>
                <View style={styles.infoValueRow}>
                  <Text style={[styles.infoValue, { fontFamily: fontFamily.semiBold }]}>
                    {verificationData?.student_id || 'N/A'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(verificationData?.student_id)}
                    style={styles.copyButton}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.accent} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoItem}>
                <View style={styles.infoLabelRow}>
                  <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.infoLabel, { fontFamily: fontFamily.medium }]}>
                    Email
                  </Text>
                </View>
                <Text style={[styles.infoValue, { fontFamily: fontFamily.semiBold }]}>
                  {verificationData?.email || 'N/A'}
                </Text>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoItem}>
                <View style={styles.infoLabelRow}>
                  <Ionicons name="call-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.infoLabel, { fontFamily: fontFamily.medium }]}>
                    Phone Number
                  </Text>
                </View>
                <Text style={[styles.infoValue, { fontFamily: fontFamily.semiBold }]}>
                  {verificationData?.phone_number || 'N/A'}
                </Text>
              </View>
            </View>

            {/* Document Thumbnails */}
            {(verificationData?.id_image || verificationData?.cor_image) && (
              <View style={styles.documentsSection}>
                <Text style={[styles.documentsLabel, { fontFamily: fontFamily.semiBold }]}>
                  Uploaded Documents
                </Text>
                <View style={styles.documentThumbnails}>
                  {verificationData?.id_image && (
                    <View style={styles.thumbnailContainer}>
                      <Image 
                        source={{ uri: verificationData.id_image }} 
                        style={styles.thumbnail}
                      />
                      <Text style={[styles.thumbnailLabel, { fontFamily: fontFamily.medium }]}>
                        Student ID
                      </Text>
                    </View>
                  )}
                  {verificationData?.cor_image && (
                    <View style={styles.thumbnailContainer}>
                      <Image 
                        source={{ uri: verificationData.cor_image }} 
                        style={styles.thumbnail}
                      />
                      <Text style={[styles.thumbnailLabel, { fontFamily: fontFamily.medium }]}>
                        COR
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Status-Specific Content */}
          {status === 'approved' && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrapper, { backgroundColor: `${statusConfig.color}15` }]}>
                  <Ionicons name="gift" size={18} color={statusConfig.color} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
                  Benefits Unlocked
                </Text>
              </View>

              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="cart" size={20} color={statusConfig.color} />
                  </View>
                  <View style={styles.benefitContent}>
                    <Text style={[styles.benefitTitle, { fontFamily: fontFamily.semiBold }]}>
                      Buy & Sell Products
                    </Text>
                    <Text style={[styles.benefitDescription, { fontFamily: fontFamily.regular }]}>
                      Access the full marketplace
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="chatbubbles" size={20} color={statusConfig.color} />
                  </View>
                  <View style={styles.benefitContent}>
                    <Text style={[styles.benefitTitle, { fontFamily: fontFamily.semiBold }]}>
                      Message Sellers
                    </Text>
                    <Text style={[styles.benefitDescription, { fontFamily: fontFamily.regular }]}>
                      Connect with other students
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="shield-checkmark" size={20} color={statusConfig.color} />
                  </View>
                  <View style={styles.benefitContent}>
                    <Text style={[styles.benefitTitle, { fontFamily: fontFamily.semiBold }]}>
                      Verified Badge
                    </Text>
                    <Text style={[styles.benefitDescription, { fontFamily: fontFamily.regular }]}>
                      Build trust in the community
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {status === 'rejected' && verificationData?.rejection_reason && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrapper, { backgroundColor: `${statusConfig.color}15` }]}>
                  <Ionicons name="information-circle" size={18} color={statusConfig.color} />
                </View>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
                  Rejection Reason
                </Text>
              </View>

              <View style={styles.rejectionReasonContainer}>
                <Text style={[styles.rejectionReasonText, { fontFamily: fontFamily.medium }]}>
                  {verificationData.rejection_reason}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.resubmitButton}
                onPress={handleResubmit}
                activeOpacity={0.8}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={[styles.resubmitButtonText, { fontFamily: fontFamily.bold }]}>
                    Submit New Request
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Help Section */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrapper}>
                <Ionicons name="help-circle" size={18} color={theme.accent} />
              </View>
              <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
                Need Help?
              </Text>
            </View>

            <View style={styles.helpSection}>
              <TouchableOpacity style={styles.helpItem} activeOpacity={0.7}>
                <View style={styles.helpIcon}>
                  <Ionicons name="document-text-outline" size={20} color={theme.accent} />
                </View>
                <Text style={[styles.helpText, { fontFamily: fontFamily.medium }]}>
                  View Verification Guidelines
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <View style={styles.helpDivider} />

              <TouchableOpacity style={styles.helpItem} activeOpacity={0.7}>
                <View style={styles.helpIcon}>
                  <Ionicons name="mail-outline" size={20} color={theme.accent} />
                </View>
                <Text style={[styles.helpText, { fontFamily: fontFamily.medium }]}>
                  Contact Support
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          {status === 'approved' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Tabs')}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="rocket" size={20} color="#fff" />
                <Text style={[styles.primaryButtonText, { fontFamily: fontFamily.bold }]}>
                  Start Using BuyNaBay
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {status === 'pending' && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Tabs')}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { fontFamily: fontFamily.semiBold }]}>
                Back to Home
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme, insets, isDarkMode, statusColor) => StyleSheet.create({
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
    marginTop: 16,
    fontSize: 15,
    color: theme.textSecondary,
  },
  
  // Header
  headerContainer: {
    paddingTop: insets.top,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: theme.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    color: theme.text,
    letterSpacing: -0.3,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scroll View
  scrollView: { 
    flex: 1 
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  contentContainer: {
    gap: 16,
  },

  // Status Hero Card
  statusHeroCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: statusColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 8,
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
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
  statusTitle: {
    fontSize: 28,
    color: theme.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  statusTimestamp: {
    fontSize: 13,
    color: theme.textSecondary,
  },

  // Card
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    padding: 20,
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

  // Timeline
  timelineContainer: {
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconCompleted: {
    backgroundColor: '#10B981',
  },
  timelineIconActive: {
    backgroundColor: '#F59E0B',
  },
  timelineIconPending: {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    marginLeft: 17,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 6,
  },
  timelineTitle: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  estimatedTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.08)' : 'rgba(253, 173, 0, 0.05)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: `${theme.accent}30`,
  },
  estimatedTimeText: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
  },

  // Info Section
  infoSection: {
    gap: 0,
  },
  infoItem: {
    paddingVertical: 16,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
  },
  copyButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: `${theme.accent}15`,
  },
  infoDivider: {
    height: 1,
    backgroundColor: theme.borderColor || theme.border,
  },

  // Documents Section
  documentsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor || theme.border,
  },
  documentsLabel: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 12,
  },
  documentThumbnails: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbnailContainer: {
    flex: 1,
  },
  thumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    marginBottom: 8,
  },
  thumbnailLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Benefits List
  benefitsList: {
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${statusColor}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },

  // Rejection Reason
  rejectionReasonContainer: {
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${statusColor}30`,
  },
  rejectionReasonText: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 22,
  },

  // Help Section
  helpSection: {
    gap: 0,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpText: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
  },
  helpDivider: {
    height: 1,
    backgroundColor: theme.borderColor || theme.border,
  },

  // Buttons
  primaryButton: {
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resubmitButton: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resubmitButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
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