import { 
  TextInput, 
  View, 
  StyleSheet, 
  TouchableOpacity,
  TextInputProps,
} from "react-native";
import { IconSymbol } from "./icon-symbol";
import { SymbolViewProps } from "expo-symbols";
import { ThemedText } from "../themed-text";
import { forwardRef } from "react";

// Constants
const ICON_COLOR = "#999";
const ICON_SIZE = 20;

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
  ...props 
}, ref) => {
  return (
    <View style={styles.container}>
      <View style={[styles.inputContainer, error && styles.inputContainerError]}>
        <IconSymbol 
          name={iconName} 
          size={ICON_SIZE} 
          color={error ? "#E74C3C" : ICON_COLOR} 
          style={styles.inputIcon}
        />
        <TextInput
          ref={ref}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={ICON_COLOR}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {showToggle && (
          <TouchableOpacity 
            onPress={onToggle}
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
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
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
