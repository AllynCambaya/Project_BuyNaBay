// screens/CartScreen.js
import ExpoCheckbox from "expo-checkbox";
import { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from "../../supabase/supabaseClient";

export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const user = auth.currentUser;
  const [buyerName, setBuyerName] = useState("");

  // Fetch buyer name
  useEffect(() => {
    const fetchBuyerName = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("email", user.email)
        .maybeSingle();
      if (!error && data?.name) setBuyerName(data.name);
    };
    fetchBuyerName();
  }, [user]);

  // Fetch cart items
  useEffect(() => {
    const fetchCart = async () => {
      if (!buyerName) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("cart")
        .select("*")
        .eq("name", buyerName);

      if (!error) {
        setCartItems(data);
        setSelectedIds([]);
      } else {
        console.error(error);
      }
      setLoading(false);
    };

    if (buyerName) fetchCart();
  }, [buyerName]);

  // Remove item
  const removeFromCart = async (id) => {
    const { error } = await supabase.from("cart").delete().eq("id", id);
    if (!error) {
      setCartItems(cartItems.filter((item) => item.id !== id));
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (selectedIds.length === 0) {
      Alert.alert("No items selected", "Please select items to checkout.");
      return;
    }

    const itemsToCheckout = cartItems.filter((item) => selectedIds.includes(item.id));

    try {
      for (const item of itemsToCheckout) {
        // Find seller email from products table
        const { data: seller, error: sellerError } = await supabase
          .from("products")
          .select("email")
          .eq("product_name", item.product_name)
          .maybeSingle();

        if (sellerError) {
          console.error("Seller lookup failed:", sellerError.message);
          continue;
        }

        if (!seller) {
          console.error("No seller found for product:", item.product_name);
          continue;
        }

        // Insert notification for seller
        const { error: notifError } = await supabase.from("notifications").insert({
          sender_id: user?.email || "unknown", // buyer's email
          receiver_id: seller.email, // seller's email
          title: "Order Received 🎉",
          message: `${buyerName || user?.email || "A buyer"} checked out your product "${item.product_name}".`,
          read: false,
        });

        if (notifError) {
          console.error("Notification insert error", notifError);
        }
      }

      // Remove selected items from cart
      const { error } = await supabase.from("cart").delete().in("id", selectedIds);
      if (!error) {
        setCartItems(cartItems.filter((item) => !selectedIds.includes(item.id)));
        setSelectedIds([]);
        Alert.alert("Order Successful 🎉", "Thank you for shopping at BuyNaBay!");
      } else {
        console.error(error);
        Alert.alert("Checkout Failed", "There was a problem processing your order.");
      }
    } catch (e) {
      console.error("Checkout error", e);
      Alert.alert("Checkout Failed", "There was a problem processing your order.");
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const allSelected = cartItems.length > 0 && selectedIds.length === cartItems.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cartItems.map((c) => c.id));
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.cardRow}>
      <View style={styles.cardLeft}>
        <ExpoCheckbox
          value={selectedIds.includes(item.id)}
          onValueChange={() => toggleSelect(item.id)}
          color={selectedIds.includes(item.id) ? "#2e7d32" : undefined}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.productName}>{item.product_name}</Text>
        <Text style={styles.price}>₱{item.price}</Text>
        <Text style={styles.quantity}>Qty: {item.quantity}</Text>

        <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromCart(item.id)}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🛒 My Cart</Text>

      {loading ? (
        <Text>Loading...</Text>
      ) : cartItems.length === 0 ? (
        <Text style={styles.emptyText}>Your cart is empty</Text>
      ) : (
        <>
          <View style={styles.selectAllRow}>
            <ExpoCheckbox
              value={allSelected}
              onValueChange={toggleSelectAll}
              color={allSelected ? "#2e7d32" : undefined}
            />
            <Text style={styles.selectAllText}>Select All</Text>
          </View>

          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
          />
        </>
      )}

      {cartItems.length > 0 && (
        <TouchableOpacity
          style={[styles.checkoutBtn, selectedIds.length === 0 && styles.checkoutBtnDisabled]}
          onPress={handleCheckout}
          disabled={selectedIds.length === 0}
        >
          <Text style={styles.checkoutText}>Checkout ({selectedIds.length})</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 12 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 16, color: "#2e7d32" },
  emptyText: { textAlign: "center", color: "#777", marginTop: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
    marginLeft: 8,
  },
  productName: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  price: { fontSize: 16, color: "#444", marginBottom: 4 },
  quantity: { fontSize: 14, color: "#555", marginBottom: 8 },
  removeBtn: {
    backgroundColor: "#e53935",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  removeText: { color: "#fff", textAlign: "center", fontWeight: "600" },
  checkoutBtn: {
    backgroundColor: "#2e7d32",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  checkoutText: { color: "#fff", textAlign: "center", fontSize: 18, fontWeight: "700" },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardLeft: { width: 40, alignItems: "center", marginTop: 0 },
  selectAllRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  selectAllText: { marginLeft: 8, fontSize: 16, fontWeight: "600" },
  checkoutBtnDisabled: { backgroundColor: "#9e9e9e" },
});
