import Fs from 'node:fs';
import Path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MediaPipeWebAssemblyPlugin — serves the MediaPipe WebAssembly runtime from this origin
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Where the installed `@mediapipe/tasks-vision` package keeps its WebAssembly runtime. */
const PACKAGE_WEB_ASSEMBLY_DIRECTORY = Path.join(
	__dirname,
	'..',
	'node_modules',
	'@mediapipe',
	'tasks-vision',
	'wasm',
);

/** The content types the development middleware answers with, by file extension. */
const CONTENT_TYPES: Record<string, string> = {
	'.js': 'text/javascript',
	'.wasm': 'application/wasm',
};

/**
 * Copies the MediaPipe WebAssembly runtime out of `node_modules` and into the built site, and serves
 * the same files from the development server, so that the Face Landmarker never reaches a content
 * delivery network. The copied files are the ones `package-lock.json` pins, which also removes the
 * version drift the previous `@latest` address carried.
 *
 * `FilesetResolver.forVisionTasks` instantiates a small WebAssembly module at run time to find out
 * whether the browser supports single-instruction-multiple-data operations, then asks for one of two
 * variants. Both variants are copied, because either one can be the one a browser asks for.
 */
export class MediaPipeWebAssemblyPlugin {
	/** The folder inside the built site, and inside the development server, that holds the runtime. */
	static readonly OUTPUT_DIRECTORY = 'wasm';

	/** The runtime file names asked for by a browser that supports the single-instruction operations. */
	static readonly SINGLE_INSTRUCTION_FILE_NAMES = [
		'vision_wasm_internal.js',
		'vision_wasm_internal.wasm',
	];

	/** The runtime file names asked for by a browser without the single-instruction operations. */
	static readonly NO_SINGLE_INSTRUCTION_FILE_NAMES = [
		'vision_wasm_nosimd_internal.js',
		'vision_wasm_nosimd_internal.wasm',
	];

	/**
	 * Returns the Vite plugin that copies the runtime into the build output and serves it in
	 * development.
	 *
	 * @returns The plugin to add to the `plugins` array in `vite.config.ts`.
	 */
	static create(): Plugin {
		return {
			name: 'sit-up-please-media-pipe-web-assembly',
			configureServer: (server: ViteDevServer) => {
				MediaPipeWebAssemblyPlugin._serveInDevelopment(server);
			},
			generateBundle() {
				for (const fileName of MediaPipeWebAssemblyPlugin.allFileNames()) {
					this.emitFile({
						type: 'asset',
						fileName: `${MediaPipeWebAssemblyPlugin.OUTPUT_DIRECTORY}/${fileName}`,
						source: MediaPipeWebAssemblyPlugin.readFile(fileName),
					});
				}
			},
		};
	}

	/** Returns every runtime file name that is copied into the built site, both variants together. */
	static allFileNames(): string[] {
		return [
			...MediaPipeWebAssemblyPlugin.SINGLE_INSTRUCTION_FILE_NAMES,
			...MediaPipeWebAssemblyPlugin.NO_SINGLE_INSTRUCTION_FILE_NAMES,
		];
	}

	/**
	 * Reads one runtime file out of the installed package.
	 *
	 * @param fileName - One of the file names returned by `allFileNames()`.
	 * @returns The bytes of that file.
	 */
	static readFile(fileName: string): Uint8Array {
		const filePath = Path.join(PACKAGE_WEB_ASSEMBLY_DIRECTORY, fileName);
		if (Fs.existsSync(filePath) === false) {
			throw new Error(
				`The MediaPipe WebAssembly runtime file ${fileName} is missing from ${PACKAGE_WEB_ASSEMBLY_DIRECTORY}. `
				+ 'Run `npm install` and build again.',
			);
		}
		return Fs.readFileSync(filePath);
	}

	/**
	 * Returns the version of the installed `@mediapipe/tasks-vision` package, which identifies the
	 * runtime the built site carries.
	 *
	 * @returns The version string, for example `0.10.35`.
	 */
	static packageVersion(): string {
		const packagePath = Path.join(__dirname, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'package.json');
		const contents = JSON.parse(Fs.readFileSync(packagePath, 'utf8')) as { version?: string };
		const version = contents.version;
		if (version === undefined) {
			throw new Error('The installed @mediapipe/tasks-vision package.json has no version field.');
		}
		return version;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Answers development-server requests for the runtime folder out of `node_modules`, so that the
	 * development server and the built site both load the runtime from their own origin.
	 *
	 * @param server - The running Vite development server.
	 * @returns Nothing.
	 */
	private static _serveInDevelopment(server: ViteDevServer): void {
		const urlPrefix = `/${MediaPipeWebAssemblyPlugin.OUTPUT_DIRECTORY}/`;
		server.middlewares.use((request, response, next) => {
			const requestUrl = request.url;
			if (requestUrl === undefined || requestUrl.startsWith(urlPrefix) === false) {
				next();
				return;
			}

			const fileName = requestUrl.slice(urlPrefix.length).split('?')[0];
			if (MediaPipeWebAssemblyPlugin.allFileNames().includes(fileName) === false) {
				next();
				return;
			}

			const contentType = CONTENT_TYPES[Path.extname(fileName)];
			response.setHeader('Content-Type', contentType ?? 'application/octet-stream');
			response.end(MediaPipeWebAssemblyPlugin.readFile(fileName));
		});
	}
}
