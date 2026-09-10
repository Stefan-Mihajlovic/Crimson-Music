import { SymbolView } from 'expo-symbols';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthFieldHandle } from '@/components/auth-field.types';
import { useVoiceSearch } from '@/hooks/use-voice-search';
import { useAppSettings } from '@/providers/settings-provider';

type LiquidSearchFieldProps = {
  onChangeText: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
  placeholder: string;
  value: string;
};

const LiquidSearchField = forwardRef<AuthFieldHandle, LiquidSearchFieldProps>(function LiquidSearchField(
  { onChangeText, onFocusChange, placeholder, value },
  ref,
) {
  const { colors } = useAppSettings();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const voiceSearch = useVoiceSearch({
    onBegin: () => inputRef.current?.focus(),
    onTranscript: onChangeText,
  });

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => {
      inputRef.current?.clear();
      onChangeText('');
    },
  }), [onChangeText]);

  return (
    <View style={styles.row}>
      <View style={[styles.field, { backgroundColor: colors.controlSurface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
        <SymbolView name="magnifyingglass" size={18} tintColor={colors.text} />
        <TextInput
          ref={inputRef}
          autoCapitalize="none"
          autoCorrect={false}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          returnKeyType="search"
          style={[styles.input, { color: colors.text }]}
          value={value}
        />
        <Pressable accessibilityLabel={voiceSearch.listening ? 'Stop voice search' : 'Start voice search'} onPress={() => void voiceSearch.toggle()} style={styles.micButton}>
          <SymbolView name={voiceSearch.listening ? 'waveform' : 'mic.fill'} size={voiceSearch.listening ? 19 : 17} tintColor={voiceSearch.listening ? colors.accent : colors.text} />
        </Pressable>
      </View>
      {focused ? (
        <Pressable
          accessibilityLabel="Cancel search"
          onPress={() => {
            voiceSearch.stop();
            inputRef.current?.clear();
            onChangeText('');
            inputRef.current?.blur();
          }}
          style={[styles.cancel, { backgroundColor: colors.controlSurface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
          <SymbolView name="xmark" size={18} tintColor={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
});

export default LiquidSearchField;

const styles = StyleSheet.create({
  row: { height: 46, flexDirection: 'row', gap: 9 },
  field: { flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, borderRadius: 23, overflow: 'hidden' },
  input: { flex: 1, height: 46, fontSize: 15 },
  micButton: { width: 32, height: 42, alignItems: 'center', justifyContent: 'center' },
  cancel: { width: 46, height: 46, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 23 },
});
