import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  testRegex: [],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};

export default config;
