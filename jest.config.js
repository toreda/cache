module.exports = {
	roots: ['./'],
	coverageDirectory: './coverage',
	coveragePathIgnorePatterns: [
		'.eslintrc.js',
		'.node/',
		'babel.config.js',
		'build-events.ts',
		'coverage/',
		'jest.config.js',
		'jest/',
		'node_modules/',
		'tests/',
		'webpack.config.js',
		'webpack.dev.js'
	],
	moduleFileExtensions: ['ts', 'js', 'json'],
	testEnvironment: 'jsdom',
	testPathIgnorePatterns: [
		'.eslintrc.js',
		'build-events.ts',
		'node_modules/',
		'coverage/',
		'gulp.js',
		'gulp.ts',
		'./jest.config.js',
		'./webpack.*.js',
		'./webpack.*.ts'
	],
	transformIgnorePatterns: ['jest.config.js'],
	testRegex: '(/__tests__/.*|(\\.|/)(spec))\\.ts$',
	testResultsProcessor: 'jest-sonar-reporter',
	globals: {
		'ts-jest': {
			tsconfig: 'tsconfig.json'
		}
	},
	transform: {
		'^.+\\.ts$': 'ts-jest'
	}
};
