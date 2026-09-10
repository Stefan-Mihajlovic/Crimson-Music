import {
  Host,
  SecureField,
  SecureFieldRef,
  Text as SwiftUIText,
  TextField,
  TextFieldRef,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  background,
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType as keyboardTypeModifier,
  onSubmit,
  padding,
  shapes,
  strokeBorder,
  submitLabel,
  textContentType as textContentTypeModifier,
  textFieldStyle,
  textInputAutocapitalization,
  tint,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  TextInputProps,
  TextInputSubmitEditingEventData,
  NativeSyntheticEvent,
  View,
} from 'react-native';

import { AuthFieldHandle } from '@/components/auth-field.types';
import { useAppSettings } from '@/providers/settings-provider';
import { NativeTextSync } from '@/services/native-text-sync';

type AuthFieldProps = TextInputProps & { hasError?: boolean };

type SwiftUIKeyboardType = Parameters<typeof keyboardTypeModifier>[0];
type SwiftUISubmitLabel = Parameters<typeof submitLabel>[0];
type SwiftUITextContentType = Parameters<typeof textContentTypeModifier>[0];

function mapKeyboardType(value?: KeyboardTypeOptions): SwiftUIKeyboardType | undefined {
  if (!value) return undefined;
  if (value === 'numeric') return 'decimal-pad';
  if (value === 'number-pad') return 'numeric';
  if (value === 'visible-password') return 'default';
  return value as SwiftUIKeyboardType;
}

function mapSubmitLabel(value?: TextInputProps['returnKeyType']): SwiftUISubmitLabel | undefined {
  if (!value) return undefined;
  if (value === 'google' || value === 'yahoo') return 'search';
  if (value === 'default' || value === 'none' || value === 'previous' || value === 'emergency-call') {
    return 'return';
  }
  return value as SwiftUISubmitLabel;
}

const AuthField = forwardRef<AuthFieldHandle, AuthFieldProps>(function AuthField(
  {
    autoFocus,
    editable = true,
    hasError = false,
    keyboardType,
    maxLength,
    onChangeText,
    onSubmitEditing,
    placeholder,
    returnKeyType,
    secureTextEntry,
    textContentType,
    value = '',
  },
  ref,
) {
  const { colors, isDark } = useAppSettings();
  const nativeText = useNativeState(value);
  const textSync = useRef(new NativeTextSync(value));
  const textFieldRef = useRef<TextFieldRef>(null);
  const secureFieldRef = useRef<SecureFieldRef>(null);

  useEffect(() => {
    if (textSync.current.shouldWriteProp(value) && nativeText.get() !== value) nativeText.set(value);
  }, [nativeText, value]);

  const handleTextChange = (text: string) => {
    textSync.current.nativeChanged(text);
    onChangeText?.(text);
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (secureTextEntry) void secureFieldRef.current?.focus();
      else void textFieldRef.current?.focus();
    },
    blur: () => {
      if (secureTextEntry) void secureFieldRef.current?.blur();
      else void textFieldRef.current?.blur();
    },
    clear: () => {
      if (secureTextEntry) void secureFieldRef.current?.clear();
      else void textFieldRef.current?.clear();
    },
  }), [secureTextEntry]);

  const submit = () => {
    onSubmitEditing?.({
      nativeEvent: { text: nativeText.get() },
    } as NativeSyntheticEvent<TextInputSubmitEditingEventData>);
  };

  const modifiers: ModifierConfig[] = [
    textFieldStyle('plain'),
    textInputAutocapitalization('never'),
    autocorrectionDisabled(true),
    font({ size: 16, weight: 'regular' }),
    foregroundStyle(colors.text),
    tint(colors.accent),
    padding({ horizontal: 17 }),
    frame({ maxWidth: 10000, height: 48, alignment: 'leading' }),
    background(colors.controlSurface, shapes.capsule()),
    strokeBorder({ content: hasError ? '#FF596E' : colors.border, style: { lineWidth: StyleSheet.hairlineWidth }, shape: 'capsule' }),
  ];

  const mappedKeyboardType = mapKeyboardType(keyboardType);
  const mappedSubmitLabel = mapSubmitLabel(returnKeyType);
  if (mappedKeyboardType) modifiers.push(keyboardTypeModifier(mappedKeyboardType));
  if (mappedSubmitLabel) modifiers.push(submitLabel(mappedSubmitLabel));
  if (textContentType) {
    modifiers.push(textContentTypeModifier(textContentType as SwiftUITextContentType));
  }
  if (onSubmitEditing) modifiers.push(onSubmit(submit));
  if (!editable) modifiers.push(disabled(true));

  const placeholderContent = placeholder ? (
    <SwiftUIText modifiers={[foregroundStyle(colors.mutedText)]}>
      {placeholder}
    </SwiftUIText>
  ) : null;

  return (
    <View style={styles.hostShell}>
      <Host
        colorScheme={isDark ? 'dark' : 'light'}
        ignoreSafeArea="container"
        style={styles.host}>
        {secureTextEntry ? (
          <SecureField
            ref={secureFieldRef}
            autoFocus={autoFocus}
            maxLength={maxLength}
            onTextChange={handleTextChange}
            placeholder={placeholder}
            text={nativeText}
            modifiers={modifiers}>
            {placeholderContent ? (
              <SecureField.Placeholder>{placeholderContent}</SecureField.Placeholder>
            ) : null}
          </SecureField>
        ) : (
          <TextField
            ref={textFieldRef}
            autoFocus={autoFocus}
            maxLength={maxLength}
            onTextChange={handleTextChange}
            placeholder={placeholder}
            text={nativeText}
            modifiers={modifiers}>
            {placeholderContent ? (
              <TextField.Placeholder>{placeholderContent}</TextField.Placeholder>
            ) : null}
          </TextField>
        )}
      </Host>
    </View>
  );
});

export default AuthField;

const styles = StyleSheet.create({
  hostShell: {
    width: '100%',
    height: 48,
    alignSelf: 'center',
  },
  host: { flex: 1 },
});
