/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2026 Toreda, Inc.
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a copy
 *	of this software and associated documentation files (the "Software"), to deal
 *	in the Software without restriction, including without limitation the rights
 *	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *	copies of the Software, and to permit persons to whom the Software is
 *	furnished to do so, subject to the following conditions:

 * 	The above copyright notice and this permission notice shall be included in all
 * 	copies or substantial portions of the Software.
 *
 * 	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * 	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * 	SOFTWARE.
 *
 */

import {Levels, Log} from '@toreda/log';

import {Build} from '@toreda/build-tools';
import {EventEmitter} from 'events';
import {promises as fs} from 'fs';
import {replaceTscAliasPaths} from 'tsc-alias';
import {series} from 'gulp';

const log = new Log({
	consoleEnabled: true,
	globalLevel: Levels.ALL
});

const build: Build = new Build({
	log: log,
	events: new EventEmitter(),
	linter: {
		globInputPaths: true
	}
});

async function runLint(): Promise<NodeJS.ReadWriteStream> {
	return build.gulpSteps.lint({
		formatterId: 'stylish',
		srcPatterns: ['./src/**.ts', './src/**/**.ts']
	});
}

function createDist(): Promise<NodeJS.ReadWriteStream> {
	return build.gulpSteps.createDir('./dist', true);
}

function cleanDist(): Promise<NodeJS.ReadWriteStream> {
	return build.gulpSteps.cleanDir('./dist', true);
}

function buildCjs(): Promise<NodeJS.ReadWriteStream> {
	return build.run.typescript('./dist', 'tsconfig.json');
}

function buildEsm(): Promise<NodeJS.ReadWriteStream> {
	return build.run.typescript('./dist/esm', 'tsconfig.esm.json');
}

async function finalizeEsm(): Promise<void> {
	// tsc emits relative imports without extensions, which Node's ESM loader
	// rejects. Rewrite them to explicit './x.js' specifiers in js + d.ts output.
	await replaceTscAliasPaths({
		configFile: 'tsconfig.esm.json',
		resolveFullPaths: true
	});

	// Mark everything under dist/esm as ESM. The package root has no "type"
	// field, so dist/*.js stays CommonJS.
	await fs.writeFile('./dist/esm/package.json', JSON.stringify({type: 'module'}, null, '\t') + '\n');
}

exports.default = series(createDist, cleanDist, runLint, buildCjs, buildEsm, finalizeEsm);
