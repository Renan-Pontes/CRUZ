import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { apiService, Badge } from "@/services/api";
import { useBasicUserInfo } from "@/hooks/useBasicUserInfo";
import { useSession } from "@/auth/ctx";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Ajuste os caminhos aqui ⬇
const mascotImg = require("../../assets/images/mascote.png");
const farmBgImg = require("../../assets/images/FARM.png");

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

  const totalXP = info.xp ?? 0;
  const level = info.level ?? 1;
  const streak = info.streak ?? 0;
  const badgeCount = badges.length;
  const displayName = info.username || info.email || "Aluno";
  const firstLetter = displayName?.[0]?.toUpperCase?.() ?? "A";

  return (
    <View style={styles.root}>
      {/* 🌾 IMAGEM DE FUNDO AJUSTADA À TELA DO CELULAR */}
      <Image
        source={farmBgImg}
        style={styles.farmBg}
        resizeMode="contain"
      />

      {/* overlay branco para leitura */}
      <View style={styles.overlay}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={{ width: 72 }} />
        </View>

        {/* SCROLL */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* CARD DO PERFIL */}
          <View style={styles.profileCard}>
            {/* Hero com avatar */}
            <View style={styles.heroArea}>
              <View style={styles.heroBackground} />

              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>{firstLetter}</Text>
                </View>

                <View style={styles.levelTag}>
                  <Text style={styles.levelTagText}>{level}</Text>
                </View>
              </View>

              <View style={styles.namePill}>
                <Text style={styles.nameText}>{displayName}</Text>
              </View>
            </View>

            {/* Estatísticas */}
            <View style={styles.statsColumn}>
              <View style={styles.bigStatCard}>
                <Text style={styles.bigStatLabel}>Total de acertos</Text>
                <Text style={styles.bigStatValue}>{totalXP}</Text>
              </View>

              <View style={styles.bigStatCard}>
                <Text style={styles.bigStatLabel}>Total de desafios</Text>
                <Text style={styles.bigStatValue}>{streak}</Text>
              </View>
            </View>

            {/* Parte de baixo */}
            <View style={styles.bottomRow}>
              {/* Nível + mascote */}
              <View style={styles.levelBox}>
                <View style={styles.levelNumberBox}>
                  <Text style={styles.levelNumber}>{level}</Text>
                  <Text style={styles.levelLabel}>Nível</Text>
                </View>

                <View style={styles.mascotContainer}>
                  <Image
                    source={mascotImg}
                    style={styles.mascotImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              {/* Ranking */}
              <View style={styles.leaderboardBox}>
                <Text style={styles.sectionTitle}>Ranking</Text>

                {loading || loadingInfo ? (
                  <View style={styles.loaderRow}>
                    <ActivityIndicator color="#ffffff" />
                    <Text style={styles.loaderText}>Carregando...</Text>
                  </View>
                ) : leaderboard.length === 0 ? (
                  <Text style={styles.emptyText}>Sem dados de ranking ainda.</Text>
                ) : (
                  leaderboard.slice(0, 6).map((entry) => (
                    <View
                      key={`${entry.id}-${entry.position}`}
                      style={[
                        styles.leaderRow,
                        entry.isYou && styles.leaderRowYou,
                      ]}
                    >
                      <Text style={styles.leaderPosition}>
                        #{entry.position}
                      </Text>
                      <Text style={styles.leaderName}>{entry.name}</Text>
                      <View style={styles.leaderDivider} />
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>

          {/* BADGES */}
          <View style={styles.badgesCard}>
            <Text style={styles.badgesTitle}>Badges</Text>

            {badgeCount === 0 ? (
              <Text style={styles.badgesEmpty}>Ainda sem badges.</Text>
            ) : (
              <View style={styles.badgeGrid}>
                {badges.map((badge) => (
                  <View key={badge.id} style={styles.badgeItem}>
                    <Text style={styles.badgeIcon}>🏅</Text>
                    <Text style={styles.badgeName}>{badge.name}</Text>
                    <Text style={styles.badgeDesc}>{badge.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const MINT = "#62D8B4";
const MINT_DARK = "#40b494";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E4F7FB",
  },

  farmBg: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    bottom: 0,
    left: 0,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  backText: {
    color: "#1E3A4C",
    fontWeight: "600",
  },
  headerTitle: {
    color: "#1E3A4C",
    fontSize: 18,
    fontWeight: "700",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  profileCard: {
    marginTop: 8,
    backgroundColor: MINT,
    borderRadius: 24,
    padding: 16,
  },

  heroArea: {
    alignItems: "center",
    marginBottom: 16,
  },
  heroBackground: {
    width: "100%",
    height: 70,
    borderRadius: 18,
    backgroundColor: "#C5F0E2",
  },
  avatarWrapper: {
    position: "absolute",
    top: 12,
    alignItems: "center",
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: MINT_DARK,
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: "700",
    color: MINT_DARK,
  },
  levelTag: {
    position: "absolute",
    bottom: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MINT_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  levelTagText: {
    color: "#fff",
    fontWeight: "800",
  },

  namePill: {
    marginTop: 52,
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  nameText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4A4A4A",
  },

  statsColumn: {
    marginTop: 12,
    gap: 10,
  },
  bigStatCard: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#7EE0BF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bigStatLabel: {
    color: "#fff",
    fontWeight: "500",
  },
  bigStatValue: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 22,
  },

  bottomRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },

  levelBox: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#7EE0BF",
    padding: 10,
    alignItems: "center",
  },
  levelNumberBox: {
    alignItems: "center",
  },
  levelNumber: {
    fontSize: 40,
    fontWeight: "800",
    color: "#ffffff",
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  mascotContainer: {
    marginTop: 8,
    width: "100%",
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  mascotImage: {
    width: "90%",
    height: "100%",
  },

  leaderboardBox: {
    flex: 1.2,
    borderRadius: 18,
    backgroundColor: "#7EE0BF",
    padding: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loaderText: {
    color: "#fff",
  },
  emptyText: {
    color: "#fff",
  },

  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  leaderRowYou: {
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  leaderPosition: {
    width: 26,
    color: "#fff",
    fontWeight: "800",
  },
  leaderName: {
    flex: 1,
    color: "#fff",
  },
  leaderDivider: {
    height: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginLeft: 4,
  },

  badgesCard: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E3A4C",
    marginBottom: 10,
  },
  badgesEmpty: {
    color: "#65748B",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeItem: {
    width: "46%",
    backgroundColor: "#F3FBF8",
    borderRadius: 12,
    padding: 10,
  },
  badgeIcon: {
    fontSize: 20,
  },
  badgeName: {
    color: "#1E3A4C",
    fontWeight: "700",
  },
  badgeDesc: {
    color: "#65748B",
    fontSize: 11,
  },
});
