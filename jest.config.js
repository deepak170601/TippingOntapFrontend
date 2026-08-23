// Packages that publish untranspiled ESM and so must be run through
// babel-jest. The react-native preset ignores everything in node_modules
// except its own scopes; naming transformIgnorePatterns here replaces
// that list rather than extending it, so the preset's entries are
// repeated below.
const esmPackages = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  '@react-navigation',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-vector-icons',
];

module.exports = {
  preset: 'react-native',
  // setupFilesAfterEnv, not setupFiles: the react-native preset already
  // populates setupFiles, and naming it here would replace that array
  // rather than extend it.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    `node_modules/(?!(${esmPackages.join('|')})/)`,
  ],
};
