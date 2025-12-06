import React, { useState, useRef, useEffect } from "react";
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

// Tipos
interface TrailNodeData {
  id: number;
  x: number;
  y: number;
  icon: "document" | "brain" | "pill" | null;
  isCompleted: boolean;
  isLocked: boolean;
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

  // Animação de entrada
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 80,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pulse no ativo
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
  const { session } = useSession();
  const [nodes, setNodes] = useState<TrailNodeData[]>([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  
  // User info state
  const [userInfo, setUserInfo] = useState({
    email: "",
    xp: 0,
    level: 1,
  });
  
  // Animações
  const walkAnim = useRef(new Animated.Value(0)).current;
  const isWalking = useRef(false);

  const animatedPosition = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH / 2 - 30,
      y: SCREEN_HEIGHT - 150 - 95,
    })
  ).current;

  // Gera posições em zigzag
  const generateNodes = (count: number, types: string[]): TrailNodeData[] => {
    const padding = 50;
    const leftX = padding + 35;
    const rightX = SCREEN_WIDTH - padding - 35;
    const centerX = SCREEN_WIDTH / 2;
    const startY = SCREEN_HEIGHT - 150;

    return Array.from({ length: count }, (_, index) => {
      const pattern = index % 4;
      let x: number;

      switch (pattern) {
        case 0: x = leftX; break;
        case 1: x = centerX + 30; break;
        case 2: x = rightX; break;
        case 3: x = centerX - 30; break;
        default: x = centerX;
      }

      const y = startY - index * VERTICAL_SPACING;
      const challengeType = types[index] || "find_errors";

      return {
        id: index + 1,
        x,
        y,
        icon: CHALLENGE_ICON_MAP[challengeType] || "document",
        isCompleted: index < currentNodeIndex,
        isLocked: index > currentNodeIndex + 1,
      };
    });
  };

  // Carrega dados da API ou usa demo
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        if (session) {
          // Carrega perfil do usuário
          try {
            const profile = await apiService.getProfile(session);
            setUserInfo({
              email: profile.email || session.split("@")[0] + "@cs.cruzeirodosul.edu.br",
              xp: profile.xp_total || 0,
              level: profile.level || 1,
            });
          } catch (e) {
            // Fallback: usa session como email
            setUserInfo(prev => ({ ...prev, email: "estudante@cs.cruzeirodosul.edu.br" }));
          }
          
          // Carrega learning path
          const response = await apiService.getLearningPath(session);
          
          if (response.modules && response.modules.length > 0) {
            const sortedModules = [...response.modules].sort((a, b) => a.position - b.position);
            const types = sortedModules.map(m => m.challenge_type);
            const generatedNodes = generateNodes(sortedModules.length, types);
            setNodes(generatedNodes);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log("Usando dados demo:", error);
      }

      // Fallback: dados demo
      const demoTypes = ["find_errors", "separacao", "atendimento", "find_errors", "separacao"];
      setNodes(generateNodes(5, demoTypes));
      setUserInfo({
        email: "estudante@cs.cruzeirodosul.edu.br",
        xp: 250,
        level: 3,
      });
      setIsLoading(false);
    };

    loadData();
  }, [session]);

  // Atualiza estados dos nodes quando currentNodeIndex muda
  useEffect(() => {
    setNodes(prev => prev.map((node, index) => ({
      ...node,
      isCompleted: index < currentNodeIndex,
      isLocked: index > currentNodeIndex + 1,
    })));
  }, [currentNodeIndex]);

  // Atualiza posição do mascote
  useEffect(() => {
    if (nodes.length > 0 && nodes[currentNodeIndex]) {
      const node = nodes[currentNodeIndex];
      Animated.spring(animatedPosition, {
        toValue: {
          x: node.x - 30,
          y: node.y - 95,
        },
        friction: 7,
        tension: 40,
        useNativeDriver: false,
      }).start();
    }
  }, [currentNodeIndex, nodes]);

  // Handler de clique
  const handleNodePress = (index: number) => {
    const node = nodes[index];
    if (node.isLocked || isWalking.current) return;

    isWalking.current = true;
    setSelectedNodeIndex(index);

    // Animação de "caminhada" (balançando)
    const walkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(walkAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(walkAnim, {
          toValue: -1,
          duration: 150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    walkAnimation.start();

    // Move o mascote
    Animated.timing(animatedPosition, {
      toValue: {
        x: node.x - 30,
        y: node.y - 95,
      },
      duration: 800,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      // Para a animação de caminhada
      walkAnimation.stop();
      walkAnim.setValue(0);
      isWalking.current = false;
      
      // Mostra o modal
      setShowModal(true);
    });

    setCurrentNodeIndex(index);
  };
  
  // Confirmar início do exercício
  const handleStartExercise = () => {
    setShowModal(false);
    router.push("/(app)/task");
  };
  
  // Cancelar
  const handleCancelExercise = () => {
    setShowModal(false);
    setSelectedNodeIndex(null);
  };
  
  // Pega nome do exercício selecionado
  const getExerciseName = () => {
    if (selectedNodeIndex === null || !nodes[selectedNodeIndex]) return "Exercício";
    const icon = nodes[selectedNodeIndex].icon;
    switch (icon) {
      case "document": return "Encontre os Erros";
      case "pill": return "Separação de Medicamentos";
      case "brain": return "Atendimento ao Cliente";
      default: return "Exercício";
    }
  };

  const progress = nodes.length > 0 ? currentNodeIndex / nodes.length : 0;
  const contentHeight = nodes.length * VERTICAL_SPACING + 300;

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
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmail} numberOfLines={1}>
            {userInfo.email}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statBadge}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>{userInfo.xp} XP</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Nv. {userInfo.level}</Text>
          </View>
        </View>
      </View>
      
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
            key={node.id}
            node={node}
            index={index}
            isActive={index === currentNodeIndex}
            onPress={() => handleNodePress(index)}
          />
        ))}

        {/* Mascote com animação de caminhada */}
        <Animated.View
          style={[
            styles.mascotContainer,
            {
              transform: [
                { translateX: animatedPosition.x },
                { translateY: animatedPosition.y },
                { rotate: walkAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: ['-8deg', '0deg', '8deg'],
                })},
              ],
            },
          ]}
        >
          <TrailPointer position={animatedPosition} isStatic />
        </Animated.View>
      </ScrollView>

      {/* Progress bar */}
      <ProgressBar progress={progress} />
      
      {/* Modal de confirmação */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExercise}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>🎯</Text>
            <Text style={styles.modalTitle}>Pronto para começar?</Text>
            <Text style={styles.modalSubtitle}>{getExerciseName()}</Text>
            
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerEmail: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statIcon: {
    fontSize: 14,
  },
  statValue: {
    color: "#FFD166",
    fontSize: 14,
    fontWeight: "600",
  },
  levelBadge: {
    backgroundColor: "#87dbba",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelText: {
    color: "#1a3a2f",
    fontSize: 14,
    fontWeight: "700",
  },
  // Mascot container
  mascotContainer: {
    position: "absolute",
    width: 60,
    height: 75,
    zIndex: 1000,
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
    fontSize: 48,
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
});