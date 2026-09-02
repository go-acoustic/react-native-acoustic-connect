import React, { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { DemoCard } from './DemoCard'
import { Colors } from '../theme/colors'
import { CHANNEL_LABEL, type Ticket } from '../verification/tickets'

/**
 * Card shell for one fix under verification. Prints what to do and what a fixed
 * build produces, so the tester does not have to hold the expectation in their
 * head — and, when the fix has no published native artifact yet, says so in a
 * banner.
 *
 * That banner is the point of this component. A card whose fix has not shipped
 * still runs and still looks healthy; without the warning, "no error" reads as
 * a pass when it is really a baseline.
 */
export function TicketCard({
  ticket,
  children,
}: {
  ticket: Ticket
  children?: ReactNode
}) {
  const blocked = Boolean(ticket.blockedBy)

  return (
    <DemoCard title={ticket.title}>
      <View style={styles.metaRow}>
        <Text style={styles.key}>{ticket.key}</Text>
        <Text style={styles.channel}>
          {CHANNEL_LABEL[ticket.channel]} · {ticket.platform}
        </Text>
      </View>

      {blocked ? (
        <View style={styles.blockedBox}>
          <Text style={styles.blockedTitle}>
            Baseline only — fix not published
          </Text>
          <Text style={styles.blockedBody}>{ticket.blockedBy}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Do</Text>
      <Text style={styles.body}>{ticket.action}</Text>
      <Text style={styles.label}>Expect</Text>
      <Text style={styles.body}>{ticket.expected}</Text>

      {children}
    </DemoCard>
  )
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  key: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.periwinkle,
    fontFamily: 'Courier',
  },
  channel: { fontSize: 10, color: Colors.darkGrey },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.darkGrey,
    textTransform: 'uppercase',
  },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  blockedBox: {
    backgroundColor: Colors.lightGrey,
    borderLeftColor: Colors.periwinkle,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  blockedTitle: { fontSize: 12, fontWeight: '700', color: Colors.violet },
  blockedBody: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
