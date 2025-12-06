import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ChallengeScaffold } from "@/components/game/ChallengeScaffold";
import { useBasicUserInfo } from "@/hooks/useBasicUserInfo";

export default function FindErrorsScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: string }>();
  const { info } = useBasicUserInfo();

  return (
    <ChallengeScaffold
      title="Encontre os Erros"
      subtitle="Ache os itens incorretos da receita sem estourar o limite."
      emoji="📄"
      infoList={[
        "Toque nos pontos com inconsistências na receita.",
        "Cada acerto marca 1/7 erros. Erros extras reduzem a pontuação.",
        "Complete para ganhar XP e avançar para o próximo módulo.",
      ]}
      highlight={moduleId ? `Módulo #${moduleId}` : undefined}
      ctaLabel="Começar desafio"
      userInfo={info}
      onStart={() =>
        router.push({
          pathname: "/(app)/task",
          params: { challengeType: "find_errors", moduleId: moduleId?.toString() },
        })
      }
      footerSlot={
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Dica rápida</Text>
          <Text style={styles.tipText}>
            Campos obrigatórios como carimbo, posologia e identificação do paciente valem mais XP. Observe carimbos,
            assinatura e data.
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
