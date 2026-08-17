import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import { MediaPipeWebAssemblyPlugin } from './media_pipe_web_assembly_plugin';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	OfflineBuild — checks that a built site carries everything an offline start needs
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The repository root, which is the folder `vite.config.ts` sits in. */
const PROJECT_ROOT = Path.join(__dirname, '..');

/** The hosts the application used to fetch the model and the runtime from, and must not name again. */
const FORBIDDEN_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com'];

/** Reads values back out of the service worker the build generated. */
class OfflineBuild {
	/**
	 * Reads one of the path lists the build writes into the service worker.
	 *
	 * @param source - The generated `sw.js` source.
	 * @param constantName - The name of the constant holding the list.
	 * @returns Every path in that list.
	 */
	static pathList(source: string, constantName: string): string[] {
		const match = new RegExp(`const ${constantName} = (\\[[^\\]]*\\]);`).exec(source);
		if (match === null) {
			throw new Error(`The generated service worker has no ${constantName} list.`);
		}
		return JSON.parse(match[1]) as string[];
	}

	/**
	 * Lists every file under a folder, as paths relative to it.
	 *
	 * @param directory - The folder to read.
	 * @param prefix - The path of `directory` relative to the starting folder.
	 * @returns Every file path found, with forward slashes.
	 */
	static filePaths(directory: string, prefix: string): string[] {
		const paths: string[] = [];
		for (const entry of Fs.readdirSync(directory, { withFileTypes: true })) {
			const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
			if (entry.isDirectory()) {
				paths.push(...OfflineBuild.filePaths(Path.join(directory, entry.name), relativePath));
				continue;
			}
			paths.push(relativePath);
		}
		return paths;
	}
}

describe('the built site can start with no network connection', () => {
	let outputDirectory = '';
	let serviceWorkerSource = '';

	beforeAll(async () => {
		outputDirectory = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sit-up-please-offline-build-'));
		await build({
			root: Path.join(PROJECT_ROOT, 'web'),
			configFile: Path.join(PROJECT_ROOT, 'vite.config.ts'),
			logLevel: 'silent',
			build: {
				outDir: outputDirectory,
				emptyOutDir: true,
			},
		});
		serviceWorkerSource = Fs.readFileSync(Path.join(outputDirectory, 'sw.js'), 'utf8');
	}, 120_000);

	it('carries the Face Landmarker model file', () => {
		const modelPath = Path.join(outputDirectory, 'models', 'face_landmarker.task');
		expect(Fs.existsSync(modelPath)).toBe(true);
		expect(Fs.statSync(modelPath).size).toBeGreaterThan(1_000_000);
	});

	it('carries both variants of the MediaPipe WebAssembly runtime', () => {
		for (const fileName of MediaPipeWebAssemblyPlugin.allFileNames()) {
			const filePath = Path.join(outputDirectory, MediaPipeWebAssemblyPlugin.OUTPUT_DIRECTORY, fileName);
			expect(Fs.existsSync(filePath), `${fileName} is missing from the built site`).toBe(true);
		}
	});

	it('precaches the document, the bundles and the model file', () => {
		const precachePaths = OfflineBuild.pathList(serviceWorkerSource, 'PRECACHE_PATHS');
		expect(precachePaths).toContain('./');
		expect(precachePaths).toContain('./models/face_landmarker.task');
		expect(precachePaths.some((path) => path.endsWith('.js'))).toBe(true);
		expect(precachePaths.some((path) => path.endsWith('.css'))).toBe(true);
	});

	it('names only files that the built site actually holds', () => {
		const listNames = ['PRECACHE_PATHS', 'SINGLE_INSTRUCTION_PATHS', 'NO_SINGLE_INSTRUCTION_PATHS'];
		for (const listName of listNames) {
			for (const path of OfflineBuild.pathList(serviceWorkerSource, listName)) {
				// The document is stored under the address a navigation asks for, which is the folder
				// itself rather than a file name.
				const relativePath = path === './' ? './index.html' : path;
				const filePath = Path.join(outputDirectory, relativePath);
				expect(Fs.existsSync(filePath), `${listName} names ${path}, which the build did not write`).toBe(true);
			}
		}
	});

	it('precaches one WebAssembly runtime variant per browser, never both at once', () => {
		const singleInstruction = OfflineBuild.pathList(serviceWorkerSource, 'SINGLE_INSTRUCTION_PATHS');
		const noSingleInstruction = OfflineBuild.pathList(serviceWorkerSource, 'NO_SINGLE_INSTRUCTION_PATHS');
		expect(singleInstruction).toHaveLength(2);
		expect(noSingleInstruction).toHaveLength(2);
		const precachePaths = OfflineBuild.pathList(serviceWorkerSource, 'PRECACHE_PATHS');
		for (const path of [...singleInstruction, ...noSingleInstruction]) {
			expect(precachePaths, 'the runtime is chosen at install time, not precached outright')
				.not.toContain(path);
		}
	});

	it('carries a build identifier, so a new deployment starts with fresh caches', () => {
		expect(serviceWorkerSource).toMatch(/const BUILD_IDENTIFIER = "[0-9a-f]{12}";/);
	});

	it('names no third-party host anywhere in the application source', () => {
		const webDirectory = Path.join(PROJECT_ROOT, 'web');
		const sourcePaths = OfflineBuild.filePaths(webDirectory, '')
			.filter((path) => /\.(ts|js|html|scss|css|webmanifest)$/.test(path))
			.filter((path) => path.startsWith('public/models/') === false);
		for (const relativePath of sourcePaths) {
			const contents = Fs.readFileSync(Path.join(webDirectory, relativePath), 'utf8');
			for (const host of FORBIDDEN_HOSTS) {
				expect(contents.includes(host), `web/${relativePath} still names ${host}`).toBe(false);
			}
		}
	});
});
