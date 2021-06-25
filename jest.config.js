module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testTimeout: 45 * 1000,
    collectCoverage: true,
    testRunner: 'jest-circus/runner',
    maxWorkers: 1,
};
