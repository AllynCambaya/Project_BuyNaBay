import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
];

const SORT_OPTIONS = [
  { key: 'latest', label: 'Latest Posts', icon: 'time-outline' },
  { key: 'trending', label: 'Trending', icon: 'trending-up-outline' },
  { key: 'most_commented', label: 'Most Discussed', icon: 'chatbubbles-outline' },
];

// Helper functions for comment tree structure
const buildCommentTree = (commentsList) => {
  const map = {};
  const roots = [];

  commentsList.forEach((comment) => {
    map[comment.id] = { ...comment, replies: [] };
  });

  commentsList.forEach((comment) => {
    if (comment.reply_to && map[comment.reply_to]) {
      map[comment.reply_to].replies.push(map[comment.id]);
    } else {
      roots.push(map[comment.id]);
    }
  });

  const sortByDate = (a, b) => new Date(a.created_at) - new Date(b.created_at);
  roots.sort(sortByDate);
  Object.values(map).forEach(comment => comment.replies.sort(sortByDate));

  return roots;
};

const insertReplyIntoTree = (tree, newReply) => {
  return tree.map(comment => {
    if (comment.id === newReply.reply_to) {
      if (comment.replies.find(r => r.id === newReply.id || r._tempId === newReply._tempId)) {
        return comment;
      }
      return { 
        ...comment, 
        replies: [...comment.replies, newReply].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) 
      };
    } else if (comment.replies && comment.replies.length > 0) {
      return { ...comment, replies: insertReplyIntoTree(comment.replies, newReply) };
    }
    return comment;
  });
};

const flattenReplies = (replyTree) => {
  const flattened = [];
  const traverse = (nodes, depth) => {
    if (!nodes || nodes.length === 0) return;
    for (const node of nodes) {
      flattened.push({ ...node, _depth: depth });
      traverse(node.replies, depth + 1);
    }
  };
  traverse(replyTree, 1);
  return flattened;
};

// Format relative time
const getRelativeTime = (dateString) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function CommunityScreen({ navigation }) {
  const user = auth.currentUser;
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create post modal
  const [createVisible, setCreateVisible] = useState(false);
  const [postText, setPostText] = useState('');
  const [postImages, setPostImages] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  // Comments modal
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [commenting, setCommenting] = useState(false);

  // Reply UI state
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyTextMap, setReplyTextMap] = useState({});
  const [replyingMap, setReplyingMap] = useState({});

  // Reaction picker
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPostTarget, setReactionPostTarget] = useState(null);

  // Image viewer
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImageUri, setViewingImageUri] = useState(null);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // Filter and sort
  const [sortBy, setSortBy] = useState('latest');
  const [sortPickerVisible, setSortPickerVisible] = useState(false);

  // UI/theme
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Realtime channels
  const postsChannelRef = useRef(null);
  const commentsChannelRef = useRef(null);
  const reactionsChannelRef = useRef(null);
  const dirtyTimerRef = useRef(null);

  // Initialize animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    fetchPosts();

    // Realtime subscription for posts
    postsChannelRef.current = supabase
      .channel('public:community_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_posts' },
        async (payload) => {
          const newPost = payload.new;
          let userData = null;
          if (newPost.user_id && !newPost.is_anonymous) {
            try {
              const { data, error } = await supabase
                .from('users')
                .select('id, name, profile_photo')
                .eq('id', newPost.user_id)
                .single();
              if (error) throw error;
              userData = data;
            } catch (err) {
              console.error("RT Post: Couldn't fetch user", err);
            }
          }

          const { data: reactionsData } = await supabase
            .from('community_reactions')
            .select('post_id, reaction_type')
            .eq('post_id', newPost.id);
          const { data: commentsData } = await supabase
            .from('community_comments')
            .select('post_id, id')
            .eq('post_id', newPost.id);

          const reaction_counts = (reactionsData || []).reduce((acc, r) => {
            const existing = acc.find(item => item.reaction_type === r.reaction_type);
            if (existing) existing.count++;
            else acc.push({ reaction_type: r.reaction_type, count: 1 });
            return acc;
          }, []);

          const comments_count = (commentsData || []).length;

          let my_reaction = null;
          if (user?.uid) {
            const { data: userReactionData } = await supabase
              .from('community_reactions')
              .select('reaction_type')
              .eq('post_id', newPost.id)
              .eq('user_id', user.uid)
              .single();
            my_reaction = userReactionData?.reaction_type || null;
          }

          const postWithUserAndMeta = {
            ...newPost,
            users: userData,
            reaction_counts,
            comments_count,
            my_reaction,
          };

          setPosts((currentPosts) => {
            const existingIndex = currentPosts.findIndex(
              p => p.id === postWithUserAndMeta.id || p._tempId === postWithUserAndMeta._tempId
            );
            if (existingIndex > -1) {
              const updatedPosts = [...currentPosts];
              updatedPosts[existingIndex] = postWithUserAndMeta;
              return updatedPosts;
            }
            return [postWithUserAndMeta, ...currentPosts];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_posts' },
        (payload) => {
          setPosts((p) => p.map((x) => (x.id === payload.new.id ? { ...x, ...payload.new } : x)));
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

    reactionsChannelRef.current = supabase
      .channel('public:community_reactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_reactions' }, (payload) => {
        const postId = payload.new?.post_id || payload.old?.post_id;
        if (postId) scheduleMarkDirty(postId);
      })
      .subscribe();

    return () => {
      if (postsChannelRef.current) supabase.removeChannel(postsChannelRef.current);
      if (reactionsChannelRef.current) supabase.removeChannel(reactionsChannelRef.current);
      if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activePost) {
      if (commentsChannelRef.current) {
        supabase.removeChannel(commentsChannelRef.current);
        commentsChannelRef.current = null;
      }
      return;
    }

    commentsChannelRef.current = supabase
      .channel(`public:community_comments:post_id=eq.${activePost.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_comments',
          filter: `post_id=eq.${activePost.id}`,
        },
        async (payload) => {
          const newComment = payload.new;
          setPosts((p) =>
            p.map((x) =>
              x.id === newComment.post_id
                ? { ...x, comments_count: (x.comments_count || 0) + 1 }
                : x
            )
          );

          let userData = null;
          if (newComment.user_id) {
            try {
              const { data, error } = await supabase
                .from('users')
                .select('id, name, profile_photo')
                .eq('id', newComment.user_id)
                .single();
              if (error) throw error;
              userData = data;
            } catch (err) {
              console.error('RT Comment: could not fetch user', err);
              userData = { id: newComment.user_id, name: 'User' };
            }
          }
          const commentWithUser = { ...newComment, users: userData, replies: [] };

          setComments((currentCommentTree) => {
            const commentExists = (nodes, idToCheck) => {
              for (const node of nodes) {
                if (node.id === idToCheck || node._tempId === idToCheck) return true;
                if (node.replies && commentExists(node.replies, idToCheck)) return true;
              }
              return false;
            };

            if (commentExists(currentCommentTree, commentWithUser.id)) {
              return currentCommentTree;
            } else if (!commentWithUser.reply_to) {
              return [...currentCommentTree, commentWithUser].sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
              );
            } else {
              return insertReplyIntoTree(currentCommentTree, commentWithUser);
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'community_comments',
          filter: `post_id=eq.${activePost.id}`,
        },
        (payload) => {
          const deletedComment = payload.old;
          if (!deletedComment) return;

          setPosts((p) =>
            p.map((x) =>
              x.id === deletedComment.post_id
                ? { ...x, comments_count: Math.max(0, (x.comments_count || 1) - 1) }
                : x
            )
          );

          const removeCommentFromTree = (nodes, idToRemove) => {
            if (!nodes) return [];
            return nodes
              .filter(node => node.id !== idToRemove)
              .map(node => ({
                ...node,
                replies: removeCommentFromTree(node.replies, idToRemove),
              }));
          };
          setComments(currentTree => removeCommentFromTree(currentTree, deletedComment.id));
        }
      )
      .subscribe();

    return () => {
      if (commentsChannelRef.current) {
        supabase.removeChannel(commentsChannelRef.current);
        commentsChannelRef.current = null;
      }
    };
  }, [activePost]);

  const scheduleMarkDirty = (postId) => {
    if (!postId) return;
    setPosts((p) =>
      p.map((px) => (px.id === postId && !px._pending ? { ...px, _dirty: true } : px))
    );
    if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    dirtyTimerRef.current = setTimeout(() => {
      fetchPosts();
      dirtyTimerRef.current = null;
    }, 700);
  };

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('community_posts')
        .select('*, users:user_id (id, email, name, profile_photo)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const postIds = (postsData || []).map((p) => p.id).filter(Boolean);
      if (postIds.length === 0) {
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      const [reactionsRes, userReactionsRes, commentsCountRes] = await Promise.all([
        supabase.from('community_reactions').select('post_id, reaction_type').in('post_id', postIds),
        user?.uid
          ? supabase
              .from('community_reactions')
              .select('post_id, reaction_type')
              .in('post_id', postIds)
              .eq('user_id', user.uid)
          : Promise.resolve({ data: [] }),
        supabase.from('community_comments').select('post_id, id').in('post_id', postIds),
      ]);

      const reactionsAll = reactionsRes.data || [];
      const userReactions = userReactionsRes.data || [];
      const commentsAll = commentsCountRes.data || [];

      const reactionMap = reactionsAll.reduce((acc, r) => {
        if (!r?.post_id || !r.reaction_type) return acc;
        acc[r.post_id] = acc[r.post_id] || {};
        acc[r.post_id][r.reaction_type] = (acc[r.post_id][r.reaction_type] || 0) + 1;
        return acc;
      }, {});

      const commentCountMap = commentsAll.reduce((acc, c) => {
        if (!c?.post_id) return acc;
        acc[c.post_id] = (acc[c.post_id] || 0) + 1;
        return acc;
      }, {});

      const userReactionMap = userReactions.reduce((acc, r) => {
        acc[r.post_id] = r.reaction_type;
        return acc;
      }, {});

      const postsWithMeta = postsData.map((p) => {
        const countsObj = reactionMap[p.id] || {};
        const reaction_counts = Object.entries(countsObj).map(([type, count]) => ({
          reaction_type: type,
          count,
        }));
        const comments_count = commentCountMap[p.id] || 0;
        const my_reaction = userReactionMap[p.id] || null;

        return { ...p, reaction_counts, my_reaction, comments_count };
      });

      setPosts(postsWithMeta);
    } catch (err) {
      console.error('Fetch posts error', err);
      Alert.alert('Error', 'Could not fetch posts.');
    } finally {
      setLoadingPosts(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const pickImages = async (forComment = false, single = false) => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: !single,
      });
      if (res.canceled) return;
      const uris = res.assets.map((a) => a.uri);
      if (forComment) setCommentImage(uris[0]);
      else setPostImages((prev) => [...(prev || []), ...uris]);
    } catch (err) {
      console.error('Image pick err', err);
      Alert.alert('Error', 'Could not pick image.');
    }
  };

  const uploadFileAsync = async (localUri, folder = 'posts') => {
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const fileExt = localUri.split('.').pop()?.split('?')[0] || 'jpg';
      const filename = `${folder}/${user.uid}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('community-uploads').upload(filename, blob, {
        upsert: false,
      });
      if (error && error.message.includes('duplicate')) {
        const { error: retryError } = await supabase.storage
          .from('community-uploads')
          .upload(filename, blob, { upsert: true });
        if (retryError) throw retryError;
      } else if (error) {
        throw error;
      }
      const { data } = supabase.storage.from('community-uploads').getPublicUrl(filename);
      return data.publicUrl;
    } catch (err) {
      console.error('Upload error', err);
      throw err;
    }
  };

  const submitPost = async () => {
    if (!postText.trim() && postImages.length === 0) {
      Alert.alert('Empty Post', 'Please add some content or an image to your post.');
      return;
    }
    setPosting(true);
    const tempId = `temp_${Date.now()}`;
    const currentUserData = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'You',
      profile_photo: user.photoURL,
    };
    const tempPost = {
      id: tempId,
      _tempId: tempId,
      _pending: true,
      user_id: user.uid,
      content: postText.trim() || null,
      image_urls: postImages,
      is_anonymous: !!isAnonymous,
      created_at: new Date().toISOString(),
      users: isAnonymous ? null : currentUserData,
      reaction_counts: [],
      my_reaction: null,
      comments_count: 0,
    };
    setPosts(currentPosts => [tempPost, ...currentPosts]);
    const originalPostImages = [...postImages];
    setPostText('');
    setPostImages([]);
    setIsAnonymous(false);
    setCreateVisible(false);

    try {
      const uploadedUrls = [];
      for (const uri of originalPostImages) {
        uploadedUrls.push(await uploadFileAsync(uri, 'posts'));
      }
      const payload = {
        user_id: user.uid,
        content: tempPost.content,
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        is_anonymous: tempPost.is_anonymous,
      };
      const { data: confirmedPost, error } = await supabase
        .from('community_posts')
        .insert(payload)
        .select('*, users:user_id (id, email, name, profile_photo)')
        .single();
      if (error) throw error;

      setPosts(currentPosts =>
        currentPosts.map(p =>
          p._tempId === tempId ? { ...confirmedPost, users: confirmedPost.users || currentUserData } : p
        )
      );
    } catch (err) {
      console.error('Post submission error:', err);
      Alert.alert('Post Error', err.message || 'Unable to create post.');
      setPosts(currentPosts => currentPosts.filter(p => p._tempId !== tempId));
    } finally {
      setPosting(false);
    }
  };

  const openComments = async (post) => {
    setActivePost(post);
    setCommentsVisible(true);
    setReplyingTo(null);
    setReplyTextMap({});
    setReplyingMap({});
    setComments([]);
    await fetchComments(post.id);
  };

  const fetchComments = async (postId) => {
    try {
      const { data: allCommentsData, error } = await supabase
        .from('community_comments')
        .select('*, users:user_id (id, name, profile_photo)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const commentTree = buildCommentTree(allCommentsData || []);
      setComments(commentTree);
    } catch (err) {
      console.error('Comments fetch error:', err);
      Alert.alert('Error', 'Could not fetch comments.');
      setComments([]);
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    const image = commentImage;
    if (!text && !image) {
      Alert.alert('Empty Comment', 'Please add some text or an image.');
      return;
    }
    if (!activePost) return;

    setCommenting(true);
    const tempId = `temp_${Date.now()}`;
    const currentUserData = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'You',
      profile_photo: user.photoURL,
    };
    const tempComment = {
      id: tempId,
      _tempId: tempId,
      _pending: true,
      post_id: activePost.id,
      user_id: user.uid,
      content: text || null,
      image_url: image || null,
      reply_to: null,
      created_at: new Date().toISOString(),
      users: currentUserData,
      replies: [],
    };
    setComments(currentTree => [...currentTree, tempComment]);
    setCommentText('');
    setCommentImage(null);

    try {
      let uploadedImageUrl = null;
      if (image) {
        uploadedImageUrl = await uploadFileAsync(image, 'comments');
      }
      const payload = {
        post_id: activePost.id,
        user_id: user.uid,
        content: text || null,
        image_url: uploadedImageUrl,
        reply_to: null,
      };
      const { data: confirmedComment, error } = await supabase
        .from('community_comments')
        .insert(payload)
        .select('*, users:user_id(id, name, profile_photo)')
        .single();
      if (error) throw error;

      setComments(currentTree =>
        currentTree
          .map(c =>
            c._tempId === tempId ? { ...confirmedComment, users: confirmedComment.users || currentUserData, replies: c.replies || [] } : c
          )
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      );
    } catch (err) {
      console.error('Comment submission error:', err);
      Alert.alert('Comment Error', err.message || 'Unable to post comment.');
      setComments(currentTree => currentTree.filter(c => c._tempId !== tempId));
    } finally {
      setCommenting(false);
    }
  };

  const submitReply = async (parentCommentId) => {
    const text = (replyTextMap[parentCommentId] || '').trim();
    if (!text) {
      Alert.alert('Empty Reply', 'Please add some text to your reply.');
      return;
    }
    if (!activePost) return;

    setReplyingMap((m) => ({ ...m, [parentCommentId]: true }));
    const tempId = `temp_${Date.now()}`;
    const currentUserData = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'You',
      profile_photo: user.photoURL,
    };
    const tempReply = {
      id: tempId,
      _tempId: tempId,
      _pending: true,
      post_id: activePost.id,
      user_id: user.uid,
      content: text,
      image_url: null,
      reply_to: parentCommentId,
      created_at: new Date().toISOString(),
      users: currentUserData,
      replies: [],
    };
    setComments(currentTree => insertReplyIntoTree(currentTree, tempReply));
    setReplyTextMap((m) => ({ ...m, [parentCommentId]: '' }));
    setReplyingTo(null);

    try {
      const payload = {
        post_id: activePost.id,
        user_id: user.uid,
        content: text,
        image_url: null,
        reply_to: parentCommentId,
      };
      const { data: confirmedReply, error } = await supabase
        .from('community_comments')
        .insert(payload)
        .select('*, users:user_id(id, name, profile_photo)')
        .single();
      if (error) throw error;

      const replaceTempReply = (nodes) =>
        nodes.map(node => {
          if (node._tempId === tempId) {
            return { ...confirmedReply, users: confirmedReply.users || currentUserData, replies: node.replies || [] };
          }
          if (node.replies) {
            return { ...node, replies: replaceTempReply(node.replies) };
          }
          return node;
        });
      setComments(currentTree => replaceTempReply(currentTree));
    } catch (err) {
      console.error('Reply submission error:', err);
      Alert.alert('Reply Error', err.message || 'Unable to post reply.');
      const removeTempReply = (nodes) =>
        nodes
          .filter(node => node._tempId !== tempId)
          .map(node => {
            if (node.replies) {
              return { ...node, replies: removeTempReply(node.replies) };
            }
            return node;
          });
      setComments(currentTree => removeTempReply(currentTree));
    } finally {
      setReplyingMap((m) => ({ ...m, [parentCommentId]: false }));
    }
  };

  const handleDeleteComment = (comment) => {
    if (comment.user_id !== user?.uid || comment._pending) {
      return;
    }

    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const commentId = comment.id;

          const removeCommentFromTree = (nodes, idToRemove) => {
            if (!nodes) return [];
            return nodes
              .filter(node => node.id !== idToRemove)
              .map(node => ({
                ...node,
                replies: removeCommentFromTree(node.replies, idToRemove),
              }));
          };
          setComments(currentTree => removeCommentFromTree(currentTree, commentId));

          try {
            const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
            if (error) throw error;

            const { data: countData } = await supabase
              .from('community_comments')
              .select('id', { count: 'exact', head: true })
              .eq('post_id', activePost.id);

            setPosts(p =>
              p.map(post =>
                post.id === activePost.id ? { ...post, comments_count: countData?.count || 0 } : post
              )
            );
          } catch (err) {
            console.error('Delete comment error', err);
            Alert.alert('Error', 'Could not delete comment.');
            if (activePost) fetchComments(activePost.id);
          }
        },
      },
    ]);
  };

  const handleStartReply = (comment) => {
    const currentId = comment.id || comment._tempId;
    const displayName = comment.users?.name || 'User';
    const mention = `@${displayName} `;

    setReplyTextMap((m) => ({ ...m, [currentId]: mention }));
    setReplyingTo(currentId);
  };

  const toggleReaction = async (postId, reactionType) => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please log in to react to posts.');
      return;
    }

    let oldReaction = null;
    setPosts(currentPosts =>
      currentPosts.map(p => {
        if (p.id === postId) {
          oldReaction = p.my_reaction;
          const newCounts = [...(p.reaction_counts || [])];

          if (oldReaction) {
            const idx = newCounts.findIndex(rc => rc.reaction_type === oldReaction);
            if (idx > -1) {
              newCounts[idx] = { ...newCounts[idx], count: Math.max(0, newCounts[idx].count - 1) };
              if (newCounts[idx].count === 0) newCounts.splice(idx, 1);
            }
          }

          if (oldReaction !== reactionType) {
            const idx = newCounts.findIndex(rc => rc.reaction_type === reactionType);
            if (idx > -1) newCounts[idx] = { ...newCounts[idx], count: newCounts[idx].count + 1 };
            else newCounts.push({ reaction_type: reactionType, count: 1 });
          }

          return {
            ...p,
            my_reaction: oldReaction === reactionType ? null : reactionType,
            reaction_counts: newCounts,
          };
        }
        return p;
      })
    );

    try {
      const { data: existing } = await supabase
        .from('community_reactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.uid)
        .single();

      if (existing && existing.reaction_type === reactionType) {
        await supabase.from('community_reactions').delete().eq('id', existing.id);
      } else if (existing) {
        await supabase
          .from('community_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existing.id);
      } else {
        await supabase.from('community_reactions').insert({
          post_id: postId,
          user_id: user.uid,
          reaction_type: reactionType,
        });
      }
      scheduleMarkDirty(postId);
    } catch (err) {
      console.error('Reaction error', err);
      Alert.alert('Reaction Error', 'Unable to update reaction.');
      setPosts(currentPosts =>
        currentPosts.map(p =>
          p.id === postId ? { ...p, my_reaction: oldReaction } : p
        )
      );
      fetchPosts();
    }
  };

  const renderReactionSummary = (post) => {
    if (!post || post._pending) return null;
    const validCounts = (post.reaction_counts || []).filter(rc => rc && rc.count > 0);
    if (validCounts.length === 0) return null;

    const totalReactions = validCounts.reduce((sum, rc) => sum + rc.count, 0);

    return (
      <View style={styles.reactionSummaryContainer}>
        <View style={styles.reactionEmojiRow}>
          {validCounts.slice(0, 3).map((rc, index) => {
            const emoji = REACTIONS.find((r) => r.key === rc.reaction_type)?.emoji || '👍';
            return (
              <View 
                key={rc.reaction_type} 
                style={[
                  styles.reactionEmojiCircle,
                  { zIndex: 3 - index, marginLeft: index > 0 ? -8 : 0 }
                ]}
              >
                <Text style={styles.reactionEmojiText}>{emoji}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.reactionCountText, { color: theme.textSecondary }]}>
          {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
        </Text>
      </View>
    );
  };

  const renderPost = ({ item, index }) => {
    const author = item.is_anonymous ? null : item.users;
    const displayName = item.is_anonymous ? 'Anonymous' : (author?.name || author?.email?.split('@')[0] || 'User');
    const avatar = item.is_anonymous ? null : author?.profile_photo;
    const isPending = item._pending;

    return (
      <Animated.View
        style={[
          styles.postCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={[styles.postCardInner, { backgroundColor: theme.cardBackground }]}>
          {/* Post Header */}
          <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
              <View style={styles.avatarContainer}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.accentLight }]}>
                    <Ionicons name={item.is_anonymous ? "eye-off" : "person"} size={20} color="#fff" />
                  </View>
                )}
              </View>
              <View style={styles.postAuthorInfo}>
                <Text style={[styles.postAuthorName, { color: theme.text }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.postTime, { color: theme.textSecondary }]}>
                  {isPending ? 'Posting...' : getRelativeTime(item.created_at)}
                </Text>
              </View>
            </View>
            {!isPending && item.user_id === user?.uid && (
              <TouchableOpacity 
                onPress={() => handlePostOptions(item)} 
                style={styles.postOptionsBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Post Content */}
          {item.content && (
            <Text style={[styles.postContent, { color: theme.text }]}>{item.content}</Text>
          )}

          {/* Post Images */}
          {item.image_urls && item.image_urls.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.postImagesScroll}
              contentContainerStyle={styles.postImagesContent}
              decelerationRate="fast"
              snapToInterval={width - 48}
            >
              {item.image_urls.map((uri, idx) =>
                isPending ? (
                  <View key={idx} style={styles.postImageWrapper}>
                    <Image source={{ uri }} style={styles.postImage} />
                    <View style={styles.imageOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => openImageViewer(uri, idx)}
                    activeOpacity={0.9}
                    style={styles.postImageWrapper}
                  >
                    <Image source={{ uri }} style={styles.postImage} />
                    {item.image_urls.length > 1 && (
                      <View style={styles.imageCounter}>
                        <Text style={styles.imageCounterText}>
                          {idx + 1}/{item.image_urls.length}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          )}

          {!isPending && (
            <>
              {/* Reactions & Comments Count */}
              <View style={styles.engagementBar}>
                {renderReactionSummary(item)}
                {item.comments_count > 0 && (
                  <TouchableOpacity onPress={() => openComments(item)}>
                    <Text style={[styles.commentsCountText, { color: theme.textSecondary }]}>
                      {item.comments_count} {item.comments_count === 1 ? 'comment' : 'comments'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Buttons */}
              <View style={[styles.postActions, { borderTopColor: theme.divider }]}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openReactionPicker(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionBtnContent}>
                    <Text style={styles.actionEmoji}>
                      {item.my_reaction ? REACTIONS.find(r => r.key === item.my_reaction)?.emoji || '👍' : '👍'}
                    </Text>
                    <Text style={[
                      styles.actionBtnText, 
                      { color: item.my_reaction ? theme.accent : theme.textSecondary }
                    ]}>
                      {item.my_reaction ? REACTIONS.find(r => r.key === item.my_reaction)?.label : 'React'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openComments(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionBtnContent}>
                    <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>
                      Comment
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                  <View style={styles.actionBtnContent}>
                    <Ionicons name="arrow-redo-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>
                      Share
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  const handlePostOptions = (post) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setPosts(currentPosts => currentPosts.filter(p => p.id !== post.id));
            const { error } = await supabase.from('community_posts').delete().eq('id', post.id);
            if (error) throw error;
          } catch (err) {
            console.error('Delete post error', err);
            Alert.alert('Error', 'Could not delete post.');
            fetchPosts();
          }
        },
      },
    ]);
  };

  const openImageViewer = (uri, index = 0) => {
    setViewingImageUri(uri);
    setImageViewerIndex(index);
    setImageViewerVisible(true);
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

  const renderCommentItem = ({ item: comment }) => {
    const author = comment.users || {};
    const displayName = author?.name || 'User';
    const avatar = author?.profile_photo;
    const isPending = comment._pending;

    return (
      <View style={[styles.commentItem, { opacity: isPending ? 0.7 : 1 }]}>
        <View style={styles.commentLayout}>
          <View style={styles.commentAvatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatar, styles.avatarPlaceholder, { backgroundColor: theme.accentLight }]}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.commentMain}>
            <View style={[styles.commentBubble, { backgroundColor: theme.cardBackgroundAlt }]}>
              <Text style={[styles.commentAuthor, { color: theme.text }]}>{displayName}</Text>
              {comment.content && (
                <Text style={[styles.commentText, { color: theme.text }]}>
                  {comment.content}
                </Text>
              )}
              {comment.image_url && (
                <TouchableOpacity onPress={() => openImageViewer(comment.image_url)} activeOpacity={0.9}>
                  <Image source={{ uri: comment.image_url }} style={styles.commentImage} />
                </TouchableOpacity>
              )}
            </View>
            {!isPending && (
              <View style={styles.commentFooter}>
                <Text style={[styles.commentTime, { color: theme.textTertiary }]}>
                  {getRelativeTime(comment.created_at)}
                </Text>
                <TouchableOpacity onPress={() => handleStartReply(comment)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.commentAction, { color: theme.accent }]}>Reply</Text>
                </TouchableOpacity>
                {comment.user_id === user?.uid && (
                  <TouchableOpacity onPress={() => handleDeleteComment(comment)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[styles.commentAction, { color: theme.error }]}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {isPending && (
              <Text style={[styles.commentTime, { color: theme.textTertiary, marginTop: 4 }]}>
                Sending...
              </Text>
            )}

            {/* Reply Input */}
            {(replyingTo === comment.id || replyingTo === comment._tempId) && (
              <View style={styles.replyInputContainer}>
                <TextInput
                  placeholder={`Reply to ${displayName}...`}
                  placeholderTextColor={theme.textTertiary}
                  value={replyTextMap[comment.id || comment._tempId] || ''}
                  onChangeText={(t) =>
                    setReplyTextMap((m) => ({ ...m, [comment.id || comment._tempId]: t }))
                  }
                  style={[
                    styles.replyInput,
                    { 
                      color: theme.text, 
                      backgroundColor: theme.background,
                      borderColor: theme.borderColor 
                    },
                  ]}
                  multiline
                  autoFocus
                />
                <View style={styles.replyActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setReplyingTo(null);
                      setReplyTextMap((m) => ({ ...m, [comment.id || comment._tempId]: '' }));
                    }}
                    style={styles.replyActionBtn}
                  >
                    <Text style={[styles.replyActionText, { color: theme.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => submitReply(comment.id || comment._tempId)}
                    disabled={replyingMap[comment.id || comment._tempId]}
                    style={[styles.replyActionBtn, styles.replySendBtn, { backgroundColor: theme.accent }]}
                  >
                    {replyingMap[comment.id || comment._tempId] ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.replyActionText, { color: '#fff', fontWeight: '700' }]}>Reply</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Nested Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <View style={styles.repliesContainer}>
                {flattenReplies(comment.replies).map(reply => (
                  <RenderReply
                    key={reply.id || reply._tempId}
                    reply={reply}
                    theme={theme}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    replyTextMap={replyTextMap}
                    setReplyTextMap={setReplyTextMap}
                    submitReply={submitReply}
                    replyingMap={replyingMap}
                    handleDeleteComment={handleDeleteComment}
                    handleStartReply={handleStartReply}
                    openImageViewer={openImageViewer}
                    user={user}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const RenderReply = ({
    reply,
    theme,
    replyingTo,
    setReplyingTo,
    replyTextMap,
    setReplyTextMap,
    submitReply,
    replyingMap,
    handleDeleteComment,
    handleStartReply,
    openImageViewer,
    user,
  }) => {
    const author = reply.users || {};
    const displayName = author?.name || 'User';
    const avatar = author?.profile_photo;
    const isPending = reply._pending;
    const currentId = reply.id || reply._tempId;

    return (
      <View style={[styles.replyItem, { opacity: isPending ? 0.7 : 1 }]}>
        <View style={styles.commentLayout}>
          <View style={styles.commentAvatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatar, styles.avatarPlaceholder, { backgroundColor: theme.accentLight }]}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.commentMain}>
            <View style={[styles.commentBubble, { backgroundColor: theme.cardBackgroundAlt }]}>
              <Text style={[styles.commentAuthor, { color: theme.text }]}>{displayName}</Text>
              {reply.content && (
                <Text style={[styles.commentText, { color: theme.text }]}>
                  {reply.content}
                </Text>
              )}
            </View>
            {!isPending && (
              <View style={styles.commentFooter}>
                <Text style={[styles.commentTime, { color: theme.textTertiary }]}>
                  {getRelativeTime(reply.created_at)}
                </Text>
                <TouchableOpacity onPress={() => handleStartReply(reply)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.commentAction, { color: theme.accent }]}>Reply</Text>
                </TouchableOpacity>
                {reply.user_id === user?.uid && (
                  <TouchableOpacity onPress={() => handleDeleteComment(reply)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[styles.commentAction, { color: theme.error }]}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {isPending && (
              <Text style={[styles.commentTime, { color: theme.textTertiary, marginTop: 4 }]}>
                Sending...
              </Text>
            )}

            {replyingTo === currentId && (
              <View style={styles.replyInputContainer}>
                <TextInput
                  placeholder={`Reply to ${displayName}...`}
                  placeholderTextColor={theme.textTertiary}
                  value={replyTextMap[currentId] || ''}
                  onChangeText={(t) =>
                    setReplyTextMap((m) => ({ ...m, [currentId]: t }))
                  }
                  style={[
                    styles.replyInput,
                    { 
                      color: theme.text, 
                      backgroundColor: theme.background,
                      borderColor: theme.borderColor 
                    },
                  ]}
                  multiline
                  autoFocus
                />
                <View style={styles.replyActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setReplyingTo(null);
                      setReplyTextMap((m) => ({ ...m, [currentId]: '' }));
                    }}
                    style={styles.replyActionBtn}
                  >
                    <Text style={[styles.replyActionText, { color: theme.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => submitReply(currentId)}
                    disabled={replyingMap[currentId]}
                    style={[styles.replyActionBtn, styles.replySendBtn, { backgroundColor: theme.accent }]}
                  >
                    {replyingMap[currentId] ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.replyActionText, { color: '#fff', fontWeight: '700' }]}>Reply</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderColor }]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/images/OfficialBuyNaBay.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.headerTitle, { color: theme.text }]}>Community</Text>
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: theme.cardBackground }]}
          onPress={() => setSortPickerVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="options-outline" size={22} color={theme.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const styles = createStyles(theme);

  if (loadingPosts) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading community...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id || item._tempId}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          stickyHeaderIndices={[0]}
          style={styles.feedList}
          contentContainerStyle={styles.feedContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.cardBackgroundAlt }]}>
                <Ionicons name="chatbubbles-outline" size={48} color={theme.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Posts Yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Be the first to share something with the community
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.accent]}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.accent }]}
          onPress={() => setCreateVisible(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FDAD00', '#f39c12']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Create Post Modal */}
        <Modal 
          visible={createVisible} 
          animationType="slide" 
          onRequestClose={() => !posting && setCreateVisible(false)}
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.background, borderBottomColor: theme.divider }]}>
              <TouchableOpacity
                onPress={() => !posting && setCreateVisible(false)}
                disabled={posting}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create Post</Text>
              <TouchableOpacity
                onPress={submitPost}
                disabled={posting || (!postText.trim() && postImages.length === 0)}
                style={[
                  styles.postBtn,
                  { backgroundColor: theme.accent },
                  (posting || (!postText.trim() && postImages.length === 0)) && styles.postBtnDisabled
                ]}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.postBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.createPostContent} showsVerticalScrollIndicator={false}>
              <TextInput
                placeholder="What's on your mind?"
                placeholderTextColor={theme.textTertiary}
                multiline
                value={postText}
                onChangeText={setPostText}
                style={[
                  styles.createInput,
                  {
                    color: theme.text,
                  },
                ]}
                maxLength={5000}
              />

              {postImages.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.previewScroll}
                  contentContainerStyle={styles.previewContent}
                >
                  {postImages.map((uri, idx) => (
                    <View key={idx} style={styles.previewImageWrapper}>
                      <Image source={{ uri }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removePreviewBtn}
                        onPress={() => setPostImages(p => p.filter((_, i) => i !== idx))}
                        disabled={posting}
                      >
                        <Ionicons name="close-circle" size={28} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={[styles.createActions, { borderTopColor: theme.divider }]}>
                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={() => pickImages(false, false)}
                  disabled={posting}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={24} color={theme.accent} />
                  <Text style={[styles.mediaBtnText, { color: theme.text }]}>
                    Add Photos
                  </Text>
                </TouchableOpacity>

                <View style={styles.anonymousToggle}>
                  <Text style={[styles.anonymousLabel, { color: theme.text }]}>
                    Post anonymously
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsAnonymous(s => !s)}
                    style={[
                      styles.switchTrack,
                      { backgroundColor: isAnonymous ? theme.accent : theme.switchOff },
                    ]}
                    disabled={posting}
                    activeOpacity={0.8}
                  >
                    <View style={[
                      styles.switchThumb,
                      isAnonymous && styles.switchThumbActive
                    ]} />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Comments Modal */}
        <Modal
          visible={commentsVisible}
          animationType="slide"
          onRequestClose={() => setCommentsVisible(false)}
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.background, borderBottomColor: theme.divider }]}>
              <TouchableOpacity 
                onPress={() => setCommentsVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={28} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Comments</Text>
              <View style={{ width: 40 }} />
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item.id || item._tempId}
              renderItem={renderCommentItem}
              style={styles.commentsList}
              contentContainerStyle={styles.commentsContent}
              ListHeaderComponent={
                activePost ? (
                  <View style={[styles.postPreview, { backgroundColor: theme.cardBackgroundAlt }]}>
                    <View style={styles.postPreviewHeader}>
                      <View style={styles.postPreviewAvatar}>
                        {activePost.is_anonymous ? (
                          <View style={[styles.commentAvatar, styles.avatarPlaceholder, { backgroundColor: theme.accentLight }]}>
                            <Ionicons name="eye-off" size={16} color="#fff" />
                          </View>
                        ) : activePost.users?.profile_photo ? (
                          <Image source={{ uri: activePost.users.profile_photo }} style={styles.commentAvatar} />
                        ) : (
                          <View style={[styles.commentAvatar, styles.avatarPlaceholder, { backgroundColor: theme.accentLight }]}>
                            <Ionicons name="person" size={16} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View>
                        <Text style={[styles.postPreviewAuthor, { color: theme.text }]}>
                          {activePost.is_anonymous ? 'Anonymous' : (activePost.users?.name || 'User')}
                        </Text>
                        <Text style={[styles.postPreviewTime, { color: theme.textSecondary }]}>
                          {getRelativeTime(activePost.created_at)}
                        </Text>
                      </View>
                    </View>
                    {activePost.content && (
                      <Text style={[styles.postPreviewContent, { color: theme.text }]} numberOfLines={3}>
                        {activePost.content}
                      </Text>
                    )}
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubble-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyCommentsText, { color: theme.textSecondary }]}>
                    No comments yet. Be the first to comment!
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />

            {/* Comment Input Box */}
            <View style={[styles.commentInputContainer, { backgroundColor: theme.cardBackground, borderTopColor: theme.divider }]}>
              <View style={styles.commentInputRow}>
                {commentImage && (
                  <View style={styles.commentImagePreview}>
                    <Image source={{ uri: commentImage }} style={styles.commentImagePreviewImg} />
                    <TouchableOpacity
                      style={styles.removeCommentImage}
                      onPress={() => setCommentImage(null)}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => pickImages(true, true)}
                  style={styles.commentImageBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={24} color={theme.accent} />
                </TouchableOpacity>
                <TextInput
                  placeholder="Write a comment..."
                  placeholderTextColor={theme.textTertiary}
                  value={commentText}
                  onChangeText={setCommentText}
                  style={[styles.commentInput, { color: theme.text, backgroundColor: theme.cardBackgroundAlt }]}
                  multiline
                  maxLength={2000}
                />
                <TouchableOpacity
                  onPress={submitComment}
                  style={[styles.commentSendBtn, { backgroundColor: theme.accent }]}
                  disabled={commenting || (!commentText.trim() && !commentImage)}
                  activeOpacity={0.8}
                >
                  {commenting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Reaction Picker Modal */}
        <Modal visible={reactionPickerVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.reactionOverlay}
            activeOpacity={1}
            onPress={() => setReactionPickerVisible(false)}
          >
            <View style={[styles.reactionPicker, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.reactionPickerTitle, { color: theme.text }]}>React to this post</Text>
              <View style={styles.reactionsGrid}>
                {REACTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={styles.reactionOption}
                    onPress={() => handleReact(r.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionOptionEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactionOptionLabel, { color: theme.textSecondary }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Sort Picker Modal */}
        <Modal visible={sortPickerVisible} transparent animationType="slide">
          <TouchableOpacity
            style={styles.sortOverlay}
            activeOpacity={1}
            onPress={() => setSortPickerVisible(false)}
          >
            <View style={[styles.sortPicker, { backgroundColor: theme.cardBackground }]}>
              <View style={styles.sortPickerHandle} />
              <Text style={[styles.sortPickerTitle, { color: theme.text }]}>Sort Posts</Text>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.sortOption, { borderBottomColor: theme.divider }]}
                  onPress={() => {
                    setSortBy(option.key);
                    setSortPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.sortOptionLeft}>
                    <Ionicons 
                      name={option.icon} 
                      size={22} 
                      color={sortBy === option.key ? theme.accent : theme.textSecondary} 
                    />
                    <Text style={[
                      styles.sortOptionText,
                      { color: sortBy === option.key ? theme.accent : theme.text }
                    ]}>
                      {option.label}
                    </Text>
                  </View>
                  {sortBy === option.key && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Image Viewer Modal */}
        <Modal
          visible={imageViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageViewerVisible(false)}
        >
          <View style={styles.imageViewerContainer}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => setImageViewerVisible(false)}
              activeOpacity={0.9}
            >
              <View style={styles.imageViewerCloseBtn}>
                <Ionicons name="close" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
            <Image
              source={{ uri: viewingImageUri }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

// Theme Definitions
const darkTheme = {
  background: '#0f0f2e',
  cardBackground: '#1a1a3e',
  cardBackgroundAlt: '#242449',
  text: '#ffffff',
  textSecondary: '#a0a0c8',
  textTertiary: '#7878a8',
  accent: '#FDAD00',
  accentLight: '#FFB82E',
  success: '#4CAF50',
  error: '#FF6B6B',
  warning: '#FFA726',
  borderColor: '#2a2a4f',
  divider: '#2f2f5a',
  shadowColor: '#000000',
  switchOff: '#404070',
  overlay: 'rgba(0, 0, 0, 0.85)',
};

const lightTheme = {
  background: '#f8f9fa',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f0f2f5',
  text: '#1a1a2e',
  textSecondary: '#65676b',
  textTertiary: '#8a8d91',
  accent: '#f39c12',
  accentLight: '#f7b731',
  success: '#27ae60',
  error: '#e74c3c',
  warning: '#f39c12',
  borderColor: '#e4e6eb',
  divider: '#dadde1',
  shadowColor: '#000000',
  switchOff: '#ccd0d5',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

// Styles
const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      fontWeight: '600',
    },

    // Header
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerLogo: {
      width: 36,
      height: 36,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    filterBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },

    // Feed
    feedList: {
      flex: 1,
    },
    feedContent: {
      paddingBottom: 100,
    },

    // Post Card
    postCard: {
      marginTop: 12,
      paddingHorizontal: 16,
    },
    postCardInner: {
      borderRadius: 12,
      padding: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    postHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    postHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatarContainer: {
      marginRight: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    postAuthorInfo: {
      flex: 1,
    },
    postAuthorName: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 2,
    },
    postTime: {
      fontSize: 13,
      fontWeight: '500',
    },
    postOptionsBtn: {
      padding: 8,
      marginRight: -8,
    },
    postContent: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 12,
    },
    postImagesScroll: {
      marginHorizontal: -16,
      marginBottom: 12,
    },
    postImagesContent: {
      paddingHorizontal: 16,
    },
    postImageWrapper: {
      marginRight: 8,
      position: 'relative',
    },
    postImage: {
      width: width - 64,
      height: 240,
      borderRadius: 12,
      backgroundColor: theme.cardBackgroundAlt,
    },
    imageOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageCounter: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    imageCounterText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },

    // Engagement Bar
    engagementBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      minHeight: 32,
    },
    reactionSummaryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    reactionEmojiRow: {
      flexDirection: 'row',
    },
    reactionEmojiCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.cardBackground,
    },
    reactionEmojiText: {
      fontSize: 12,
    },
    reactionCountText: {
      fontSize: 13,
      fontWeight: '600',
    },
    commentsCountText: {
      fontSize: 13,
      fontWeight: '600',
    },

    // Post Actions
    postActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      paddingTop: 8,
      marginTop: 8,
      gap: 4,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    actionBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionEmoji: {
      fontSize: 18,
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // FAB
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    fabGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Modal
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    postBtn: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
      minWidth: 70,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postBtnDisabled: {
      opacity: 0.5,
    },
    postBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },

    // Create Post
    createPostContent: {
      flex: 1,
      padding: 16,
    },
    createInput: {
      fontSize: 16,
      lineHeight: 24,
      minHeight: 150,
      textAlignVertical: 'top',
      marginBottom: 16,
    },
    previewScroll: {
      marginBottom: 16,
    },
    previewContent: {
      gap: 12,
    },
    previewImageWrapper: {
      position: 'relative',
    },
    previewImage: {
      width: 100,
      height: 100,
      borderRadius: 12,
      backgroundColor: theme.cardBackgroundAlt,
    },
    removePreviewBtn: {
      position: 'absolute',
      top: -10,
      right: -10,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 14,
    },
    createActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 16,
      borderTopWidth: 1,
    },
    mediaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    mediaBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
    anonymousToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    anonymousLabel: {
      fontSize: 15,
      fontWeight: '500',
    },
    switchTrack: {
      width: 51,
      height: 31,
      borderRadius: 16,
      padding: 2,
      justifyContent: 'center',
    },
    switchThumb: {
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: '#fff',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    switchThumbActive: {
      transform: [{ translateX: 20 }],
    },

    // Comments
    commentsList: {
      flex: 1,
    },
    commentsContent: {
      padding: 16,
      paddingBottom: 100,
    },
    postPreview: {
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    postPreviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    postPreviewAvatar: {
      width: 36,
      height: 36,
    },
    postPreviewAuthor: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 2,
    },
    postPreviewTime: {
      fontSize: 12,
      fontWeight: '500',
    },
    postPreviewContent: {
      fontSize: 14,
      lineHeight: 20,
    },
    commentItem: {
      marginBottom: 16,
    },
    commentLayout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    commentAvatarContainer: {
      marginRight: 10,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    commentMain: {
      flex: 1,
    },
    commentBubble: {
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxWidth: '100%',
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
    },
    commentImage: {
      width: '100%',
      maxWidth: 200,
      height: 150,
      borderRadius: 12,
      marginTop: 8,
      backgroundColor: theme.cardBackground,
    },
    commentFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 6,
      paddingLeft: 14,
    },
    commentTime: {
      fontSize: 12,
      fontWeight: '600',
    },
    commentAction: {
      fontSize: 13,
      fontWeight: '700',
    },
    replyInputContainer: {
      marginTop: 12,
    },
    replyInput: {
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      borderWidth: 1,
      minHeight: 40,
      maxHeight: 100,
    },
    replyActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 8,
    },
    replyActionBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 18,
    },
    replySendBtn: {
      minWidth: 70,
      alignItems: 'center',
    },
    replyActionText: {
      fontSize: 14,
      fontWeight: '700',
    },
    repliesContainer: {
      marginTop: 12,
      marginLeft: 8,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: theme.divider,
    },
    replyItem: {
      marginBottom: 12,
    },

    // Comment Input
    commentInputContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
    },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    commentImagePreview: {
      position: 'relative',
      marginBottom: 4,
    },
    commentImagePreviewImg: {
      width: 40,
      height: 40,
      borderRadius: 8,
    },
    removeCommentImage: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 10,
    },
    commentImageBtn: {
      padding: 8,
    },
    commentInput: {
      flex: 1,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14,
      maxHeight: 100,
    },
    commentSendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Reaction Picker
    reactionOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    reactionPicker: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      padding: 24,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    reactionPickerTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 20,
      textAlign: 'center',
    },
    reactionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 16,
    },
    reactionOption: {
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      minWidth: 80,
    },
    reactionOptionEmoji: {
      fontSize: 36,
    },
    reactionOptionLabel: {
      fontSize: 13,
      fontWeight: '600',
    },

    // Sort Picker
    sortOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'flex-end',
    },
    sortPicker: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingBottom: 32,
      paddingHorizontal: 20,
    },
    sortPickerHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.divider,
      alignSelf: 'center',
      marginBottom: 20,
    },
    sortPickerTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 20,
    },
    sortOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
    },
    sortOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    sortOptionText: {
      fontSize: 16,
      fontWeight: '600',
    },

    // Image Viewer
    imageViewerContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerClose: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 20,
      right: 20,
      zIndex: 10,
    },
    imageViewerCloseBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerImage: {
      width: '100%',
      height: '80%',
    },

    // Empty States
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
      paddingHorizontal: 40,
    },
    emptyIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    emptyComments: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    emptyCommentsText: {
      marginTop: 16,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
  });