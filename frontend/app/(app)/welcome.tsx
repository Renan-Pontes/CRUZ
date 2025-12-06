import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@/auth/ctx";
import { useBasicUserInfo } from "@/hooks/useBasicUserInfo";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Imagem do Capsulim - ajuste o caminho conforme sua estrutura
const capsulimBg = require("../../assets/images/Ativo_43.png");

export default function WelcomeScreen() {
  const { session } = useSession();
  const { info } = useBasicUserInfo();

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Redireciona se não tiver sessão
    if (!session) {
      router.replace("/sign-in");
      return;
    }

    // Sequência de animações na entrada
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(bubbleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [session]);

  const handleContinue = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.replace("/(app)/trail");
    });
  };

  // Pega nome do usuário
  const displayName = info.username || info.email?.split("@")[0] || "Colaborador";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Background com o Capsulim */}
      <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
        <Image
          source={capsulimBg}
          style={styles.backgroundImage}
          resizeMode="cover"
        />

        {/* Gradiente sutil no topo para legibilidade */}
        <LinearGradient
          colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,0.7)", "transparent"]}
          style={styles.topGradient}
        />
      </Animated.View>

      {/* Balão de fala do Capsulim */}
      <Animated.View
        style={[
          styles.speechBubbleContainer,
          {
            opacity: bubbleAnim,
            transform: [
              { scale: bubbleAnim },
              {
                translateY: bubbleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.speechBubble}>
          <Text style={styles.greetingText}>Olá, {displayName}! 👋</Text>
          <Text style={styles.welcomeText}>Bem-vindo ao treinamento!</Text>
          <Text style={styles.subText}>
            Estou aqui para te ajudar a aprender sobre medicamentos de forma divertida.
          </Text>
          <View style={styles.bubbleArrow} />
        </View>
      </Animated.View>

      {/* Área inferior com botão */}
      <Animated.View
        style={[
          styles.bottomArea,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.bottomContent}>
          <View style={styles.progressInfo}>
            <View style={styles.progressDot} />
            <Text style={styles.progressText}>Pronto para começar?</Text>
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#2D9CDB", "#1A7BBD"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Vamos lá!</Text>
              <Text style={styles.buttonIcon}>→</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerText}>A2 Segurança • Treinamento de Medicamentos</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  imageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  speechBubbleContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.08,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  speechBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    paddingBottom: 24,
    shadowColor: "#1A5276",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    maxWidth: 340,
    borderWidth: 2,
    borderColor: "rgba(45, 156, 219, 0.2)",
  },
  bubbleArrow: {
    position: "absolute",
    bottom: -12,
    left: "50%",
    marginLeft: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A5276",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2D9CDB",
    marginBottom: 8,
    textAlign: "center",
  },
  subText: {
    fontSize: 14,
    color: "#5D6D7E",
    textAlign: "center",
    lineHeight: 20,
  },
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomContent: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    shadowColor: "#1A5276",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  progressInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#27AE60",
    marginRight: 8,
  },
  progressText: {
    fontSize: 14,
    color: "#5D6D7E",
    fontWeight: "500",
  },
  continueButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2D9CDB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 8,
  },
  buttonIcon: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  footerText: {
    fontSize: 12,
    color: "#95A5A6",
    textAlign: "center",
    marginTop: 20,
  },
});