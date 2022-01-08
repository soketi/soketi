module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testTimeout: 20 * 1000,
    collectCoverage: true,
    maxWorkers: 1,
    testRunner: 'jest-circus/runner',
    include: ['src/*'],
    globals: {
        'ts-jest': {
            isolatedModules: true,
        },
    },
};
