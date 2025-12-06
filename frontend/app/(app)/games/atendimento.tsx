// app/(app)/games/atendimento.tsx

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  ImageBackground,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSession } from "@/auth/ctx";
import { apiService } from "@/services/api";
import { useStorageState } from "../../useStorageState";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Imagem do Capsulim (Ativo_14) usada como background
const capsulimImg = require("../../../assets/images/Ativo_14.png");

type Message = {
  id: string;
  type: "capsulim" | "user" | "system" | "feedback";
  text: string;
  timestamp: Date;
  score?: number;
  xp?: number;
};

export default function AtendimentoScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: string }>();
  const { session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [[, localCompletedRaw], setLocalCompleted] = useStorageState("localCompletionsCount");

  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animação de entrada das primeiras mensagens
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Scroll automático para o final
  const scrollToEnd = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    const load = async () => {
      if (!session) {
        router.replace("/sign-in");
        return;
      }
      setLoading(true);
      setCompleted(false);
      setMessages([]);
      try {
        const res = await apiService.getAtendimento(session);
        setData(res);

        // Capsulim apresenta o cenário
        const capsulimMessage: Message = {
          id: "capsulim-1",
          type: "capsulim",
          text: `Temos um cliente aqui na farmácia. Veja a situação:\n\n"${res.customer_scenario}"\n\nComo você responderia a esse cliente?`,
          timestamp: new Date(),
        };

        setMessages([capsulimMessage]);
      } catch (e) {
        console.log("Erro ao carregar atendimento", e);
        Alert.alert("Erro", "Não foi possível carregar o caso de atendimento.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session]);

  const handleSubmit = async () => {
    if (!session || !data?.challenge_id || submitting) return;
    if (completed) {
      Alert.alert("Aviso", "Você já enviou este exercício.");
      return;
    }
    if (!answer.trim()) {
      Alert.alert("Aviso", "Digite sua resposta antes de enviar.");
      return;
    }

    // Adiciona mensagem do usuário
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      text: answer.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setAnswer("");
    scrollToEnd();

    setSubmitting(true);

    try {
      const res = await apiService.submitAtendimento(
        session,
        Number(data.challenge_id),
        userMessage.text,
        {
          moduleId: moduleId ? Number(moduleId) : undefined,
          scenario: data.customer_scenario,
          contextType: data.context_type,
        }
      );

      // Feedback do Capsulim
      const feedbackMessage: Message = {
        id: `feedback-${Date.now()}`,
        type: "feedback",
        text: res.feedback,
        timestamp: new Date(),
        score: res.score,
        xp: res.xp_earned,
      };
      setMessages((prev) => [...prev, feedbackMessage]);
      scrollToEnd();

      const current = parseInt(localCompletedRaw || "0", 10) || 0;
      setLocalCompleted(String(current + 1));
      setCompleted(true);

      // Auto-retorno após delay
      setTimeout(() => router.replace("/(app)/trail"), 4000);
    } catch (e) {
      console.log("Erro ao enviar atendimento", e);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: "system",
        text: "Ops! Algo deu errado. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      scrollToEnd();

      Alert.alert("Erro", "Não foi possível enviar sua resposta.");
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 90) return "🌟";
    if (score >= 80) return "😄";
    if (score >= 60) return "👍";
    if (score >= 40) return "🤔";
    return "😅";
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return "Excelente!";
    if (score >= 80) return "Muito bom!";
    if (score >= 60) return "Bom trabalho!";
    if (score >= 40) return "Pode melhorar";
    return "Tente novamente";
  };

  const renderMessage = (message: Message, index: number) => {
    switch (message.type) {
      case "system":
        return (
          <View key={message.id} style={styles.systemMessageContainer}>
            <Text style={styles.systemMessageText}>{message.text}</Text>
          </View>
        );

      case "capsulim":
        return (
          <Animated.View
            key={message.id}
            style={[
              styles.capsulimMessageContainer,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateX: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.capsulimBubble}>
              <View style={styles.capsulimHeader}>
                <Text style={styles.capsulimEmoji}>💊</Text>
                <Text style={styles.capsulimName}>Capsulim</Text>
              </View>
              <Text style={styles.capsulimText}>{message.text}</Text>
              <View style={styles.bubbleArrowLeft} />
            </View>
          </Animated.View>
        );

      case "user":
        return (
          <View key={message.id} style={styles.userMessageContainer}>
            <View style={styles.userBubble}>
              <View style={styles.userHeader}>
                <Text style={styles.userName}>Você</Text>
                <Text style={styles.userEmoji}>🧑‍⚕️</Text>
              </View>
              <Text style={styles.userText}>{message.text}</Text>
              <View style={styles.bubbleArrowRight} />
            </View>
          </View>
        );

      case "feedback":
        return (
          <View key={message.id} style={styles.feedbackContainer}>
            {/* Score Card */}
            <View style={styles.scoreCard}>
              <Text style={styles.scoreEmoji}>{getScoreEmoji(message.score || 0)}</Text>
              <View style={styles.scoreInfo}>
                <Text style={styles.scoreLabel}>{getScoreMessage(message.score || 0)}</Text>
                <View style={styles.scoreRow}>
                  <View
                    style={[
                      styles.scoreBadge,
                      (message.score || 0) >= 80
                        ? styles.scoreHigh
                        : (message.score || 0) >= 50
                        ? styles.scoreMedium
                        : styles.scoreLow,
                    ]}
                  >
                    <Text style={styles.scoreText}>{message.score} pts</Text>
                  </View>
                  {message.xp && (
                    <View style={styles.xpBadge}>
                      <Text style={styles.xpText}>+{message.xp} XP</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Feedback do Capsulim */}
            <View style={styles.feedbackBubble}>
              <View style={styles.capsulimHeader}>
                <Text style={styles.capsulimEmoji}>💊</Text>
                <Text style={styles.capsulimName}>Avaliação do Capsulim</Text>
              </View>
              <Text style={styles.feedbackText}>{message.text}</Text>
            </View>

            {/* Botão voltar */}
            <TouchableOpacity
              style={styles.backToTrailButton}
              onPress={() => router.replace("/(app)/trail")}
            >
              <Text style={styles.backToTrailText}>Voltar para Trilha</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  if (loading || !data) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={capsulimImg} style={styles.loadingImage} resizeMode="contain" />
        <ActivityIndicator color="#87dbba" size="large" style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Preparando atendimento...</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={capsulimImg}
      style={styles.fullBackground}
      resizeMode="cover" // cobre a tela toda
    >
      {/* Overlay esbranquiçado, agora mais transparente (0.2) */}
      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            disabled={submitting}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🏥 Farmácia</Text>
            <Text style={styles.headerSubtitle}>Simulação de Atendimento</Text>
          </View>
          <View style={styles.contextBadge}>
            <Text style={styles.contextText}>{data.context_type || "Balcão"}</Text>
          </View>
        </View>

        {/* Chat Area */}
        <View style={styles.chatArea}>
          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
          >
            {messages.map((msg, idx) => renderMessage(msg, idx))}
          </ScrollView>
        </View>

        {/* Input Area */}
        {!completed && (
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  multiline
                  placeholder="Como você responderia ao cliente?"
                  placeholderTextColor="rgba(0,0,0,0.4)"
                  value={answer}
                  onChangeText={setAnswer}
                  editable={!submitting}
                  maxLength={1000}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!answer.trim() || submitting) && styles.sendButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!answer.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHint}>
              💡 Responda como se estivesse atendendo o cliente pessoalmente
            </Text>
          </View>
        )}

        {/* Completed Bar */}
        {completed && (
          <View style={styles.completedBar}>
            <Text style={styles.completedEmoji}>✅</Text>
            <View>
              <Text style={styles.completedText}>Atendimento concluído!</Text>
              <Text style={styles.completedSubtext}>Voltando para trilha...</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // Background geral
  fullBackground: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232, 245, 233, 0.2)", // mais transparente pra ver o fundo
  },

  keyboardView: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
  },
  loadingImage: {
    width: 150,
    height: 200,
    opacity: 0.8,
  },
  loadingText: {
    color: "#2E7D32",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(46, 125, 50, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(46, 125, 50, 0.1)",
    borderRadius: 10,
  },
  backText: {
    color: "#2E7D32",
    fontWeight: "600",
    fontSize: 14,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#1B5E20",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#66BB6A",
    fontSize: 11,
    marginTop: 2,
  },
  contextBadge: {
    backgroundColor: "#C8E6C9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  contextText: {
    color: "#2E7D32",
    fontSize: 12,
    fontWeight: "600",
  },

  // Chat Area
  chatArea: {
    flex: 1,
    position: "relative",
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 120,
  },

  // System message
  systemMessageContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  systemMessageText: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },

  // Capsulim message
  capsulimMessageContainer: {
    marginBottom: 16,
    marginRight: 40,
  },
  capsulimBubble: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderTopLeftRadius: 6,
    padding: 16,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(46, 125, 50, 0.15)",
  },
  capsulimHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  capsulimEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  capsulimName: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "700",
  },
  capsulimText: {
    color: "#333",
    fontSize: 15,
    lineHeight: 24,
  },
  bubbleArrowLeft: {
    position: "absolute",
    top: 16,
    left: -8,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#fff",
  },

  // User message
  userMessageContainer: {
    marginBottom: 16,
    marginLeft: 40,
    alignItems: "flex-end",
  },
  userBubble: {
    backgroundColor: "#2E7D32",
    borderRadius: 20,
    borderTopRightRadius: 6,
    padding: 16,
    maxWidth: "100%",
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  userName: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 6,
  },
  userEmoji: {
    fontSize: 14,
  },
  userText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleArrowRight: {
    position: "absolute",
    top: 16,
    right: -8,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#2E7D32",
  },

  // Feedback
  feedbackContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scoreEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    color: "#333",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scoreBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scoreHigh: {
    backgroundColor: "#4CAF50",
  },
  scoreMedium: {
    backgroundColor: "#FF9800",
  },
  scoreLow: {
    backgroundColor: "#f44336",
  },
  scoreText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  xpBadge: {
    backgroundColor: "#FFD166",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpText: {
    color: "#1a3a2f",
    fontSize: 14,
    fontWeight: "700",
  },
  feedbackBubble: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "#C8E6C9",
  },
  feedbackText: {
    color: "#333",
    fontSize: 14,
    lineHeight: 22,
  },
  backToTrailButton: {
    marginTop: 16,
    backgroundColor: "#2E7D32",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  backToTrailText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Input
  inputContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "rgba(46, 125, 50, 0.1)",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  textInput: {
    color: "#333",
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  inputHint: {
    color: "#666",
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
  },

  // Completed
  completedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    gap: 12,
  },
  completedEmoji: {
    fontSize: 24,
  },
  completedText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  completedSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
});
