const config = require('jest-config');

module.exports = {
	...config.defaults,
	rootDir: process.cwd(),
	modulePathIgnorePatterns: ['<rootDir>/.history'],
	moduleDirectories: [
		'dist/node_modules',
		...config.defaults.moduleDirectories
	],
	testEnvironment: 'jsdom'
};
