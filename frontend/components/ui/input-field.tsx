import { 
  TextInput, 
  View, 
  StyleSheet, 
  TouchableOpacity,
  TextInputProps,
  Animated,
} from "react-native";
import { IconSymbol } from "./icon-symbol";
import { SymbolViewProps } from "expo-symbols";
import { ThemedText } from "../themed-text";
import { forwardRef, useRef, useState, useEffect, useCallback } from "react";

// Constants
const ICON_COLOR = "#999";
const ICON_SIZE = 20;
const CHAR_DELAY = 40; // ms entre cada caractere

// Input Field Component
interface InputFieldProps extends TextInputProps {
  iconName: SymbolViewProps['name'];
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  showToggle?: boolean;
  onToggle?: () => void;
  isPasswordVisible?: boolean;
  error?: boolean;
  errorMessage?: string;
}

export const InputField = forwardRef<TextInput, InputFieldProps>(({ 
  iconName, 
  placeholder, 
  value, 
  onChangeText,
  showToggle = false,
  onToggle,
  isPasswordVisible = false,
  error = false,
  errorMessage,
  secureTextEntry,
  ...props 
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [revealedCount, setRevealedCount] = useState(isPasswordVisible ? value.length : 0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Array de animações para cada caractere (scale)
  const charAnims = useRef<Animated.Value[]>([]).current;
  
  const isPasswordField = showToggle || secureTextEntry;

  // Garante que temos animações suficientes
  useEffect(() => {
    while (charAnims.length < value.length) {
      charAnims.push(new Animated.Value(1));
    }
  }, [value.length]);

  // Sincroniza revealedCount quando não está animando
  useEffect(() => {
    if (!isAnimating) {
      setRevealedCount(isPasswordVisible ? value.length : 0);
    }
  }, [value.length, isPasswordVisible, isAnimating]);

  const animateChar = useCallback((index: number) => {
    if (charAnims[index]) {
      charAnims[index].setValue(1.5);
      Animated.spring(charAnims[index], {
        toValue: 1,
        friction: 6,
        tension: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [charAnims]);

  const handleToggle = () => {
    if (!onToggle || isAnimating || value.length === 0) {
      onToggle?.();
      return;
    }

    setIsAnimating(true);
    const revealing = !isPasswordVisible;
    const charCount = value.length;
    
    // Chama toggle imediatamente para o ícone mudar
    onToggle();

    if (revealing) {
      // Reveal: de 0 até length
      let current = 0;
      const interval = setInterval(() => {
        if (current < charCount) {
          setRevealedCount(current + 1);
          animateChar(current);
          current++;
        } else {
          clearInterval(interval);
          setIsAnimating(false);
        }
      }, CHAR_DELAY);
    } else {
      // Hide: de length até 0
      let current = charCount;
      const interval = setInterval(() => {
        if (current > 0) {
          current--;
          setRevealedCount(current);
          animateChar(current);
        } else {
          clearInterval(interval);
          setIsAnimating(false);
        }
      }, CHAR_DELAY);
    }
  };

  // Gera a string de display baseado em quantos caracteres estão revelados
  const getDisplayString = () => {
    if (!isPasswordField) return value;
    
    return value
      .split('')
      .map((char, i) => (i < revealedCount ? char : '•'))
      .join('');
  };

  // Renderiza caracteres animados individualmente
  const renderAnimatedChars = () => {
    if (value.length === 0) {
      return <ThemedText style={styles.placeholder}>{placeholder}</ThemedText>;
    }

    return (
      <View style={styles.charsRow}>
        {value.split('').map((char, index) => {
          const displayChar = index < revealedCount ? char : '•';
          const animValue = charAnims[index] || new Animated.Value(1);
          
          return (
            <Animated.Text
              key={index}
              style={[
                styles.char,
                { transform: [{ scale: animValue }] }
              ]}
            >
              {displayChar}
            </Animated.Text>
          );
        })}
      </View>
    );
  };

  // Mostra visualização customizada quando é campo de senha, não está focado, e tem valor
  const showAnimatedDisplay = isPasswordField && !isFocused && value.length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.inputContainer, error && styles.inputContainerError]}>
        <IconSymbol 
          name={iconName} 
          size={ICON_SIZE} 
          color={error ? "#E74C3C" : ICON_COLOR} 
          style={styles.inputIcon}
        />
        
        <View style={styles.inputWrapper}>
          {showAnimatedDisplay ? (
            <TouchableOpacity 
              style={styles.animatedDisplay}
              onPress={() => setIsFocused(true)}
              activeOpacity={1}
            >
              {renderAnimatedChars()}
            </TouchableOpacity>
          ) : (
            <TextInput
              ref={ref}
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor={ICON_COLOR}
              value={value}
              onChangeText={onChangeText}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={isPasswordField && !isPasswordVisible}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              {...props}
            />
          )}
        </View>

        {showToggle && (
          <TouchableOpacity 
            onPress={handleToggle}
            style={styles.eyeIcon}
            activeOpacity={0.7}
          >
            <IconSymbol 
              name={isPasswordVisible ? "eye" : "eye.slash"} 
              size={ICON_SIZE} 
              color={ICON_COLOR}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && errorMessage && (
        <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  inputContainerError: {
    borderColor: "#E74C3C",
  },
  inputIcon: {
    marginRight: 10,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: "center",
    height: "100%",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },
  animatedDisplay: {
    flex: 1,
    justifyContent: "center",
  },
  charsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  char: {
    fontSize: 16,
    color: "#000",
    includeFontPadding: false,
  },
  placeholder: {
    fontSize: 16,
    color: ICON_COLOR,
  },
  eyeIcon: {
    padding: 5,
    marginLeft: 10,
  },
  errorText: {
    color: "#E74C3C",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 20,
  },
});