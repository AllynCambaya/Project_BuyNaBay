// screens/CommunityScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react'; // Added React import
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl, // --- NEW ---: Import RefreshControl
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    useWindowDimensions,
    View,
} from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width: initialWidth } = Dimensions.get('window');

const REACTIONS = [
    { key: 'like', emoji: '👍' },
    { key: 'love', emoji: '❤️' },
    { key: 'haha', emoji: '😂' },
    { key: 'wow', emoji: '😮' },
    { key: 'sad', emoji: '😢' },
    { key: 'angry', emoji: '😡' },
];

// --- NEW HELPER ---: Function to build nested comment tree
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

// --- NEW HELPER ---: Function to recursively insert a reply into the tree
const insertReplyIntoTree = (tree, newReply) => {
    return tree.map(comment => {
        if (comment.id === newReply.reply_to) {
            if (comment.replies.find(r => r.id === newReply.id || r._tempId === newReply._tempId)) { // Avoid duplicate adds
                return comment;
            }
            return { ...comment, replies: [...comment.replies, newReply].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) };
        } else if (comment.replies && comment.replies.length > 0) {
            return { ...comment, replies: insertReplyIntoTree(comment.replies, newReply) };
        }
        return comment;
    });
};

// --- NEW HELPER ---: Function to flatten a reply tree for "straight" rendering
const flattenReplies = (replyTree) => {
    const flattened = [];
    const traverse = (nodes, depth) => {
      if (!nodes || nodes.length === 0) return;
      for (const node of nodes) {
        flattened.push({ ...node, _depth: depth });
        traverse(node.replies, depth + 1);
      }
    };
    traverse(replyTree, 1); // Start at depth 1
    return flattened;
};


export default function CommunityScreen({ navigation }) {
    const user = auth.currentUser;
    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // --- NEW ---: State for pull-to-refresh

    // create post modal
    const [createVisible, setCreateVisible] = useState(false);
    const [postText, setPostText] = useState('');
    const [postImages, setPostImages] = useState([]); // array of local URIs
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [posting, setPosting] = useState(false);

    // comments modal + threaded replies
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [activePost, setActivePost] = useState(null);
    const [comments, setComments] = useState([]); // NOW A NESTED TREE
    const [commentText, setCommentText] = useState('');
    const [commentImage, setCommentImage] = useState(null);
    const [commenting, setCommenting] = useState(false);

    // reply UI state
    const [replyingTo, setReplyingTo] = useState(null); // comment id (or reply id) we are replying to
    const [replyTextMap, setReplyTextMap] = useState({}); // { commentId: 'reply text' }
    const [replyingMap, setReplyingMap] = useState({}); // { commentId: boolean } // Tracks submission loading state

    // reaction picker
    const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
    const [reactionPostTarget, setReactionPostTarget] = useState(null);

    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [viewingImageUri, setViewingImageUri] = useState(null);

    // UI/theme + responsiveness
    const systemColorScheme = useColorScheme();
    const isDark = systemColorScheme === 'dark';
    const theme = isDark ? darkTheme : lightTheme;
    const { width: windowWidth } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isWide = isWeb && windowWidth > 3000;

    // realtime channels refs
    const postsChannelRef = useRef(null);
    const commentsChannelRef = useRef(null);
    const reactionsChannelRef = useRef(null);

    // optimization: debounce refetch for dirty posts
    const dirtyTimerRef = useRef(null);

    // --- REFACTORED ---: This useEffect now handles POSTS and REACTIONS only.
    // It runs ONCE on mount to ensure subscriptions are stable.
    useEffect(() => {
        fetchPosts(); // Initial fetch

        // Subscribe to realtime changes for posts
        postsChannelRef.current = supabase
            .channel('public:community_posts')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'community_posts' },
                async (payload) => { // Make async to fetch user
                    const newPost = payload.new;
                    let userData = null;
                    if (newPost.user_id && !newPost.is_anonymous) {
                        try {
                            const { data, error } = await supabase.from('users').select('id, name, profile_photo').eq('id', newPost.user_id).single();
                            if (error) throw error;
                            userData = data;
                        } catch (err) { console.error("RT Post: Couldn't fetch user", err); }
                    }
                    // Fetch post metadata (reactions, comments) for the new post
                    const { data: reactionsData, error: reactionsError } = await supabase.from('community_reactions').select('post_id, reaction_type').eq('post_id', newPost.id);
                    const { data: commentsData, error: commentsError } = await supabase.from('community_comments').select('post_id, id').eq('post_id', newPost.id);
                    
                    const reaction_counts = (reactionsData || []).reduce((acc, r) => {
                        const existing = acc.find(item => item.reaction_type === r.reaction_type);
                        if (existing) existing.count++;
                        else acc.push({ reaction_type: r.reaction_type, count: 1 });
                        return acc;
                    }, []);
                    
                    const comments_count = (commentsData || []).length;
                    
                    // Check for user's reaction
                    let my_reaction = null;
                    if (user?.uid) {
                        const { data: userReactionData } = await supabase.from('community_reactions').select('reaction_type').eq('post_id', newPost.id).eq('user_id', user.uid).single();
                        my_reaction = userReactionData?.reaction_type || null;
                    }

                    const postWithUserAndMeta = {
                        ...newPost,
                        users: userData,
                        reaction_counts,
                        comments_count,
                        my_reaction
                    };


                    setPosts((currentPosts) => {
                        const existingIndex = currentPosts.findIndex(p => p.id === postWithUserAndMeta.id || p._tempId === postWithUserAndMeta._tempId);
                        if (existingIndex > -1) {
                            // Replace pending/duplicate
                            const updatedPosts = [...currentPosts];
                            updatedPosts[existingIndex] = postWithUserAndMeta;
                            return updatedPosts;
                        }
                        return [postWithUserAndMeta, ...currentPosts]; // Prepend new
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

        // Subscribe to realtime reactions
        reactionsChannelRef.current = supabase
            .channel('public:community_reactions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'community_reactions' },
                (payload) => {
                    const postId = payload.new?.post_id || payload.old?.post_id;
                    if (postId) {
                        scheduleMarkDirty(postId);
                    }
                }
            )
            .subscribe();

        return () => {
            if (postsChannelRef.current) supabase.removeChannel(postsChannelRef.current);
            if (reactionsChannelRef.current) supabase.removeChannel(reactionsChannelRef.current);
            if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // --- MODIFIED ---: Empty dependency array so it runs only ONCE.

    // --- NEW ---: This useEffect now handles COMMENT subscriptions only.
    // It depends on `activePost` to subscribe/unsubscribe as needed.
    useEffect(() => {
        if (!activePost) {
            // If modal is closed, ensure we're unsubscribed
            if (commentsChannelRef.current) {
                supabase.removeChannel(commentsChannelRef.current);
                commentsChannelRef.current = null;
            }
            return;
        }

        // Subscribe to realtime comments for the active post
        commentsChannelRef.current = supabase
            .channel(`public:community_comments:post_id=eq.${activePost.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'community_comments', filter: `post_id=eq.${activePost.id}` },
                async (payload) => {
                    const newComment = payload.new;

                    // Bump global count FIRST
                    setPosts((p) => p.map((x) => (x.id === newComment.post_id ? { ...x, comments_count: (x.comments_count || 0) + 1 } : x)));

                    let userData = null;
                    if (newComment.user_id) {
                        try {
                            const { data, error } = await supabase.from('users').select('id, name, profile_photo').eq('id', newComment.user_id).single();
                            if (error) throw error;
                            userData = data;
                        } catch (err) {
                            console.error('RT Comment: could not fetch user', err);
                            userData = { id: newComment.user_id, name: 'User' };
                        }
                    }
                    const commentWithUser = { ...newComment, users: userData, replies: [] };

                    setComments((currentCommentTree) => {
                        const commentExists = (nodes, idToCheck, tempIdToCheck) => {
                            for (const node of nodes) {
                                if (node.id === idToCheck || node._tempId === tempIdToCheck) return true;
                                if (node.replies && commentExists(node.replies, idToCheck, tempIdToCheck)) return true;
                            }
                            return false;
                        };

                        const replacePending = (nodes, confirmedComment) => nodes.map(node => {
                            if (node._tempId === confirmedComment._tempId || (node.id === confirmedComment.id && node._pending)) {
                                return { ...confirmedComment, replies: node.replies || [] };
                            }
                            if (node.replies) {
                                return { ...node, replies: replacePending(node.replies, confirmedComment) };
                            }
                            return node;
                        });

                        let replaced = false;
                        const updatedTreeReplacingPending = replacePending(currentCommentTree, { ...commentWithUser, _tempId: commentWithUser.id });
                        if (JSON.stringify(updatedTreeReplacingPending) !== JSON.stringify(currentCommentTree)) {
                            replaced = true;
                        }

                        if (replaced) {
                            return updatedTreeReplacingPending;
                        } else if (commentExists(currentCommentTree, commentWithUser.id, commentWithUser.id)) {
                            return currentCommentTree;
                        } else {
                            if (!commentWithUser.reply_to) {
                                return [...currentCommentTree, commentWithUser].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                            } else {
                                return insertReplyIntoTree(currentCommentTree, commentWithUser);
                            }
                        }
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'community_comments', filter: `post_id=eq.${activePost.id}` },
                (payload) => {
                  const deletedComment = payload.old;
                  if (!deletedComment) return;

                  setPosts((p) => p.map((x) => (x.id === deletedComment.post_id ? { ...x, comments_count: Math.max(0, (x.comments_count || 1) - 1) } : x)));

                  const removeCommentFromTree = (nodes, idToRemove) => {
                    if (!nodes) return [];
                    return nodes
                      .filter(node => node.id !== idToRemove)
                      .map(node => ({
                        ...node,
                        replies: removeCommentFromTree(node.replies, idToRemove)
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
    }, [activePost]); // --- MODIFIED ---: This hook now *only* depends on activePost.


    const scheduleMarkDirty = (postId) => {
        if (!postId) return;
        setPosts((p) => p.map((px) => (px.id === postId && !px._pending ? { ...px, _dirty: true } : px))); // Don't mark pending posts as dirty
        if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
        dirtyTimerRef.current = setTimeout(() => {
            fetchPosts(); // Refetch will clear _dirty flags
            dirtyTimerRef.current = null;
        }, 700);
    };

    useEffect(() => {
        const dirtyPost = posts.find((p) => p._dirty);
        if (dirtyPost && !dirtyTimerRef.current) {
            scheduleMarkDirty(dirtyPost.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posts]);

    const fetchPosts = async () => {
        try {
            const { data: postsData, error } = await supabase.from('community_posts').select('*, users:user_id (id, email, name, profile_photo)').order('created_at', { ascending: false });
            if (error) throw error;

            const postIds = (postsData || []).map((p) => p.id).filter(Boolean);
            if (postIds.length === 0) { setPosts([]); setLoadingPosts(false); return; }

            const [reactionsRes, userReactionsRes, commentsCountRes] = await Promise.all([
                supabase.from('community_reactions').select('post_id, reaction_type').in('post_id', postIds),
                user?.uid ? supabase.from('community_reactions').select('post_id, reaction_type').in('post_id', postIds).eq('user_id', user.uid) : Promise.resolve({ data: [] }),
                supabase.from('community_comments').select('post_id, id').in('post_id', postIds)
            ]);

            const reactionsAll = reactionsRes.data || [];
            const userReactions = userReactionsRes.data || [];
            const commentsAll = commentsCountRes.data || [];

            const reactionMap = reactionsAll.reduce((acc, r) => { if (!r?.post_id || !r.reaction_type) return acc; acc[r.post_id] = acc[r.post_id] || {}; acc[r.post_id][r.reaction_type] = (acc[r.post_id][r.reaction_type] || 0) + 1; return acc; }, {});
            const commentCountMap = commentsAll.reduce((acc, c) => { if (!c?.post_id) return acc; acc[c.post_id] = (acc[c.post_id] || 0) + 1; return acc; }, {});
            const userReactionMap = userReactions.reduce((acc, r) => { acc[r.post_id] = r.reaction_type; return acc; }, {});

            const postsWithMeta = postsData.map((p) => {
                const countsObj = reactionMap[p.id] || {};
                const reaction_counts = Object.entries(countsObj).map(([type, count]) => ({ reaction_type: type, count }));
                const comments_count = commentCountMap[p.id] || 0;
                const my_reaction = userReactionMap[p.id] || null;

                const existingPost = posts.find(ep => ep.id === p.id || ep._tempId === p._tempId); // Match pending too
                const pendingStatus = existingPost?._pending ? { _pending: true, _tempId: existingPost._tempId } : {};

                return { ...p, reaction_counts, my_reaction, comments_count, ...pendingStatus };
            });
            setPosts(postsWithMeta);
        } catch (err) { console.error('Fetch posts error', err); Alert.alert('Error', 'Could not fetch posts.'); }
        finally { setLoadingPosts(false); }
    };

    // --- NEW ---: Callback for RefreshControl
    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPosts();
        setRefreshing(false);
    };


    const pickImages = async (forComment = false, single = false) => {
        try {
            const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: !single });
            if (res.canceled) return;
            const uris = res.assets.map((a) => a.uri);
            if (forComment) setCommentImage(uris[0]);
            else setPostImages((prev) => [...(prev || []), ...uris]);
        } catch (err) { console.error('Image pick err', err); Alert.alert('Error', 'Could not pick image.'); }
    };

    const uploadFileAsync = async (localUri, folder = 'posts') => {
        try {
            const response = await fetch(localUri); const blob = await response.blob();
            const fileExt = localUri.split('.').pop()?.split('?')[0] || 'jpg';
            const filename = `${folder}/${user.uid}_${Date.now()}.${fileExt}`;
            const { error } = await supabase.storage.from('community-uploads').upload(filename, blob, { upsert: false });
            if (error && error.message.includes('duplicate')) { // Be more specific about retrying
                console.warn('Upload failed (duplicate), retrying with upsert:', error.message);
                const { error: retryError } = await supabase.storage.from('community-uploads').upload(filename, blob, { upsert: true });
                if (retryError) throw retryError;
            } else if (error) { throw error; } // Throw other errors
            const { data } = supabase.storage.from('community-uploads').getPublicUrl(filename); return data.publicUrl;
        } catch (err) { console.error('Upload error', err); throw err; }
    };

    const submitPost = async () => {
        if (!postText.trim() && postImages.length === 0) { Alert.alert('Empty post'); return; }
        setPosting(true);
        const tempId = `temp_${Date.now()}`;
        const currentUserData = { id: user.uid, name: user.displayName || user.email?.split('@')[0] || 'You', profile_photo: user.photoURL };
        const tempPost = { id: tempId, _tempId: tempId, _pending: true, user_id: user.uid, content: postText.trim() || null, image_urls: postImages, is_anonymous: !!isAnonymous, created_at: new Date().toISOString(), users: isAnonymous ? null : currentUserData, reaction_counts: [], my_reaction: null, comments_count: 0 };
        setPosts(currentPosts => [tempPost, ...currentPosts]);
        const originalPostImages = [...postImages]; // Copy array before resetting state
        setPostText(''); setPostImages([]); setIsAnonymous(false); setCreateVisible(false);
        try {
            const uploadedUrls = [];
            for (const uri of originalPostImages) { uploadedUrls.push(await uploadFileAsync(uri, 'posts')); }
            const payload = { user_id: user.uid, content: tempPost.content, image_urls: uploadedUrls.length > 0 ? uploadedUrls : null, is_anonymous: tempPost.is_anonymous };
            const { data: confirmedPost, error } = await supabase.from('community_posts').insert(payload).select('*, users:user_id (id, email, name, profile_photo)').single();
            if (error) throw error;
            
            // Note: The realtime listener will replace this, but we do it manually too
            // for a faster optimistic -> confirmed transition.
            setPosts(currentPosts => currentPosts.map(p => (p._tempId === tempId ? { ...confirmedPost, users: confirmedPost.users || currentUserData } : p)));
        } catch (err) { console.error('Post submission error:', err); Alert.alert('Post Error', err.message || 'Unable to create post.'); setPosts(currentPosts => currentPosts.filter(p => p._tempId !== tempId));
        } finally { setPosting(false); }
    };


    const openComments = async (post) => {
        setActivePost(post); setCommentsVisible(true); setReplyingTo(null); setReplyTextMap({}); setReplyingMap({}); setComments([]); await fetchComments(post.id);
    };

    const fetchComments = async (postId) => {
        try {
            const { data: allCommentsData, error } = await supabase.from('community_comments').select('*, users:user_id (id, name, profile_photo)').eq('post_id', postId).order('created_at', { ascending: true });
            if (error) throw error;
            const commentTree = buildCommentTree(allCommentsData || []); setComments(commentTree);
        } catch (err) { console.error('Comments fetch error:', err); Alert.alert('Error', 'Could not fetch comments.'); setComments([]); }
    };

    const submitComment = async () => {
        const text = commentText.trim(); const image = commentImage;
        if (!text && !image) { Alert.alert('Empty comment'); return; } if (!activePost) return;
        setCommenting(true);
        const tempId = `temp_${Date.now()}`;
        const currentUserData = { id: user.uid, name: user.displayName || user.email?.split('@')[0] || 'You', profile_photo: user.photoURL };
        const tempComment = { id: tempId, _tempId: tempId, _pending: true, post_id: activePost.id, user_id: user.uid, content: text || null, image_url: image || null, reply_to: null, created_at: new Date().toISOString(), users: currentUserData, replies: [] };
        setComments(currentTree => [...currentTree, tempComment]);
        setCommentText(''); setCommentImage(null);
        try {
            let uploadedImageUrl = null; if (image) { uploadedImageUrl = await uploadFileAsync(image, 'comments'); }
            const payload = { post_id: activePost.id, user_id: user.uid, content: text || null, image_url: uploadedImageUrl, reply_to: null };
            const { data: confirmedComment, error } = await supabase.from('community_comments').insert(payload).select('*, users:user_id(id, name, profile_photo)').single();
            if (error) throw error;

            // Replace temp comment using the replacePending logic adapted for comments
            setComments(currentTree => currentTree.map(c => (c._tempId === tempId ? { ...confirmedComment, users: confirmedComment.users || currentUserData, replies: c.replies || [] } : c))
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) );
            // Note: Realtime listener will also fire and update count
            // setPosts(p => p.map(post => post.id === activePost.id ? {...post, comments_count: (post.comments_count || 0) + 1} : post));


        } catch (err) { console.error('Comment submission error:', err); Alert.alert('Comment Error', err.message || 'Unable to post comment.'); setComments(currentTree => currentTree.filter(c => c._tempId !== tempId));
        } finally { setCommenting(false); }
    };

    const submitReply = async (parentCommentId) => {
        const text = (replyTextMap[parentCommentId] || '').trim(); if (!text) { Alert.alert('Empty reply'); return; } if (!activePost) return;
        setReplyingMap((m) => ({ ...m, [parentCommentId]: true }));
        const tempId = `temp_${Date.now()}`;
        const currentUserData = { id: user.uid, name: user.displayName || user.email?.split('@')[0] || 'You', profile_photo: user.photoURL };
        const tempReply = { id: tempId, _tempId: tempId, _pending: true, post_id: activePost.id, user_id: user.uid, content: text, image_url: null, reply_to: parentCommentId, created_at: new Date().toISOString(), users: currentUserData, replies: [] };
        setComments(currentTree => insertReplyIntoTree(currentTree, tempReply));
        setReplyTextMap((m) => ({ ...m, [parentCommentId]: '' })); setReplyingTo(null);
        try {
            const payload = { post_id: activePost.id, user_id: user.uid, content: text, image_url: null, reply_to: parentCommentId };
            const { data: confirmedReply, error } = await supabase.from('community_comments').insert(payload).select('*, users:user_id(id, name, profile_photo)').single();
            if (error) throw error;

            const replaceTempReply = (nodes) => nodes.map(node => {
                if (node._tempId === tempId) { return { ...confirmedReply, users: confirmedReply.users || currentUserData, replies: node.replies || [] }; }
                if (node.replies) { return { ...node, replies: replaceTempReply(node.replies) }; } return node;
            });
            setComments(currentTree => replaceTempReply(currentTree));
            // Note: Realtime listener will also fire and update count
            // setPosts(p => p.map(post => post.id === activePost.id ? {...post, comments_count: (post.comments_count || 0) + 1} : post));

        } catch (err) { console.error('Reply submission error:', err); Alert.alert('Reply Error', err.message || 'Unable to post reply.');
            const removeTempReply = (nodes) => nodes.filter(node => node._tempId !== tempId).map(node => { if (node.replies) { return { ...node, replies: removeTempReply(node.replies) }; } return node; });
            setComments(currentTree => removeTempReply(currentTree));
        } finally { setReplyingMap((m) => ({ ...m, [parentCommentId]: false })); }
    };

    // --- NEW ---: Function to delete a comment or reply
    const handleDeleteComment = (comment) => {
        if (comment.user_id !== user?.uid || comment._pending) {
          return; // Can't delete others' comments or pending comments
        }

        Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [ // Note: This won't delete replies by default unless DB is set up for cascade
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const commentId = comment.id;

              // Optimistic update
              const removeCommentFromTree = (nodes, idToRemove) => {
                if (!nodes) return [];
                return nodes
                  .filter(node => node.id !== idToRemove)
                  .map(node => ({
                    ...node,
                    replies: removeCommentFromTree(node.replies, idToRemove)
                  }));
              };
              setComments(currentTree => removeCommentFromTree(currentTree, commentId));

              try {
                // RLS should ensure user can only delete their own.
                // If replies should be cascade deleted, this needs to be set up in Supabase DB policies/triggers.
                const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
                if (error) throw error;
                
                // Refetch comment count for accuracy after delete
                const { data: countData, error: countError } = await supabase
                  .from('community_comments')
                  .select('id', { count: 'exact', head: true })
                  .eq('post_id', activePost.id);
                
                if (!countError) {
                   // --- BUG FIX APPLIED HERE ---
                   // Used optional chaining (countData?.count) to prevent crash if countData is null
                   setPosts(p => p.map(post => post.id === activePost.id ? {...post, comments_count: countData?.count || 0} : post));
                }

              } catch (err) {
                console.error('Delete comment error', err);
                Alert.alert('Error', 'Could not delete comment.');
                // Refetch to restore state on failure
                if (activePost) fetchComments(activePost.id);
              }
            },
          },
        ]);
    };

    // --- NEW ---: Function to pre-fill mention on reply
    const handleStartReply = (comment) => {
        const currentId = comment.id || comment._tempId;
        const displayName = comment.users?.name || 'User';
        const mention = `@${displayName} `;
        
        // Pre-fill the text map with the mention
        setReplyTextMap((m) => ({ ...m, [currentId]: mention }));
        // Set this comment as the one being replied to
        setReplyingTo(currentId);
    };


    const toggleReaction = async (postId, reactionType) => {
        if (!user?.uid) { Alert.alert('Login required'); return; }
        let oldReaction = null;
        setPosts(currentPosts => currentPosts.map(p => {
            if (p.id === postId) { oldReaction = p.my_reaction; const newCounts = [...(p.reaction_counts || [])]; let changed = false;
                if (oldReaction) { const idx = newCounts.findIndex(rc => rc.reaction_type === oldReaction); if (idx > -1) { newCounts[idx] = { ...newCounts[idx], count: Math.max(0, newCounts[idx].count - 1) }; if (newCounts[idx].count === 0) newCounts.splice(idx, 1); changed = true; } }
                if (oldReaction !== reactionType) { const idx = newCounts.findIndex(rc => rc.reaction_type === reactionType); if (idx > -1) newCounts[idx] = { ...newCounts[idx], count: newCounts[idx].count + 1 }; else newCounts.push({ reaction_type: reactionType, count: 1 }); changed = true; }
                return { ...p, my_reaction: (oldReaction === reactionType) ? null : reactionType, reaction_counts: newCounts };
            } return p;
        }));
        try {
            const { data: existing } = await supabase.from('community_reactions').select('*').eq('post_id', postId).eq('user_id', user.uid).single();
            if (existing && existing.reaction_type === reactionType) { await supabase.from('community_reactions').delete().eq('id', existing.id); }
            else if (existing) { await supabase.from('community_reactions').update({ reaction_type: reactionType }).eq('id', existing.id); }
            else { await supabase.from('community_reactions').insert({ post_id: postId, user_id: user.uid, reaction_type: reactionType }); }
            scheduleMarkDirty(postId); // Keep for consistency
        } catch (err) { console.error('Reaction error', err); Alert.alert('Reaction Error');
            setPosts(currentPosts => currentPosts.map(p => p.id === postId ? { ...p, my_reaction: oldReaction /* Revert counts? Hard. */ } : p)); fetchPosts(); // Refetch on error
        }
    };

    // --- MODIFIED ---: Fixed renderReactionSummary
    const renderReactionSummary = (post) => {
        if (!post || post._pending) return null; // Don't render for pending posts
        // Filter out any potential null values in reaction_counts to be extra safe
        const validCounts = (post.reaction_counts || []).filter(rc => rc && rc.count > 0);
        if (validCounts.length === 0) return <Text style={[styles.smallText, { color: theme.textSecondary }]}>Be the first to react</Text>;

        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {validCounts.slice(0, 3).map((rc) => {
                    const emoji = REACTIONS.find((r) => r.key === rc.reaction_type)?.emoji || '👍';
                    return <Text key={rc.reaction_type} style={{ fontSize: 12, color: theme.textSecondary }}>{emoji}{rc.count}</Text>;
                })}
                {/* --- FIX APPLIED HERE --- */}
                {validCounts.length > 3 && <Text style={{ fontSize: 12, color: theme.textSecondary }}>...</Text>}
            </View>
        );
    };

    const renderPost = ({ item }) => {
        const author = item.is_anonymous ? null : item.users;
        const displayName = item.is_anonymous ? 'Anonymous' : (author?.name || author?.email?.split('@')[0] || 'User');
        const avatar = item.is_anonymous ? null : author?.profile_photo;
        const isPending = item._pending;

        return (
            <View style={[ styles.postCard, { backgroundColor: theme.cardBackground, opacity: isPending ? 0.6 : 1 }, isWide && styles.wideCard ]}>
                <View style={styles.postHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={styles.avatarWrapper}>
                            {avatar ? (<Image source={{ uri: avatar }} style={styles.avatarSmall} />)
                                : (<View style={[styles.avatarSmall, styles.avatarPlaceholder]}><Ionicons name="person" size={24} color="#fff" /></View>)}
                        </View>
                        <View style={{ marginLeft: 10, flexShrink: 1 }}>
                            <Text style={[styles.postAuthor, { color: theme.text }]}>{displayName}</Text>
                            <Text style={[styles.postTime, { color: theme.textSecondary }]}>
                                {isPending ? 'Sending...' : new Date(item.created_at).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                    {!isPending && item.user_id === user?.uid && (
                        <TouchableOpacity onPress={() => handlePostOptions(item)} style={{ padding: 5 }}>
                            <Ionicons name="ellipsis-vertical" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ marginTop: 10 }}>
                    {item.content && <Text style={[styles.postText, { color: theme.text }]}>{item.content}</Text>}
                    {item.image_urls && item.image_urls.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                            {item.image_urls.map((uri, idx) => (
                                isPending ? (
                                    <Image key={idx} source={{ uri }} style={[ styles.postImage, { marginRight: 8 }]}/>
                                ) : (
                                    <TouchableOpacity key={idx} onPress={() => openImageViewer(uri)} style={{ marginRight: 8 }}>
                                        <Image source={{ uri }} style={styles.postImage}/>
                                    </TouchableOpacity>
                                )
                            ))}
                        </ScrollView>
                    )}
                </View>

                {!isPending && (
                    <>
                        <View style={styles.postFooter}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => openReactionPicker(item)}>
                                <Text style={{ fontSize: 18 }}>{item.my_reaction ? REACTIONS.find(r => r.key === item.my_reaction)?.emoji || '👍' : '👍'}</Text>
                                <Text style={[styles.smallText, { color: theme.textSecondary, marginLeft: 6 }]}>React</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item)}>
                                <Ionicons name="chatbubble-outline" size={18} color={theme.textSecondary} />
                                <Text style={[styles.smallText, { color: theme.textSecondary, marginLeft: 6 }]}>Comment ({item.comments_count || 0})</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ marginTop: 6, minHeight: 15 }}>{renderReactionSummary(item)}</View>
                    </>
                )}
            </View>
        );
    };

    const handlePostOptions = (post) => {
        Alert.alert('Delete Post', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try { setPosts(currentPosts => currentPosts.filter(p => p.id !== post.id)); const { error } = await supabase.from('community_posts').delete().eq('id', post.id); if (error) throw error; }
                catch (err) { console.error('Delete post error', err); Alert.alert('Error', 'Could not delete post.'); fetchPosts(); }
            }},
        ]);
    };

    const openImageViewer = (uri) => { setViewingImageUri(uri); setImageViewerVisible(true); };
    const openReactionPicker = (post) => { setReactionPostTarget(post); setReactionPickerVisible(true); };
    const handleReact = async (reactionKey) => { if (!reactionPostTarget) return; await toggleReaction(reactionPostTarget.id, reactionKey); setReactionPickerVisible(false); setReactionPostTarget(null); };
    const handlePickCommentImage = async () => { await pickImages(true, true); };
    const handlePickPostImages = async () => { await pickImages(false, false); };


    const renderCommentItem = ({ item: comment }) => {
        const author = comment.users || {}; const displayName = author?.name || 'User'; const avatar = author?.profile_photo; const isPending = comment._pending;
        return (
            <View style={[styles.commentItem, { opacity: isPending ? 0.6 : 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={styles.avatarWrapperSmall}>
                        {avatar ? <Image source={{ uri: avatar }} style={styles.avatarSmallComment} /> : <View style={[styles.avatarSmallComment, styles.avatarPlaceholder]}><Ionicons name="person" size={18} color="#fff" /></View>}
                    </View>
                    <View style={styles.commentContent}>
                        <Text style={[{ color: theme.text, fontWeight: '700' }]}>{displayName}</Text>
                        {comment.content && <Text style={{ color: theme.textSecondary, marginTop: 2 }}>{comment.content}</Text>}
                        {comment.image_url && <Image source={{ uri: comment.image_url }} style={styles.commentImage} />}
                        {!isPending && (
                            <View style={styles.commentActions}>
                                {/* --- MODIFIED: Use handleStartReply --- */}
                                <TouchableOpacity onPress={() => handleStartReply(comment)} style={{ marginRight: 16 }}>
                                    <Text style={[styles.smallText, { color: theme.textSecondary }]}>Reply</Text>
                                </TouchableOpacity>
                                <Text style={[styles.smallText, { color: theme.textSecondary }]}>{new Date(comment.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
                                {/* --- NEW DELETE BUTTON --- */}
                                {comment.user_id === user?.uid && !isPending && (
                                    <TouchableOpacity onPress={() => handleDeleteComment(comment)} style={{ marginLeft: 16 }}>
                                        <Text style={[styles.smallText, { color: theme.accent }]}>Delete</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {isPending && <Text style={[styles.smallText, { color: theme.textSecondary, marginTop: 8 }]}>Sending...</Text>}
                        {(replyingTo === comment.id || replyingTo === comment._tempId) && (
                            <View style={{ marginTop: 8 }}>
                                <TextInput placeholder={`Replying to ${displayName}...`} placeholderTextColor={theme.textSecondary} value={replyTextMap[comment.id || comment._tempId] || ''} onChangeText={(t) => setReplyTextMap((m) => ({ ...m, [comment.id || comment._tempId]: t }))} style={[styles.replyInput, { color: theme.text, backgroundColor: theme.background }]} autoFocus />
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, gap: 12 }}>
                                    <TouchableOpacity onPress={() => { setReplyingTo(null); setReplyTextMap((m) => ({ ...m, [comment.id || comment._tempId]: '' })); }}><Text style={{ color: theme.textSecondary }}>Cancel</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => submitReply(comment.id || comment._tempId)} disabled={replyingMap[comment.id || comment._tempId]}><ActivityIndicator size="small" animating={!!replyingMap[comment.id || comment._tempId]} /><Text style={{ color: theme.accent, fontWeight: '700', marginLeft: replyingMap[comment.id || comment._tempId] ? 5:0 }}>Reply</Text></TouchableOpacity>
                                </View>
                            </View>
                        )}
                        {/* --- MODIFIED: Use flattenReplies to render replies "straight" --- */}
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
                                        handleDeleteComment={handleDeleteComment} // Pass delete handler
                                        handleStartReply={handleStartReply} // Pass mention handler
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    // --- MODIFIED: Removed recursive rendering from RenderReply ---
    const RenderReply = ({ reply, theme, replyingTo, setReplyingTo, replyTextMap, setReplyTextMap, submitReply, replyingMap, handleDeleteComment, handleStartReply }) => {
        const author = reply.users || {}; const displayName = author?.name || 'User'; const avatar = author?.profile_photo; const isPending = reply._pending;
        const currentId = reply.id || reply._tempId; // Use real ID if available, otherwise temp ID

        return (
            <View style={[styles.replyItem, { opacity: isPending ? 0.6 : 1 }]} >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={styles.avatarWrapperSmall}>
                        {avatar ? <Image source={{ uri: avatar }} style={styles.avatarSmallComment} /> : <View style={[styles.avatarSmallComment, styles.avatarPlaceholder]}><Ionicons name="person" size={18} color="#fff" /></View>}
                    </View>
                    <View style={styles.commentContent}>
                        <Text style={[{ color: theme.text, fontWeight: '700' }]}>{displayName}</Text>
                        {reply.content && <Text style={{ color: theme.textSecondary, marginTop: 2 }}>{reply.content}</Text>}
                        {!isPending && (
                            <View style={styles.commentActions}>
                                {/* --- MODIFIED: Use handleStartReply --- */}
                                <TouchableOpacity onPress={() => handleStartReply(reply)} style={{ marginRight: 16 }}>
                                    <Text style={[styles.smallText, { color: theme.textSecondary }]}>Reply</Text>
                                </TouchableOpacity>
                                <Text style={[styles.smallText, { color: theme.textSecondary }]}>{new Date(reply.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
                                {/* --- NEW DELETE BUTTON --- */}
                                {reply.user_id === user?.uid && !isPending && (
                                    <TouchableOpacity onPress={() => handleDeleteComment(reply)} style={{ marginLeft: 16 }}>
                                        <Text style={[styles.smallText, { color: theme.accent }]}>Delete</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {isPending && <Text style={[styles.smallText, { color: theme.textSecondary, marginTop: 8 }]}>Sending...</Text>}
                        {replyingTo === currentId && (
                            <View style={{ marginTop: 8 }}>
                                <TextInput placeholder={`Replying to ${displayName}...`} placeholderTextColor={theme.textSecondary} value={replyTextMap[currentId] || ''} onChangeText={(t) => setReplyTextMap((m) => ({ ...m, [currentId]: t }))} style={[styles.replyInput, { color: theme.text, backgroundColor: theme.background }]} autoFocus />
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, gap: 12 }}>
                                    <TouchableOpacity onPress={() => { setReplyingTo(null); setReplyTextMap((m) => ({ ...m, [currentId]: '' })); }}><Text style={{ color: theme.textSecondary }}>Cancel</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => submitReply(currentId)} disabled={replyingMap[currentId]} style={{flexDirection: 'row', alignItems: 'center'}}><ActivityIndicator size="small" animating={!!replyingMap[currentId]} /><Text style={{ color: theme.accent, fontWeight: '700', marginLeft: replyingMap[currentId] ? 5:0 }}>Reply</Text></TouchableOpacity>
                                </View>
                            </View>
                        )}
                        {/* --- RECURSIVE PART REMOVED --- */}
                    </View>
                </View>
            </View>
        );
    };



    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, isWide && { paddingHorizontal: 40 }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Community</Text>
                <TouchableOpacity style={styles.createBtn} onPress={() => setCreateVisible(true)}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Loading or Posts List */}
            {loadingPosts ? (
                <View style={styles.centerLoader}><ActivityIndicator size="large" color={theme.accent} /><Text style={{ marginTop: 10, color: theme.textSecondary }}>Loading posts...</Text></View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item.id || item._tempId}
                    renderItem={renderPost}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.listContentContainer}
                    ListEmptyComponent={<Text style={styles.emptyListText}>No posts yet — be the first!</Text>}
                    // --- NEW: Added RefreshControl ---
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[theme.accent]} // Android
                            tintColor={theme.accent} // iOS
                        />
                    }
                    // --- END NEW ---
                />
            )}

            {/* Create Post Modal */}
            <Modal visible={createVisible} animationType="slide" onRequestClose={() => !posting && setCreateVisible(false)}>
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => !posting && setCreateVisible(false)} disabled={posting}><Ionicons name="close" size={26} color={theme.text} /></TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Create Post</Text>
                        <TouchableOpacity onPress={submitPost} disabled={posting} style={{flexDirection: 'row', alignItems: 'center'}}><ActivityIndicator size="small" color={theme.accent} animating={posting}/><Text style={[styles.postNow, { color: theme.accent, marginLeft: posting ? 5:0 }]}>Post</Text></TouchableOpacity>
                    </View>
                    <ScrollView style={{ padding: 16 }}>
                        <TextInput placeholder="What's on your mind?" placeholderTextColor={theme.textSecondary} multiline value={postText} onChangeText={setPostText} style={[styles.createInput, styles.createText, { color: theme.text, backgroundColor: theme.cardBackground }]} />
                        {postImages.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
                                {postImages.map((uri, idx) => (
                                    <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                                        <Image source={{ uri }} style={styles.previewImage} />
                                        <TouchableOpacity style={styles.removeImageBtn} onPress={() => setPostImages(p => p.filter((_, i) => i !== idx))} disabled={posting}><Ionicons name="close-circle" size={24} color="#fff" /></TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                        <View style={styles.createActionsRow}>
                            <TouchableOpacity style={styles.mediaBtn} onPress={handlePickPostImages} disabled={posting}><Ionicons name="image-outline" size={22} color={theme.accent} /><Text style={[styles.smallText, { color: theme.textSecondary, marginLeft: 6 }]}>Photo</Text></TouchableOpacity>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ color: theme.textSecondary }}>Post anonymously</Text>
                                <TouchableOpacity onPress={() => setIsAnonymous(s => !s)} style={[styles.anonToggle, isAnonymous && { backgroundColor: theme.accent, borderColor: theme.accent }]} disabled={posting}>{isAnonymous && <Ionicons name="checkmark" size={16} color="#fff" />}</TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Comments Modal */}
            <Modal visible={commentsVisible} animationType="slide" onRequestClose={() => setCommentsVisible(false)}>
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setCommentsVisible(false)}><Ionicons name="arrow-back" size={26} color={theme.text} /></TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Comments</Text>
                        <View style={{ width: 50 }} />
                    </View>
                    <FlatList data={comments} keyExtractor={(item) => item.id || item._tempId} renderItem={renderCommentItem} style={{ flex: 1, paddingHorizontal: 12 }} contentContainerStyle={{ paddingBottom: 100 }}
                        ListHeaderComponent={ activePost ? (<View style={styles.postPreview}><Text style={{ color: theme.text, fontWeight: '700' }}>{activePost.is_anonymous ? 'Anonymous' : (activePost.users?.name || 'User')}</Text>{activePost.content && <Text style={{ marginTop: 4, color: theme.textSecondary, fontSize: 13 }} numberOfLines={2}>{activePost.content}</Text>}</View>) : null }
                        ListEmptyComponent={<Text style={styles.emptyListText}>No comments yet</Text>} />
                    <View style={[styles.commentBox, { backgroundColor: theme.cardBackground, borderTopColor: theme.background }]}>
                        {commentImage && (<View style={{ marginRight: 8, position: 'relative' }}><Image source={{uri: commentImage}} style={{width: 36, height: 36, borderRadius: 4}}/><TouchableOpacity style={styles.removeCommentImageBtn} onPress={()=>setCommentImage(null)}><Ionicons name="close-circle" size={18} color="#aaa" /></TouchableOpacity></View>)}
                        <TouchableOpacity onPress={handlePickCommentImage} style={{ padding: 5, marginRight: 5 }}><Ionicons name="image-outline" size={22} color={theme.accent} /></TouchableOpacity>
                        <TextInput placeholder="Write a comment..." placeholderTextColor={theme.textSecondary} value={commentText} onChangeText={setCommentText} style={[styles.commentInput, { color: theme.text }]} multiline />
                        <TouchableOpacity onPress={submitComment} style={{ padding: 8, flexDirection: 'row', alignItems: 'center' }} disabled={commenting}><ActivityIndicator size="small" animating={commenting}/><Ionicons name="send-outline" size={22} color={theme.accent} style={{marginLeft: commenting ? 5:0}} /></TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Reaction Picker */}
            <Modal visible={reactionPickerVisible} transparent animationType="fade" onRequestClose={() => setReactionPickerVisible(false)}>
                <TouchableOpacity style={styles.reactionOverlay} activeOpacity={1} onPress={() => setReactionPickerVisible(false)}>
                    <View style={[styles.reactionRow, { backgroundColor: theme.cardBackground }]}>{REACTIONS.map((r) => (<TouchableOpacity key={r.key} style={styles.reactionBtn} onPress={() => handleReact(r.key)}><Text style={{ fontSize: 26 }}>{r.emoji}</Text></TouchableOpacity>))}</View>
                </TouchableOpacity>
            </Modal>

            {/* Image Viewer */}
            <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)}>
                <SafeAreaView style={styles.imageViewerOverlay}>
                    <TouchableOpacity style={styles.imageViewerCloseBtn} onPress={() => setImageViewerVisible(false)}><Ionicons name="close" size={32} color="#fff" /></TouchableOpacity>
                    <Image source={{ uri: viewingImageUri }} style={styles.imageViewerImage} resizeMode="contain"/>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

// Themes
const darkTheme = { background: '#0f1724', cardBackground: '#111827', text: '#e6eef6', textSecondary: '#9aa6b2', accent: '#f39c12', };
const lightTheme = { background: '#f5f7fa', cardBackground: '#fff', text: '#1a1a2e', textSecondary: '#6b7280', accent: '#f39c12', };

// Styles
const styles = StyleSheet.create({
    container: { flex: 1 },
    centerLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContentContainer: { padding: 12, paddingBottom: 60 },
    wideCard: { maxWidth: 760, alignSelf: 'center', width: '95%' },
    emptyListText: { textAlign: 'center', marginTop: 40, color: '#9aa6b2' },
    header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.2)' },
    headerTitle: { fontSize: 20, fontWeight: '700' },
    createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f39c12', alignItems: 'center', justifyContent: 'center' },
    postCard: { marginBottom: 12, padding: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(128,128,128,0.1)' },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    avatarWrapper: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#ccc' },
    avatarSmall: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#a0aec0' },
    postAuthor: { fontSize: 15, fontWeight: '600' },
    postTime: { fontSize: 12, marginTop: 2 },
    postText: { fontSize: 15, lineHeight: 21, marginTop: 4 },
    postImage: { width: initialWidth * 0.7, height: 180, borderRadius: 12 },
    postFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.1)', paddingTop: 8 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
    smallText: { fontSize: 12 },
    modalContainer: { flex: 1 },
    modalHeader: { height: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    postNow: { fontSize: 16, fontWeight: '600' },
    createInput: { minHeight: 120, borderRadius: 8, padding: 12, fontSize: 16, textAlignVertical: 'top' },
    createText: { fontSize: 16 },
    createActionsRow: { flexDirection: 'row', marginTop: 12, alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.1)', paddingTop: 12 },
    mediaBtn: { flexDirection: 'row', alignItems: 'center', padding: 5 },
    anonToggle: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: 80, height: 80, borderRadius: 8 },
    removeImageBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 2 },
    postPreview: { padding: 10, borderRadius: 8, marginBottom: 15, backgroundColor: 'rgba(128,128,128,0.1)' },
    commentItem: { marginBottom: 10 },
    replyItem: { marginTop: 10 }, // This style now applies to all replies equally
    avatarWrapperSmall: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', marginRight: 8, backgroundColor: '#ccc' },
    avatarSmallComment: { width: 32, height: 32, borderRadius: 16 },
    commentContent: { flex: 1, backgroundColor: 'rgba(128,128,128,0.08)', borderRadius: 10, padding: 10 },
    commentImage: { width: 140, height: 110, marginTop: 8, borderRadius: 8 },
    commentActions: { flexDirection: 'row', marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }, // Added flexWrap
    replyInput: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 38, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)' },
    repliesContainer: { marginTop: 10, marginLeft: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: 'rgba(128,128,128,0.1)' }, // This is the single indent for all replies
    commentBox: { paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 },
    commentInput: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(128,128,128,0.1)', marginRight: 5 },
    removeCommentImageBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 10 },
    reactionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    reactionRow: { flexDirection: 'row', padding: 12, justifyContent: 'space-around', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    reactionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    imageViewerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
    imageViewerCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 20, right: 20, zIndex: 10, padding: 10 },
    imageViewerImage: { width: '100%', height: '80%' },
});