module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // The RN config only switches the jest environment on for __tests__/
      // and *.test.* files. jest.setup.js runs in that same environment but
      // matches neither pattern, so every jest.mock() reads as no-undef.
      files: ['jest.setup.js', 'jest.config.js'],
      env: { jest: true, node: true },
    },
  ],
};
