module.exports = {
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    testTimeout: 30000,
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
    coverageThreshold: {
        global: { branches: 20, functions: 20, lines: 30, statements: 30 },
    },
};
