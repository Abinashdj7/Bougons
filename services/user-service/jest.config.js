module.exports = {
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/'],
    testMatch: ['**/?(*.)+(spec|test).js'],
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
    coverageThreshold: {
        global: { branches: 30, functions: 30, lines: 40, statements: 40 },
    },
};
