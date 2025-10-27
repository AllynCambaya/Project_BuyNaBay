// screens/tabs/NotificationsScreen.js
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from "../../supabase/supabaseClient";

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get notifications for this user
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("receiver_id", user.email) // seller sees only their notifications
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
      setLoading(false);
      return;
    }

    const notificationsData = data || [];

    // Collect unique sender emails to fetch their display names in one query
    const uniqueSenders = Array.from(new Set(notificationsData.map(n => n.sender_id).filter(Boolean)));

    let senderMap = {};
    if (uniqueSenders.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('email,name')
        .in('email', uniqueSenders);

      if (usersError) {
        console.warn('Error fetching sender names:', usersError);
      } else if (usersData) {
        senderMap = usersData.reduce((acc, u) => {
          acc[u.email] = u.name;
          return acc;
        }, {});
      }
    }

    // Attach sender_name to each notification
    const annotated = notificationsData.map(n => ({
      ...n,
      sender_name: senderMap[n.sender_id] || null,
    }));

    setNotifications(annotated);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    if (!user?.email) return;

    // Real-time subscription for new notifications
    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${user.email}`,
        },
        (payload) => {
          console.log("New notification received:", payload.new);
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) return <ActivityIndicator style={{ marginTop: 20 }} />;

  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No notifications yet 📭</Text>
      </View>
    );
  }

  const navigateToMessaging = (params) => {
    // Try current navigator, then parent, then grandparent — whichever has the route registered.
    // This avoids "action not handled by any navigator" when this screen is nested.
    try {
      // Try current navigator first
      navigation.navigate('Messaging', params);
      return;
    } catch (e) {
      // ignore and try parent
    }

    const parent = navigation.getParent && navigation.getParent();
    if (parent && parent.navigate) {
      parent.navigate('Messaging', params);
      return;
    }

    const grandParent = parent && parent.getParent && parent.getParent();
    if (grandParent && grandParent.navigate) {
      grandParent.navigate('Messaging', params);
      return;
    }

    // Last resort: attempt to navigate to Tabs -> Messaging if app uses nested tabs
    try {
      navigation.navigate('Tabs', { screen: 'Messaging', params });
    } catch (err) {
      console.error('Failed to navigate to Messaging via any navigator:', err);
    }
  };

  const handleNotificationPress = async (notification) => {
    // Navigate to messaging with sender (renter/checkout user).
    // Try to resolve the sender's display name from users.name to pass to Messaging.
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name')
        .eq('email', notification.sender_id)
        .maybeSingle();

      if (userError) console.warn('Error fetching sender name:', userError);

      const receiverName = userData?.name || null;

      navigateToMessaging({ receiverId: notification.sender_id, receiverName });
    } catch (err) {
      console.error('Error navigating from notification:', err);
      // Fallback: still navigate with receiverId only
      navigateToMessaging({ receiverId: notification.sender_id });
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          // Prefer sender_name (from users.name) when showing the message; replace email in message text if present
          const senderDisplay = item.sender_name || item.sender_id;
          let displayMessage = item.message || '';
          if (item.sender_id && displayMessage.includes(item.sender_id)) {
            displayMessage = displayMessage.replace(item.sender_id, senderDisplay);
          }

          return (
            <TouchableOpacity onPress={() => handleNotificationPress(item)}>
              <View style={styles.card}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message}>{displayMessage}</Text>
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 12 },
  emptyText: { textAlign: "center", marginTop: 20, fontSize: 16, color: "#777" },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { fontSize: 16, fontWeight: "bold", color: "#2e7d32", marginBottom: 4 },
  message: { fontSize: 14, color: "#333", marginBottom: 4 },
  date: { fontSize: 12, color: "#777" },
});
