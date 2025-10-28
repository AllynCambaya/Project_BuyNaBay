// screens/CommunityScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width } = Dimensions.get('window');

const REACTIONS = [
  { key: 'like', emoji: '👍' },
  { key: 'love', emoji: '❤️' },
  { key: 'haha', emoji: '😂' },
  { key: 'wow', emoji: '😮' },
  { key: 'sad', emoji: '😢' },
  { key: 'angry', emoji: '😡' },
];

export default function CommunityScreen({ navigation }) {
  const user = auth.currentUser;
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // create post modal
  const [createVisible, setCreateVisible] = useState(false);
  const [postText, setPostText] = useState('');
  const [postImages, setPostImages] = useState([]); // array of local URIs
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  // comments modal
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [commenting, setCommenting] = useState(false);

  // reaction picker
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPostTarget, setReactionPostTarget] = useState(null);

  // UI/theme
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  // realtime channels refs
  const postsChannelRef = useRef(null);
  const commentsChannelRef = useRef(null);
  const reactionsChannelRef = useRef(null);

  useEffect(() => {
    fetchPosts();

    // subscribe to realtime changes
    postsChannelRef.current = supabase
      .channel('public:community_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_posts' },
        (payload) => {
          setPosts((p) => [payload.new, ...p]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_posts' },
        (payload) => {
          setPosts((p) => p.map((x) => (x.id === payload.new.id ? payload.new : x)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'community_posts' },
        (payload) => {
          setPosts((p) => p.filter((x) => x.id !== payload.old.id));
        }
      )
      .subscribe();

    // comments realtime
    commentsChannelRef.current = supabase
      .channel('public:community_comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_comments' },
        (payload) => {
          setComments((c) => (payload.new.post_id === activePost?.id ? [...c, payload.new] : c));
          // bump post comment count
          setPosts((p) => p.map(x => x.id === payload.new.post_id ? { ...x, comments_count: (x.comments_count || 0) + 1 } : x));
        }
      )
      .subscribe();

    // reactions realtime
    reactionsChannelRef.current = supabase
      .channel('public:community_reactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_reactions' },
        (payload) => {
          // mark post as dirty so we re-fetch aggregated counts
          setPosts((p) =>
            p.map((px) => (px.id === payload.new.post_id ? { ...px, _dirty: true } : px))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'community_reactions' },
        (payload) => {
          setPosts((p) =>
            p.map((px) => (px.id === payload.old.post_id ? { ...px, _dirty: true } : px))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_reactions' },
        (payload) => {
          setPosts((p) =>
            p.map((px) => (px.id === payload.new.post_id ? { ...px, _dirty: true } : px))
          );
        }
      )
      .subscribe();

    return () => {
      if (postsChannelRef.current) supabase.removeChannel(postsChannelRef.current);
      if (commentsChannelRef.current) supabase.removeChannel(commentsChannelRef.current);
      if (reactionsChannelRef.current) supabase.removeChannel(reactionsChannelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePost]);

  // Small effect: if any post has _dirty flag, re-fetch posts to update reaction aggregates
  useEffect(() => {
    const anyDirty = posts.some((p) => p._dirty);
    if (anyDirty) fetchPosts(); // fetchPosts will reset dirty flags
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      // fetch posts joined with basic user info (from your public.users table)
      const { data: postsData, error } = await supabase
        .from('community_posts')
        .select('*, users:user_id (id, email, name, profile_photo)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      const postIds = postsData.map((p) => p.id).filter(Boolean);

      // 1) fetch all reactions for these posts, then aggregate client-side
      const { data: reactionsAll = [] } = await supabase
        .from('community_reactions')
        .select('post_id, reaction_type')
        .in('post_id', postIds);

      const reactionMap = {}; // { postId: { like: 2, love: 1 } }
      reactionsAll.forEach((r) => {
        if (!r?.post_id || !r.reaction_type) return;
        reactionMap[r.post_id] = reactionMap[r.post_id] || {};
        reactionMap[r.post_id][r.reaction_type] = (reactionMap[r.post_id][r.reaction_type] || 0) + 1;
      });

      // 2) fetch current user's reactions for these posts
      let userReactions = [];
      if (user?.uid && postIds.length > 0) {
        const { data: ur = [] } = await supabase
          .from('community_reactions')
          .select('post_id, reaction_type')
          .in('post_id', postIds)
          .eq('user_id', user.uid);
        userReactions = ur;
      }

      // 3) fetch comment counts for these posts and aggregate client-side
      const { data: commentsAll = [] } = await supabase
        .from('community_comments')
        .select('post_id')
        .in('post_id', postIds);

      const commentCountMap = {};
      commentsAll.forEach((c) => {
        if (!c?.post_id) return;
        commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1;
      });

      // Build posts with meta
      const postsWithMeta = postsData.map((p) => {
        const countsObj = reactionMap[p.id] || {};
        const reaction_counts = Object.keys(countsObj).map((k) => ({ reaction_type: k, count: countsObj[k] }));
        const uReact = userReactions.find((r) => r.post_id === p.id);
        const comments_count = commentCountMap[p.id] || 0;

        // Remove _dirty flag if present
        const cleaned = { ...p };
        if (cleaned._dirty) delete cleaned._dirty;

        return {
          ...cleaned,
          reaction_counts,
          my_reaction: uReact?.reaction_type || null,
          comments_count,
        };
      });

      setPosts(postsWithMeta);
    } catch (err) {
      console.error('Fetch posts error', err);
      Alert.alert('Error', 'Could not fetch posts. See console for details.');
    } finally {
      setLoadingPosts(false);
    }
  };

  // Pick images for post or comment
  const pickImages = async (forComment = false, single = false) => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: !single && true,
      });

      if (res.canceled) return;
      const uris = res.assets.map((a) => a.uri);

      if (forComment) setCommentImage(uris[0]);
      else setPostImages((prev) => (Array.isArray(prev) ? [...prev, ...uris] : uris));
    } catch (err) {
      console.error('Image pick error', err);
      Alert.alert('Image error', 'Could not pick image.');
    }
  };

  // upload image to supabase storage and return public url
  const uploadFileAsync = async (localUri, folder = 'posts') => {
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const fileExt = localUri.split('.').pop().split('?')[0];
      const filename = `${folder}/${auth.currentUser.uid}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('community-uploads')
        .upload(filename, blob, { upsert: false });

      if (uploadError) {
        // if file exists or bucket rules cause error, attempt with upsert:true
        const { error: retry } = await supabase.storage
          .from('community-uploads')
          .upload(filename, blob, { upsert: true });
        if (retry) throw retry;
      }

      const { data } = supabase.storage.from('community-uploads').getPublicUrl(filename);
      return data.publicUrl;
    } catch (err) {
      console.error('Upload error', err);
      throw err;
    }
  };

  // Submit a post (text + optional images)
  const submitPost = async () => {
    if (!postText.trim() && postImages.length === 0) {
      Alert.alert('Empty post', 'Add text or an image before posting.');
      return;
    }
    setPosting(true);
    try {
      // upload images and collect urls
      const uploadedUrls = [];
      for (const uri of postImages) {
        const url = await uploadFileAsync(uri, 'posts');
        uploadedUrls.push(url);
      }

      const payload = {
        user_id: user?.uid || null,
        content: postText.trim() || null,
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        is_anonymous: !!isAnonymous,
      };

      const { data, error } = await supabase.from('community_posts').insert(payload).select().single();
      if (error) throw error;

      // reset
      setPostText('');
      setPostImages([]);
      setIsAnonymous(false);
      setCreateVisible(false);

      // optimistic: prepend the new post in state (realtime will do it too)
      setPosts((p) => [data, ...p]);
    } catch (err) {
      console.error('Post error', err);
      Alert.alert('Post error', err.message || 'Unable to create post.');
    } finally {
      setPosting(false);
    }
  };

  // open comments modal and fetch comments for the post
  const openComments = async (post) => {
    setActivePost(post);
    setCommentsVisible(true);
    fetchComments(post.id);
  };

  const fetchComments = async (postId) => {
    try {
      const { data, error } = await supabase
        .from('community_comments')
        .select('*, users:user_id (id, name, profile_photo)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Comments fetch error', err);
      Alert.alert('Error', 'Could not fetch comments.');
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() && !commentImage) {
      Alert.alert('Empty comment', 'Add text or image to post a comment.');
      return;
    }
    if (!activePost) return;

    setCommenting(true);
    try {
      let imageUrl = null;
      if (commentImage) imageUrl = await uploadFileAsync(commentImage, 'comments');

      const payload = {
        post_id: activePost.id,
        user_id: user?.uid || null,
        content: commentText.trim() || null,
        image_url: imageUrl,
      };

      const { data, error } = await supabase.from('community_comments').insert(payload).select().single();
      if (error) throw error;

      setComments((c) => [...c, data]);
      setCommentText('');
      setCommentImage(null);
      // update post comment count locally
      setPosts((p) => p.map((x) => (x.id === activePost.id ? { ...x, comments_count: (x.comments_count || 0) + 1 } : x)));
    } catch (err) {
      console.error('Comment error', err);
      Alert.alert('Comment error', err.message || 'Unable to post comment.');
    } finally {
      setCommenting(false);
    }
  };

  // handle reactions: toggle reaction. If user already has same reaction -> remove; if different -> update to new type
  const toggleReaction = async (postId, reactionType) => {
    if (!user?.uid) {
      Alert.alert('Login required', 'Please login to react.');
      return;
    }

    try {
      // check existing reaction
      const { data: existing } = await supabase
        .from('community_reactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.uid)
        .single();

      if (existing && existing.reaction_type === reactionType) {
        // remove reaction
        await supabase.from('community_reactions').delete().eq('id', existing.id);
        setPosts((p) => p.map((x) => (x.id === postId ? { ...x, _dirty: true } : x)));
        return;
      } else if (existing) {
        // update reaction_type
        await supabase.from('community_reactions').update({ reaction_type: reactionType }).eq('id', existing.id);
      } else {
        // insert new
        await supabase.from('community_reactions').insert({
          post_id: postId,
          user_id: user.uid,
          reaction_type: reactionType,
        });
      }

      setPosts((p) => p.map((x) => (x.id === postId ? { ...x, _dirty: true } : x)));
    } catch (err) {
      console.error('Reaction error', err);
      Alert.alert('Reaction error', 'Could not update reaction.');
    }
  };

  // helper to show reaction summary (a simple mapping)
  const renderReactionSummary = (post) => {
    if (!post) return null;
    const counts = {};
    (post.reaction_counts || []).forEach((r) => {
      counts[r.reaction_type] = r.count || r['count'] || 1;
    });

    const nonZero = Object.keys(counts).filter((k) => counts[k] > 0);
    if (nonZero.length === 0)
      return <Text style={[styles.smallText, { color: theme.textSecondary }]}>Be the first to react</Text>;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {nonZero.slice(0, 3).map((k) => {
          const emoji = REACTIONS.find((r) => r.key === k)?.emoji || '👍';
          return (
            <Text key={k} style={{ marginRight: 6 }}>
              {emoji} {counts[k]}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderPost = ({ item }) => {
    const author = item.users || {};
    const displayName = item.is_anonymous ? 'Anonymous' : (author?.name || author?.email?.split('@')[0] || 'User');
    const avatar = item.is_anonymous ? null : author?.profile_photo || null;

    return (
      <View style={[styles.postCard, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.postHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.avatarWrapper}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarSmall} />
              ) : (
                <View style={[styles.avatarSmall, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{displayName[0]}</Text>
                </View>
              )}
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.postAuthor, { color: theme.text }]}>{displayName}</Text>
              <Text style={[styles.postTime, { color: theme.textSecondary }]}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          </View>

          {/* more actions (report, delete if owner) */}
          <TouchableOpacity onPress={() => handlePostOptions(item)}>
            <Ionicons name="ellipsis-vertical" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 10 }}>
          {item.content ? <Text style={[styles.postText, { color: theme.text }]}>{item.content}</Text> : null}

          {item.image_urls && Array.isArray(item.image_urls) && item.image_urls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {item.image_urls.map((uri, idx) => (
                <TouchableOpacity key={idx} onPress={() => openImageViewer(uri)}>
                  <Image source={{ uri }} style={styles.postImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openReactionPicker(item)}>
            <Text style={{ fontSize: 18 }}>{item.my_reaction ? (REACTIONS.find((r) => r.key === item.my_reaction)?.emoji || '👍') : '👍'}</Text>
            <Text style={[styles.smallText, { color: theme.textSecondary, marginLeft: 6 }]}>React</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item)}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.smallText, { color: theme.textSecondary, marginLeft: 6 }]}>Comment ({item.comments_count || 0})</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => sharePost(item)}>
            <Ionicons name="share-social-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.smallText, { color: theme.textSecondary, marginLeft: 6 }]}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 6 }}>{renderReactionSummary(item)}</View>
      </View>
    );
  };

  // helpers for interactions
  const handlePostOptions = (post) => {
    const isOwner = user?.uid && post.user_id === user.uid;
    if (isOwner) {
      Alert.alert('Delete post', 'Delete this post?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('community_posts').delete().eq('id', post.id);
              setPosts((p) => p.filter((x) => x.id !== post.id));
            } catch (err) {
              console.error('Delete post error', err);
              Alert.alert('Error', 'Could not delete post.');
            }
          },
        },
      ]);
    } else {
      Alert.alert('Report', 'Report this post? (not implemented)', [{ text: 'OK' }]);
    }
  };

  const openImageViewer = (uri) => {
    // fallback: open a simple full-screen modal or navigate if you have an ImageViewer screen
    if (navigation && navigation.navigate) {
      navigation.navigate('ImageViewer', { uri });
    } else {
      Alert.alert('Image', uri);
    }
  };

  const sharePost = (post) => {
    Alert.alert('Share', 'Share functionality not implemented in this example.');
  };

  const openReactionPicker = (post) => {
    setReactionPostTarget(post);
    setReactionPickerVisible(true);
  };

  const handleReact = async (reactionKey) => {
    if (!reactionPostTarget) return;
    await toggleReaction(reactionPostTarget.id, reactionKey);
    setReactionPickerVisible(false);
    setReactionPostTarget(null);
  };

  const handlePickCommentImage = async () => {
    await pickImages(true, true);
  };

  const handlePickPostImages = async () => {
    await pickImages(false, false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Community</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setCreateVisible(true)}>
          <Ionicons name="create" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loadingPosts ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={{ marginTop: 10, color: theme.textSecondary }}>Loading posts...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 60, color: theme.textSecondary }}>No posts yet — be the first!</Text>}
        />
      )}

      {/* CREATE POST MODAL */}
      <Modal visible={createVisible} animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateVisible(false)}>
              <Ionicons name="close" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create Post</Text>
            <TouchableOpacity onPress={submitPost} disabled={posting}>
              {posting ? <ActivityIndicator /> : <Text style={[styles.postNow, { color: theme.accent }]}>Post</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16 }}>
            <View style={[styles.createInput, { backgroundColor: theme.cardBackground }]}>
              <TextInput
                placeholder="What's on your mind?"
                placeholderTextColor={theme.textSecondary}
                multiline
                value={postText}
                onChangeText={setPostText}
                style={[styles.createText, { color: theme.text }]}
              />
            </View>

            <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={styles.mediaBtn} onPress={handlePickPostImages}>
                  <Ionicons name="image" size={20} color={theme.accent} />
                  <Text style={{ marginLeft: 8, color: theme.textSecondary }}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaBtn} onPress={() => Alert.alert('Attach', 'Attach file not implemented')}>
                  <Ionicons name="attach" size={20} color={theme.accent} />
                  <Text style={{ marginLeft: 8, color: theme.textSecondary }}>Attach</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: theme.textSecondary }}>Post anonymously</Text>
                <TouchableOpacity onPress={() => setIsAnonymous((s) => !s)} style={[styles.anonToggle, isAnonymous && { backgroundColor: theme.accent }]}>
                  {isAnonymous ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </TouchableOpacity>
              </View>
            </View>

            {postImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                {postImages.map((uri, idx) => (
                  <View key={idx} style={{ marginRight: 8 }}>
                    <Image source={{ uri }} style={{ width: 120, height: 120, borderRadius: 10 }} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setPostImages((p) => p.filter((_, i) => i !== idx))}>
                      <Ionicons name="close-circle" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* COMMENTS MODAL */}
      <Modal visible={commentsVisible} animationType="slide" onRequestClose={() => setCommentsVisible(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCommentsVisible(false)}>
              <Ionicons name="arrow-back" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Comments</Text>
            <View style={{ width: 50 }} />
          </View>

          <View style={{ flex: 1, padding: 12 }}>
            <View style={[styles.postPreview, { backgroundColor: theme.cardBackground }]}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{activePost?.is_anonymous ? 'Anonymous' : (activePost?.users?.name || 'User')}</Text>
              {activePost?.content ? <Text style={{ marginTop: 8, color: theme.textSecondary }}>{activePost.content}</Text> : null}
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[styles.commentItem, { backgroundColor: theme.cardBackground }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.avatarWrapper}>
                      {item.users?.profile_photo ? (
                        <Image source={{ uri: item.users.profile_photo }} style={styles.avatarSmall} />
                      ) : (
                        <View style={[styles.avatarSmall, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>{(item.users?.name || 'U')[0]}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[{ color: theme.text, fontWeight: '700' }]}>{item.users?.name || 'User'}</Text>
                      {item.content ? <Text style={{ color: theme.textSecondary, marginTop: 4 }}>{item.content}</Text> : null}
                      {item.image_url ? <Image source={{ uri: item.image_url }} style={{ width: 140, height: 110, marginTop: 8, borderRadius: 8 }} /> : null}
                    </View>
                  </View>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 20 }}>No comments yet</Text>}
            />
          </View>

          <View style={[styles.commentBox, { backgroundColor: theme.cardBackground }]}>
            <TouchableOpacity onPress={handlePickCommentImage} style={{ marginRight: 8 }}>
              <Ionicons name="image" size={24} color={theme.accent} />
            </TouchableOpacity>
            <TextInput
              placeholder="Write a comment..."
              placeholderTextColor={theme.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              style={[styles.commentInput, { color: theme.text }]}
            />
            <TouchableOpacity onPress={submitComment} style={{ marginLeft: 8 }}>
              {commenting ? <ActivityIndicator /> : <Ionicons name="send" size={22} color={theme.accent} />}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* REACTION PICKER */}
      <Modal visible={reactionPickerVisible} transparent animationType="fade" onRequestClose={() => setReactionPickerVisible(false)}>
        <TouchableOpacity style={styles.reactionOverlay} activeOpacity={1} onPress={() => setReactionPickerVisible(false)}>
          <View style={[styles.reactionRow, { backgroundColor: theme.cardBackground }]}>
            {REACTIONS.map((r) => (
              <TouchableOpacity key={r.key} style={styles.reactionBtn} onPress={() => handleReact(r.key)}>
                <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// themes
const darkTheme = {
  background: '#0f1724',
  cardBackground: '#111827',
  text: '#e6eef6',
  textSecondary: '#9aa6b2',
  accent: '#f39c12',
};

const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#fff',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  accent: '#f39c12',
};

// styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  createBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f39c12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  postAuthor: { fontSize: 16, fontWeight: '700' },
  postTime: { fontSize: 12 },
  postText: { fontSize: 15, lineHeight: 20 },
  postImage: { width: width * 0.7, height: 180, borderRadius: 12, marginRight: 8 },
  postFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  smallText: { fontSize: 12 },
  modalContainer: { flex: 1 },
  modalHeader: { height: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  postNow: { fontSize: 16, fontWeight: '700' },
  createInput: { minHeight: 120, borderRadius: 12, padding: 12 },
  createText: { fontSize: 16 },
  mediaBtn: { flexDirection: 'row', alignItems: 'center' },
  anonToggle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 2,
  },
  postPreview: { padding: 12, borderRadius: 12, marginBottom: 12 },
  commentItem: { padding: 10, borderRadius: 10, marginBottom: 10 },
  commentBox: { padding: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: '#eee' },
  commentInput: { flex: 1, minHeight: 40, maxHeight: 120, padding: 8 },
  reactionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  reactionRow: { flexDirection: 'row', padding: 12, justifyContent: 'space-around', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  reactionBtn: { paddingHorizontal: 6 },
});
