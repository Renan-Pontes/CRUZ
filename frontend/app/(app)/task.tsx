import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Image, Platform, Text, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ThemedText } from "../../components/themed-text";
import { IconSymbol } from "../../components/ui/icon-symbol";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useStorageState } from "../useStorageState";
import { useSession } from "@/auth/ctx";
import { apiService, API_BASE_URL } from "@/services/api";

// Mock configuration to switch between tasks
const CURRENT_TASK_MOCK: 'A' | 'B' | 'C' = 'A';

export default function TaskScreen() {
  const { session } = useSession();
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [selectedOptions, setSelectedOptions] = React.useState<string[]>([]);
  const [isLandscape, setIsLandscape] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [attemptCompleted, setAttemptCompleted] = useState(false);
  const [[loadingSeen, rotateSeen], setRotateSeen] = useStorageState("rotateOverlaySeen");
  const [[loadingLocalCompleted, localCompletedRaw], setLocalCompleted] = useStorageState("localCompletionsCount");
  const [optionStatus, setOptionStatus] = useState<Record<string, "correct" | "wrong">>({});
  const params = useLocalSearchParams<{ challengeType?: string; moduleId?: string; recipeType?: string }>();
  const challengeTypeParam = (params.challengeType as string) || "find_errors";
  const moduleIdParam = params.moduleId ? Number(params.moduleId) : undefined;
  const recipeTypeParam = (params.recipeType as string) || "";
  const recipeType = (["A", "B", "C"].includes(recipeTypeParam) 
    ? (recipeTypeParam as "A" | "B" | "C") 
    : challengeTypeParam === "find_errors" 
      ? CURRENT_TASK_MOCK 
      : null);
  const showRotateOverlay = !!recipeType && (recipeType === "A" || recipeType === "B") && !isLandscape && !rotateSeen;
  const [isLoading, setIsLoading] = useState(true);
  const [findData, setFindData] = useState<any>(null);
  const [separacaoData, setSeparacaoData] = useState<any>(null);
  const [atendimentoData, setAtendimentoData] = useState<any>(null);

  React.useEffect(() => {
    if (Platform.OS === "web") return;

    const setup = async () => {
      const current = await ScreenOrientation.getOrientationAsync();
      const landscapeNow = current === ScreenOrientation.Orientation.LANDSCAPE_LEFT || current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(landscapeNow);

      if (recipeType === "C") {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      } else if (recipeType === "A" || recipeType === "B") {
        await ScreenOrientation.unlockAsync(); // permite o usuário girar
      } 
    };

    setup();

    const sub = ScreenOrientation.addOrientationChangeListener((event) => {
      const next = event.orientationInfo.orientation;
      const isLand = next === ScreenOrientation.Orientation.LANDSCAPE_LEFT || next === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(isLand);
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(sub);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, [recipeType]);

  const backgroundImage = (recipeType || findData?.recipe_type) === "C"
    ? require("../../assets/images/background-em-pe.png")
    : require("../../assets/images/backgroud-task.png");

  const recipeImage = useMemo(() => {
    if (findData?.image_url) {
      return { uri: findData.image_url };
    }
    const type = (recipeType || CURRENT_TASK_MOCK) as "A" | "B" | "C";
    return {
      'A': require('../../assets/images/receitaA.png'),
      'B': require('../../assets/images/receitaB.png'),
      'C': require('../../assets/images/receitaC.png'),
    }[type];
  }, [findData, recipeType]);


  const options = useMemo(() => {
    if (challengeTypeParam === "find_errors" && findData?.options) {
      return findData.options.map((opt: string, idx: number) => ({
        id: String(idx + 1),
        label: opt,
        correct: false,
      }));
    }
    // fallback menu options
    return [
      { id: "1", label: "Carimbo do fornecedor", correct: true },
      { id: "2", label: "Quantidade forma farmacêutica", correct: false },
      { id: "3", label: "Posologia", correct: true },
      { id: "4", label: "Indentificação de Emitente", correct: true },
      { id: "5", label: "Identificação do fornecedor", correct: true },
    ];
  }, [challengeTypeParam, findData]);

  const handleOptionPress = async (id: string) => {
    if (isSubmitting || attemptCompleted) return;
    if (challengeTypeParam !== "find_errors") {
      // toggle only
      if (selectedOptions.includes(id)) {
        setSelectedOptions(selectedOptions.filter(item => item !== id));
      } else {
        setSelectedOptions([...selectedOptions, id]);
      }
      return;
    }

    if (!session) {
      Alert.alert("Sessão inválida", "Faça login novamente.");
      router.replace("/sign-in");
      return;
    }

    const option = options.find((o) => o.id === id);
    if (!option || !findData?.attempt_id) return;

    try {
      setIsSubmitting(true);
      const res = await apiService.submitFindErrorsError(
        session,
        findData.attempt_id,
        option.label,
        moduleIdParam
      );
      setOptionStatus((prev) => ({
        ...prev,
        [id]: res.correct ? "correct" : "wrong",
      }));

      if (res.completed) {
        // Apenas registra conclusão se for attempt atual (não replays)
        const currentCount = parseInt(localCompletedRaw || "0", 10) || 0;
        setLocalCompleted(String(currentCount + 1));
        setAttemptCompleted(true);
        Alert.alert(
          res.correct ? "Exercício concluído" : "Exercício concluído",
          `Erros encontrados: ${res.found_errors}/${res.total_errors}`,
          [{ text: "OK", onPress: () => router.replace("/(app)/trail") }]
        );
        setTimeout(() => router.replace("/(app)/trail"), 1200);
      } else {
        if (!res.correct) {
          Alert.alert("Errou", "Esse item não é um erro. Tente novamente.");
        }
      }
    } catch (e) {
      console.log("Erro ao enviar erro:", e);
      Alert.alert("Erro", "Não foi possível registrar o clique. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setAttemptCompleted(false);
      if (!session) {
        setIsLoading(false);
        return;
      }
      try {
        if (challengeTypeParam === "atendimento") {
          const data = await apiService.getAtendimento(session);
          setAtendimentoData(data);
        } else if (challengeTypeParam === "separacao") {
          const data = await apiService.startSeparacao(session, false);
          setSeparacaoData(data);
        } else {
          const data = await apiService.startFindErrors(session, false);
          setFindData(data);
        }
      } catch (e) {
        console.log("Erro ao carregar exercício:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [challengeTypeParam, session]);

  const handleSubmit = async () => {
    if (isSubmitting || attemptCompleted) return;
    if (!session) {
      Alert.alert("Sessão inválida", "Faça login novamente.");
      router.replace("/sign-in");
      return;
    }
    setIsSubmitting(true);
    let score = 0;

    try {
      if (challengeTypeParam === "atendimento" && atendimentoData?.challenge_id) {
        const response = await apiService.submitAtendimento(
          session,
          atendimentoData.challenge_id,
          "Resposta enviada pelo app",
          { moduleId: moduleIdParam, scenario: atendimentoData.customer_scenario, contextType: atendimentoData.context_type }
        );
        score = response.score || 0;
      } else if (challengeTypeParam === "separacao") {
        // Garante um attempt
        const attempt = separacaoData || (await apiService.startSeparacao(session, false));
        const med = attempt?.medications?.[attempt.current_index || 0];
        if (med) {
          const result = await apiService.submitSeparacaoAnswer(
            session,
            attempt.attempt_id,
            med.category,
            moduleIdParam,
            med.id
          );
          score = result.final_score || result.xp_earned || 0;
        }
      } else {
        // find_errors: envia primeiro item selecionado ou o primeiro disponível
        const attempt = findData?.attempt_id
          ? findData
          : await apiService.startFindErrors(session, false);
        const errorToSend =
          (selectedOptions[0] && options.find(o => o.id === selectedOptions[0])?.label) ||
          attempt?.options?.[0];
        if (attempt?.attempt_id && errorToSend) {
          await fetch(`${API_BASE_URL}/api/challenges/find-errors/attempt/${attempt.attempt_id}/submit/`, {
            method: "POST",
            headers: {
              Authorization: `Session ${session}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ found_error: errorToSend }),
          }).catch(() => {});
          score = 10;
        }
      }

      // Só incrementa progresso local se não for replay: considera attempt_id atual para evitar duplicar
      const currentCount = parseInt(localCompletedRaw || "0", 10) || 0;
      const nextCount = currentCount + 1;
      setLocalCompleted(String(nextCount));
      setAttemptCompleted(true);

      router.replace({
        pathname: "/(app)/trail",
        params: { lastScore: String(score) },
      });
    } catch (e) {
      console.log("Erro ao enviar exercício:", e);
      Alert.alert("Erro", "Não foi possível enviar o exercício. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <ImageBackground 
          source={backgroundImage} 
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.contentContainer}>
            <Image resizeMode="contain" source={recipeImage} style={styles.scrollContent} />
          </View>
          
          {/* Back button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <IconSymbol name="chevron.right" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '180deg' }] }} />
            <ThemedText style={styles.backText}>Voltar</ThemedText>
          </TouchableOpacity>

          {/* Search Button */}
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.8}
          >
            <Image 
              source={require('../../assets/images/lupa.png')} 
              style={styles.searchIcon} 
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Menu Modal */}
          {menuVisible && (
            <View style={styles.menuOverlay}>
              <TouchableOpacity style={styles.overlayBackground} onPress={() => setMenuVisible(false)} />
              <View style={styles.menuContainer}>
                {options.map((option) => {
                  const isSelected = selectedOptions.includes(option.id);
                  return (
                    <TouchableOpacity 
                      key={option.id} 
                      style={[
                        styles.menuItem, 
                        (optionStatus[option.id] === "correct" && styles.menuItemCorrect),
                        (optionStatus[option.id] === "wrong" && styles.menuItemIncorrect)
                      ]}
                      onPress={() => handleOptionPress(option.id)}
                    >
                      {optionStatus[option.id] && (
                        <IconSymbol 
                          name={optionStatus[option.id] === "correct" ? "checkmark" : "xmark"} 
                          size={20} 
                          color={optionStatus[option.id] === "correct" ? "#4CAF50" : "#F44336"} 
                          style={{ marginRight: 8 }}
                        />
                      )}
                      <ThemedText style={[
                        styles.menuText,
                        optionStatus[option.id] === "correct" && styles.textCorrect,
                        optionStatus[option.id] === "wrong" && styles.textIncorrect,
                      ]}>
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          
          {/* Overlay para rotação obrigatória */}
          {showRotateOverlay && (
            <View style={styles.rotateOverlay}>
              <View style={styles.rotateCard}>
                <Text style={styles.rotateIcon}>↻</Text>
                <Text style={styles.rotateTitle}>Vire o aparelho</Text>
                <Text style={styles.rotateSub}>Receitas A e B são melhores em paisagem</Text>
                <TouchableOpacity
                  style={styles.rotateCta}
                  onPress={() => setRotateSeen("1")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.rotateCtaText}>Okay</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ImageBackground>
        {/* Submit bar */}
        <View style={styles.submitBar}>
          <View>
            <Text style={styles.submitLabel}>Pronto para enviar?</Text>
            <Text style={styles.submitSub}>
              {challengeTypeParam === "atendimento"
                ? "Enviar a resposta escrita para correção."
                : "Confirme suas seleções e finalize o desafio."}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>{isSubmitting ? "Enviando..." : "Enviar"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#364A5E', // Fallback color
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 1000,
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  searchButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  searchIcon: {
    width: 45,
    height: 45,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    width: '60%',
    borderWidth: 2,
    borderColor: '#673AB7', // Roxo
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    marginBottom: 8,
  },
  menuItemCorrect: {
    backgroundColor: '#C8E6C9', // Verde claro
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  menuItemIncorrect: {
    backgroundColor: '#FFCDD2', // Vermelho claro
    borderWidth: 1,
    borderColor: '#F44336',
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  textCorrect: {
    color: '#2E7D32',
  },
  textIncorrect: {
    color: '#C62828',
  },
  rotateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 3000,
  },
  rotateCard: {
    backgroundColor: "rgba(36, 50, 65, 0.9)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(135, 219, 186, 0.4)",
  },
  rotateIcon: {
    fontSize: 42,
    color: "#87dbba",
    marginBottom: 8,
  },
  rotateTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  rotateSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  rotateCta: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#87dbba",
    borderRadius: 10,
  },
  rotateCtaText: {
    color: "#1a3a2f",
    fontWeight: "800",
    fontSize: 14,
  },
  submitBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 4000,
    elevation: 12,
  },
  submitLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  submitSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: "#87dbba",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#1a3a2f",
    fontWeight: "800",
    fontSize: 14,
  },
});
