module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/tests/**/*.integration.test.js'],
  moduleNameMapper: { '^@/assets/(.*)$': '<rootDir>/assets/$1', '^@/(.*)$': '<rootDir>/src/$1' },
  clearMocks: true,
};
