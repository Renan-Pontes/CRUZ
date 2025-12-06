import { useState, useRef } from "react";
import { router } from "expo-router";
import { 
  StyleSheet, 
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "../components/ui/icon-symbol";

import { useSession } from "../auth/ctx";
import { InputField } from "../components/ui/input-field";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { apiService } from "../services/api";

// Constants
const GRADIENT_COLORS = ['#87dbba', '#87dbba', '#87dbba'] as const;

// Main Component
export default function SignUp() {
  const { signIn } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // Refs for focusing
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const clearErrors = () => {
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
  };

  const validateForm = (): boolean => {
    clearErrors();
    let isValid = true;

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
      setPasswordError("Por favor, insira uma senha");
      passwordRef.current?.focus();
      return false;
    }
    
    if (password.length < 8) {
      setPasswordError("A senha deve ter pelo menos 8 caracteres");
      passwordRef.current?.focus();
      return false;
    }
    
    if (password !== confirmPassword) {
      setConfirmPasswordError("As senhas não coincidem");
      confirmPasswordRef.current?.focus();
      return false;
    }

    return isValid;
  };

  const handleSignUp = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Call the register API
      const response = await apiService.register({
        email: email.trim(),
        password,
        username: username.trim() || undefined,
      });

      // Store the token using the session context
      // You might want to update the useSession hook to handle token storage
      console.log("Registration successful:", response);

      // Show success message
      Alert.alert(
        "Cadastro Realizado!",
        "Sua conta foi criada com sucesso.",
        [
          {
            text: "OK",
            onPress: () => {
              // Sign in the user automatically with the token
              signIn(response.token);
              router.replace("/trail");
            },
          },
        ]
      );
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Erro no Cadastro",
        error instanceof Error ? error.message : "Erro ao criar conta. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(prev => !prev);
  };

  const navigateToSignIn = () => {
    router.back();
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
              {/* Avatar Circle */}
              <ThemedView style={styles.avatarContainer}>
                <ThemedView style={styles.avatar}>
                  <IconSymbol name="person.badge.plus" size={40} color="#FFF" />
                </ThemedView>
              </ThemedView>

              {/* Welcome Text */}
              <ThemedText type="title" style={styles.welcomeText}>
                Criar Conta
              </ThemedText>

              {/* Username Input */}
              <InputField
                iconName="person"
                placeholder="Usuário"
                value={username}
                onChangeText={setUsername}
              />

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

              {/* Confirm Password Input */}
              <InputField
                ref={confirmPasswordRef}
                iconName="lock"
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setConfirmPasswordError(null);
                }}
                onFocus={() => setConfirmPasswordError(null)}
                secureTextEntry={!showConfirmPassword}
                showToggle
                onToggle={toggleConfirmPasswordVisibility}
                isPasswordVisible={showConfirmPassword}
                error={!!confirmPasswordError}
                errorMessage={confirmPasswordError || undefined}
              />

              {/* Sign Up Button */}
              <TouchableOpacity 
                style={[styles.button, isLoading && styles.buttonDisabled]} 
                onPress={handleSignUp}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#6BBD5E" />
                ) : (
                  <ThemedText style={styles.buttonText}>Criar Conta</ThemedText>
                )}
              </TouchableOpacity>

              {/* Already have account link */}
              <TouchableOpacity 
                onPress={navigateToSignIn}
                style={styles.linkContainer}
              >
                <ThemedText style={styles.linkText}>
                  Já tem uma conta? <ThemedText style={styles.linkTextBold}>Entrar</ThemedText>
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
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
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
