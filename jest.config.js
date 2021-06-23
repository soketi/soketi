module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testTimeout: 15 * 1000,
    collectCoverage: true,
    testRunner: 'jest-circus/runner',
    maxWorkers: 1,
};
