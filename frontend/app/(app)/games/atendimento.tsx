import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ChallengeScaffold } from "@/components/game/ChallengeScaffold";
import { useBasicUserInfo } from "@/hooks/useBasicUserInfo";

export default function AtendimentoScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: string }>();
  const { info } = useBasicUserInfo();

  return (
    <ChallengeScaffold
      title="Atendimento ao Cliente"
      subtitle="Responda o paciente com clareza, empatia e técnica."
      emoji="🧠"
      infoList={[
        "Leia o cenário e escreva uma resposta orientando o paciente.",
        "Use linguagem simples, clara e segura. Cite a posologia quando fizer sentido.",
        "Pontuação considera conteúdo, empatia e clareza.",
      ]}
      highlight={moduleId ? `Módulo #${moduleId}` : undefined}
      ctaLabel="Começar atendimento"
      userInfo={info}
      onStart={() =>
        router.push({
          pathname: "/(app)/task",
          params: { challengeType: "atendimento", moduleId: moduleId?.toString() },
        })
      }
      footerSlot={
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Dica rápida</Text>
          <Text style={styles.tipText}>
            Mencione sinais de alerta para encaminhar ao médico e reforce como usar o medicamento com segurança.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  tipCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tipTitle: {
    color: "#FFD166",
    fontWeight: "700",
    marginBottom: 6,
  },
  tipText: {
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
  },
});
