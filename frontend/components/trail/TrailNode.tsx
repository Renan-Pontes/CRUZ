import React from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";

type IconName = "document" | "brain" | null;

interface TrailNodeProps {
  x: number;
  y: number;
  icon: IconName;
  completed: boolean;
  isActive: boolean;
  onPress: () => void;
}

export function TrailNode({ x, y, icon, completed, isActive, onPress }: TrailNodeProps) {
  const iconChar =
    icon === "document" ? "📄" : icon === "brain" ? "🧠" : "•";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.node,
        {
          left: x - 24,
          top: y - 24,
          backgroundColor: completed ? "#87dbba" : "#ffffff33",
          borderColor: isActive ? "#FFD166" : "rgba(255,255,255,0.3)",
        },
      ]}
    >
      <Text style={styles.icon}>{iconChar}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  node: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 20,
  },
});
