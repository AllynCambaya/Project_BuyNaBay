import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const darkTheme = {
  background: '#0f0f2e',
  cardBackground: '#1e1e3f',
  text: '#fff',
  textSecondary: '#bbb',
  accent: '#FDAD00',
  borderColor: '#2a2a4a',
};

const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  accent: '#f39c12',
  borderColor: '#e0e0ea',
};

export default function LostAndFoundDetailsScreen({ route, navigation }) {
  const item = route?.params?.item || {};
  const images = item.lost_and_found_url || item.image_urls || [];

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  const onMomentumScrollEnd = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setActiveIndex(index);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{item.item_name || 'Details'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ backgroundColor: theme.cardBackground }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          ref={scrollRef}
          style={[styles.imageCarousel, { backgroundColor: theme.cardBackground }]}
        >
          {images.length > 0 ? (
            images.map((uri, idx) => (
              <Image
                key={idx}
                source={{ uri }}
                style={styles.image}
                resizeMode="cover"
              />
            ))
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.noImageText, { color: theme.textSecondary }]}>No images</Text>
            </View>
          )}
        </ScrollView>

        {/* pagination dots */}
        {images.length > 1 && (
          <View style={styles.dotsContainer}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === activeIndex ? theme.accent : theme.textSecondary },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* left / right controls + avatar overlay */}
      <View style={[styles.cardFooter, { backgroundColor: theme.cardBackground }]}> 
        {/* avatar + reporter */}
        <View style={styles.reporterRow}>
          <Image
            source={{ uri: item.user_avatar || 'https://placekitten.com/50/50' }}
            style={styles.reporterAvatar}
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.reporterName, { color: theme.text }]}>{item.user_name || 'Anonymous'}</Text>
            <Text style={[styles.reporterEmail, { color: theme.textSecondary }]} numberOfLines={1}>{item.user_email || ''}</Text>
          </View>
        </View>

        {/* nav buttons */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={() => {
              if (!scrollRef.current) return;
              const newIndex = Math.max(0, activeIndex - 1);
              scrollRef.current.scrollTo({ x: newIndex * width, animated: true });
              setActiveIndex(newIndex);
            }}
            style={[styles.navButton, activeIndex === 0 && styles.navButtonDisabled]}
            disabled={activeIndex === 0}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (!scrollRef.current) return;
              const newIndex = Math.min(images.length - 1, activeIndex + 1);
              scrollRef.current.scrollTo({ x: newIndex * width, animated: true });
              setActiveIndex(newIndex);
            }}
            style={[styles.navButton, activeIndex === images.length - 1 && styles.navButtonDisabled]}
            disabled={activeIndex === images.length - 1}
          >
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}> 
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Item</Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>{item.item_name || '-'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Status</Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>{item.item_status || '-'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Location</Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>{item.location || '-'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Description</Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>{item.description || '-'}</Text>
        </View>

        <View style={styles.sectionRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Reporter</Text>
            <Text style={[styles.sectionText, { color: theme.text }]}>{item.user_name || item.user_email || 'Anonymous'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Posted</Text>
            <Text style={[styles.sectionText, { color: theme.text }]}>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 6 },
  title: { fontSize: 18, fontWeight: '700' },
  imageCarousel: { height: height * 0.45 },
  image: { width, height: height * 0.45 },
  noImage: { width, height: height * 0.45, justifyContent: 'center', alignItems: 'center' },
  noImageText: { marginTop: 12 },
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  content: { padding: 16 },
  section: { marginBottom: 12 },
  sectionRow: { marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 13, marginBottom: 4 },
  sectionText: { fontSize: 16 },
  cardFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reporterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#fff',
  },
  reporterName: { fontSize: 15, fontWeight: '700' },
  reporterEmail: { fontSize: 12, opacity: 0.9 },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
});
