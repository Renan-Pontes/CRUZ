import React from "react";
import { Animated, StyleSheet, Image } from "react-native";

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
