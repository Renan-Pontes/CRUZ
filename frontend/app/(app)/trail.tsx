import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  TouchableOpacity,
  Text,
  Modal,
  Easing,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { TrailPath } from "../../components/trail/TrailPath";
import { TrailPointer } from "../../components/trail/TrailPointer";
import { ProgressBar } from "../../components/trail/ProgressBar";
import { useSession } from "@/auth/ctx";
import { apiService } from "@/services/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Configurações
const VERTICAL_SPACING = 200;
const NODE_SIZE = 90;
const MIN_NODES = 15; // Mínimo de nodes para parecer infinito

// Tipos
interface TrailNodeData {
  id: number;
  x: number;
  y: number;
  icon: "document" | "brain" | "pill" | null;
  challengeType: string;
  isCompleted: boolean;
  isLocked: boolean;
  moduleId?: number;
}

// Ícones
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

// ============ COMPONENTE TRAIL NODE ============
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

// ============ COMPONENTE PRINCIPAL ============
export default function Trail() {
  const { session, signOut } = useSession();
  const [nodes, setNodes] = useState<TrailNodeData[]>([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TrailNodeData | null>(null);
  
  // User info state
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

  // Gera posições em zigzag
  const generateNodes = useCallback((
    modules: Array<{ id: number; challenge_type: string; position: number }>,
    completedCount: number
  ): TrailNodeData[] => {
    const padding = 50;
    const leftX = padding + 45;
    const rightX = SCREEN_WIDTH - padding - 45;
    const centerX = SCREEN_WIDTH / 2;
    const startY = SCREEN_HEIGHT - 200;

    // Se tiver poucos módulos, repete para criar trilha longa
    let expandedModules = [...modules];
    while (expandedModules.length < MIN_NODES) {
      const baseModules = modules.map((m, i) => ({
        ...m,
        id: m.id + 1000 * Math.floor(expandedModules.length / modules.length) + i,
        position: expandedModules.length + i,
      }));
      expandedModules = [...expandedModules, ...baseModules];
    }

    return expandedModules.map((module, index) => {
      const pattern = index % 4;
      let x: number;

      switch (pattern) {
        case 0: x = leftX; break;
        case 1: x = centerX + 40; break;
        case 2: x = rightX; break;
        case 3: x = centerX - 40; break;
        default: x = centerX;
      }

      const y = startY - index * VERTICAL_SPACING;
      const challengeType = module.challenge_type || "find_errors";

      return {
        id: module.id,
        x,
        y,
        icon: CHALLENGE_ICON_MAP[challengeType] || "document",
        challengeType,
        isCompleted: index < completedCount,
        isLocked: index > completedCount, // Só o atual está desbloqueado
        moduleId: module.id,
      };
    });
  }, []);

  // Carrega dados do backend
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        if (session) {
          // 1. Carrega perfil do usuário (XP, level, etc) via /api/auth/me/
          try {
            const meResponse = await apiService.getMe(session);
            setUserInfo({
              email: meResponse.email || "",
              xp: meResponse.profile?.experience_points || 0,
              level: meResponse.profile?.level || 1,
              streak: meResponse.profile?.streak || 0,
            });
          } catch (e) {
            console.log("Erro ao carregar perfil:", e);
          }
          
          // 2. Carrega learning path
          try {
            const pathResponse = await apiService.getLearningPath(session);
            
            if (pathResponse.modules && pathResponse.modules.length > 0) {
              const sortedModules = [...pathResponse.modules].sort(
                (a, b) => a.position - b.position
              );
              
              // 3. Carrega atividades para determinar progresso
              let completedCount = 0;
              try {
                const activities = await apiService.getActivity(session);
                // Conta quantos desafios foram completados
                const completedChallenges = activities.filter(
                  (act: any) => act.activity_type === "challenge_completed"
                );
                completedCount = Math.min(completedChallenges.length, sortedModules.length);
              } catch (e) {
                console.log("Erro ao carregar atividades:", e);
              }
              
              const generatedNodes = generateNodes(sortedModules, completedCount);
              setNodes(generatedNodes);
              setCurrentNodeIndex(completedCount);
              
              // Posiciona mascote no node atual
              if (generatedNodes[completedCount]) {
                const node = generatedNodes[completedCount];
                animatedPosition.setValue({
                  x: node.x - 30,
                  y: node.y - 95,
                });
              }
              
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.log("Erro ao carregar trilha:", e);
          }
        }
      } catch (error) {
        console.log("Erro geral:", error);
      }

      // Fallback: dados demo
      const demoModules = [
        { id: 1, challenge_type: "find_errors", position: 0 },
        { id: 2, challenge_type: "separacao", position: 1 },
        { id: 3, challenge_type: "atendimento", position: 2 },
        { id: 4, challenge_type: "find_errors", position: 3 },
        { id: 5, challenge_type: "separacao", position: 4 },
      ];
      
      const demoNodes = generateNodes(demoModules, 0);
      setNodes(demoNodes);
      setCurrentNodeIndex(0);
      
      // Posiciona mascote
      if (demoNodes[0]) {
        animatedPosition.setValue({
          x: demoNodes[0].x - 30,
          y: demoNodes[0].y - 95,
        });
      }
      
      setUserInfo({
        email: "estudante@cs.cruzeirodosul.edu.br",
        xp: 0,
        level: 1,
        streak: 0,
      });
      
      setIsLoading(false);
    };

    loadData();
  }, [session, generateNodes]);

  // Handler de clique no node
  const handleNodePress = (index: number) => {
    const node = nodes[index];
    if (node.isLocked) return;

    // Mostra modal para o node clicado
    setSelectedNode(node);
    setShowModal(true);
  };
  
  // Confirmar início do exercício
  const handleStartExercise = () => {
    setShowModal(false);
    
    if (selectedNode) {
      // Navega para task com o tipo de desafio
      router.push({
        pathname: "/(app)/task",
        params: { 
          challengeType: selectedNode.challengeType,
          moduleId: selectedNode.moduleId?.toString(),
        },
      });
    }
  };
  
  // Cancelar - NÃO avança o progresso
  const handleCancelExercise = () => {
    setShowModal(false);
    setSelectedNode(null);
    // Não faz nada mais - mantém o estado atual
  };
  
  // Logout
  const handleLogout = async () => {
    Alert.alert(
      "Sair",
      "Deseja realmente sair da sua conta?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sair", 
          style: "destructive",
          onPress: async () => {
            try {
              if (session) {
                await apiService.logout(session);
              }
            } catch (e) {
              console.log("Erro no logout:", e);
            }
            signOut();
          }
        },
      ]
    );
  };

  const progress = nodes.length > 0 ? currentNodeIndex / Math.min(nodes.length, 10) : 0;
  const contentHeight = nodes.length * VERTICAL_SPACING + 400;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Carregando trilha...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header com info do usuário */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmail} numberOfLines={1}>
            {userInfo.email}
          </Text>
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
      
      {/* Streak indicator */}
      {userInfo.streak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakText}>🔥 {userInfo.streak} dias seguidos!</Text>
        </View>
      )}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ minHeight: contentHeight }}
        showsVerticalScrollIndicator={false}
      >
        {/* Path */}
        <TrailPath nodes={nodes} />

        {/* Nodes */}
        {nodes.map((node, index) => (
          <TrailNodeItem
            key={`node-${node.id}-${index}`}
            node={node}
            index={index}
            isActive={index === currentNodeIndex}
            onPress={() => handleNodePress(index)}
          />
        ))}

        {/* Mascote */}
        <Animated.View
          style={[
            styles.mascotContainer,
            {
              transform: [
                { translateX: animatedPosition.x },
                { translateY: animatedPosition.y },
              ],
            },
          ]}
        >
          <TrailPointer position={animatedPosition} isStatic />
        </Animated.View>
      </ScrollView>

      {/* Progress bar */}
      <ProgressBar progress={Math.min(progress, 1)} />
      
      {/* Modal de confirmação */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExercise}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>
              {selectedNode?.icon ? ICON_EMOJI[selectedNode.icon] : "🎯"}
            </Text>
            <Text style={styles.modalTitle}>Pronto para começar?</Text>
            <Text style={styles.modalSubtitle}>
              {selectedNode ? CHALLENGE_NAMES[selectedNode.challengeType] || "Exercício" : "Exercício"}
            </Text>
            
            <TouchableOpacity 
              style={styles.modalButtonPrimary}
              onPress={handleStartExercise}
            >
              <Text style={styles.modalButtonPrimaryText}>Começar!</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalButtonSecondary}
              onPress={handleCancelExercise}
            >
              <Text style={styles.modalButtonSecondaryText}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#364A5E",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  // Header styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  logoutText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerEmail: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textAlign: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 3,
  },
  statIcon: {
    fontSize: 12,
  },
  statValue: {
    color: "#FFD166",
    fontSize: 13,
    fontWeight: "700",
  },
  levelBadge: {
    backgroundColor: "#87dbba",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  levelText: {
    color: "#1a3a2f",
    fontSize: 13,
    fontWeight: "700",
  },
  // Streak banner
  streakBanner: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    paddingVertical: 6,
    alignItems: "center",
  },
  streakText: {
    color: "#FFD166",
    fontSize: 14,
    fontWeight: "600",
  },
  // Mascot container
  mascotContainer: {
    position: "absolute",
    width: 60,
    height: 75,
    zIndex: 1000,
  },
  // Node styles
  nodeContainer: {
    position: "absolute",
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  nodeCompleted: {
    backgroundColor: "#87dbba",
    borderColor: "#5fa88a",
  },
  nodeActive: {
    borderColor: "#FFD166",
    borderWidth: 5,
  },
  nodeLocked: {
    backgroundColor: "#4a5568",
    borderColor: "#2d3748",
    opacity: 0.6,
  },
  nodeIcon: {
    fontSize: 36,
  },
  nodeIconLocked: {
    fontSize: 28,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#364A5E",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  modalButtonPrimary: {
    backgroundColor: "#87dbba",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    width: "100%",
    marginBottom: 12,
  },
  modalButtonPrimaryText: {
    color: "#1a3a2f",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  modalButtonSecondary: {
    paddingVertical: 12,
  },
  modalButtonSecondaryText: {
    color: "#999",
    fontSize: 16,
  },
}); 