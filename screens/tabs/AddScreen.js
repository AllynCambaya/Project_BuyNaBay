import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function AddScreen() {
  const navigation = useNavigation();
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleProduct = useRef(new Animated.Value(1)).current;
  const scaleRental = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
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

  const handlePressIn = (scaleValue) => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (scaleValue) => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Decorative Background Elements */}
          <View style={styles.backgroundDecor}>
            <View style={[styles.decorCircle, styles.decorCircle1]} />
            <View style={[styles.decorCircle, styles.decorCircle2]} />
          </View>

          {/* Header Section */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="add-circle" size={56} color={theme.accent} />
            </View>
            <Text style={styles.headerTitle}>Create New Listing</Text>
            <Text style={styles.headerSubtitle}>
              Choose what you'd like to share with the BuyNaBay community
            </Text>
          </Animated.View>

          {/* Options Container */}
          <Animated.View
            style={[
              styles.optionsContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Add Product Card */}
            <Animated.View style={{ transform: [{ scale: scaleProduct }] }}>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => navigation.navigate('AddProductScreen')}
                onPressIn={() => handlePressIn(scaleProduct)}
                onPressOut={() => handlePressOut(scaleProduct)}
                activeOpacity={1}
              >
                <View style={[styles.iconWrapper, { backgroundColor: theme.accentLight }]}>
                  <Ionicons name="cube-outline" size={40} color={theme.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Sell a Product</Text>
                  <Text style={styles.optionDescription}>
                    List items for sale and reach buyers in your area
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Add Rental Card */}
            <Animated.View style={{ transform: [{ scale: scaleRental }] }}>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => navigation.navigate('RentItemScreen')}
                onPressIn={() => handlePressIn(scaleRental)}
                onPressOut={() => handlePressOut(scaleRental)}
                activeOpacity={1}
              >
                <View style={[styles.iconWrapper, { backgroundColor: theme.accentLight }]}>
                  <Ionicons name="home-outline" size={40} color={theme.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>List for Rent</Text>
                  <Text style={styles.optionDescription}>
                    Offer items or spaces for rent to the community
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Help Text */}
          <Animated.View
            style={[
              styles.helpContainer,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
            <Text style={styles.helpText}>
              Your listings will be visible to all verified BuyNaBay users
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </>
  );
}

// Theme definitions aligned with BuyNaBay brand
const darkTheme = {
  background: '#1B1B41',
  cardBackground: '#252553',
  text: '#FFFFFF',
  textSecondary: '#B0B0C8',
  textTertiary: '#7A7A9A',
  accent: '#FDAD00',
  accentLight: 'rgba(253, 173, 0, 0.15)',
  borderColor: '#3A3A68',
  shadowColor: '#000000',
  decorColor: 'rgba(253, 173, 0, 0.08)',
};

const lightTheme = {
  background: '#F8F9FB',
  cardBackground: '#FFFFFF',
  text: '#1B1B41',
  textSecondary: '#6B6B8A',
  textTertiary: '#9999B3',
  accent: '#FDAD00',
  accentLight: 'rgba(253, 173, 0, 0.12)',
  borderColor: '#E8E8F0',
  shadowColor: '#1B1B41',
  decorColor: 'rgba(253, 173, 0, 0.05)',
};

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    backgroundDecor: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
    },
    decorCircle: {
      position: 'absolute',
      backgroundColor: theme.decorColor,
      borderRadius: 1000,
    },
    decorCircle1: {
      width: 300,
      height: 300,
      top: -150,
      right: -100,
    },
    decorCircle2: {
      width: 250,
      height: 250,
      bottom: -100,
      left: -80,
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    iconContainer: {
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      color: theme.text,
      fontFamily: 'Poppins-Bold',
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      fontFamily: 'Poppins-Regular',
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: width * 0.8,
    },
    optionsContainer: {
      gap: 16,
      marginBottom: 32,
    },
    optionCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    iconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      fontFamily: 'Poppins-Bold',
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    optionDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 19,
      fontFamily: 'Poppins-Regular',
    },
    arrowContainer: {
      marginLeft: 8,
    },
    helpContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      gap: 8,
      marginTop: 'auto',
    },
    helpText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'Poppins-Regular',
      textAlign: 'center',
      lineHeight: 18,
      flex: 1,
    },
  });