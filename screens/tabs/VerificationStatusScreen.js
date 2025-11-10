// screens/tabs/VerificationStatusScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function VerificationStatusScreen({ navigation }) {
  const user = auth.currentUser;
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  const fetchVerificationStatus = async (isRefreshing = false) => {
    if (!user) return;

    try {
      if (!isRefreshing) setLoading(true);

      const { data, error } = await supabase
        .from('verifications')
        .select('status, created_at')
        .eq('email', user.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error.message);
        Alert.alert('Error', 'Failed to fetch verification status.');
        if (!isRefreshing) setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!data || data.length === 0) {
        Alert.alert(
          'No Verification Found',
          'You haven\'t submitted a verification yet.'
        );
        navigation.goBack();
        return;
      }

      const latestStatus = data[0].status;
      setStatus(latestStatus);

      // Trigger animations after data is loaded
      if (!isRefreshing) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong while fetching status.');
    } finally {
      if (!isRefreshing) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVerificationStatus(true);
  };

  const getStatusIcon = () => {
    if (status === 'approved') return 'checkmark-circle';
    if (status === 'rejected') return 'close-circle';
    return 'time';
  };

  const getStatusColor = () => {
    if (status === 'approved') return theme.successColor;
    if (status === 'rejected') return theme.error;
    return theme.warningColor;
  };

  const getStatusText = () => {
    if (status === 'approved') return 'Verified';
    if (status === 'rejected') return 'Rejected';
    return 'Pending Review';
  };

  const getStatusTitle = () => {
    if (status === 'approved') return 'Verification Complete';
    if (status === 'rejected') return 'Verification Rejected';
    return 'Verification Under Review';
  };

  const getStatusDescription = () => {
    if (status === 'approved') {
      return 'Your profile has been successfully verified. You now have full access to the marketplace.';
    }
    if (status === 'rejected') {
      return 'Your verification request was rejected. Please check your details and try again.';
    }
    return 'Our admin team is reviewing your student ID and COR images. This usually takes 1-2 business days. You will be notified once your profile is verified.';
  };

  const styles = createStyles(theme);

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading verification status...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Background gradient effect */}
            <View style={styles.backgroundGradient} />

            {/* Branded logo - upper left */}
            <View style={styles.brandedLogoContainer}>
              <Image
                source={require('../../assets/images/OfficialBuyNaBay.png')}
                style={styles.brandedLogoImage}
                resizeMode="contain"
              />
              <Text style={styles.brandedLogoText}>BuyNaBay</Text>
            </View>

            {/* Header Section */}
            <Animated.View
              style={[
                styles.headerSection,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: getStatusColor() + '20' }]}>
                <Ionicons name={getStatusIcon()} size={80} color={getStatusColor()} />
              </View>

              <Text style={styles.statusTitle}>{getStatusTitle()}</Text>

              <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
              </View>

              <Text style={styles.statusDescription}>{getStatusDescription()}</Text>
            </Animated.View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Icon name="info-circle" size={20} color={theme.accent} />
                <Text style={styles.infoCardTitle}>What happens next?</Text>
              </View>

              <View style={styles.timelineContainer}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineIconContainer}>
                    <Ionicons name="document-text" size={20} color={theme.accent} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Document Review</Text>
                    <Text style={styles.timelineDescription}>
                      Admin reviews your uploaded documents
                    </Text>
                  </View>
                </View>

                <View style={styles.timelineLine} />

                <View style={styles.timelineItem}>
                  <View style={styles.timelineIconContainer}>
                    <Ionicons name="time" size={20} color={theme.accent} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Processing Time</Text>
                    <Text style={styles.timelineDescription}>
                      Typically takes 1–2 business days
                    </Text>
                  </View>
                </View>

                <View style={styles.timelineLine} />

                <View style={styles.timelineItem}>
                  <View style={styles.timelineIconContainer}>
                    <Ionicons name="notifications" size={20} color={theme.accent} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Notification</Text>
                    <Text style={styles.timelineDescription}>
                      You'll be notified of the decision
                    </Text>
                  </View>
                </View>

                <View style={styles.timelineLine} />

                <View style={styles.timelineItem}>
                  <View style={styles.timelineIconContainer}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.successColor} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Full Access</Text>
                    <Text style={styles.timelineDescription}>
                      Get full marketplace access once approved
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleRefresh}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.buttonText}>
                  {refreshing ? 'Checking...' : 'Refresh Status'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
              >
                <Ionicons name="home" size={20} color="#fff" />
                <Text style={styles.buttonText}>Browse Products</Text>
              </TouchableOpacity>
            </View>

            {/* Help Section */}
            <View style={styles.helpSection}>
              <Icon name="question-circle" size={16} color={theme.textSecondary} />
              <Text style={styles.helpText}>
                Need help? Contact our support team
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// Dark theme colors 
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
  successColor: '#4CAF50',
  warningColor: '#FBC02D',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
};

// Light theme colors 
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
  successColor: '#27ae60',
  warningColor: '#f39c12',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
};

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    container: {
      flex: 1,
      paddingHorizontal: Math.max(width * 0.05, 20),
      paddingBottom: 30,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      
      height: 300,
      backgroundColor: theme.gradientBackground,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      zIndex: 0,
    },
    brandedLogoContainer: {
      marginTop: 10, 
      marginBottom: 40,
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 10,
    },
    brandedLogoImage: {
      width: 32,
      height: 32,
      marginRight: 8,
    },
    brandedLogoText: {
      fontSize: 18,
      fontWeight: '800', 
      color: theme.accentSecondary,
      letterSpacing: -0.5,
    },
    headerSection: {
      alignItems: 'center',
      marginBottom: 30,
      zIndex: 1,
    },
    iconContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
    statusTitle: {
      fontSize: Math.min(width * 0.07, 28),
      fontWeight: '800', 
      color: theme.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 25,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    statusText: {
      fontSize: 16,
      fontWeight: '700', 
    },
    statusDescription: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 20,
    },
    infoCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 20,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.borderColor,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    infoCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    infoCardTitle: {
      fontSize: 18,
      fontWeight: '700', 
      color: theme.text,
      marginLeft: 10,
    },
    timelineContainer: {
      paddingLeft: 10,
    },
    timelineItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    timelineIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accent + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    timelineContent: {
      flex: 1,
      paddingBottom: 4,
    },
    timelineTitle: {
      fontSize: 16,
      fontWeight: '600', 
      color: theme.text,
      marginBottom: 4,
    },
    timelineDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    timelineLine: {
      width: 2,
      height: 24,
      backgroundColor: theme.borderColor,
      marginLeft: 19,
      marginVertical: 4,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    refreshButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 16, 
      borderRadius: 16,
      gap: 8,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    browseButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.successColor,
      paddingVertical: 16, 
      borderRadius: 16,
      gap: 8,
      shadowColor: theme.successColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700', 
    },
    helpSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    helpText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    loadingOverlay: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
  });