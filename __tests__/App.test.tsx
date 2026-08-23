/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let tree: ReturnType<typeof ReactTestRenderer.create> | undefined;

  // async callback on purpose: App kicks off requestNeededAndroidPermissions
  // in an effect and calls setState when it resolves. A sync act() returns
  // before that microtask runs, so the update lands outside act and React
  // warns. Awaiting inside act flushes it while still tracked.
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });

  expect(tree!.toJSON()).toBeTruthy();

  // Unmount before the test returns. The permission mock grants, so the whole
  // navigator mounts and SplashScreen arms a 2.5s timer; left running it fires
  // after Jest has torn the environment down and logs a wall of stack traces.
  await ReactTestRenderer.act(async () => {
    tree!.unmount();
  });
});
