import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Image } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "../../components/themed-text";
import { IconSymbol } from "../../components/ui/icon-symbol";
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

// Mock configuration to switch between tasks
const CURRENT_TASK_MOCK: 'A' | 'B' | 'C' = 'A';

export default function TaskScreen() {
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [selectedOptions, setSelectedOptions] = React.useState<string[]>([]);

  if (Platform.OS !== "web") {
  useFocusEffect(
    React.useCallback(() => {
      // 👉 Quando a tela é carregada / exibida
      if (CURRENT_TASK_MOCK === 'C') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }

      // 👉 Quando a tela é desmontada / sair
      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT
        );
      };
    }, [])
  );
}
  const backgroundImage = CURRENT_TASK_MOCK === 'C' 
    ? require("../../assets/images/background-em-pe.png")
    : require("../../assets/images/backgroud-task.png");

  const recipeImage = {
    'A': require('../../assets/images/receitaA.png'),
    'B': require('../../assets/images/receitaB.png'),
    'C': require('../../assets/images/receitaC.png'),
  }[CURRENT_TASK_MOCK];


  const options = [
    { id: '1', label: 'Carimbo do fornecedor', correct: true },
    { id: '2', label: 'Quantidade forma farmacêutica', correct: false },
    { id: '3', label: 'Posologia', correct: true },
    { id: '4', label: 'Indentificação de Emitente', correct: true },
    { id: '5', label: 'Identificação do fornecedor', correct: true },
  ];

  const handleOptionPress = (id: string) => {
    if (selectedOptions.includes(id)) {
      setSelectedOptions(selectedOptions.filter(item => item !== id));
    } else {
      setSelectedOptions([...selectedOptions, id]);
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
                        isSelected && (option.correct ? styles.menuItemCorrect : styles.menuItemIncorrect)
                      ]}
                      onPress={() => handleOptionPress(option.id)}
                    >
                      {isSelected && (
                        <IconSymbol 
                          name={option.correct ? "checkmark" : "xmark"} 
                          size={20} 
                          color={option.correct ? "#4CAF50" : "#F44336"} 
                          style={{ marginRight: 8 }}
                        />
                      )}
                      <ThemedText style={[
                        styles.menuText,
                        isSelected && (option.correct ? styles.textCorrect : styles.textIncorrect)
                      ]}>
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ImageBackground>
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
});