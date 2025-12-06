import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { IconSymbol } from "../ui/icon-symbol";

interface TrailNodeProps {
  x: number;
  y: number;
  icon?: 'brain' | 'document' | null;
  completed?: boolean;
  isActive?: boolean;
  onPress: () => void;
}

export function TrailNode({ x, y, icon, completed = false, isActive = false, onPress }: TrailNodeProps) {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { left: x - 50, top: y - 50 }, // Center the 100x100 circle
        isActive && styles.active,
        completed && styles.completed,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.circle}>
        {icon === 'brain' && (
          <IconSymbol name="brain" size={50} color="#E91E63" />
        )}
        {icon === 'document' && (
          <IconSymbol name="doc.text" size={50} color="#000" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  active: {
    transform: [{ scale: 1.1 }],
  },
  completed: {
    opacity: 0.7,
  },
});
