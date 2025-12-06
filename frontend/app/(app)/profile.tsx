import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { apiService, Badge } from "@/services/api";
import { useBasicUserInfo } from "@/hooks/useBasicUserInfo";
import { useSession } from "@/auth/ctx";

type LeaderboardItem = {
  id: number | string;
  name: string;
  score: number;
  position: number;
  trend?: string;
  isYou?: boolean;
};

export default function ProfileScreen() {
  const { info, loadingInfo } = useBasicUserInfo();
  const { session } = useSession();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        try {
          const profile = await apiService.getProfile(session);
          setBadges(profile.awarded_badges || []);
        } catch (e) {
          console.log("Falha ao buscar badges", e);
        }

        try {
          const raw: any = await apiService.getLeaderboard(session);
          const items = Array.isArray(raw) ? raw : raw?.results || [];
          const youId = Array.isArray(raw)
            ? null
            : raw?.you?.user?.id ?? raw?.you?.user_id ?? null;

          const parsed: LeaderboardItem[] = items.map((entry: any) => ({
            id: entry.user?.id ?? entry.user_id ?? entry.id,
            name: entry.user?.username ?? entry.username ?? "Aluno",
            score: entry.score ?? entry.experience_points ?? entry.xp ?? 0,
            position: entry.position ?? entry.rank ?? 0,
            trend: entry.trend,
            isYou: youId
              ? (entry.user?.id ?? entry.user_id ?? entry.id) === youId
              : false,
          }));

          setLeaderboard(parsed);
        } catch (e) {
          console.log("Falha ao buscar leaderboard", e);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session]);

  const totalXP = info.xp;
  const level = info.level;
  const streak = info.streak;
  const badgeCount = badges.length;
  const displayName = info.username || info.email || "Aluno";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Olá,</Text>
              <Text style={styles.cardSubtitle}>{displayName}</Text>
            </View>
            <View style={styles.levelPill}>
              <Text style={styles.levelText}>Nv.{level}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatBubble label="XP" value={totalXP.toString()} />
            <StatBubble label="Streak" value={`${streak} 🔥`} />
            <StatBubble label="Badges" value={`${badgeCount} 🏅`} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          {loading || loadingInfo ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator color="#FFD166" />
              <Text style={styles.loaderText}>Carregando ranking...</Text>
            </View>
          ) : leaderboard.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados de ranking ainda.</Text>
          ) : (
            leaderboard.map((entry) => (
              <View
                key={`${entry.id}-${entry.position}`}
                style={[
                  styles.leaderRow,
                  entry.isYou && styles.leaderRowYou,
                  entry.position <= 3 && styles.leaderRowTop,
                ]}
              >
                <View style={styles.leaderLeft}>
                  <Text style={styles.leaderPosition}>#{entry.position}</Text>
                  <View>
                    <Text style={styles.leaderName}>{entry.name}</Text>
                    <Text style={styles.leaderScore}>{entry.score} pts</Text>
                  </View>
                </View>
                {entry.trend && (
                  <Text
                    style={[
                      styles.trendText,
                      entry.trend === "up" && styles.trendUp,
                      entry.trend === "down" && styles.trendDown,
                    ]}
                  >
                    {entry.trend === "up" ? "↑" : entry.trend === "down" ? "↓" : "→"}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Badges</Text>
          {badges.length === 0 ? (
            <Text style={styles.emptyText}>Ainda sem badges. Bora jogar!</Text>
          ) : (
            <View style={styles.badgeGrid}>
              {badges.map((badge) => (
                <View key={badge.id} style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>🏅</Text>
                  <Text style={styles.badgeName} numberOfLines={1}>
                    {badge.name}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>
                    {badge.description}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatBubble({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBubble}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: 4,
  },
  levelPill: {
    backgroundColor: "#87dbba",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelText: {
    color: "#1a3a2f",
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statBubble: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  statValue: {
    color: "#FFD166",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loaderText: {
    color: "rgba(255,255,255,0.8)",
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 8,
  },
  leaderRowTop: {
    borderWidth: 1,
    borderColor: "rgba(255, 209, 102, 0.5)",
  },
  leaderRowYou: {
    backgroundColor: "rgba(135, 219, 186, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(135, 219, 186, 0.6)",
  },
  leaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  leaderPosition: {
    color: "#FFD166",
    fontWeight: "800",
    fontSize: 16,
  },
  leaderName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  leaderScore: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  trendText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  trendUp: {
    color: "#87dbba",
  },
  trendDown: {
    color: "#FF6B6B",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeItem: {
    width: "46%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
  },
  badgeIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  badgeName: {
    color: "#fff",
    fontWeight: "700",
    marginBottom: 4,
  },
  badgeDesc: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
});
