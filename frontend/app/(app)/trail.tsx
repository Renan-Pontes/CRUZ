import React, { useState, useRef } from "react";
import { View, StyleSheet, Dimensions, Animated } from "react-native";
import { router } from "expo-router";
import { TrailNode } from "../../components/trail/TrailNode";
import { TrailPath } from "../../components/trail/TrailPath";
import { TrailPointer } from "../../components/trail/TrailPointer";
import { ProgressBar } from "../../components/trail/ProgressBar";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Trail nodes configuration (bottom to top progression)
const TRAIL_NODES = [
  { id: 3, x: 180, y: SCREEN_HEIGHT - 200, icon: 'document' as const, completed: false }, // Start (33%)
  { id: 2, x: 240, y: 320, icon: null, completed: false }, // Middle (66%)
  { id: 1, x: 62, y: 120, icon: 'brain' as const, completed: false }, // End (100%)
];

export default function Trail() {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [completedNodes, setCompletedNodes] = useState<number[]>([0]); // Start with first node completed
  const animatedPosition = useRef(new Animated.ValueXY({
    x: TRAIL_NODES[0].x,
    y: TRAIL_NODES[0].y - 90,
  })).current;

  const handleNodePress = (index: number) => {
    const node = TRAIL_NODES[index];

    // Animate pointer to new position
    Animated.timing(animatedPosition, {
      toValue: {
        x: node.x , // Offset to center pointer on node
        y: node.y - 90, // Offset to position above node
      },
      duration: 500,
      useNativeDriver: false,
    }).start();

    // Update current node
    setCurrentNodeIndex(index);

    // Mark nodes from start up to current as completed
    const newCompleted = Array.from({ length: index + 1 }, (_, i) => i);
    setCompletedNodes(newCompleted);
    
    // Navigate to task screen if clicking first node
    if (index === 0) {
      router.push("/(app)/task");
      return;
    }
  };

  const progress = completedNodes.length / TRAIL_NODES.length;

  return (
    <View style={styles.container}>
      {/* Path connecting nodes */}
      <TrailPath nodes={TRAIL_NODES} />

      {/* Nodes */}
      {TRAIL_NODES.map((node, index) => (
        <TrailNode
          key={node.id}
          x={node.x}
          y={node.y}
          icon={node.icon}
          completed={completedNodes.includes(index)}
          isActive={index === currentNodeIndex}
          onPress={() => handleNodePress(index)}
        />
      ))}

      {/* Animated pointer */}
      <TrailPointer position={animatedPosition} />

      {/* Progress bar */}
      <ProgressBar progress={progress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#364A5E",
  },
});
