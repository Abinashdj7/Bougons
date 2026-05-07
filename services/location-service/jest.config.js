module.exports = {
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/'],
    testMatch: ['**/?(*.)+(spec|test).js'],
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
    coverageThreshold: {
        global: { branches: 20, functions: 20, lines: 30, statements: 30 },
    },
};
