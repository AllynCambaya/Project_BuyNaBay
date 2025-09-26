// screens/CartScreen.js
import { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from "../../supabase/supabaseClient";

export default function CartScreen() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;
  const [buyerName, setBuyerName] = useState("");

  // Fetch buyer name from users table
  useEffect(() => {
    const fetchBuyerName = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("email", user.email)
        .single();
      if (!error && data?.name) setBuyerName(data.name);
    };
    fetchBuyerName();
  }, [user]);

  // Fetch cart items for this buyer
  const fetchCart = async () => {
    if (!buyerName) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cart")
      .select("*")
      .eq("name", buyerName);

    if (error) {
      console.error(error);
    } else {
      setCartItems(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (buyerName) fetchCart();
  }, [buyerName]);

  // Remove item from cart
  const removeFromCart = async (id) => {
    const { error } = await supabase.from("cart").delete().eq("id", id);
    if (!error) {
      setCartItems(cartItems.filter((item) => item.id !== id));
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert("Cart Empty", "Please add items to your cart first.");
      return;
    }

    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("name", buyerName);

    if (!error) {
      setCartItems([]);
      Alert.alert("Order Successful 🎉", "Thank you for shopping at BuyNaBay!");
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.productName}>{item.product_name}</Text>
      <Text style={styles.price}>₱{item.price}</Text>
      <Text style={styles.quantity}>Qty: {item.quantity}</Text>

      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => removeFromCart(item.id)}
      >
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
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
        <FlatList
          data={cartItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
        />
      )}

      {cartItems.length > 0 && (
        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
          <Text style={styles.checkoutText}>Checkout</Text>
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
});
