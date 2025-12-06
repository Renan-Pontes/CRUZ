import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  TouchableOpacity,
  Text,
  Alert,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { TrailPath } from "../../components/trail/TrailPath";
import { TrailPointer } from "../../components/trail/TrailPointer";
import { ProgressBar } from "../../components/trail/ProgressBar";
import { useSession } from "@/auth/ctx";
import { apiService } from "@/services/api";
import { useStorageState } from "../useStorageState";
import { useMemo } from "react";

function balanceModules(mods: Array<{ id: number; challenge_type: string; position: number; title?: string }>) {
  const buckets: Record<string, any[]> = {};
  mods.forEach((m) => {
    buckets[m.challenge_type] = buckets[m.challenge_type] || [];
    buckets[m.challenge_type].push(m);
  });
  Object.values(buckets).forEach((arr: any) => arr.sort((a: any, b: any) => a.position - b.position));

  const targetOrder = ["find_errors", "atendimento", "separacao"];
  const order: any[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const t of targetOrder) {
      if (buckets[t] && buckets[t].length) {
        order.push(buckets[t].shift());
        added = true;
      }
    }
    if (!added) {
      const remainingTypes = Object.keys(buckets).filter((t) => buckets[t]?.length);
      if (remainingTypes.length) {
        remainingTypes.forEach((t) => {
          while (buckets[t].length) {
            order.push(buckets[t].shift());
          }
        });
        added = true;
      }
    }
  }
  return order;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const VERTICAL_SPACING = 200;
const NODE_SIZE = 90;
const MIN_NODES = 15;

interface TrailNodeData {
  id: number;
  x: number;
  y: number;
  icon: "document" | "brain" | "pill" | null;
  challengeType: string;
  isCompleted: boolean;
  isLocked: boolean;
  moduleId?: number;
  title?: string;
}

const ICON_EMOJI: Record<string, string> = {
  document: "📄",
  brain: "🧠",
  pill: "💊",
};

const CHALLENGE_ICON_MAP: Record<string, "document" | "brain" | "pill"> = {
  find_errors: "document",
  atendimento: "brain",
  separacao: "pill",
};

const CHALLENGE_NAMES: Record<string, string> = {
  find_errors: "Encontre os Erros",
  atendimento: "Atendimento ao Cliente",
  separacao: "Separação de Medicamentos",
};

function TrailNodeItem({
  node,
  index,
  isActive,
  onPress,
}: {
  node: TrailNodeData;
  index: number;
  isActive: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 80,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isActive && !node.isLocked) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, node.isLocked]);

  const iconChar = node.icon ? ICON_EMOJI[node.icon] || "•" : "•";

  return (
    <Animated.View
      style={[
        styles.nodeContainer,
        {
          left: node.x - NODE_SIZE / 2,
          top: node.y - NODE_SIZE / 2,
          opacity: scaleAnim,
          transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={node.isLocked ? 1 : 0.8}
        onPress={onPress}
        disabled={node.isLocked}
        style={[
          styles.node,
          node.isCompleted && styles.nodeCompleted,
          isActive && !node.isLocked && styles.nodeActive,
          node.isLocked && styles.nodeLocked,
        ]}
      >
        <Text style={[styles.nodeIcon, node.isLocked && styles.nodeIconLocked]}>
          {node.isLocked ? "🔒" : iconChar}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function Trail() {
  const { session, signOut } = useSession();
  const [nodes, setNodes] = useState<TrailNodeData[]>([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [[loadingLocalCompleted, localCompletedRaw], setLocalCompleted] = useStorageState("localCompletionsCount");

  const [userInfo, setUserInfo] = useState({
    email: "",
    xp: 0,
    level: 1,
    streak: 0,
  });

  const animatedPosition = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH / 2 - 30,
      y: SCREEN_HEIGHT - 200 - 95,
    })
  ).current;

  const scrollViewRef = useRef<ScrollView>(null);

  const generateNodes = useCallback(
    (
      modules: Array<{ id: number; challenge_type: string; position: number }>,
      completedCount: number
    ): TrailNodeData[] => {
      const padding = 50;
      const leftX = padding + 45;
      const rightX = SCREEN_WIDTH - padding - 45;
      const centerX = SCREEN_WIDTH / 2;

      let expandedModules = [...modules];
      while (expandedModules.length < MIN_NODES) {
        const baseModules = modules.map((m, i) => ({
          ...m,
          id: m.id + 1000 * Math.floor(expandedModules.length / modules.length) + i,
          position: expandedModules.length + i,
        }));
        expandedModules = [...expandedModules, ...baseModules];
      }

      const totalHeight = expandedModules.length * VERTICAL_SPACING + 400;

      const nodes = expandedModules.map((module, index) => {
        const pattern = index % 4;
        let x: number;

        switch (pattern) {
          case 0: x = leftX; break;
          case 1: x = centerX + 40; break;
          case 2: x = rightX; break;
          case 3: x = centerX - 40; break;
          default: x = centerX;
        }

        const y = totalHeight - 200 - index * VERTICAL_SPACING;
        const challengeType = module.challenge_type || "find_errors";

        return {
          id: module.id,
          x,
          y,
          icon: CHALLENGE_ICON_MAP[challengeType] || "document",
          challengeType,
          isCompleted: index < completedCount,
          isLocked: index > completedCount,
          moduleId: module.id,
          title: (module as any).title,
        };
      });

      const minY = Math.min(...nodes.map((n) => n.y));
      if (minY < 150) {
        const offset = 150 - minY;
        return nodes.map((n) => ({ ...n, y: n.y + offset }));
      }
      return nodes;
    },
    []
  );

  const loadData = useCallback(
    async (isPullRefresh = false) => {
      setLoadError(null);
      if (isPullRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      let loaded = false;

      try {
        if (session) {
          try {
            const meResponse = await apiService.getMe(session);
            setUserInfo({
              email: meResponse.email || "",
              xp: meResponse.profile?.experience_points || 0,
              level: meResponse.profile?.level || 1,
              streak: meResponse.profile?.streak || 0,
            });
          } catch (e: any) {
            if (e?.status === 401 || e?.status === 403) return;
            console.log("Erro ao carregar perfil:", e);
          }

          try {
            const pathResponse = await apiService.getLearningPath(session);
            const fallbackModules = [
              { id: 1, title: "Primeiro desafio", challenge_type: "find_errors", position: 0, required_exercises: 1 },
            ];

            const modulesToUseRaw =
              pathResponse.modules && pathResponse.modules.length > 0
                ? [...pathResponse.modules]
                : fallbackModules;

            const balanced = balanceModules(modulesToUseRaw);
            const sortedModules = balanced.map((m, idx) => ({ ...m, position: idx }));

            let completedCount = 0;
            try {
              const activities = await apiService.getActivity(session);
              const completedChallenges = activities.filter(
                (act: any) => act.activity_type === "challenge_completed"
              );
              const localCompleted = parseInt(localCompletedRaw || "0", 10) || 0;
              const totalCompleted = completedChallenges.length + localCompleted;
              completedCount = Math.min(totalCompleted, sortedModules.length);
            } catch (e) {
              console.log("Erro ao carregar atividades:", e);
            }

            const generatedNodes = generateNodes(sortedModules, completedCount);
            setNodes(generatedNodes);
            const activeIndexNodes = generatedNodes.length > 0 ? Math.min(completedCount, generatedNodes.length - 1) : 0;
            setCurrentNodeIndex(activeIndexNodes);

            if (generatedNodes[activeIndexNodes]) {
              const node = generatedNodes[activeIndexNodes];
              animatedPosition.setValue({ x: node.x - 30, y: node.y - 95 });
            }
            loaded = true;
          } catch (e: any) {
            if (e?.status === 401 || e?.status === 403) return;
            console.log("Erro ao carregar trilha:", e);
          }
        }
      } catch (error: any) {
        if (error?.status === 401 || error?.status === 403) return;
        console.log("Erro geral:", error);
        setLoadError("Falha ao carregar trilha. Usando modo demo.");
      }

      if (!loaded) {
        const demoModules = [
          { id: 1, title: "Receitas Tipo A", challenge_type: "find_errors", position: 0 },
          { id: 2, title: "Separação Básica", challenge_type: "separacao", position: 1 },
          { id: 3, title: "Atendimento", challenge_type: "atendimento", position: 2 },
          { id: 4, title: "Receitas Tipo B", challenge_type: "find_errors", position: 3 },
          { id: 5, title: "Separação II", challenge_type: "separacao", position: 4 },
        ];
        const localCompleted = parseInt(localCompletedRaw || "0", 10) || 0;
        const demoCompleted = Math.min(localCompleted, demoModules.length);
        const demoNodes = generateNodes(demoModules, demoCompleted);
        let usedPrev = false;
        setNodes((prev) => {
          if (prev.length) { usedPrev = true; return prev; }
          return demoNodes;
        });
        if (!usedPrev) {
          const activeIndex = demoNodes.length > 0 ? Math.min(demoCompleted, demoNodes.length - 1) : 0;
          setCurrentNodeIndex(activeIndex);
          if (demoNodes[activeIndex]) {
            animatedPosition.setValue({ x: demoNodes[activeIndex].x - 30, y: demoNodes[activeIndex].y - 95 });
          }
        }
      }

      setIsLoading(false);
      setIsRefreshing(false);
      if (loaded && session) setLocalCompleted("0");
    },
    [session, generateNodes, animatedPosition, setLocalCompleted, localCompletedRaw]
  );

  useEffect(() => {
    if (nodes.length > 0 && currentNodeIndex >= 0 && scrollViewRef.current) {
      const node = nodes[currentNodeIndex];
      const scrollY = Math.max(0, node.y - SCREEN_HEIGHT / 2);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
      }, 500);
    }
  }, [nodes, currentNodeIndex]);

  useEffect(() => {
    loadData();
  }, [loadData, localCompletedRaw]);

  // ============ NAVEGAÇÃO PARA EXERCISE INTRO ============
  const handleNodePress = (index: number) => {
    const node = nodes[index];
    if (node.isLocked) return;

    router.push({
      pathname: "/(app)/exercise-intro",
      params: {
        type: node.challengeType,
        moduleId: node.moduleId?.toString(),
        name: node.title || CHALLENGE_NAMES[node.challengeType],
      },
    });
  };

  const handleLogout = async () => {
    Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            if (session) await apiService.logout(session);
          } catch (e) {
            console.log("Erro no logout:", e);
          }
          signOut();
        },
      },
    ]);
  };

  const completedNodes = useMemo(() => nodes.filter((n) => n.isCompleted).length, [nodes]);
  const progress = nodes.length > 0 ? completedNodes / nodes.length : 0;
  const maxY = nodes.reduce((acc, node) => Math.max(acc, node.y), 0);
  const contentHeight = Math.max(SCREEN_HEIGHT + 200, maxY + NODE_SIZE + 200);
  const activeNode = nodes[currentNodeIndex] || nodes[0];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Carregando trilha...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#3f5872", "#243241", "#1d2835"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/(app)/profile")}>
            <Text style={styles.secondaryText}>Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmail} numberOfLines={1}>{userInfo.email}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statBadge}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>{userInfo.xp}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Nv.{userInfo.level}</Text>
          </View>
        </View>
      </View>

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => loadData(true)} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {userInfo.streak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakText}>🔥 {userInfo.streak} dias seguidos!</Text>
        </View>
      )}

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroLabel}>Próximo desafio</Text>
          <Text style={styles.heroSmall}>{activeNode?.title || CHALLENGE_NAMES[activeNode?.challengeType || "find_errors"]}</Text>
        </View>
        <View style={styles.heroRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeEmoji}>{activeNode?.icon ? ICON_EMOJI[activeNode.icon] : "🎯"}</Text>
            <Text style={styles.heroBadgeText}>{activeNode ? CHALLENGE_NAMES[activeNode.challengeType] : "Desafio"}</Text>
          </View>
          <View style={styles.heroMiniStats}>
            <Text style={styles.heroMiniLabel}>Progresso</Text>
            <Text style={styles.heroMiniValue}>{Math.round(progress * 100)}%</Text>
          </View>
        </View>
        <View style={styles.heroFooter}>
          <View style={styles.legendRow}>
            <LegendItem label="Docs" icon="📄" />
            <LegendItem label="Atendimento" icon="🧠" />
            <LegendItem label="Separação" icon="💊" />
          </View>
          <TouchableOpacity style={styles.primaryCta} onPress={() => activeNode && handleNodePress(currentNodeIndex)} activeOpacity={0.9}>
            <Text style={styles.primaryCtaText}>Começar agora</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ minHeight: contentHeight, paddingBottom: 240, paddingTop: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor="#FFD166" colors={["#FFD166"]} />}
      >
        <TrailPath nodes={nodes} />
        {nodes.map((node, index) => (
          <TrailNodeItem key={`node-${node.id}-${index}`} node={node} index={index} isActive={index === currentNodeIndex} onPress={() => handleNodePress(index)} />
        ))}
        <Animated.View style={[styles.mascotContainer, { transform: [{ translateX: animatedPosition.x }, { translateY: animatedPosition.y }] }]}>
          <TrailPointer position={animatedPosition} isStatic />
        </Animated.View>
      </ScrollView>

      <ProgressBar progress={Math.min(progress, 1)} />
    </View>
  );
}

function LegendItem({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={styles.legendItem}>
      <Text style={styles.legendIcon}>{icon}</Text>
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#364A5E" },
  centered: { justifyContent: "center", alignItems: "center" },
  scrollView: { flex: 1 },
  loadingText: { color: "#FFFFFF", fontSize: 16 },
  errorBanner: { backgroundColor: "rgba(255, 107, 107, 0.25)", paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  errorText: { color: "#FFE8E8", flex: 1, marginRight: 12 },
  retryButton: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "700" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingTop: 50, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.3)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  secondaryButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8 },
  secondaryText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  logoutButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8 },
  logoutText: { color: "#FF6B6B", fontSize: 14, fontWeight: "600" },
  headerCenter: { flex: 1, marginHorizontal: 8 },
  headerEmail: { color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  statBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, gap: 3 },
  statIcon: { fontSize: 12 },
  statValue: { color: "#FFD166", fontSize: 13, fontWeight: "700" },
  levelBadge: { backgroundColor: "#87dbba", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  levelText: { color: "#1a3a2f", fontSize: 13, fontWeight: "700" },
  streakBanner: { backgroundColor: "rgba(255, 107, 107, 0.2)", paddingVertical: 6, alignItems: "center" },
  streakText: { color: "#FFD166", fontSize: 14, fontWeight: "600" },
  heroCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, padding: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  heroHeader: { marginBottom: 10 },
  heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" },
  heroSmall: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 4 },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroBadge: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", gap: 10 },
  heroBadgeEmoji: { fontSize: 24 },
  heroBadgeText: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },
  heroMiniStats: { width: 90, padding: 10, backgroundColor: "rgba(135, 219, 186, 0.2)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(135, 219, 186, 0.5)" },
  heroMiniLabel: { color: "#c7f4e4", fontSize: 12 },
  heroMiniValue: { color: "#1a3a2f", fontWeight: "800", fontSize: 18 },
  heroFooter: { marginTop: 14, gap: 10 },
  legendRow: { flexDirection: "row", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  legendIcon: { fontSize: 16 },
  legendText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  primaryCta: { marginTop: 4, backgroundColor: "#87dbba", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  primaryCtaText: { color: "#1a3a2f", fontWeight: "800", fontSize: 16 },
  mascotContainer: { position: "absolute", width: 60, height: 75, zIndex: 1000 },
  nodeContainer: { position: "absolute", width: NODE_SIZE, height: NODE_SIZE, alignItems: "center", justifyContent: "center" },
  node: { width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2, borderWidth: 4, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 10 },
  nodeCompleted: { backgroundColor: "#87dbba", borderColor: "#5fa88a" },
  nodeActive: { borderColor: "#FFD166", borderWidth: 5 },
  nodeLocked: { backgroundColor: "#4a5568", borderColor: "#2d3748", opacity: 0.6 },
  nodeIcon: { fontSize: 36 },
  nodeIconLocked: { fontSize: 28 },
});