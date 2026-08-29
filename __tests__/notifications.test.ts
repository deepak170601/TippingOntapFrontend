// __tests__/notifications.test.ts
//
// These cover the one part of event reminders that is easy to get quietly
// wrong: turning a zone-less "2029-06-17" + "19:00" from the API into the
// instant a notification should fire.
//
// The trap is that `new Date('2029-06-17')` is parsed as UTC midnight by spec,
// while `new Date('2029-06-17T19:00')` is parsed as local. Mixing the two puts
// a reminder hours out, and the error scales with the merchant's distance from
// UTC — so it looks perfect to anyone developing in London and is wildly wrong
// in Sydney. Asserting against a locally-constructed Date is what pins it.
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEventReminders, scheduledReminderCount } from '../src/services/notifications';
import type { Event } from '../src/services/api';

const mockNotifee = notifee as unknown as {
  createTriggerNotification:  jest.Mock;
  getTriggerNotificationIds:  jest.Mock;
  cancelTriggerNotifications: jest.Mock;
  getNotificationSettings:    jest.Mock;
  createChannel:              jest.Mock;
};

const baseEvent: Event = {
  id:            'evt-1',
  name:          'Spring Fair',
  date:          'Jun 17, 2029',
  time:          '7:00 PM',
  dateIso:       '2029-06-17',
  timeIso:       '19:00',
  location:      'Central Park',
  tipOptions:    [100, 200],
  status:        'upcoming',
  tipsCollected: 0,
  totalAmount:   0,
};

// The instant the fixture starts, in the device's own zone. Everything below is
// asserted relative to this rather than to a hardcoded epoch.
const START = new Date(2029, 5, 17, 19, 0, 0, 0).getTime();
const DAY   = 24 * 60 * 60 * 1000;

/** The (id, timestamp) pairs handed to notifee, in call order. */
const scheduled = (): { id: string; when: number }[] =>
  mockNotifee.createTriggerNotification.mock.calls.map(
    ([notification, trigger]) => ({ id: notification.id, when: trigger.timestamp }),
  );

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockNotifee.getTriggerNotificationIds.mockResolvedValue([]);
  mockNotifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });
});

describe('syncEventReminders', () => {
  it('schedules both reminders in local time, not UTC', async () => {
    await syncEventReminders([baseEvent]);

    expect(scheduled()).toEqual([
      { id: 'evt:evt-1:day',  when: START - DAY },
      { id: 'evt:evt-1:soon', when: START - 30 * 60 * 1000 },
    ]);
  });

  it('falls back to one evening reminder when the event has no start time', async () => {
    await syncEventReminders([
      { ...baseEvent, time: undefined, timeIso: undefined },
    ]);

    // 18:00 the previous evening — and crucially no "starts in 30 minutes",
    // because without a time there is nothing honest to count down to.
    expect(scheduled()).toEqual([
      { id: 'evt:evt-1:day', when: new Date(2029, 5, 16, 18, 0, 0, 0).getTime() },
    ]);
  });

  it('ignores events that are not upcoming', async () => {
    await syncEventReminders([
      { ...baseEvent, status: 'active' },
      { ...baseEvent, id: 'evt-2', status: 'past' },
    ]);

    expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('drops reminders whose moment has already passed', async () => {
    // Created the morning of the event: the day-before reminder is gone, but
    // the 30-minute one is still ahead and must survive.
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2029, 5, 17, 9, 0).getTime());

    await syncEventReminders([baseEvent]);

    expect(scheduled()).toEqual([
      { id: 'evt:evt-1:soon', when: START - 30 * 60 * 1000 },
    ]);

    (Date.now as jest.Mock).mockRestore();
  });

  it('cancels our stale reminders and leaves anything else alone', async () => {
    mockNotifee.getTriggerNotificationIds.mockResolvedValue([
      'evt:evt-1:day',      // still wanted
      'evt:deleted:soon',   // ours, event is gone
      'some-other-feature', // not ours
    ]);

    await syncEventReminders([baseEvent]);

    expect(mockNotifee.cancelTriggerNotifications)
      .toHaveBeenCalledWith(['evt:deleted:soon']);
  });

  it('schedules nothing when notification permission is denied', async () => {
    mockNotifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 0 });

    await syncEventReminders([baseEvent]);

    expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('schedules nothing when the merchant has turned reminders off', async () => {
    await AsyncStorage.setItem('notif_event_reminders_enabled', 'false');

    await syncEventReminders([baseEvent]);

    expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  });
});

describe('scheduledReminderCount', () => {
  it('counts only our own reminders', async () => {
    mockNotifee.getTriggerNotificationIds.mockResolvedValue([
      'evt:a:day', 'evt:a:soon', 'some-other-feature',
    ]);
    await expect(scheduledReminderCount()).resolves.toBe(2);
  });
});
