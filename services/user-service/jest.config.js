module.exports = {
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/'],
    testMatch: ['**/?(*.)+(spec|test).js'],
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
    coverageThreshold: {
        global: { branches: 50, functions: 50, lines: 50, statements: 50 },
    },
};
