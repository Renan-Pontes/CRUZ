import React from "react";
import { Animated, StyleSheet } from "react-native";
import { Svg, Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface TrailPathProps {
  nodes: Array<{ x: number; y: number }>;
}

export function TrailPath({ nodes }: TrailPathProps) {
  if (nodes.length < 2) return null;

  // Create a curved path through all nodes using quadratic bezier curves
  let pathData = `M ${nodes[0].x} ${nodes[0].y}`;
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    
    // Calculate control point for curve
    const controlX = (current.x + next.x) / 2 + 50;
    const controlY = (current.y + next.y) / 2;
    
    pathData += ` Q ${controlX} ${controlY}, ${next.x} ${next.y}`;
  }

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Path
        d={pathData}
        stroke="#FFC107"
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
