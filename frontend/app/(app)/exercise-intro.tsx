import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useBasicUserInfo } from "@/hooks/useBasicUserInfo";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Imagem do Capsulim
const capsulimBg = require("../../assets/images/Ativo_43.png");

// Tipos de exercício e suas dicas
const EXERCISE_TIPS: Record<string, { title: string; tips: string[]; icon: string }> = {
  separacao: {
    title: "Separação de Medicamentos",
    icon: "🧺",
    tips: [
      "Arraste cada medicamento para a cesta correta",
      "Categoria A: Medicamentos de alta vigilância",
      "Categoria B: Medicamentos comuns",
      "Categoria C: Medicamentos controlados",
      "Preste atenção no nome do medicamento!",
    ],
  },
  find_errors: {
    title: "Encontre os Erros",
    icon: "📄",
    tips: [
      "Analise a receita com atenção",
      "Toque nos pontos com inconsistências",
      "Verifique carimbo, posologia e identificação",
      "Cada acerto marca pontos, erros reduzem",
      "Complete para ganhar XP!",
    ],
  },
  atendimento: {
    title: "Atendimento ao Cliente",
    icon: "🧠",
    tips: [
      "Leia o cenário do cliente com atenção",
      "Pense na melhor resposta profissional",
      "Seja claro e objetivo na sua resposta",
      "A IA vai avaliar sua resposta",
      "Quanto melhor a resposta, mais pontos!",
    ],
  },
  default: {
    title: "Novo Exercício",
    icon: "💊",
    tips: [
      "Siga as instruções na tela",
      "Preste atenção nos detalhes",
      "Você pode tentar novamente se errar",
      "Boa sorte!",
    ],
  },
};

export default function ExerciseIntroScreen() {
  const params = useLocalSearchParams<{
    type?: string;
    moduleId?: string;
    name?: string;
  }>();

  const { info } = useBasicUserInfo();

  const type = params.type || "default";
  const exerciseData = EXERCISE_TIPS[type] || EXERCISE_TIPS.default;

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  // Estado para animar as dicas uma por uma
  const [visibleTips, setVisibleTips] = useState<number[]>([]);

  useEffect(() => {
    // Sequência de animações
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(bubbleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Anima as dicas uma por uma
      exerciseData.tips.forEach((_, index) => {
        setTimeout(() => {
          setVisibleTips((prev) => [...prev, index]);
        }, index * 200);
      });

      // Mostra o botão após as dicas
      setTimeout(() => {
        Animated.spring(buttonAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }).start();
      }, exerciseData.tips.length * 200 + 300);
    });
  }, []);

  const handleStart = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navega para o exercício correspondente
      const routeMap: Record<string, string> = {
        separacao: "/(app)/games/separacao",
        find_errors: "/(app)/games/find-errors",
        atendimento: "/(app)/games/atendimento",
      };
      const route = routeMap[type] || "/(app)/trail";
      router.replace({
        pathname: route as any,
        params: { moduleId: params.moduleId },
      });
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Background com o Capsulim */}
      <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
        <Image source={capsulimBg} style={styles.backgroundImage} resizeMode="cover" />
        <View style={styles.overlay} />
      </Animated.View>

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Nv.{info.level}</Text>
        </View>
      </Animated.View>

      {/* Balão de fala com dicas */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: bubbleAnim,
            transform: [
              {
                scale: bubbleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.speechBubble}>
          {/* Ícone e título */}
          <View style={styles.titleRow}>
            <Text style={styles.titleIcon}>{exerciseData.icon}</Text>
            <Text style={styles.titleText}>{params.name || exerciseData.title}</Text>
          </View>

          <View style={styles.divider} />

          {/* Capsulim falando */}
          <Text style={styles.capsulimSays}>💬 Dicas do Capsulim:</Text>

          {/* Lista de dicas */}
          <ScrollView style={styles.tipsContainer} showsVerticalScrollIndicator={false}>
            {exerciseData.tips.map((tip, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.tipRow,
                  {
                    opacity: visibleTips.includes(index) ? 1 : 0,
                    transform: [
                      {
                        translateX: visibleTips.includes(index) ? 0 : 20,
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>{index + 1}</Text>
                </View>
                <Text style={styles.tipText}>{tip}</Text>
              </Animated.View>
            ))}
          </ScrollView>

          {/* Seta do balão */}
          <View style={styles.bubbleArrow} />
        </View>
      </Animated.View>

      {/* Botão de começar */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            opacity: buttonAnim,
            transform: [
              {
                translateY: buttonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
              {
                scale: buttonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.85}>
          <LinearGradient
            colors={["#27AE60", "#1E8449"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Começar Exercício</Text>
            <Text style={styles.buttonIcon}>▶</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.encourageText}>Você consegue! 💪</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F6F3",
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backButton: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A5276",
  },
  levelBadge: {
    backgroundColor: "#87dbba",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  levelText: {
    color: "#1a3a2f",
    fontWeight: "700",
    fontSize: 14,
  },
  contentContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.12,
    left: 16,
    right: 16,
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  speechBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#1A5276",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: "rgba(39, 174, 96, 0.2)",
  },
  bubbleArrow: {
    position: "absolute",
    bottom: -14,
    right: 60,
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  titleIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A5276",
    flex: 1,
  },
  divider: {
    height: 2,
    backgroundColor: "rgba(39, 174, 96, 0.2)",
    borderRadius: 1,
    marginBottom: 16,
  },
  capsulimSays: {
    fontSize: 14,
    fontWeight: "600",
    color: "#27AE60",
    marginBottom: 12,
  },
  tipsContainer: {
    maxHeight: SCREEN_HEIGHT * 0.22,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingRight: 8,
  },
  tipBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E8F8F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tipBulletText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#27AE60",
  },
  tipText: {
    fontSize: 14,
    color: "#34495E",
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
  },
  startButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#27AE60",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
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
    marginRight: 10,
  },
  buttonIcon: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  encourageText: {
    fontSize: 14,
    color: "#5D6D7E",
    textAlign: "center",
    marginTop: 16,
    fontWeight: "500",
  },
});