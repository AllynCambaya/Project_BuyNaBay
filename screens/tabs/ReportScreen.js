// screens/ReportScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
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

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or misleading', icon: 'exclamation-triangle' },
  { id: 'scam', label: 'Scam or fraud', icon: 'ban' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'times-circle' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'user-times' },
  { id: 'fake', label: 'Fake account or listing', icon: 'shield' },
  { id: 'violence', label: 'Violence or threats', icon: 'warning' },
  { id: 'other', label: 'Other', icon: 'ellipsis-h' },
];

export default function ReportScreen({ route, navigation }) {
  const { reported_student_id, reported_name } = route?.params || {};
  const user = auth.currentUser;

  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Trigger animations on mount
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
  }, []);

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      Alert.alert('Select a Reason', 'Please select a reason for reporting.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Add Details', 'Please provide additional details about this report.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from('reports').insert([
        {
          reporter_id: user?.email,
          reported_user_id: reported_student_id,
          reported_user_name: reported_name,
          reason: selectedReason,
          description: description.trim(),
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review it and take appropriate action.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      console.error('Report submission error:', err);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Report User</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {/* Warning Banner */}
              <View style={styles.warningBanner}>
                <Icon name="shield" size={32} color={theme.error} />
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>Report {reported_name || 'User'}</Text>
                  <Text style={styles.warningText}>
                    Help us keep BuyNaBay safe. Your report will be reviewed confidentially.
                  </Text>
                </View>
              </View>

              {/* Reported User Info */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="user" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Reporting</Text>
                </View>
                <View style={styles.userCard}>
                  <View style={styles.userAvatar}>
                    <Icon name="user-circle" size={40} color={theme.accent} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{reported_name || 'User'}</Text>
                    <Text style={styles.userEmail}>{reported_student_id}</Text>
                  </View>
                </View>
              </View>

              {/* Reason Selection */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="list" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Select Reason</Text>
                </View>
                <View style={styles.reasonsContainer}>
                  {REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.id}
                      style={[
                        styles.reasonCard,
                        selectedReason === reason.id && styles.reasonCardSelected,
                      ]}
                      onPress={() => setSelectedReason(reason.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.reasonIconContainer,
                          selectedReason === reason.id && styles.reasonIconContainerSelected,
                        ]}
                      >
                        <Icon
                          name={reason.icon}
                          size={20}
                          color={selectedReason === reason.id ? '#fff' : theme.accent}
                        />
                      </View>
                      <Text
                        style={[
                          styles.reasonText,
                          selectedReason === reason.id && styles.reasonTextSelected,
                        ]}
                      >
                        {reason.label}
                      </Text>
                      {selectedReason === reason.id && (
                        <Icon name="check-circle" size={20} color={theme.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="align-left" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Additional Details</Text>
                </View>
                <View style={styles.card}>
                  <TextInput
                    style={styles.textArea}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={6}
                    placeholder="Please provide specific details about this report. Include any relevant information that will help us investigate..."
                    placeholderTextColor={theme.textSecondary}
                    textAlignVertical="top"
                    maxLength={500}
                  />
                  <Text style={styles.charCount}>{description.length}/500</Text>
                </View>
              </View>

              {/* Privacy Notice */}
              <View style={styles.privacyNotice}>
                <Icon name="lock" size={16} color={theme.textSecondary} />
                <Text style={styles.privacyText}>
                  Your report is confidential and will not be shared with the reported user.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Fixed Bottom Button */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (submitting || !selectedReason || !description.trim()) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitReport}
              disabled={submitting || !selectedReason || !description.trim()}
              activeOpacity={0.85}
            >
              {submitting ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.submitButtonText, { marginLeft: 10 }]}>
                    Submitting...
                  </Text>
                </View>
              ) : (
                <>
                  <Icon name="flag" size={20} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                  <Icon name="arrow-right" size={16} color="#fff" style={{ marginLeft: 10 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  inputBackground: '#1e1e3f',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  historyColor: '#4CAF50',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  buttonDisabled: '#555',
  warningBg: '#2a1f1f',
  reasonBg: '#252550',
  reasonSelectedBg: '#2a2a55',
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
  inputBackground: '#f9f9fc',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  historyColor: '#27ae60',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  buttonDisabled: '#ccc',
  warningBg: '#ffebee',
  reasonBg: '#f9f9fc',
  reasonSelectedBg: '#fffbf0',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Math.max(width * 0.04, 16),
    paddingVertical: 16,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    padding: Math.max(width * 0.04, 16),
    paddingBottom: 100,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.warningBg,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.error,
  },
  warningContent: {
    flex: 1,
    marginLeft: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.error,
    marginBottom: 6,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  warningText: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  userAvatar: {
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  userEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  reasonsContainer: {
    gap: 12,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.reasonBg,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.borderColor,
  },
  reasonCardSelected: {
    backgroundColor: theme.reasonSelectedBg,
    borderColor: theme.accent,
  },
  reasonIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reasonIconContainerSelected: {
    backgroundColor: theme.accent,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  reasonTextSelected: {
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.inputBackground,
    fontSize: 15,
    color: theme.text,
    minHeight: 120,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  charCount: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'right',
    marginTop: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundAlt,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  privacyText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  bottomContainer: {
    backgroundColor: theme.cardBackground,
    paddingHorizontal: Math.max(width * 0.04, 16),
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  submitButton: {
    backgroundColor: theme.error,
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.error,
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
    backgroundColor: theme.buttonDisabled,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOpacity: 0.2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});