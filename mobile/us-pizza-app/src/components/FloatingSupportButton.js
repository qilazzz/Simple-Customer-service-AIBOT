import React, { useCallback } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Set to tab bar height when bottom tabs (Home/Menu/Market/Order/Profile) are added. */
export const TAB_BAR_CLEARANCE = 64;

const BUTTON_SIZE = 56;
const EDGE_MARGIN = 16;
const DRAG_ACTIVATION = 12;
const SNAP_DURATION_MS = 280;

/**
 * Draggable floating Customer Service button.
 * Tap opens support; drag moves the button and snaps to the nearest horizontal edge on release.
 */
export default function FloatingSupportButton({
  onPress,
  bottomOffset = 0,
  topOffset = 0,
}) {
  const insets = useSafeAreaInsets();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const minX = useSharedValue(EDGE_MARGIN);
  const maxX = useSharedValue(0);
  const minY = useSharedValue(EDGE_MARGIN);
  const maxY = useSharedValue(0);
  const visible = useSharedValue(0);

  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const clamp = (value, low, high) => {
    'worklet';
    return Math.min(Math.max(value, low), high);
  };

  const snapToNearestEdge = () => {
    'worklet';
    const centerX = translateX.value + BUTTON_SIZE / 2;
    const midX = (minX.value + maxX.value + BUTTON_SIZE) / 2;
    const targetX = centerX < midX ? minX.value : maxX.value;

    translateX.value = withTiming(targetX, {
      duration: SNAP_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    startX.value = targetX;
  };

  const onLayout = useCallback(
    (event) => {
      const { width, height } = event.nativeEvent.layout;
      if (width < BUTTON_SIZE || height < BUTTON_SIZE) return;

      const boundMinX = EDGE_MARGIN;
      const boundMaxX = width - BUTTON_SIZE - EDGE_MARGIN;
      const boundMinY = EDGE_MARGIN + insets.top + topOffset;
      const boundMaxY =
        height - BUTTON_SIZE - EDGE_MARGIN - bottomOffset - insets.bottom;

      minX.value = boundMinX;
      maxX.value = boundMaxX;
      minY.value = boundMinY;
      maxY.value = boundMaxY;

      translateX.value = boundMaxX;
      translateY.value = boundMaxY;
      startX.value = boundMaxX;
      startY.value = boundMaxY;
      visible.value = 1;
    },
    [
      bottomOffset,
      insets.bottom,
      insets.top,
      maxX,
      maxY,
      minX,
      minY,
      startX,
      startY,
      topOffset,
      translateX,
      translateY,
      visible,
    ],
  );

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(DRAG_ACTIVATION)
    .onEnd((_event, success) => {
      'worklet';
      if (success) {
        runOnJS(handlePress)();
      }
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-DRAG_ACTIVATION, DRAG_ACTIVATION])
    .activeOffsetY([-DRAG_ACTIVATION, DRAG_ACTIVATION])
    .onBegin(() => {
      'worklet';
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = clamp(
        startX.value + event.translationX,
        minX.value,
        maxX.value,
      );
      translateY.value = clamp(
        startY.value + event.translationY,
        minY.value,
        maxY.value,
      );
    })
    .onEnd(() => {
      'worklet';
      translateY.value = clamp(translateY.value, minY.value, maxY.value);
      startY.value = translateY.value;
      snapToNearestEdge();
    });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={onLayout}
      collapsable={false}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.fab, animatedStyle]}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel="Customer Service"
        >
          <Image
            source={require('../../app/assets/customer-service-icon.png')}
            style={styles.iconImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
  },
  fab: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 6,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  iconImage: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
});
