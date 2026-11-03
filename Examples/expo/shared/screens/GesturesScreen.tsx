import React, { useMemo, useRef, useState } from 'react'
import {
  type GestureResponderEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Colors } from '../theme/colors'

const LIST_ROWS = 40
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const SWIPE_THRESHOLD_DP = 48
const LONG_PRESS_MS = 400
const DOUBLE_TAP_MS = 400
const PINCH_SLOP_DP = 8

function swipeName(
  travelX: number,
  travelY: number,
  threshold: number
): string | null {
  const absX = Math.abs(travelX)
  const absY = Math.abs(travelY)
  if (absX < threshold && absY < threshold) {
    return null
  }
  if (absX >= absY) {
    return travelX > 0 ? 'swipeRight' : 'swipeLeft'
  }
  return travelY > 0 ? 'swipeDown' : 'swipeUp'
}

type GestureProps = { onGesture: (name: string) => void }

function touchDistance(event: GestureResponderEvent): number {
  const [first, second] = event.nativeEvent.touches
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY)
}

function LongPressTarget({ onGesture }: GestureProps) {
  return (
    <Pressable
      testID="gesture_long_press"
      style={styles.target}
      delayLongPress={LONG_PRESS_MS}
      onPress={() => onGesture('tap')}
      onLongPress={() => onGesture('longPress')}
    >
      <Text style={styles.targetLabel}>Long press me</Text>
    </Pressable>
  )
}

function DoubleTapTarget({ onGesture }: GestureProps) {
  const lastTapAt = useRef(Number.NEGATIVE_INFINITY)

  return (
    <Pressable
      testID="gesture_double_tap"
      style={styles.target}
      onPress={(event) => {
        const now = event.nativeEvent.timestamp
        if (now - lastTapAt.current <= DOUBLE_TAP_MS) {
          lastTapAt.current = Number.NEGATIVE_INFINITY
          onGesture('doubleTap')
        } else {
          lastTapAt.current = now
        }
      }}
    >
      <Text style={styles.targetLabel}>Double tap me</Text>
    </Pressable>
  )
}

function SwipeTarget({ onGesture }: GestureProps) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_event, gesture) => {
          const name = swipeName(gesture.dx, gesture.dy, SWIPE_THRESHOLD_DP)
          if (name) {
            onGesture(name)
          }
        },
      }),
    [onGesture]
  )

  return (
    <View
      testID="gesture_swipe"
      accessible
      style={styles.target}
      {...panResponder.panHandlers}
    >
      <Text style={styles.targetLabel}>Swipe me — any direction</Text>
    </View>
  )
}

function PinchTarget({ onGesture }: GestureProps) {
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const startDistance = useRef(0)
  const startZoom = useRef(1)

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (event) => {
          if (event.nativeEvent.touches.length < 2) {
            startDistance.current = 0
            return
          }
          const distance = touchDistance(event)
          if (startDistance.current === 0) {
            startDistance.current = distance
            startZoom.current = zoomRef.current
            return
          }
          const next = Math.min(
            MAX_ZOOM,
            Math.max(
              MIN_ZOOM,
              (startZoom.current * distance) / startDistance.current
            )
          )
          zoomRef.current = next
          setZoom(next)
          if (Math.abs(distance - startDistance.current) >= PINCH_SLOP_DP) {
            onGesture(distance > startDistance.current ? 'zoomIn' : 'zoomOut')
          }
        },
        onPanResponderRelease: () => {
          startDistance.current = 0
        },
        onPanResponderTerminate: () => {
          startDistance.current = 0
        },
      }),
    [onGesture]
  )

  return (
    <View
      testID="gesture_pinch_zoom"
      accessible
      accessibilityLabel="Pinch to zoom"
      style={styles.pinch}
      {...panResponder.panHandlers}
    >
      <View style={[styles.pinchContent, { transform: [{ scale: zoom }] }]}>
        <Text style={styles.targetLabel}>Pinch me</Text>
      </View>
    </View>
  )
}

export function GesturesScreen() {
  const [lastGesture, setLastGesture] = useState('none')

  return (
    <View style={styles.screen}>
      <Text testID="tv_gestures_title" style={styles.title}>
        Gestures
      </Text>
      <Text testID="tv_gestures_last" style={styles.body}>
        {`Last gesture: ${lastGesture}`}
      </Text>

      <LongPressTarget onGesture={setLastGesture} />
      <DoubleTapTarget onGesture={setLastGesture} />
      <SwipeTarget onGesture={setLastGesture} />
      <PinchTarget onGesture={setLastGesture} />

      <ScrollView testID="gesture_scroll_list" style={styles.list}>
        {Array.from({ length: LIST_ROWS }, (_, index) => (
          <Text
            key={index}
            testID={`gesture_row_${index}`}
            style={[styles.body, styles.row]}
          >
            {`Scrollable row ${index + 1}`}
          </Text>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '600', color: Colors.violet },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  target: {
    height: 72,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.middleGrey,
  },
  targetLabel: { fontSize: 14, color: Colors.violet },
  pinch: {
    height: 120,
    width: 120,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 14,
  },
  pinchContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.lime,
  },
  list: { flex: 1, width: '100%' },
  row: { paddingVertical: 4 },
})
