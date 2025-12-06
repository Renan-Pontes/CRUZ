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
      <Image source={require("../../assets/images/mascote.png")} style={{ width: 60, height: 70 }} resizeMode="contain" />
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
