// __tests__/support.test.ts
import { buildSupportRequest } from '../src/services/support';

jest.mock('../src/utils/deviceInfo', () => ({
  getDeviceSummary: () => ({ brand: 'samsung', model: 'SM-G991B', os: 'Android 14' }),
  formatDevice: () => 'samsung SM-G991B · Android 14',
}));

const user = {
  id: 'u1',
  firstName: 'Kee',
  lastName: 'Ban',
  fullName: 'Kee Ban',
  email: 'keerban@gmail.com',
  phoneNumber: '+15551234567',
  onboardingComplete: false,
};

describe('buildSupportRequest', () => {
  it('carries who is stuck, on what, and how to reach them', () => {
    const r = buildSupportRequest('phone', user);
    expect(r.channel).toBe('phone');
    expect(r.name).toBe('Kee Ban');
    expect(r.email).toBe('keerban@gmail.com');
    expect(r.phoneNumber).toBe('+15551234567');
    expect(r.device).toBe('samsung SM-G991B · Android 14');
  });

  it('carries no device identifiers, only brand and model', () => {
    // The client asked for "mobile model and brand nothing more than that".
    // Android also exposes Serial and Fingerprint; neither may appear here.
    const serialised = JSON.stringify(buildSupportRequest('email', user));
    expect(serialised).not.toMatch(/serial/i);
    expect(serialised).not.toMatch(/fingerprint/i);
    expect(Object.keys(buildSupportRequest('email', user)).sort()).toEqual([
      'channel', 'context', 'device', 'email', 'name', 'phoneNumber', 'sentAt',
    ]);
  });

  it('falls back rather than sending "undefined" to support', () => {
    // A merchant who cannot finish signup may have half a profile — that is
    // exactly the person most likely to be using this.
    const r = buildSupportRequest('email', null);
    expect(r.name).toBe('Unknown merchant');
    expect(r.email).toBe('Not provided');
    expect(r.phoneNumber).toBe('Not provided');
  });

  it('defaults the context to the screen that owns the button', () => {
    expect(buildSupportRequest('email', user).context).toBe('Stripe onboarding');
    expect(buildSupportRequest('email', user, 'Wallet').context).toBe('Wallet');
  });

  it('timestamps in ISO 8601 UTC', () => {
    expect(buildSupportRequest('email', user).sentAt)
      .toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });
});
