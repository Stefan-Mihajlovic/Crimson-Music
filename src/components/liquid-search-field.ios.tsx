import {
  Host,
  HStack,
  Image as SwiftUIImage,
  Text as SwiftUIText,
  TextField,
  TextFieldRef,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  autocorrectionDisabled,
  background,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
  strokeBorder,
  submitLabel,
  textFieldStyle,
  textInputAutocapitalization,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  const { colors, isDark, performanceMode, reduceMotion } = useAppSettings();
  const nativeText = useNativeState(value);
  const textFieldRef = useRef<TextFieldRef>(null);
  const [focused, setFocused] = useState(false);
  const voiceSearch = useVoiceSearch({
    onBegin: () => void textFieldRef.current?.focus(),
    onTranscript: (transcript) => {
      nativeText.set(transcript);
      onChangeText(transcript);
    },
  });

  useEffect(() => {
    if (nativeText.get() !== value) nativeText.set(value);
  }, [nativeText, value]);

  useImperativeHandle(ref, () => ({
    focus: () => void textFieldRef.current?.focus(),
    blur: () => void textFieldRef.current?.blur(),
    clear: () => {
      nativeText.set('');
      onChangeText('');
      void textFieldRef.current?.clear();
    },
  }), [nativeText, onChangeText]);

  const cancelSearch = () => {
    voiceSearch.stop();
    nativeText.set('');
    onChangeText('');
    void textFieldRef.current?.clear();
    void textFieldRef.current?.blur();
  };

  return (
    <View style={styles.shell}>
      <Host
        colorScheme={isDark ? 'dark' : 'light'}
        ignoreSafeArea="container"
        style={styles.host}>
        <HStack spacing={10} modifiers={[
          frame({ maxWidth: 10000, height: 52 }),
          ...(!performanceMode && !reduceMotion ? [animation(Animation.spring({ duration: 0.42, bounce: 0.16 }), focused)] : []),
        ]}>
          <HStack
            spacing={9}
            modifiers={[
              frame({ maxWidth: 10000, height: 52, alignment: 'leading' }),
              padding({ horizontal: 14 }),
              background(colors.controlSurface, shapes.capsule()),
              strokeBorder({ content: colors.border, style: { lineWidth: StyleSheet.hairlineWidth }, shape: 'capsule' }),
            ]}>
            <SwiftUIImage systemName="magnifyingglass" size={18} color={colors.text} />
            <TextField
              ref={textFieldRef}
              onFocusChange={(nextFocused) => {
                setFocused(nextFocused);
                onFocusChange?.(nextFocused);
              }}
              onTextChange={onChangeText}
              placeholder={placeholder}
              text={nativeText}
              modifiers={[
                textFieldStyle('plain'),
                textInputAutocapitalization('never'),
                autocorrectionDisabled(true),
                submitLabel('search'),
                font({ size: 16, weight: 'regular' }),
                foregroundStyle(colors.text),
                tint(colors.accent),
                frame({ maxWidth: 10000, height: 52, alignment: 'leading' }),
              ]}>
              <TextField.Placeholder>
                <SwiftUIText modifiers={[foregroundStyle(colors.mutedText)]}>{placeholder}</SwiftUIText>
              </TextField.Placeholder>
            </TextField>
            <SwiftUIImage
              systemName={voiceSearch.listening ? 'waveform' : 'mic.fill'}
              size={voiceSearch.listening ? 19 : 17}
              color={voiceSearch.listening ? colors.accent : colors.text}
              onPress={() => void voiceSearch.toggle()}
            />
          </HStack>

          {focused ? (
            <SwiftUIImage
              systemName="xmark"
              size={18}
              color={colors.text}
              onPress={cancelSearch}
              modifiers={[
                frame({ width: 52, height: 52 }),
                background(colors.controlSurface, shapes.circle()),
                strokeBorder({ content: colors.border, style: { lineWidth: StyleSheet.hairlineWidth }, shape: 'circle' }),
              ]}
            />
          ) : null}
        </HStack>
      </Host>
    </View>
  );
});

export default LiquidSearchField;

const styles = StyleSheet.create({
  shell: { width: '100%', height: 52 },
  host: { flex: 1 },
});
