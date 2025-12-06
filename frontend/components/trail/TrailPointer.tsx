import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Image } from "react-native";

interface TrailPointerProps {
  position: Animated.ValueXY;
  isStatic?: boolean;
}

export function TrailPointer({ position, isStatic = false }: TrailPointerProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isStatic) return;
    
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 4,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    float.start();
    return () => float.stop();
  }, [isStatic]);

  // Se estático, renderiza só a imagem (animação controlada pelo pai)
  if (isStatic) {
    return (
      <Image
        source={require("../../assets/images/mascote.png")}
        style={styles.mascot}
        resizeMode="contain"
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX: position.x },
            { translateY: Animated.add(position.y, floatAnim) },
          ],
        },
      ]}
    >
      <Image
        source={require("../../assets/images/mascote.png")}
        style={styles.mascot}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 60,
    height: 75,
    zIndex: 1000,
  },
  mascot: {
    width: 60,
    height: 75,
  },
}); 