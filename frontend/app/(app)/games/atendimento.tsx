import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSession } from "@/auth/ctx";
import { apiService } from "@/services/api";
import { useStorageState } from "../../useStorageState";

export default function AtendimentoScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: string }>();
  const { session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; feedback: string; xp?: number } | null>(null);
  const [completed, setCompleted] = useState(false);
  const [[, localCompletedRaw], setLocalCompleted] = useStorageState("localCompletionsCount");

  useEffect(() => {
    const load = async () => {
      if (!session) {
        router.replace("/sign-in");
        return;
      }
      setLoading(true);
      setCompleted(false);
      setResult(null);
      setStatus(null);
      try {
        const res = await apiService.getAtendimento(session);
        setData(res);
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
      setStatus("Você já enviou este exercício.");
      return;
    }
    if (!answer.trim()) {
      Alert.alert("Aviso", "Digite sua resposta antes de enviar.");
      return;
    }
    setSubmitting(true);
    setStatus("Enviando resposta...");
    setResult(null);
    try {
      const res = await apiService.submitAtendimento(
        session,
        Number(data.challenge_id),
        answer.trim(),
        {
          moduleId: moduleId ? Number(moduleId) : undefined,
          scenario: data.customer_scenario,
          contextType: data.context_type,
        }
      );
      const current = parseInt(localCompletedRaw || "0", 10) || 0;
      setLocalCompleted(String(current + 1));
      setStatus("Resposta enviada! Aguardando avaliação da IA...");
      setResult({ score: res.score, feedback: res.feedback, xp: res.xp_earned });
      setStatus("Avaliação concluída pela IA.");
      setCompleted(true);
      Alert.alert("Resposta enviada", `Score: ${res.score}\nFeedback: ${res.feedback}`, [
        { text: "Voltar para trilha", onPress: () => router.replace("/(app)/trail") },
      ]);
    } catch (e) {
      console.log("Erro ao enviar atendimento", e);
      const message = e instanceof Error ? e.message : "Não foi possível enviar sua resposta.";
      setStatus(message);
      Alert.alert("Erro", message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#FFD166" size="large" />
        <Text style={styles.loadingText}>Carregando caso...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Atendimento</Text>
        <TouchableOpacity onPress={() => setAnswer("")} style={styles.resetButton}>
          <Text style={styles.resetText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {status && (
          <View style={styles.statusBox}>
            {submitting && <ActivityIndicator color="#FFD166" style={{ marginRight: 8 }} />}
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Cenário</Text>
          <Text style={styles.text}>{data.customer_scenario}</Text>
          <Text style={styles.context}>Contexto: {data.context_type}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Sua resposta</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Digite aqui..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={answer}
            onChangeText={setAnswer}
          />
        </View>

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Resultado da IA</Text>
            <Text style={styles.resultScore}>Score: {result.score}</Text>
            {!!result.xp && <Text style={styles.resultScore}>XP ganho: {result.xp}</Text>}
            <Text style={styles.resultFeedback}>{result.feedback}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submit,
            (submitting || completed) && { opacity: 0.6 },
            completed && { backgroundColor: "#4caf50" },
          ]}
          disabled={submitting || completed}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>
            {completed ? "Enviado" : submitting ? "Enviando..." : "Enviar resposta"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#243241", padding: 16 },
  loadingText: { color: "#fff", marginTop: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
  content: { gap: 16 },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
  },
  label: { color: "rgba(255,255,255,0.7)", marginBottom: 6, fontWeight: "700" },
  text: { color: "#fff", lineHeight: 20, marginBottom: 8 },
  context: { color: "#FFD166", fontWeight: "700" },
  input: {
    minHeight: 140,
    color: "#fff",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    textAlignVertical: "top",
  },
  submit: {
    backgroundColor: "#87dbba",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: { color: "#1a3a2f", fontWeight: "800", fontSize: 16 },
  statusBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: { color: "#fff", fontWeight: "700" },
  resultBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  resultTitle: { color: "#FFD166", fontWeight: "800", fontSize: 15 },
  resultScore: { color: "#fff", fontWeight: "700" },
  resultFeedback: { color: "#fff", lineHeight: 20 },
});
