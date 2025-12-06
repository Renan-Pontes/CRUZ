import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/auth/ctx";
import { apiService, LearningPathModule } from "@/services/api";

export interface TrailNodeData {
  id: number;
  moduleId: number;
  title: string;
  challengeType: "find_errors" | "atendimento" | "separacao";
  position: number;
  x: number;
  y: number;
  icon: "document" | "brain" | "pill" | null;
  isCompleted: boolean;
  isLocked: boolean;
}

interface UseLearningPathReturn {
  nodes: TrailNodeData[];
  isLoading: boolean;
  error: string | null;
  currentNodeIndex: number;
  setCurrentNodeIndex: (index: number) => void;
  completeNode: (index: number) => void;
  refetch: () => Promise<void>;
  contentHeight: number;
}

// Mapeia challenge_type para ícone
const CHALLENGE_ICON_MAP: Record<string, TrailNodeData["icon"]> = {
  find_errors: "document",
  atendimento: "brain",
  separacao: "pill",
};

// Gera posições em zigzag para os nodes
function generateNodePositions(
  modules: LearningPathModule[],
  screenWidth: number,
  startY: number,
  verticalSpacing: number = 120 // Reduzido de 180 para 120
): { nodes: TrailNodeData[]; totalHeight: number } {
  const padding = 50;
  const leftX = padding + 35;
  const rightX = screenWidth - padding - 35;
  const centerX = screenWidth / 2;

  const nodes = modules.map((module, index) => {
    // Padrão zigzag mais suave
    const pattern = index % 4;
    let x: number;

    switch (pattern) {
      case 0:
        x = leftX;
        break;
      case 1:
        x = centerX + 30;
        break;
      case 2:
        x = rightX;
        break;
      case 3:
        x = centerX - 30;
        break;
      default:
        x = centerX;
    }

    const y = startY - index * verticalSpacing;

    return {
      id: module.id,
      moduleId: module.id,
      title: module.title,
      challengeType: module.challenge_type as TrailNodeData["challengeType"],
      position: module.position,
      x,
      y,
      icon: CHALLENGE_ICON_MAP[module.challenge_type] || null,
      isCompleted: false,
      isLocked: false,
    };
  });

  // Calcula altura total do conteúdo
  const totalHeight = modules.length * verticalSpacing + 300;

  return { nodes, totalHeight };
}

export function useLearningPath(screenWidth: number, screenHeight: number): UseLearningPathReturn {
  const { session } = useSession();
  const [nodes, setNodes] = useState<TrailNodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [contentHeight, setContentHeight] = useState(screenHeight);

  // Função para atualizar estado de lock/complete dos nodes
  const updateNodeStates = useCallback((nodesList: TrailNodeData[], currentIdx: number) => {
    return nodesList.map((node, index) => ({
      ...node,
      // CORRIGIDO: Só bloqueia nodes que estão 2+ posições à frente
      // O próximo (currentIdx + 1) deve estar DESBLOQUEADO
      isLocked: index > currentIdx + 1,
      isCompleted: index < currentIdx,
    }));
  }, []);

  const fetchLearningPath = useCallback(async () => {
    if (!session) {
      // Sem sessão, usa demo nodes
      const { nodes: demoNodes, totalHeight } = createDemoNodes(screenWidth, screenHeight);
      setNodes(updateNodeStates(demoNodes, 0));
      setContentHeight(totalHeight);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.getLearningPath(session);

      if (response.modules && response.modules.length > 0) {
        const sortedModules = [...response.modules].sort((a, b) => a.position - b.position);
        const startY = screenHeight - 150;
        const { nodes: generatedNodes, totalHeight } = generateNodePositions(
          sortedModules,
          screenWidth,
          startY
        );

        setNodes(updateNodeStates(generatedNodes, currentNodeIndex));
        setContentHeight(totalHeight);
      } else {
        const { nodes: demoNodes, totalHeight } = createDemoNodes(screenWidth, screenHeight);
        setNodes(updateNodeStates(demoNodes, 0));
        setContentHeight(totalHeight);
      }
    } catch (err) {
      console.error("Erro ao buscar learning path:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar trilha");
      // Fallback para demo
      const { nodes: demoNodes, totalHeight } = createDemoNodes(screenWidth, screenHeight);
      setNodes(updateNodeStates(demoNodes, 0));
      setContentHeight(totalHeight);
    } finally {
      setIsLoading(false);
    }
  }, [session, screenWidth, screenHeight, currentNodeIndex, updateNodeStates]);

  // Atualiza estados quando currentNodeIndex muda
  useEffect(() => {
    if (nodes.length > 0) {
      setNodes((prevNodes) => updateNodeStates(prevNodes, currentNodeIndex));
    }
  }, [currentNodeIndex, updateNodeStates]);

  // Busca inicial
  useEffect(() => {
    fetchLearningPath();
  }, []);

  const completeNode = useCallback((index: number) => {
    if (index === currentNodeIndex && index < nodes.length - 1) {
      setCurrentNodeIndex(index + 1);
    }
  }, [currentNodeIndex, nodes.length]);

  return {
    nodes,
    isLoading,
    error,
    currentNodeIndex,
    setCurrentNodeIndex,
    completeNode,
    refetch: fetchLearningPath,
    contentHeight,
  };
}

// Nodes demo
function createDemoNodes(
  screenWidth: number,
  screenHeight: number
): { nodes: TrailNodeData[]; totalHeight: number } {
  const demoModules: LearningPathModule[] = [
    { id: 1, title: "Receitas Tipo A", challenge_type: "find_errors", position: 1, required_exercises: 3 },
    { id: 2, title: "Separação Básica", challenge_type: "separacao", position: 2, required_exercises: 5 },
    { id: 3, title: "Atendimento I", challenge_type: "atendimento", position: 3, required_exercises: 2 },
    { id: 4, title: "Receitas Tipo B", challenge_type: "find_errors", position: 4, required_exercises: 3 },
    { id: 5, title: "Separação Avançada", challenge_type: "separacao", position: 5, required_exercises: 5 },
  ];

  const startY = screenHeight - 150;
  return generateNodePositions(demoModules, screenWidth, startY);
}