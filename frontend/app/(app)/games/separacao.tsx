import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ChallengeScaffold } from "@/components/game/ChallengeScaffold";
import { useBasicUserInfo } from "@/hooks/useBasicUserInfo";

export default function SeparacaoScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: string }>();
  const { info } = useBasicUserInfo();

  return (
    <ChallengeScaffold
      title="Separação de Medicamentos"
      subtitle="Classifique rapidamente cada medicamento na categoria correta."
      emoji="💊"
      infoList={[
        "Arraste ou toque para enviar o medicamento à categoria certa.",
        "Atenção às cores e classes terapêuticas para acelerar.",
        "Quanto mais acertos em sequência, maior o combo de XP.",
      ]}
      highlight={moduleId ? `Módulo #${moduleId}` : undefined}
      ctaLabel="Começar separação"
      userInfo={info}
      onStart={() =>
        router.push({
          pathname: "/(app)/task",
          params: { challengeType: "separacao", moduleId: moduleId?.toString() },
        })
      }
      footerSlot={
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Dica rápida</Text>
          <Text style={styles.tipText}>
            Foque primeiro nas categorias mais comuns. Errar três vezes seguidas quebra a sequência de pontuação.
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
