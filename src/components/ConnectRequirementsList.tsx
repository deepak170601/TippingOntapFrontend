// src/components/ConnectRequirementsList.tsx
//
// Shows what Stripe is actually waiting for.
//
// Before this existed the app could only say "onboarding incomplete", which does
// not distinguish the two situations a stalled merchant can be in:
//
//   - Stripe is reviewing something already submitted → nothing to do, wait.
//   - Stripe is waiting on the merchant → they must act, and nothing told them.
//
// A merchant who believes they are in the first case while actually in the
// second waits forever. Stripe reports precisely which it is on
// account.requirements; the backend translates the dotted field paths into
// sentences and returns them on GET /connect/status.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConnectStatus } from '../services/api';
import {
  colours, fontSizes, fontWeights, spacing, radius,
} from '../theme';

interface Props {
  status: ConnectStatus | null;
}

const ConnectRequirementsList = ({ status }: Props): React.JSX.Element | null => {
  if (!status) { return null; }

  // Defaulted, not destructured straight through. App releases and backend
  // deploys are not atomic: a build carrying this component can run against a
  // backend that predates the requirements fields, in which case these arrive
  // undefined and `currentlyDue.length` throws on a screen the merchant cannot
  // navigate away from. Degrading to "show nothing" is the correct behaviour
  // against an older backend.
  const currentlyDue      = status.currentlyDue      ?? [];
  const requirementErrors = status.requirementErrors ?? [];
  const pendingReview     = status.pendingReview     ?? false;
  const hasPastDue        = status.hasPastDue        ?? false;
  const currentDeadline   = status.currentDeadline   ?? null;

  const hasWork = currentlyDue.length > 0 || requirementErrors.length > 0;

  // Everything submitted, Stripe still checking. Saying so is the point: it is
  // the one case where "do nothing" is the correct instruction, and the merchant
  // cannot tell it apart from being stuck without being told.
  if (!hasWork && pendingReview) {
    return (
      <View style={styles.card}>
        <Text style={styles.pendingTitle}>Stripe is reviewing your details</Text>
        <Text style={styles.pendingBody}>
          Nothing more is needed from you right now. This usually takes a few
          minutes, occasionally longer if documents need a closer look.
        </Text>
      </View>
    );
  }

  if (!hasWork) { return null; }

  const deadline = currentDeadline !== null
    ? new Date(currentDeadline).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {hasPastDue ? 'Action needed now' : 'Stripe still needs'}
      </Text>

      {/* Rejections first — a merchant re-uploading the same expired document
          because nobody told them why it bounced is the worst version of this. */}
      {requirementErrors.map(err => (
        <View key={`${err.requirement}:${err.code}`} style={styles.row}>
          <Text style={styles.errorBullet}>!</Text>
          <Text style={styles.errorText}>{err.reason}</Text>
        </View>
      ))}

      {currentlyDue.map(req => (
        <View key={req.code} style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.itemText}>{req.label}</Text>
        </View>
      ))}

      {deadline !== null && (
        <Text style={styles.deadline}>
          {hasPastDue
            ? `This was due ${deadline}.`
            : `Please complete this by ${deadline}.`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.surfaceBlue,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginTop:       spacing.md,
  },
  title: {
    fontSize:     fontSizes.md,
    fontWeight:   fontWeights.semiBold,
    color:        colours.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  spacing.xs,
  },
  bullet: {
    fontSize:    fontSizes.sm,
    color:       colours.textSecondary,
    marginRight: spacing.sm,
    lineHeight:  20,
  },
  itemText: {
    flex:       1,
    fontSize:   fontSizes.sm,
    color:      colours.textPrimary,
    lineHeight: 20,
  },
  errorBullet: {
    fontSize:    fontSizes.sm,
    fontWeight:  fontWeights.bold,
    color:       colours.error,
    marginRight: spacing.sm,
    lineHeight:  20,
  },
  errorText: {
    flex:       1,
    fontSize:   fontSizes.sm,
    color:      colours.error,
    lineHeight: 20,
  },
  deadline: {
    fontSize:  fontSizes.xs,
    color:     colours.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  pendingTitle: {
    fontSize:     fontSizes.md,
    fontWeight:   fontWeights.semiBold,
    color:        colours.textPrimary,
    marginBottom: spacing.xs,
  },
  pendingBody: {
    fontSize:   fontSizes.sm,
    color:      colours.textSecondary,
    lineHeight: 20,
  },
});

export default ConnectRequirementsList;
