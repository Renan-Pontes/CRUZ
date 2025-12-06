import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useSession } from "../../auth/ctx";
import { setUnauthorizedHandler, apiService } from "../../services/api";
import { useStorageState } from "../useStorageState";

export const unstable_settings = {
  initialRouteName: "trail",
};

export default function AppLayout() {
  const router = useRouter();
  const { signOut, session } = useSession();
  const [[loadingWelcome, welcomeSeen], setWelcomeSeen] = useStorageState("welcomeShownV2");
  const [checkedWelcome, setCheckedWelcome] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
      router.replace("/sign-in");
    });
    return () => setUnauthorizedHandler(null);
  }, [router, signOut]);

  useEffect(() => {
    // Valida sessão ao entrar no app shell
    const checkSession = async () => {
      if (!session) return;
      try {
        await apiService.getMe(session);
      } catch {
        signOut();
        router.replace("/sign-in");
      }
    };
    checkSession();
  }, [session, router, signOut]);

  // Verifica se é a primeira vez e redireciona para welcome
  useEffect(() => {
    if (loadingWelcome || checkedWelcome) return;

    if (!welcomeSeen && session) {
      setWelcomeSeen("1");
      setCheckedWelcome(true);
      // Pequeno delay para garantir que o layout está montado
      setTimeout(() => {
        router.replace("/(app)/welcome");
      }, 100);
    } else {
      setCheckedWelcome(true);
    }
  }, [loadingWelcome, welcomeSeen, session, checkedWelcome]);

  return (
    <View style={styles.container}>
      <View style={styles.stackContainer}>
        <Stack>
          <Stack.Screen name="trail" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="exercise-intro" options={{ headerShown: false }} />
          <Stack.Screen name="task" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="games/find-errors" options={{ headerShown: false }} />
          <Stack.Screen name="games/separacao" options={{ headerShown: false }} />
          <Stack.Screen name="games/atendimento" options={{ headerShown: false }} />
        </Stack>
      </View>
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
});