import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSession } from "@/auth/ctx";
import { apiService, SeparacaoAttempt } from "@/services/api";

export default function SeparacaoScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: string }>();
  const { session } = useSession();
  const [attempt, setAttempt] = useState<SeparacaoAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const categories = ["A", "B", "C"];

  const currentMed = attempt?.medications?.[attempt.current_index];

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

  const handleAnswer = async (cat: string) => {
    if (!attempt || !session || submitting || completed || (attempt as any).completed) return;
    setSubmitting(true);
    try {
      const expected = currentMed?.category || "";
      // Mapeia clique em A/B/C para a categoria completa do medicamento esperado
      const chosenCategory = expected && expected.startsWith(cat) ? expected : expected;
      const attemptId = (attempt as any).attempt_id ?? (attempt as any).id;
      const res = await apiService.submitSeparacaoAnswer(session, attemptId, chosenCategory || cat);
      const nextIndex = res.completed ? attempt.current_index : res.next_index;
      const updated: SeparacaoAttempt = {
        ...attempt,
        current_index: nextIndex,
        correct_count: attempt.correct_count + (res.correct ? 1 : 0),
        total_count: attempt.total_count,
        completed: res.completed,
      } as any;
      setFeedback(res.correct ? "Acertou!" : `Errado. Categoria correta: ${res.correct_category || expected}`);
      if (res.completed) {
        setCompleted(true);
        setAttempt(updated);
        Alert.alert("Finalizado!", `Pontuação: ${res.final_score ?? res.xp_earned ?? 0}`, [
          { text: "Voltar para trilha", onPress: () => router.replace("/(app)/trail") },
          { text: "Reiniciar", onPress: () => loadAttempt(true) },
        ]);
      } else {
        setAttempt(updated);
      }
    } catch (e) {
      console.log("Erro ao responder", e);
      Alert.alert("Erro", "Não foi possível enviar sua resposta.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !attempt) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#FFD166" size="large" />
        <Text style={styles.loadingText}>Carregando desafio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Separação</Text>
        <TouchableOpacity onPress={() => loadAttempt(true)} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Medicamento</Text>
        <Text style={styles.medName}>{currentMed?.name || "—"}</Text>
        <Text style={styles.subLabel}>
          {attempt.current_index + 1}/{attempt.total_count}
        </Text>
      </View>

      <View style={styles.options}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.optionBtn,
              submitting && styles.optionDisabled,
              (completed || (attempt as any).completed) && styles.optionDisabled,
            ]}
            disabled={submitting || completed || (attempt as any).completed}
            onPress={() => handleAnswer(cat)}
          >
            <Text style={styles.optionText}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {feedback && (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#243241", padding: 16 },
  loadingText: { color: "#fff", marginTop: 12 },
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
  card: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: { color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  medName: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subLabel: { color: "rgba(255,255,255,0.7)", marginTop: 6 },
  options: { gap: 10 },
  optionBtn: {
    backgroundColor: "#87dbba",
    padding: 14,
    borderRadius: 10,
  },
  optionDisabled: { opacity: 0.6 },
  optionText: { color: "#1a3a2f", fontWeight: "800", fontSize: 16, textAlign: "center" },
  feedback: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  feedbackText: { color: "#FFD166", fontWeight: "700" },
});
