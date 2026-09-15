import React, { useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { DemoCard } from './DemoCard'
import { DemoTextField } from './DemoTextField'
import { PrimaryButton, SecondaryButton } from './buttons'
import { Colors } from '../theme/colors'

type ReplayModalCardProps = {
  /**
   * `transparent` maps to `UIModalPresentationOverFullScreen` on iOS and an
   * opaque `UIModalPresentationFullScreen` when false. Both present a separate
   * `RCTFabricModalHostViewController`, so both need to yield a populated
   * control tree in session replay.
   */
  transparent?: boolean
}

/**
 * Session-replay reference for React Native's core `<Modal>`.
 *
 * `<Modal>` does not render inline. On iOS under Fabric, the modal's children
 * are mounted into a separate `RCTFabricModalHostViewController`'s view
 * (`RCTModalHostViewComponentView.mm` `-mountChildComponentView:index:`), so
 * the presented subtree sits outside the `react-native-screens` navigator
 * hierarchy. That makes it the one case where the SDK's screen-layout capture
 * has to resolve a capture root without a `RNSScreenStackView` /
 * `RNSScreenContainerView` above it.
 *
 * The controls below are deliberately varied — text, a bordered text input,
 * two buttons, and a status line — so a replay reviewer can confirm each one is
 * individually inspectable rather than just seeing a correct-looking screenshot.
 * The status line echoes the input and the tap count so an interaction that
 * never registered can be told apart from one the SDK failed to capture.
 */
export function ReplayModalCard({ transparent = false }: ReplayModalCardProps) {
  const [visible, setVisible] = useState(false)
  const [note, setNote] = useState('')
  const [actionCount, setActionCount] = useState(0)

  return (
    <DemoCard title={transparent ? 'Modal (transparent)' : 'Modal (opaque)'}>
      <Text style={styles.body}>
        Opens a core RN <Text style={styles.code}>&lt;Modal&gt;</Text>. Every
        element inside it should be selectable in session replay, not just
        visible in the screenshot.
      </Text>
      <PrimaryButton title="Open modal" onPress={() => setVisible(true)} />

      <Modal
        visible={visible}
        transparent={transparent}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.backdrop, transparent && styles.backdropDimmed]}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Modal content</Text>
            <Text style={styles.body}>
              Text, an input, and buttons — each should appear as its own
              control in the captured layout.
            </Text>
            <DemoTextField
              label="Note"
              placeholder="Type to check text capture"
              value={note}
              onChangeText={setNote}
            />
            <PrimaryButton
              title="Primary action"
              onPress={() => setActionCount((count) => count + 1)}
            />
            <SecondaryButton title="Close" onPress={() => setVisible(false)} />
            {/* Echoes both inputs back on screen. Without this the modal gives
                no in-app signal, so a reviewer cannot tell a missing capture
                from an interaction that never registered — they'd have to take
                the replay's word for it. Typing here and tapping above should
                produce a matching text-change event and click event, and this
                line is what you compare them against. */}
            <Text style={styles.status}>
              Note: {note.length > 0 ? note : '—'} · Primary action taps:{' '}
              {actionCount}
            </Text>
          </View>
        </View>
      </Modal>
    </DemoCard>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  status: { fontSize: 12, color: Colors.violet },
  code: {
    fontSize: 13,
    color: Colors.violet,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  backdropDimmed: { backgroundColor: 'rgba(31, 30, 93, 0.45)' },
  sheet: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 20,
    gap: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.violet,
  },
})
