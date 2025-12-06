import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

interface TrailPathProps {
  nodes: Array<{ x: number; y: number }>;
}

export function TrailPath({ nodes }: TrailPathProps) {
  if (nodes.length < 2) return null;

  // Cria path curvo
  let pathData = `M ${nodes[0].x} ${nodes[0].y}`;

  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    const controlX = (current.x + next.x) / 2 + (i % 2 === 0 ? 30 : -30);
    const controlY = (current.y + next.y) / 2;
    pathData += ` Q ${controlX} ${controlY}, ${next.x} ${next.y}`;
  }

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Path
        d={pathData}
        stroke="rgba(0, 0, 0, 0.2)"
        strokeWidth={14}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={pathData}
        stroke="#FFC107"
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}