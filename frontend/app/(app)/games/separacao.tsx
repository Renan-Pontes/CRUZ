import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSession } from "@/auth/ctx";
import { apiService, SeparacaoAttempt } from "@/services/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// background da cestinha
const cestinhaBg = require("../../../assets/images/cESTINHA.png");

// Tipo para coordenadas absolutas da tela
type AbsoluteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DropZones = {
  [key: string]: AbsoluteRect | null;
};

export default function SeparacaoScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: string }>();
  const { session } = useSession();

  const [attempt, setAttempt] = useState<SeparacaoAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [autoNavigated, setAutoNavigated] = useState(false);

  // Coordenadas absolutas das cestas (medidas com measureInWindow)
  const [dropZones, setDropZones] = useState<DropZones>({ A: null, B: null, C: null });

  const categories = ["A", "B", "C"];

  const currentMed = attempt?.medications?.[attempt.current_index];

  // Refs para as cestas (para medir posição absoluta)
  const basketRefs = useRef<{ [key: string]: View | null }>({ A: null, B: null, C: null });

  // Animação de arrastar
  const pan = useRef(new Animated.ValueXY()).current;
  const panOffset = useRef({ x: 0, y: 0 });

  // Refs para acessar estado atual dentro do PanResponder
  const submittingRef = useRef(submitting);
  const completedRef = useRef(completed);
  const dropZonesRef = useRef(dropZones);

  // Manter refs sincronizadas
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  useEffect(() => {
    dropZonesRef.current = dropZones;
  }, [dropZones]);

  const resetDragPosition = () => {
    pan.setValue({ x: 0, y: 0 });
    panOffset.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    resetDragPosition();
    setFeedback(null);
  }, [currentMed?.id]);

  // Função para medir posição absoluta de uma cesta
  const measureBasket = (cat: string) => {
    const ref = basketRefs.current[cat];
    if (ref) {
      ref.measureInWindow((x, y, width, height) => {
        if (typeof x === "number" && typeof y === "number") {
          console.log(`Cesta ${cat} medida:`, { x, y, width, height });
          setDropZones((prev) => ({
            ...prev,
            [cat]: { x, y, width, height },
          }));
        }
      });
    }
  };

  // Medir todas as cestas após o layout
  const measureAllBaskets = () => {
    // Pequeno delay para garantir que o layout está pronto
    setTimeout(() => {
      categories.forEach((cat) => measureBasket(cat));
    }, 100);
  };

  // Função para processar a resposta
  const handleAnswerRef = useRef<(cat: string) => void>(() => {});

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          return !submittingRef.current && !completedRef.current;
        },
        onMoveShouldSetPanResponder: () => {
          return !submittingRef.current && !completedRef.current;
        },
        onPanResponderGrant: () => {
          pan.setOffset({
            x: panOffset.current.x,
            y: panOffset.current.y,
          });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: (evt, gesture) => {
          panOffset.current = {
            x: panOffset.current.x + gesture.dx,
            y: panOffset.current.y + gesture.dy,
          };
          pan.flattenOffset();

          // Posição ABSOLUTA do dedo na tela
          const dropX = gesture.moveX;
          const dropY = gesture.moveY;

          console.log("Drop em:", { dropX, dropY });
          console.log("Zonas:", dropZonesRef.current);

          let chosenCat: string | null = null;
          const zones = dropZonesRef.current;

          // Verifica se caiu em alguma cesta (usando coordenadas absolutas)
          for (const cat of ["A", "B", "C"]) {
            const zone = zones[cat];
            if (!zone) {
              console.log(`Zona ${cat} não medida ainda`);
              continue;
            }
            
            const inX = dropX >= zone.x && dropX <= zone.x + zone.width;
            const inY = dropY >= zone.y && dropY <= zone.y + zone.height;
            
            console.log(`Cesta ${cat}: inX=${inX}, inY=${inY}`, zone);
            
            if (inX && inY) {
              chosenCat = cat;
              break;
            }
          }

          if (chosenCat) {
            console.log("Escolheu categoria:", chosenCat);
            handleAnswerRef.current(chosenCat);
          } else {
            console.log("Não caiu em nenhuma cesta, voltando...");
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start(() => {
              panOffset.current = { x: 0, y: 0 };
            });
          }
        },
      }),
    []
  );

  const loadAttempt = async (reset = false) => {
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    setLoading(true);
    setFeedback(null);
    setCompleted(false);
    try {
      const data = await apiService.startSeparacao(session, reset);
      if (!data.medications || data.medications.length === 0) {
        Alert.alert("Sem medicamentos", "Nenhum medicamento disponível para separar.");
        setAttempt(null);
        return;
      }
      setAttempt({ ...data, attempt_id: (data as any).attempt_id ?? (data as any).id });
    } catch (e) {
      console.log("Erro ao iniciar separação", e);
      Alert.alert("Erro", "Não foi possível carregar o desafio de separação.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttempt(false);
  }, [session]);

  useEffect(() => {
    if ((attempt as any)?.completed && !autoNavigated) {
      setCompleted(true);
      setAutoNavigated(true);
      setTimeout(() => router.replace("/(app)/trail"), 900);
    }
  }, [attempt, autoNavigated]);

  const handleAnswer = async (cat: string) => {
    if (!attempt || !session || submitting || completed || (attempt as any).completed) return;
    if (!currentMed?.id) {
      Alert.alert("Concluído", "Exercício finalizado. Voltando para a trilha.");
      setCompleted(true);
      router.replace("/(app)/trail");
      return;
    }
    setSubmitting(true);
    try {
      const expected = currentMed?.category || "";
      const chosenCategory = expected && expected.startsWith(cat) ? expected : expected;
      const attemptId = (attempt as any).attempt_id ?? (attempt as any).id;
      const res = await apiService.submitSeparacaoAnswer(
        session,
        attemptId,
        chosenCategory || cat,
        moduleId ? Number(moduleId) : undefined,
        currentMed.id
      );
      const nextIndex = typeof res.index === "number" ? res.index : attempt.current_index + 1;
      const updated: SeparacaoAttempt = {
        ...attempt,
        current_index: nextIndex,
        correct_count: attempt.correct_count + (res.correct ? 1 : 0),
        total_count: attempt.total_count,
        completed: res.completed,
      } as any;
      setFeedback(
        res.correct
          ? "✓ Acertou!"
          : `✗ Errado. Categoria correta: ${res.correct_category || expected}`
      );
      if (res.completed) {
        setCompleted(true);
        setAttempt(updated);
        if (!autoNavigated) {
          setAutoNavigated(true);
          setTimeout(() => router.replace("/(app)/trail"), 900);
        }
        Alert.alert("Finalizado!", `Pontuação: ${res.final_score ?? res.xp_earned ?? 0}`, [
          { text: "Voltar para trilha", onPress: () => router.replace("/(app)/trail") },
        ]);
      } else {
        setAttempt(updated);
        resetDragPosition();
      }
    } catch (e) {
      console.log("Erro ao responder", e);
      Alert.alert("Erro", "Não foi possível enviar sua resposta.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  });

  if (loading || !attempt) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FFD166" size="large" />
        <Text style={styles.loadingText}>Carregando desafio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={measureAllBaskets}>
      {/* Background */}
      <Image
        source={cestinhaBg}
        style={styles.bg}
        resizeMode="contain"
      />

      {/* Conteúdo */}
      <View style={styles.overlay}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            disabled={submitting}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Separação</Text>
          <TouchableOpacity
            onPress={() => loadAttempt(true)}
            style={styles.resetButton}
            disabled={submitting}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* INFO DO MEDICAMENTO */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.label}>Medicamento</Text>
            <Text style={styles.medName}>{currentMed?.name || "—"}</Text>
            <Text style={styles.subLabel}>
              {attempt.current_index + 1}/{attempt.total_count}
            </Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Acertos</Text>
            <Text style={styles.scoreValue}>{attempt.correct_count}</Text>
          </View>
        </View>

        {/* ÁREA DE JOGO */}
        <View style={styles.gameArea}>
          {/* INSTRUÇÃO */}
          <Text style={styles.instruction}>
            Arraste o medicamento até a cesta da categoria correta.
          </Text>

          {/* ÁREA DO REMÉDIO ARRASTÁVEL */}
          <View style={styles.draggableArea}>
            <Animated.View
              style={[
                styles.draggable,
                {
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <View style={styles.draggableInner}>
                <Text style={styles.draggableText}>
                  {currentMed?.name || "Medicamento"}
                </Text>
              </View>
            </Animated.View>
          </View>

          {/* CESTAS - com refs para medir posição absoluta */}
          <View style={styles.basketsRow}>
            {categories.map((cat) => (
              <View
                key={cat}
                ref={(ref) => {
                  basketRefs.current[cat] = ref;
                }}
                style={styles.basketBox}
                onLayout={() => measureBasket(cat)}
              >
                <Text style={styles.basketLabel}>Categoria {cat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FEEDBACK */}
        {feedback && (
          <View
            style={[
              styles.feedback,
              feedback.includes("Acertou") ? styles.feedbackCorrect : styles.feedbackWrong,
            ]}
          >
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#243241",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#fff", marginTop: 12 },

  root: {
    flex: 1,
    backgroundColor: "#243241",
  },

  bg: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    bottom: 0,
    left: 0,
  },

  overlay: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
  },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  backText: { color: "#fff", fontWeight: "700" },
  resetText: { color: "#FFD166", fontWeight: "700" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  infoBox: {
    flex: 1.5,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    padding: 12,
  },
  scoreBox: {
    flex: 0.8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  medName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  subLabel: { color: "rgba(255,255,255,0.7)", marginTop: 6 },
  scoreLabel: { color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  scoreValue: { color: "#FFD166", fontSize: 20, fontWeight: "800" },

  gameArea: {
    flex: 1,
    justifyContent: "space-between",
  },

  instruction: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },

  draggableArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  draggable: {},
  draggableInner: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    minWidth: SCREEN_WIDTH * 0.6,
  },
  draggableText: {
    color: "#243241",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },

  basketsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 24,
  },
  basketBox: {
    width: SCREEN_WIDTH * 0.27,
    height: 90,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  basketLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },

  feedback: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 10,
  },
  feedbackCorrect: {
    backgroundColor: "rgba(39, 174, 96, 0.85)",
  },
  feedbackWrong: {
    backgroundColor: "rgba(192, 57, 43, 0.85)",
  },
  feedbackText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
});