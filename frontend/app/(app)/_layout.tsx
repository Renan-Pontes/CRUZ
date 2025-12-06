import { Stack, useRouter, usePathname } from "expo-router";
import { View, TouchableOpacity, Alert, StyleSheet, Image } from "react-native";
import { ThemedText } from "../../components/themed-text";
import { useSession } from "../../auth/ctx";
import { apiService } from "../../services/api";

export const unstable_settings = {
  initialRouteName: "trail",
};

export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut, session } = useSession();

  const handleLogout = async () => {
    Alert.alert(
      "Sair",
      "Tem certeza que deseja sair?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            try {
              if (session) {
                await apiService.logout(session, false);
              }
            } catch (error) {
              console.error("Logout error:", error);
            } finally {
              signOut();
              router.replace("/sign-in");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.stackContainer}>
        <Stack>
          <Stack.Screen name="trail" options={{ headerShown: false }} />
          <Stack.Screen name="task" options={{ headerShown: false }} />
        </Stack>
      </View>
      
      {/* Floating logout button - only show if NOT on task screen */}
      {pathname !== '/task' && (
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.logoutText}>Sair</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stackContainer: {
    flex: 1,
  },
  logoutButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
