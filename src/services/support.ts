// src/services/support.ts
//
// "Having trouble? Contact us" — the merchant taps a channel, and the support
// team is supposed to receive who is stuck and on what handset.
//
// Nothing is actually sent yet. The transport (email relay, SMS gateway,
// helpdesk API) is being supplied later, so this module exists to fix the
// SHAPE of that request now and give the rest of the app something real to
// call. When the transport arrives, only `deliver` below changes; no screen,
// no sheet and no payload type has to move.
//
// It is deliberately a service rather than inline screen code. A support
// request is an outbound message about a person, and the decision about what
// it contains belongs somewhere reviewable — not scattered across a button
// handler.
import { getDeviceSummary, formatDevice } from '../utils/deviceInfo';
import type { AuthResponse } from './api';

type User = AuthResponse['user'];

/** How the merchant asked to be contacted back. */
export type SupportChannel = 'email' | 'phone';

export interface SupportRequest {
  channel:     SupportChannel;
  /** Who is stuck. */
  name:        string;
  email:       string;
  phoneNumber: string;
  /** "samsung SM-G991B · Android 14" — hardware only, no identifiers. */
  device:      string;
  /** Where in the app they were when they asked. */
  context:     string;
  /** ISO 8601, UTC. */
  sentAt:      string;
}

export const buildSupportRequest = (
  channel: SupportChannel,
  user: User | null,
  context: string = 'Stripe onboarding',
): SupportRequest => ({
  channel,
  // A merchant who cannot finish signup may have half a profile, so every
  // field falls back rather than rendering "undefined" into a support inbox.
  name:        user?.fullName    ?? 'Unknown merchant',
  email:       user?.email       ?? 'Not provided',
  phoneNumber: user?.phoneNumber ?? 'Not provided',
  device:      formatDevice(getDeviceSummary()),
  context,
  sentAt:      new Date().toISOString(),
});

// ── The seam ──────────────────────────────────────────────────
// Replace the body of this function with the real call. Keep the signature:
// everything upstream already treats a rejected promise as "tell the merchant
// it did not send", so a genuine network failure needs no new handling.
const deliver = async (request: SupportRequest): Promise<void> => {
  // MOCK. Logged rather than silently swallowed so the payload can be read off
  // a device during testing and checked against what support expects.
  console.warn(
    '[support] MOCK — no message was sent. Payload that will go to support:\n'
    + JSON.stringify(request, null, 2),
  );

  // Stand in for network latency so the sheet's spinner is exercised in
  // testing rather than flashing past. Remove with the mock.
  await new Promise<void>(resolve => setTimeout(resolve, 700));
};

/**
 * Notifies support that this merchant needs help.
 *
 * Resolves when the request has been handed off. Rejects if it could not be —
 * callers must surface that rather than claiming it was sent.
 */
export const requestSupport = async (
  channel: SupportChannel,
  user: User | null,
  context?: string,
): Promise<SupportRequest> => {
  const request = buildSupportRequest(channel, user, context);
  await deliver(request);
  return request;
};

/**
 * True while support messages are mocked. The sheet uses it to say so on
 * screen, because telling a merchant "we have your request" when nothing was
 * sent is worse than the missing feature. Flip to false with the real
 * transport.
 */
export const SUPPORT_IS_MOCKED = true;

export default requestSupport;
