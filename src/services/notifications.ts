// src/services/notifications.ts
//
// Event reminders, scheduled on the phone rather than sent from the server.
//
// That is not a shortcut, it is the only thing that can be correct today. The
// backend stores an event's date as a DateOnly and its time as a TimeOnly with
// no zone attached (Models/Event.cs), so "7:00 PM" on the server is not an
// instant — it is a wall-clock reading whose meaning depends entirely on where
// the merchant is. The phone that set the time is the only party that knows.
// A server-side scheduler would also be asleep when it mattered: fly.toml runs
// with min_machines_running = 0, so the machine suspends when nobody is using
// the app, which is precisely the state it is in half an hour before an event.
//
// What this costs, stated plainly so nobody is surprised later:
//
//   - Reminders live on one device. Sign in on a second phone and it schedules
//     its own copy; uninstall, or clear app data, and they are gone.
//   - Android decides when they actually fire. These are inexact alarms
//     (SET_AND_ALLOW_WHILE_IDLE), so the OS may batch them by a few minutes to
//     save battery. Exact alarms would need SCHEDULE_EXACT_ALARM, which Google
//     Play restricts to apps whose core purpose is alarms and calendars — not
//     a tipping app. A few minutes of drift on a 30-minute warning is fine;
//     losing the Play listing is not.
//   - Aggressive OEM battery managers (Xiaomi, Oppo, some Samsung) kill
//     scheduled work outright. Nothing in an app can fully prevent that.
//
// Everything here is a no-op if the merchant has reminders switched off or has
// denied the notification permission. Nothing throws at a call site.
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
  AlarmType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event } from './api';

// Versioned rather than 'event-reminders' plain. A channel's sound cannot be
// changed after it is first created — Android locks it, and neither Notifee
// nor this app can override that — so the only way to turn sound on for
// someone who already has the app installed is a new channel id. Bump this
// suffix again if a channel property that matters ever needs to change after
// people already have the old one.
const CHANNEL_ID   = 'event-reminders-v2';
const ENABLED_KEY  = 'notif_event_reminders_enabled';

// Every notification this module owns is `evt:<eventId>:<kind>`. The prefix is
// how a sync tells our scheduled reminders apart from anything else the app
// might schedule later, so it can cancel a stale one without touching the rest.
const ID_PREFIX = 'evt:';

const DAY_MS  = 24 * 60 * 60 * 1000;
const HALF_HR = 30 * 60 * 1000;

// Where the day-before reminder lands for an event with no start time set.
// Evening, so it is read the night before rather than lost in a morning batch.
const EVENING_HOUR = 18;

type ReminderKind = 'day' | 'soon';

const idFor = (eventId: string, kind: ReminderKind): string =>
  `${ID_PREFIX}${eventId}:${kind}`;

// ── Permission ────────────────────────────────────────────────
// Android 13+ needs POST_NOTIFICATIONS at runtime. Below 13 this resolves
// granted without showing anything.
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED
        || settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
};

export const hasNotificationPermission = async (): Promise<boolean> => {
  try {
    const settings = await notifee.getNotificationSettings();
    return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED
        || settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
};

// ── Merchant preference ───────────────────────────────────────
// Defaults to on. A merchant who never opens Settings still gets reminded,
// which is the whole point of the feature.
export const areRemindersEnabled = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) !== 'false';
  } catch {
    return true;
  }
};

export const setRemindersEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // A preference that failed to persist is not worth failing a screen over.
  }
  if (!enabled) { await cancelAllEventReminders(); }
};

// ── Channel ───────────────────────────────────────────────────
// Must exist before any notification is posted on Android 8+, or the OS drops
// it silently. Calling this again with the same id is a harmless no-op — but
// it is exactly that, a no-op, not an update. On Android 8+ every property
// below is fixed at the moment a channel id is first created on a device, and
// the OS enforces that regardless of what this app asks for afterwards. That
// is why sound not being set here originally meant no reminder ever had a
// sound: Notifee's channel default is silence, not the system default, and
// once that first silent channel existed on a phone there was no way back —
// only a new id, above, could add sound for someone who already had it.
const ensureChannel = async (): Promise<void> => {
  await notifee.createChannel({
    id:          CHANNEL_ID,
    name:        'Event reminders',
    description: 'Reminders before an event you have scheduled starts.',
    importance:  AndroidImportance.HIGH,
    sound:       'default',
    vibration:   true,
  });
};

// ── When does this event actually start? ──────────────────────
//
// dateIso is "2029-06-17" and timeIso is "19:00", both local wall-clock with no
// zone (see the note at the top). Building the Date with numeric arguments
// rather than Date.parse is deliberate: `new Date("2029-06-17")` is parsed as
// UTC midnight by spec, so an event would silently shift by the device's offset
// — hours out in either direction, and worst in exactly the timezones furthest
// from the developer's.
//
// Returns null when the event has no usable date, which is the caller's cue to
// schedule nothing rather than guess.
const startOf = (event: Event): Date | null => {
  if (!event.dateIso) { return null; }

  const [y, m, d] = event.dateIso.split('-').map(Number);
  if (!y || !m || !d) { return null; }

  if (event.timeIso) {
    const [hh, mm] = event.timeIso.split(':').map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      return new Date(y, m - 1, d, hh, mm, 0, 0);
    }
  }

  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

// ── Build the reminders one event deserves ────────────────────
interface PlannedReminder {
  id:    string;
  when:  number;
  title: string;
  body:  string;
}

const planFor = (event: Event, now: number): PlannedReminder[] => {
  // Only events that have not started. An active event needs no reminder and a
  // past one is history.
  if (event.status !== 'upcoming') { return []; }

  const start = startOf(event);
  if (start === null) { return []; }

  const where = event.location ? ` at ${event.location}` : '';
  const plans: PlannedReminder[] = [];

  if (event.timeIso) {
    // Both reminders, anchored to the real start time.
    plans.push({
      id:    idFor(event.id, 'day'),
      when:  start.getTime() - DAY_MS,
      title: `${event.name} is tomorrow`,
      body:  `Starts at ${event.time ?? event.timeIso}${where}. Give yourself time to set up.`,
    });
    plans.push({
      id:    idFor(event.id, 'soon'),
      when:  start.getTime() - HALF_HR,
      title: `${event.name} starts in 30 minutes`,
      body:  `Be there and ready to take tips by ${event.time ?? event.timeIso}${where}.`,
    });
  } else {
    // No start time was set, so there is no honest way to say "in 30 minutes".
    // One reminder the evening before, and it does not pretend to know a time.
    const evening = new Date(start.getTime() - DAY_MS);
    evening.setHours(EVENING_HOUR, 0, 0, 0);
    plans.push({
      id:    idFor(event.id, 'day'),
      when:  evening.getTime(),
      title: `${event.name} is tomorrow`,
      body:  `Your event is tomorrow${where}. Make sure you are set up and ready.`,
    });
  }

  // A trigger in the past is rejected by Notifee, and an event created an hour
  // before it starts legitimately has no day-before reminder left to give.
  return plans.filter(p => p.when > now);
};

// ── Sync ──────────────────────────────────────────────────────
//
// The single entry point. Give it the current list of events and it makes the
// device's scheduled reminders match: creates what is missing, replaces what
// changed, cancels what no longer applies (event deleted, started, ended, or
// rescheduled earlier).
//
// Idempotent by construction — Notifee replaces a trigger notification that
// reuses an existing id, so calling this on every app focus costs nothing and
// is how a reminder follows an edited event.
//
// Never throws. A reminder that failed to schedule must not take down the
// screen that asked for it.
export const syncEventReminders = async (events: Event[]): Promise<void> => {
  try {
    if (!(await areRemindersEnabled())) { return; }
    if (!(await hasNotificationPermission())) { return; }

    await ensureChannel();

    const now     = Date.now();
    const planned = events.flatMap(e => planFor(e, now));
    const wanted  = new Set(planned.map(p => p.id));

    // Cancel ours that are no longer wanted, and only ours.
    const scheduled = await notifee.getTriggerNotificationIds();
    const stale     = scheduled.filter(id => id.startsWith(ID_PREFIX) && !wanted.has(id));
    if (stale.length > 0) {
      await notifee.cancelTriggerNotifications(stale);
    }

    for (const plan of planned) {
      const trigger: TimestampTrigger = {
        type:      TriggerType.TIMESTAMP,
        timestamp: plan.when,
        repeatFrequency: RepeatFrequency.NONE,
        alarmManager: {
          // Fires in Doze, but inexact — no SCHEDULE_EXACT_ALARM needed.
          // See the note at the top of this file.
          type: AlarmType.SET_AND_ALLOW_WHILE_IDLE,
        },
      };

      await notifee.createTriggerNotification(
        {
          id:    plan.id,
          title: plan.title,
          body:  plan.body,
          android: {
            channelId:  CHANNEL_ID,
            smallIcon:  'ic_launcher',
            importance: AndroidImportance.HIGH,
            pressAction: { id: 'default' },
          },
        },
        trigger,
      );
    }
  } catch (err) {
    console.warn('[notifications] sync failed:', err);
  }
};

// How many reminders are actually armed on this device right now.
//
// Exists because everything else about this feature is invisible until it
// either fires or fails to. Surfaced in Settings so "did that event schedule
// anything?" has an answer that does not involve waiting a day to find out.
export const scheduledReminderCount = async (): Promise<number> => {
  try {
    const ids = await notifee.getTriggerNotificationIds();
    return ids.filter(id => id.startsWith(ID_PREFIX)).length;
  } catch {
    return 0;
  }
};

// ── Cancellation ──────────────────────────────────────────────
export const cancelEventReminders = async (eventId: string): Promise<void> => {
  try {
    await notifee.cancelTriggerNotifications([
      idFor(eventId, 'day'),
      idFor(eventId, 'soon'),
    ]);
  } catch {
    // Cancelling something that is not scheduled is not an error worth raising.
  }
};

// Everything this module owns, and nothing else. Called on logout — one
// merchant's schedule must not fire at whoever signs in next.
export const cancelAllEventReminders = async (): Promise<void> => {
  try {
    const scheduled = await notifee.getTriggerNotificationIds();
    const ours      = scheduled.filter(id => id.startsWith(ID_PREFIX));
    if (ours.length > 0) {
      await notifee.cancelTriggerNotifications(ours);
    }
  } catch {
    // Best effort.
  }
};

export default {
  scheduledReminderCount,
  requestNotificationPermission,
  hasNotificationPermission,
  areRemindersEnabled,
  setRemindersEnabled,
  syncEventReminders,
  cancelEventReminders,
  cancelAllEventReminders,
};
