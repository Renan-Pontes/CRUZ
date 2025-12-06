import React from "react";
import { Animated, StyleSheet } from "react-native";
import { Svg, Path } from "react-native-svg";

interface TrailPointerProps {
  position: Animated.ValueXY;
}

export function TrailPointer({ position }: TrailPointerProps) {
  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
          ],
        },
      ]}
    >
      <Svg width="40" height="60" viewBox="0 0 40 60">
        <Path
          d="M20,0 C30,0 40,10 40,20 C40,30 30,40 20,60 C10,40 0,30 0,20 C0,10 10,0 20,0 Z"
          fill="#F44336"
          stroke="#B71C1C"
          strokeWidth="2"
        />
        <Path
          d="M20,10 C25,10 30,15 30,20 C30,25 25,30 20,30 C15,30 10,25 10,20 C10,15 15,10 20,10 Z"
          fill="#263238"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 40,
    height: 60,
    zIndex: 1000,
  },
});
