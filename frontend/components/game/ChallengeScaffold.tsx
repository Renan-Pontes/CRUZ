import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { BasicUserInfo } from "@/hooks/useBasicUserInfo";

type Props = {
  title: string;
  subtitle: string;
  emoji: string;
  infoList: string[];
  ctaLabel: string;
  onStart: () => void;
  userInfo: BasicUserInfo;
  highlight?: string;
  footerSlot?: React.ReactNode;
};

export function ChallengeScaffold({
  title,
  subtitle,
  emoji,
  infoList,
  ctaLabel,
  onStart,
  userInfo,
  highlight,
  footerSlot,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity onPress={() => router.push("/(app)/profile")} style={styles.profileBtn}>
          <Text style={styles.profileText}>Perfil</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEmoji}>{emoji}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Nv.{userInfo.level}</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{subtitle}</Text>
          {highlight && <Text style={styles.cardHighlight}>{highlight}</Text>}
          <View style={styles.statsRow}>
            <Stat label="XP" value={userInfo.xp} />
            <Stat label="Streak" value={userInfo.streak} suffix=" 🔥" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Como funciona</Text>
          {infoList.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardAction}>
          <Text style={styles.sectionTitle}>Vamos nessa?</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onStart} activeOpacity={0.9}>
            <Text style={styles.primaryText}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>

        {footerSlot}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#364A5E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  backText: {
    color: "#fff",
    fontWeight: "600",
  },
  profileBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  profileText: {
    color: "#fff",
    fontWeight: "600",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardEmoji: {
    fontSize: 40,
  },
  levelBadge: {
    backgroundColor: "#87dbba",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelText: {
    color: "#1a3a2f",
    fontWeight: "700",
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cardHighlight: {
    color: "#FFD166",
    marginTop: 6,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  stat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 10,
  },
  statLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  statValue: {
    color: "#FFD166",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    color: "#FFD166",
    fontSize: 18,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
  },
  cardAction: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#87dbba",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: "100%",
  },
  primaryText: {
    color: "#1a3a2f",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },
});
