/* eslint-disable react-hooks/immutability */

import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import BouncyPressable from '@/components/bouncy-pressable';
import BrandLogo from '@/components/brand-logo';
import { PreferencesGlassButton, PreferencesGlassSurface } from '@/components/preferences-glass';
import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { RecommendationStyle } from '@/services/auth';

type CategoryOption = {
  id: string;
  image: ImageSource;
  label: string;
};

type RecommendationOption = {
  id: RecommendationStyle;
  label: string;
};

const categories: CategoryOption[] = [
  { id: 'electronic', label: 'Electronic', image: require('@/assets/images/categories/electronic.jpg') },
  { id: 'hip-hop-rap', label: 'Hip-Hop/Rap', image: require('@/assets/images/categories/hip-hop-rap.jpg') },
  { id: 'pop', label: 'Pop', image: require('@/assets/images/categories/pop.jpg') },
  { id: 'r-b-soul', label: 'R&B/Soul', image: require('@/assets/images/categories/r-b-soul.jpg') },
  { id: 'rock', label: 'Rock', image: require('@/assets/images/categories/rock.jpg') },
  { id: 'ambient', label: 'Ambient', image: require('@/assets/images/categories/ambient.jpg') },
  { id: 'jazz', label: 'Jazz', image: require('@/assets/images/categories/jazz.jpg') },
  { id: 'classical', label: 'Classical', image: require('@/assets/images/categories/classical.jpg') },
  { id: 'reggae', label: 'Reggae', image: require('@/assets/images/categories/reggae.jpg') },
  { id: 'podcasts', label: 'Podcasts', image: require('@/assets/images/categories/podcasts.jpg') },
];

const recommendationOptions: RecommendationOption[] = [
  { id: 'familiar', label: 'Familiar and accessible' },
  { id: 'balanced', label: 'A balanced mix' },
  { id: 'surprise', label: 'Surprise me' },
  { id: 'underground', label: 'Deep underground' },
];

const minimumCategoryCount = 2;
const finalSliderCategories = categories.slice(0, 8);
const finalSliderColumnWidth = 104;
const finalSliderLoopWidth = finalSliderCategories.length * finalSliderColumnWidth;

export default function OnboardingScreen({ editing = false }: { editing?: boolean } = {}) {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { completeOnboarding, onboardingComplete, user } = useAuth();
  const { performanceMode, reduceMotion: reduceMotionSetting } = useAppSettings();
  const systemReduceMotion = useReducedMotion();
  const reduceMotion = performanceMode || reduceMotionSetting || systemReduceMotion;
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const isEditing = editing || mode === 'edit';
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => (user?.FavoriteCategories || []).filter((id) => categories.some((category) => category.id === id)),
  );
  const [recommendationStyle, setRecommendationStyle] = useState<RecommendationStyle>(
    () => user?.RecommendationStyle || 'balanced',
  );
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const pullProgress = useSharedValue(0);
  const pullStart = useSharedValue(0);
  const pullInteraction = useSharedValue(0);
  const idlePullOffset = useSharedValue(0);
  const pullDistance = Math.max(520, screenHeight * 0.72);
  const finalSliderTop = interpolate(
    screenHeight,
    [700, 900],
    [230, 310],
    Extrapolation.CLAMP,
  );

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);

  const close = useCallback(() => {
    if (saving.current) return;
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(account)/account');
  }, []);

  useEffect(() => {
    idlePullOffset.value = 0;
    if (step === 2 && !reduceMotion && !finishing && appActive) {
      idlePullOffset.value = withRepeat(
        withSequence(
          withTiming(-6, {
            duration: 780,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: 780,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      );
    }
    return () => cancelAnimation(idlePullOffset);
  }, [appActive, finishing, idlePullOffset, reduceMotion, step]);

  const toggleCategory = useCallback((categoryId: string) => {
    if (saving.current) return;
    setError('');
    setSelectedCategories((current) => (
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    ));
  }, []);

  const next = useCallback(() => {
    if (saving.current) return;
    if (step === 0) {
      if (selectedCategories.length < minimumCategoryCount) {
        setError(`Choose at least ${minimumCategoryCount} categories.`);
        return;
      }
      setError('');
      setStep(1);
      return;
    }
    if (step === 1) {
      setError('');
      setStep(2);
    }
  }, [selectedCategories.length, step]);

  const finishOnboarding = useCallback(async (releaseVelocity = 0) => {
    if (saving.current || !user || selectedCategories.length < minimumCategoryCount) return;
    saving.current = true;
    setFinishing(true);
    setError('');
    pullInteraction.value = 1;
    pullProgress.value = reduceMotion
      ? 1
      : withSpring(1, {
        damping: 17,
        mass: 0.62,
        overshootClamping: true,
        stiffness: 118,
        velocity: releaseVelocity,
      });
    try {
      await Promise.all([
        completeOnboarding(selectedCategories, recommendationStyle),
        new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : 620)),
      ]);
      if (!mounted.current) return;
      if (isEditing && router.canGoBack()) {
        router.back();
      } else {
        router.replace(isEditing ? '/(app)/(account)/account' : '/(app)/(home)');
      }
    } catch {
      if (!mounted.current) return;
      saving.current = false;
      setError('We could not save your personalization. Check your connection and pull up again.');
      setFinishing(false);
      pullProgress.value = reduceMotion
        ? 0
        : withSpring(0, { damping: 15, stiffness: 170 });
    }
  }, [
    completeOnboarding,
    isEditing,
    pullInteraction,
    pullProgress,
    recommendationStyle,
    reduceMotion,
    selectedCategories,
    user,
  ]);

  const pullGesture = useMemo(() => Gesture.Pan()
    .enabled(step === 2 && !finishing && appActive)
    .activeOffsetY([-4, 8])
    .failOffsetX([-20, 20])
    .onBegin(() => {
      pullInteraction.value = withTiming(1, { duration: 90 });
      pullStart.value = pullProgress.value;
    })
    .onUpdate((event) => {
      pullProgress.value = Math.max(
        0,
        Math.min(1, pullStart.value + Math.max(0, -event.translationY) / pullDistance),
      );
    })
    // eslint-disable-next-line react-hooks/refs -- onEnd only registers this callback; ref-guarded completion runs after the gesture ends.
    .onEnd((event) => {
      const upwardVelocity = Math.max(0, -event.velocityY);
      const releaseVelocity = upwardVelocity / pullDistance;
      const projectedProgress = pullProgress.value + releaseVelocity * 0.24;
      if (pullProgress.value >= 0.76 || projectedProgress >= 0.76) {
        scheduleOnRN(finishOnboarding, releaseVelocity);
      } else {
        pullProgress.value = reduceMotion
          ? 0
          : withSpring(0, { damping: 15, stiffness: 180 });
      }
    })
    .onFinalize(() => {
      pullInteraction.value = withTiming(0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    }), [
    appActive,
    finishOnboarding,
    finishing,
    pullInteraction,
    pullProgress,
    pullStart,
    pullDistance,
    reduceMotion,
    step,
  ]);

  const pullTravelStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(1, pullProgress.value));
    const fingerDistance = progress * pullDistance;
    const accelerationPoint = screenHeight * 0.4;
    const travel = fingerDistance <= accelerationPoint
      ? fingerDistance
      : accelerationPoint + (fingerDistance - accelerationPoint) * 2.8;
    const idleOffset = idlePullOffset.value
      * (1 - pullInteraction.value)
      * (1 - progress);
    return {
      transform: [{ translateY: -travel + idleOffset }],
    };
  });
  const pullScaleStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(1, pullProgress.value));
    const growth = 1 - Math.pow(1 - progress, 3);
    return {
      opacity: 1,
      transform: [{ scale: 1 + 0.98 * growth }],
    };
  });
  const pullArrowStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));
  const pullLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pullProgress.value,
      [0, 0.025, 0.1],
      [1, 0.55, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const finalCopyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pullProgress.value, [0, 0.4, 0.72], [1, 0.72, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(pullProgress.value, [0, 0.72], [0, -28], Extrapolation.CLAMP),
    }],
  }));
  const finalSliderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pullProgress.value, [0, 0.18, 0.52], [1, 0.78, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(pullProgress.value, [0, 0.52], [0, -18], Extrapolation.CLAMP),
      },
      {
        scale: interpolate(pullProgress.value, [0, 0.52], [1, 1.08], Extrapolation.CLAMP),
      },
    ],
  }));

  if (!user) {
    return <Redirect href="/welcome" />;
  }
  if (onboardingComplete && !isEditing && !finishing) {
    return <Redirect href="/(app)/(home)" />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['#1D0B35', '#150D25', '#0A080F', '#09070D']}
          locations={[0, 0.38, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={[
          styles.safeArea,
          { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) },
        ]}>
        {step === 0 ? (
          <CategoryStep
            error={error}
            onClose={isEditing ? close : undefined}
            onNext={next}
            onToggle={toggleCategory}
            reduceMotion={reduceMotion}
            selected={selectedCategories}
          />
        ) : null}
        {step === 1 ? (
          <RecommendationStep
            error={error}
            onBack={() => {
              setError('');
              setStep(0);
            }}
            onNext={next}
            onSelect={(style) => {
              setError('');
              setRecommendationStyle(style);
            }}
            reduceMotion={reduceMotion}
            selected={recommendationStyle}
          />
        ) : null}
        {step === 2 ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(430).withInitialValues({ opacity: 1 })}
            style={styles.finalStep}>
            <Animated.View style={[styles.finalBrand, finalCopyStyle]}>
              <Text style={styles.welcomeLabel}>
                {isEditing ? 'Your music, your way' : 'Welcome to'}
              </Text>
              <BrandLogo style={styles.finalLogo} />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.finalSliderWrap, { top: finalSliderTop }, finalSliderStyle]}>
              <InfiniteCategorySlider reduceMotion={reduceMotion || finishing || !appActive} />
            </Animated.View>

            {error ? (
              <Animated.View style={[styles.pullArea, finalCopyStyle]}>
                <Text style={styles.finalError}>{error}</Text>
              </Animated.View>
            ) : null}

            <GestureDetector gesture={pullGesture}>
              <Animated.View
                accessibilityHint={isEditing
                  ? 'Swipe this control upward to save your music preferences'
                  : 'Swipe this control upward to finish setup'}
                accessibilityLabel={isEditing ? 'Pull up to save' : 'Pull up to enter Crimson'}
                accessibilityRole="button"
                accessibilityState={{ disabled: finishing, busy: finishing }}
                onAccessibilityTap={() => void finishOnboarding()}
                style={[styles.pullControl, pullTravelStyle]}>
                <Animated.View style={[styles.pullScaler, pullScaleStyle]}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.curvedPullLabelWrap, pullLabelStyle]}>
                    <CurvedPullLabel
                      label={isEditing ? 'PULL UP TO SAVE' : 'PULL UP TO ENTER'}
                    />
                  </Animated.View>
                  <View pointerEvents="none" style={styles.pullNativeGlass}>
                    <PreferencesGlassSurface effect="clear" interactive radius={52} style={StyleSheet.absoluteFill} />
                    <Animated.View style={[styles.pullGlassContent, pullArrowStyle]}>
                      {finishing ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <SymbolView
                          name="arrow.up"
                          size={42}
                          tintColor="#FFFFFF"
                          weight="medium"
                        />
                      )}
                    </Animated.View>
                  </View>
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function InfiniteCategorySlider({ reduceMotion }: { reduceMotion: boolean }) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = 0;
    if (!reduceMotion) {
      offset.value = withRepeat(
        withTiming(-finalSliderLoopWidth, {
          duration: 26000,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(offset);
  }, [offset, reduceMotion]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View style={styles.finalSliderViewport}>
      <View style={styles.finalSliderTilt}>
        <Animated.View
          style={[
            styles.finalSliderTrack,
            { width: finalSliderLoopWidth * 2 },
            trackStyle,
          ]}>
          {[0, 1].map((copy) => (
            <View
              key={copy}
              style={[styles.finalSliderGroup, { width: finalSliderLoopWidth }]}>
              {finalSliderCategories.map((category, index) => {
                const raised = index % 2 === 0;
                return (
                  <View
                    key={`${copy}-${category.id}`}
                    style={[
                      styles.finalSliderColumn,
                      raised ? styles.finalSliderColumnRaised : styles.finalSliderColumnLowered,
                    ]}>
                    <View style={styles.finalSliderCard}>
                      <Image
                        contentFit="cover"
                        source={category.image}
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={['rgba(21,8,34,0.02)', 'rgba(8,5,13,0.24)']}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <View style={styles.finalSliderCard}>
                      <Image
                        contentFit="cover"
                        source={finalSliderCategories[(index + 4) % finalSliderCategories.length].image}
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={['rgba(21,8,34,0.02)', 'rgba(8,5,13,0.24)']}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

function CurvedPullLabel({ label }: { label: string }) {
  return (
    <Svg
      pointerEvents="none"
      style={styles.curvedPullLabel}
      viewBox="0 0 156 92">
      <Defs>
        <Path
          d="M 12 86 A 66 66 0 0 1 144 86"
          id="pull-label-arc"
        />
      </Defs>
      <SvgText
        fill="rgba(255,255,255,0.9)"
        fontSize={13.2}
        fontWeight="300"
        letterSpacing={0.45}
        textAnchor="middle">
        <TextPath href="#pull-label-arc" startOffset="50%">
          {label}
        </TextPath>
      </SvgText>
    </Svg>
  );
}

function OnboardingNextButton({ disabled = false, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <PreferencesGlassButton accessibilityLabel={label} disabled={disabled} height={52} selected onPress={onPress}>
      <Text style={styles.nextLabel}>{label}</Text>
    </PreferencesGlassButton>
  );
}

function CategoryStep({
  error,
  onClose,
  onNext,
  onToggle,
  reduceMotion,
  selected,
}: {
  error: string;
  onClose?: () => void;
  onNext: () => void;
  onToggle: (categoryId: string) => void;
  reduceMotion: boolean;
  selected: string[];
}) {
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(300).withInitialValues({ opacity: 1 })}
      style={styles.step}>
      {onClose ? (
        <Animated.View
          entering={reduceMotion
            ? undefined
            : FadeInDown.delay(70).duration(360).easing(Easing.out(Easing.cubic)).withInitialValues({ opacity: 1 })}
          style={styles.stepBack}>
          <PreferencesGlassButton
            accessibilityLabel="Close music preferences"
            radius={22}
            height={44}
            onPress={onClose}
            tintColor="rgba(255,255,255,0.08)"
            contentStyle={styles.stepBackContent}>
            <SymbolView
              name="xmark"
              size={18}
              tintColor="rgba(255,255,255,0.9)"
              weight="semibold"
            />
          </PreferencesGlassButton>
        </Animated.View>
      ) : null}
      <OnboardingHeader
        subtitle="Choose at least 2 categories that you like"
        reduceMotion={reduceMotion}
      />
      <ScrollView
        bounces
        contentContainerStyle={styles.categoryScroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.categoryGrid}>
          {categories.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              index={index}
              onPress={() => onToggle(category.id)}
              reduceMotion={reduceMotion}
              selected={selected.includes(category.id)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.helper, error ? styles.helperError : null]}>
          {error || `${selected.length} selected`}
        </Text>
        <OnboardingNextButton
          disabled={selected.length < minimumCategoryCount}
          label="Next"
          onPress={onNext}
        />
      </View>
    </Animated.View>
  );
}

function RecommendationStep({
  error,
  onBack,
  onNext,
  onSelect,
  reduceMotion,
  selected,
}: {
  error: string;
  onBack: () => void;
  onNext: () => void;
  onSelect: (style: RecommendationStyle) => void;
  reduceMotion: boolean;
  selected: RecommendationStyle;
}) {
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(300).withInitialValues({ opacity: 1 })}
      style={styles.step}>
      <Animated.View
        entering={reduceMotion
          ? undefined
          : FadeInDown.delay(70).duration(360).easing(Easing.out(Easing.cubic)).withInitialValues({ opacity: 1 })}
        style={styles.stepBack}>
        <PreferencesGlassButton
          accessibilityLabel="Back to categories"
          radius={22}
          height={44}
          onPress={onBack}
          tintColor="rgba(255,255,255,0.08)"
          contentStyle={styles.stepBackContent}>
          <SymbolView
            name="chevron.left"
            size={20}
            tintColor="rgba(255,255,255,0.9)"
            weight="semibold"
          />
        </PreferencesGlassButton>
      </Animated.View>
      <OnboardingHeader
        subtitle={'Choose how adventurous your recommendations\nshould be (You can always change this)'}
        reduceMotion={reduceMotion}
      />
      <ScrollView bounces contentContainerStyle={styles.recommendationBody} showsVerticalScrollIndicator={false}>
        {recommendationOptions.map((option, index) => (
          <RecommendationCard
            key={option.id}
            index={index}
            onPress={() => onSelect(option.id)}
            option={option}
            reduceMotion={reduceMotion}
            selected={selected === option.id}
          />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={[styles.helper, error ? styles.helperError : null]}>
          {error || 'You can change this later in Settings'}
        </Text>
        <OnboardingNextButton label="Next" onPress={onNext} />
      </View>
    </Animated.View>
  );
}

function OnboardingHeader({
  reduceMotion,
  subtitle,
}: {
  reduceMotion: boolean;
  subtitle: string;
}) {
  return (
    <Animated.View
      entering={reduceMotion
        ? undefined
        : FadeInDown.delay(30).duration(420).easing(Easing.out(Easing.cubic))}
      style={styles.header}>
      <Text style={styles.title}>Let’s personalize</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Animated.View>
  );
}

function CategoryCard({
  category,
  index,
  onPress,
  reduceMotion,
  selected,
}: {
  category: CategoryOption;
  index: number;
  onPress: () => void;
  reduceMotion: boolean;
  selected: boolean;
}) {
  const selection = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selection.value = reduceMotion
      ? selected ? 1 : 0
      : withSpring(selected ? 1 : 0, { damping: 13, mass: 0.56, stiffness: 240 });
  }, [reduceMotion, selected, selection]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selection.value,
      [0, 1],
      ['rgba(255,255,255,0.24)', '#B36DFF'],
    ),
  }));
  const selectedOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selection.value, [0, 1], [0, 0.9]),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
  }));

  return (
    <Animated.View
      entering={reduceMotion
        ? undefined
        : FadeInDown
          .delay(90 + index * 55)
          .duration(390)
          .easing(Easing.out(Easing.cubic))}
      style={styles.categoryCell}>
      <Animated.View style={[styles.categoryCard, cardStyle]}>
        <Image contentFit="cover" source={category.image} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['transparent', 'rgba(4,3,7,0.78)']}
          locations={[0.26, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, selectedOverlayStyle]}>
          <LinearGradient
            colors={['rgba(126,45,228,0.08)', 'rgba(174,79,255,0.95)']}
            locations={[0.12, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Text style={styles.categoryLabel}>{category.label}</Text>
        <Animated.View style={[styles.check, checkStyle]}>
          <SymbolView name="checkmark.circle.fill" size={23} tintColor="#FFFFFF" />
        </Animated.View>
        <BouncyPressable
          accessibilityLabel={category.label}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          onPress={onPress}
          pressedScale={0.96}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

function RecommendationCard({
  index,
  onPress,
  option,
  reduceMotion,
  selected,
}: {
  index: number;
  onPress: () => void;
  option: RecommendationOption;
  reduceMotion: boolean;
  selected: boolean;
}) {
  const selection = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selection.value = reduceMotion
      ? selected ? 1 : 0
      : withSpring(selected ? 1 : 0, { damping: 12, mass: 0.52, stiffness: 250 });
  }, [reduceMotion, selected, selection]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selection.value,
      [0, 1],
      ['rgba(255,255,255,0.57)', '#FFFFFF'],
    ),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
  }));

  return (
    <Animated.View
      entering={reduceMotion
        ? undefined
        : FadeInDown
          .delay(100 + index * 85)
          .duration(420)
          .easing(Easing.out(Easing.cubic))
          .withInitialValues({ opacity: 1 })}
      style={styles.recommendationShell}>
      <PreferencesGlassButton
        accessibilityLabel={option.label}
        radius={29}
        height={58}
        onPress={onPress}
        selected={selected}
        style={[styles.recommendationGlass, selected && styles.recommendationSelected]}
        tintColor={selected ? '#9B4DFF' : 'rgba(255,255,255,0.07)'}
        contentStyle={styles.recommendationContent}>
        <Animated.Text style={[styles.recommendationLabel, labelStyle]}>
          {option.label}
        </Animated.Text>
        <Animated.View style={[styles.optionCheck, checkStyle]}>
          <SymbolView name="checkmark.circle.fill" size={23} tintColor="#FFFFFF" />
        </Animated.View>
      </PreferencesGlassButton>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09070D', overflow: 'hidden' },
  safeArea: { flex: 1 },
  step: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  stepBack: {
    position: 'absolute',
    top: 20,
    left: 18,
    width: 44,
    height: 44,
    zIndex: 5,
  },
  stepBackContent: { alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 34, paddingBottom: 22 },
  title: {
    color: '#FFFFFF',
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '500',
    letterSpacing: -1.25,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 5,
    color: 'rgba(224,211,232,0.58)',
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
  categoryScroll: { paddingHorizontal: 24, paddingTop: 2, paddingBottom: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  categoryCell: { width: '48%', flexGrow: 1, height: 82 },
  categoryCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1.15,
    backgroundColor: '#211929',
  },
  categoryLabel: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  check: { position: 'absolute', top: 8, right: 8, width: 24, height: 24 },
  footer: { flexShrink: 0, paddingHorizontal: 24, paddingTop: 7, paddingBottom: 4 },
  nextLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  helper: {
    height: 22,
    color: 'rgba(255,255,255,0.44)',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  helperError: { color: '#FF91A2' },
  recommendationBody: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 15,
    paddingHorizontal: 30,
    paddingBottom: 34,
  },
  recommendationShell: { width: '100%', height: 58 },
  recommendationGlass: { width: '100%' },
  recommendationSelected: {
    shadowColor: '#A95DFF',
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
  },
  recommendationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  recommendationLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  optionCheck: { width: 24, height: 24 },
  finalStep: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  finalBrand: { alignItems: 'center', paddingTop: 78 },
  welcomeLabel: { color: 'rgba(226,214,233,0.62)', fontSize: 21, fontWeight: '300' },
  finalLogo: { width: 244, height: 80, marginTop: 10 },
  finalSliderWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 282,
  },
  finalSliderViewport: {
    flex: 1,
    overflow: 'visible',
  },
  finalSliderTilt: {
    position: 'absolute',
    top: 0,
    left: '-9%',
    width: '118%',
    height: 260,
    transform: [{ rotate: '7deg' }],
  },
  finalSliderTrack: {
    height: 260,
    flexDirection: 'row',
    marginLeft: -38,
  },
  finalSliderGroup: {
    height: 260,
    flexDirection: 'row',
  },
  finalSliderColumn: {
    width: 96,
    gap: 8,
    marginRight: 8,
  },
  finalSliderColumnRaised: { marginTop: 0 },
  finalSliderColumnLowered: { marginTop: 22 },
  finalSliderCard: {
    width: 96,
    height: 96,
    overflow: 'hidden',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#211929',
  },
  pullArea: { position: 'absolute', left: 0, right: 0, bottom: 145, alignItems: 'center' },
  finalError: {
    maxWidth: 330,
    marginTop: 9,
    color: '#FF91A2',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  pullControl: {
    position: 'absolute',
    left: '50%',
    marginLeft: -52,
    bottom: 24,
    width: 104,
    height: 104,
    overflow: 'visible',
    shadowColor: '#A875FF',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 20,
  },
  pullScaler: {
    width: 104,
    height: 104,
    overflow: 'visible',
  },
  curvedPullLabelWrap: {
    position: 'absolute',
    top: -29,
    left: '50%',
    width: 156,
    height: 92,
    marginLeft: -78,
    zIndex: 2,
  },
  curvedPullLabel: { width: '100%', height: '100%' },
  pullNativeGlass: {
    width: 104,
    height: 104,
  },
  pullGlassContent: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
});
