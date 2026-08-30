// __tests__/PastEventsScreen.test.ts
//
// Covers getMonthTag, specifically the year-boundary case that broke "Last
// Month" every January: comparing d.getMonth() === now.getMonth() - 1 fails
// in January, since now.getMonth() - 1 is -1 and no month is ever -1, so
// every December event silently dropped out of "Last Month" the moment the
// calendar turned over. A test that only runs correctly in January is no
// test at all, so "now" is mocked here rather than left to the clock.
import { getMonthTag } from '../src/screens/dashboard/PastEventsScreen';
import type { Event } from '../src/services/api';

const eventOn = (dateIso: string): Event => ({
  id:            'evt-1',
  name:          'Test Event',
  date:          dateIso,
  dateIso,
  location:      'Somewhere',
  tipOptions:    [100],
  status:        'past',
  tipsCollected: 0,
  totalAmount:   0,
});

describe('getMonthTag', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tags this month and last month correctly mid-year', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 15).getTime()); // Jun 2026

    expect(getMonthTag(eventOn('2026-06-02'))).toBe('this');
    expect(getMonthTag(eventOn('2026-05-20'))).toBe('last');
    expect(getMonthTag(eventOn('2026-04-01'))).toBe('older');
  });

  it('counts December as last month when the calendar has just turned to January', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2027, 0, 5).getTime()); // Jan 2027

    expect(getMonthTag(eventOn('2027-01-02'))).toBe('this');
    expect(getMonthTag(eventOn('2026-12-30'))).toBe('last');
    expect(getMonthTag(eventOn('2026-11-15'))).toBe('older');
  });

  it('parses dateIso as local, not UTC midnight', () => {
    // The trap this guards against: new Date('2026-06-01') is UTC midnight by
    // spec, which is May 31st in any timezone behind UTC — a boundary event
    // would silently fall into the wrong tab depending on where the device is.
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 15).getTime());
    expect(getMonthTag(eventOn('2026-06-01'))).toBe('this');
  });

  it('falls back to the display date string when dateIso is missing', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 15).getTime());
    const event = { ...eventOn('2026-06-02'), dateIso: undefined, date: 'Jun 2, 2026' };
    expect(getMonthTag(event)).toBe('this');
  });
});
