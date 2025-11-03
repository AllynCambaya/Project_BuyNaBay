// screens/ReportScreen.js
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
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
  { id: 'spam', label: 'Spam or misleading', icon: 'exclamation-triangle', description: 'Unwanted or deceptive content' },
  { id: 'scam', label: 'Scam or fraud', icon: 'ban', description: 'Fraudulent activity or deception' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'times-circle', description: 'Offensive or unsuitable material' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'user-times', description: 'Threatening or abusive behavior' },
  { id: 'fake', label: 'Fake account or listing', icon: 'shield', description: 'Impersonation or false information' },
  { id: 'violence', label: 'Violence or threats', icon: 'warning', description: 'Dangerous or threatening content' },
  { id: 'other', label: 'Other', icon: 'ellipsis-h', description: 'Something else' },
];

export default function ReportScreen({ route, navigation }) {
  const { reported_student_id, reported_name, reported_avatar } = route?.params || {};
  const user = auth.currentUser;

  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trigger animations on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
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

      // Animate success modal
      setShowSuccessModal(true);
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        navigation.goBack();
      }, 2000);

    } catch (err) {
      console.error('Report submission error:', err);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = createStyles(theme);

  const selectedReasonData = REPORT_REASONS.find(r => r.id === selectedReason);

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
              <Icon name="chevron-left" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Report User</Text>
              <Text style={styles.headerSubtitle}>Help keep BuyNaBay safe</Text>
            </View>
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
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim },
                ],
              }}
            >
              {/* Warning Banner */}
              <View style={styles.warningBanner}>
                <View style={styles.warningIconCircle}>
                  <Icon name="shield" size={28} color={theme.error} />
                </View>
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>Confidential Report</Text>
                  <Text style={styles.warningText}>
                    Your report helps protect our community. All submissions are reviewed confidentially.
                  </Text>
                </View>
              </View>

              {/* Reported User Card */}
              <View style={styles.section}>
                <View style={styles.sectionLabel}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="user" size={14} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Reporting</Text>
                </View>
                
                <View style={styles.userCard}>
                  <View style={styles.userAvatarContainer}>
                    {reported_avatar ? (
                      <Image source={{ uri: reported_avatar }} style={styles.userAvatar} />
                    ) : (
                      <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                        <Icon name="user" size={28} color={theme.textSecondary} />
                      </View>
                    )}
                    <View style={styles.userBadge}>
                      <Icon name="flag" size={10} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{reported_name || 'User'}</Text>
                    <Text style={styles.userEmail}>{reported_student_id}</Text>
                  </View>
                </View>
              </View>

              {/* Reason Selection */}
              <View style={styles.section}>
                <View style={styles.sectionLabel}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="list-ul" size={14} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Select Reason</Text>
                  {selectedReason && <Text style={styles.sectionBadge}>Selected</Text>}
                </View>

                <View style={styles.reasonsGrid}>
                  {REPORT_REASONS.map((reason, index) => {
                    const isSelected = selectedReason === reason.id;
                    return (
                      <TouchableOpacity
                        key={reason.id}
                        style={[
                          styles.reasonCard,
                          isSelected && styles.reasonCardSelected,
                        ]}
                        onPress={() => setSelectedReason(reason.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.reasonHeader}>
                          <View
                            style={[
                              styles.reasonIconContainer,
                              isSelected && styles.reasonIconContainerSelected,
                            ]}
                          >
                            <Icon
                              name={reason.icon}
                              size={18}
                              color={isSelected ? '#fff' : theme.accent}
                            />
                          </View>
                          {isSelected && (
                            <View style={styles.checkBadge}>
                              <Icon name="check" size={12} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.reasonLabel,
                            isSelected && styles.reasonLabelSelected,
                          ]}
                        >
                          {reason.label}
                        </Text>
                        <Text style={styles.reasonDescription}>{reason.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Description Section */}
              <View style={styles.section}>
                <View style={styles.sectionLabel}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="align-left" size={14} color={theme.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Additional Details</Text>
                  <Text style={styles.requiredBadge}>Required</Text>
                </View>

                <View style={styles.textAreaCard}>
                  <TextInput
                    style={styles.textArea}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    placeholder="Describe what happened. Include specific details, dates, or any relevant information that will help us investigate this report..."
                    placeholderTextColor={theme.textTertiary}
                    textAlignVertical="top"
                    maxLength={500}
                  />
                  <View style={styles.textAreaFooter}>
                    <View style={styles.textAreaHint}>
                      <Icon name="info-circle" size={12} color={theme.textSecondary} />
                      <Text style={styles.hintText}>Be as specific as possible</Text>
                    </View>
                    <Text style={[
                      styles.charCount,
                      description.length >= 450 && styles.charCountWarning
                    ]}>
                      {description.length}/500
                    </Text>
                  </View>
                </View>
              </View>

              {/* Privacy & Guidelines */}
              <View style={styles.infoSection}>
                <View style={styles.infoCard}>
                  <View style={styles.infoIconContainer}>
                    <Icon name="lock" size={16} color={theme.success} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>Your Privacy Protected</Text>
                    <Text style={styles.infoText}>
                      Reports are confidential and will not be shared with the reported user.
                    </Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoIconContainer}>
                    <Icon name="clock-o" size={16} color={theme.accent} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>Review Process</Text>
                    <Text style={styles.infoText}>
                      Our team will review your report within 24-48 hours and take appropriate action.
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Fixed Bottom Submit Button */}
          <View style={styles.bottomBar}>
            {selectedReasonData && (
              <View style={styles.selectionSummary}>
                <Icon name={selectedReasonData.icon} size={16} color={theme.accent} />
                <Text style={styles.summaryText}>{selectedReasonData.label}</Text>
              </View>
            )}
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
                <View style={styles.buttonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.submitButtonText}>Submitting Report...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Icon name="send" size={18} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Success Modal Overlay */}
          {showSuccessModal && (
            <View style={styles.successModalOverlay}>
              <Animated.View
                style={[
                  styles.successModal,
                  {
                    opacity: successAnim,
                    transform: [
                      {
                        scale: successAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.successIconCircle}>
                  <Icon name="check" size={48} color="#fff" />
                </View>
                <Text style={styles.successTitle}>Report Submitted!</Text>
                <Text style={styles.successMessage}>
                  Thank you for helping keep BuyNaBay safe. We'll review your report shortly.
                </Text>
              </Animated.View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// Dark theme colors (matching InboxScreen and MessagingScreen)
const darkTheme = {
  background: '#0a0e27',
  cardBackground: '#141b3c',
  text: '#ffffff',
  textSecondary: '#a8b2d1',
  textTertiary: '#6b7280',
  accent: '#FDAD00',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  border: '#252b47',
  inputBackground: '#1e2544',
  buttonDisabled: '#4a5568',
  warningBg: '#2a1a1a',
  reasonBg: '#1e2544',
  reasonSelectedBg: '#2a3a5a',
  infoBg: '#1e2544',
  shadowColor: '#000',
  overlayBg: 'rgba(10, 14, 39, 0.95)',
};

// Light theme colors (matching InboxScreen and MessagingScreen)
const lightTheme = {
  background: '#f8fafc',
  cardBackground: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  accent: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  border: '#e2e8f0',
  inputBackground: '#f1f5f9',
  buttonDisabled: '#cbd5e1',
  warningBg: '#fef2f2',
  reasonBg: '#f9fafb',
  reasonSelectedBg: '#fffbeb',
  infoBg: '#f8fafc',
  shadowColor: '#000',
  overlayBg: 'rgba(248, 250, 252, 0.95)',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardView: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 40,
  },
  
  // Content
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 120,
  },
  
  // Warning Banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.warningBg,
    padding: 18,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.error,
    ...Platform.select({
      ios: {
        shadowColor: theme.error,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  warningIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.error}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.error,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  warningText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  
  // Section
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  sectionBadge: {
    backgroundColor: theme.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  requiredBadge: {
    backgroundColor: theme.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  
  // User Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: theme.border,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
  },
  userBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.error,
    borderWidth: 2,
    borderColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  userEmail: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  
  // Reasons Grid
  reasonsGrid: {
    gap: 12,
  },
  reasonCard: {
    backgroundColor: theme.reasonBg,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  reasonCardSelected: {
    backgroundColor: theme.reasonSelectedBg,
    borderColor: theme.accent,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reasonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonIconContainerSelected: {
    backgroundColor: theme.accent,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  reasonLabelSelected: {
    fontWeight: '700',
    color: theme.text,
  },
  reasonDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  
  // Text Area
  textAreaCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  textArea: {
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
    minHeight: 140,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  textAreaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  textAreaHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  charCount: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  charCountWarning: {
    color: theme.warning,
  },
  
  // Info Section
  infoSection: {
    gap: 12,
    marginTop: 8,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.infoBg,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 3,
  },
  infoText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  
  // Bottom Bar
  bottomBar: {
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  summaryText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: theme.error,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  submitButtonDisabled: {
    backgroundColor: theme.buttonDisabled,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  
  // Success Modal
  successModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.overlayBg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successModal: {
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: width * 0.85,
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});