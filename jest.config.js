module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    testTimeout: 20 * 1000,
    collectCoverage: true,
    maxWorkers: 1,
    testRunner: 'jest-circus/runner',
    globals: {
        'ts-jest': {
            isolatedModules: true,
        },
        Uint8Array: Uint8Array,
    },
};
