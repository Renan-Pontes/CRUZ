import { useState, useRef } from "react";
import { router } from "expo-router";
import { 
  StyleSheet, 
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useSession } from "../auth/ctx";
import { InputField } from "../components/ui/input-field";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { apiService } from "../services/api";

// Constants
const GRADIENT_COLORS = ['#87dbba', '#87dbba', '#87dbba'] as const;

// Main Component
export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Refs for focusing
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const clearErrors = () => {
    setEmailError(null);
    setPasswordError(null);
  };

  const validateForm = (): boolean => {
    clearErrors();

    if (!email.trim()) {
      setEmailError("Por favor, insira seu email");
      emailRef.current?.focus();
      return false;
    }
    
    if (!email.toLowerCase().endsWith("@cs.cruzeirodosul.edu.br")) {
      setEmailError("Use seu email institucional (@cs.cruzeirodosul.edu.br)");
      emailRef.current?.focus();
      return false;
    }
    
    if (!password) {
      setPasswordError("Por favor, insira sua senha");
      passwordRef.current?.focus();
      return false;
    }

    return true;
  };

  const handleSignIn = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Call the login API
      const response = await apiService.login(email.trim(), password);

      console.log("Login successful:", response);

      // Sign in the user using context with the token
      signIn(response.token);
      
      // Navigate to home
      router.replace("/trail");
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert(
        "Erro no Login",
        error instanceof Error ? error.message : "Erro ao fazer login. Verifique suas credenciais."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const navigateToSignUp = () => {
    router.push("/sign-up");
  };

  return (
    <SafeAreaProvider>
      <LinearGradient
        colors={GRADIENT_COLORS}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Logo */}
              <ThemedView style={styles.avatarContainer}>
                <Image 
                  source={require('../assets/images/logo.png')}
                  style={styles.avatar}
                  resizeMode="contain"
                />
              </ThemedView>

              {/* Welcome Text */}
              <ThemedText type="title" style={styles.welcomeText}>
                Bem vindo
              </ThemedText>

              {/* Email Input */}
              <InputField
                ref={emailRef}
                iconName="envelope"
                placeholder="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError(null);
                }}
                onFocus={() => setEmailError(null)}
                keyboardType="email-address"
                error={!!emailError}
                errorMessage={emailError || undefined}
              />

              {/* Password Input */}
              <InputField
                ref={passwordRef}
                iconName="lock"
                placeholder="Senha"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(null);
                }}
                onFocus={() => setPasswordError(null)}
                secureTextEntry={!showPassword}
                showToggle
                onToggle={togglePasswordVisibility}
                isPasswordVisible={showPassword}
                error={!!passwordError}
                errorMessage={passwordError || undefined}
              />

              {/* Sign In Button */}
              <TouchableOpacity 
                style={[styles.button, isLoading && styles.buttonDisabled]} 
                onPress={handleSignIn}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#6BBD5E" />
                ) : (
                  <ThemedText style={styles.buttonText}>Entrar</ThemedText>
                )}
              </TouchableOpacity>

              {/* Create Account Link */}
              <TouchableOpacity 
                onPress={navigateToSignUp}
                style={styles.linkContainer}
              >
                <ThemedText style={styles.linkText}>
                  Não tem uma conta? <ThemedText style={styles.linkTextBold}>Criar conta</ThemedText>
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    width: "100%",
  },
  avatarContainer: {
    backgroundColor: "transparent",
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
  },
  welcomeText: {
    marginBottom: 14,
  },
  button: {
    marginTop: 20,
    marginBottom: 20,
    width: "100%",
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6BBD5E",
  },
  linkContainer: {
    marginTop: 10,
    paddingVertical: 10,
  },
  linkText: {
    fontSize: 16,
  },
  linkTextBold: {
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});