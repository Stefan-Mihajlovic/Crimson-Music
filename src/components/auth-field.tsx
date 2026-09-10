import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { AuthFieldHandle } from '@/components/auth-field.types';
import { useAppSettings } from '@/providers/settings-provider';

type AuthFieldProps = TextInputProps & { hasError?: boolean };

const AuthField = forwardRef<AuthFieldHandle, AuthFieldProps>(function AuthField(
  { hasError = false, style, ...props },
  ref,
) {
  const { colors } = useAppSettings();
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => inputRef.current?.clear(),
  }));

  return (
    <View style={[styles.shell, { backgroundColor: colors.controlSurface, borderColor: hasError ? '#FF596E' : colors.border }]}>
      <TextInput
        ref={inputRef}
        {...props}
        autoCapitalize="none"
        autoCorrect={false}
        cursorColor={colors.accent}
        placeholderTextColor={colors.mutedText}
        selectionColor={colors.accentSoft}
        style={[styles.input, { color: colors.text }, style]}
      />
    </View>
  );
});

export default AuthField;

const styles = StyleSheet.create({
  shell: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 17,
    fontSize: 16,
  },
});
