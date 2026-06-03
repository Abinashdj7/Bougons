module.exports = {
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
    testTimeout: 30000,
    coverageThreshold: {
        global: { branches: 30, functions: 30, lines: 40, statements: 40 },
    },
};
