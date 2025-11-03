import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
    Dimensions,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useColorScheme,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function AddScreen() {
  const navigation = useNavigation();
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>What would you like to add?</Text>
            <Text style={styles.headerSubtitle}>Choose an option below to get started</Text>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => navigation.navigate('AddProductScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="cube-outline" size={48} color={theme.accent} />
              <Text style={styles.optionTitle}>Add Product</Text>
              <Text style={styles.optionDescription}>List an item for sale in the marketplace.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => navigation.navigate('RentItemScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={48} color={theme.accent} />
              <Text style={styles.optionTitle}>Add Rental</Text>
              <Text style={styles.optionDescription}>List an item for rent to the community.</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

// Theme definitions
const darkTheme = {
  background: '#0f0f2e',
  cardBackground: '#1e1e3f',
  text: '#ffffff',
  textSecondary: '#a0a0bb',
  accent: '#FDAD00',
  borderColor: '#2a2a4a',
  shadowColor: '#000000',
};

const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#6a6a8a',
  accent: '#f39c12',
  borderColor: '#e0e0ea',
  shadowColor: '#000000',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    color: theme.text,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 8,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    gap: 20,
  },
  optionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    marginTop: 16,
    fontFamily: 'Poppins-Bold',
  },
  optionDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
});