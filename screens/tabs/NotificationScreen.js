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
    if (!user?.email) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("receiver_id", user.email) // seller sees only their notifications
      .order("created_at", { ascending: false });

    if (!error) setNotifications(data);
    else console.error("Error fetching notifications:", error);

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

  const handleNotificationPress = (notification) => {
    // Navigate to existing MessagingScreen with the buyer
    navigation.navigate("MessagingScreen", {
      receiverId: notification.sender_id, // buyer's email
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleNotificationPress(item)}>
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
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
