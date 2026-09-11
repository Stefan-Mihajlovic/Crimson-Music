const moduleNameMapper = { '^@/assets/(.*)$': '<rootDir>/assets/$1', '^@/(.*)$': '<rootDir>/src/$1' };
module.exports = {
  projects: [
    { preset: 'jest-expo/android', displayName: 'Android', testMatch: ['<rootDir>/tests/platforms/*.android.test.js'], moduleNameMapper, clearMocks: true },
    { preset: 'jest-expo/web', displayName: 'Web', testMatch: ['<rootDir>/tests/platforms/*.web.test.js'], moduleNameMapper, clearMocks: true },
  ],
};
