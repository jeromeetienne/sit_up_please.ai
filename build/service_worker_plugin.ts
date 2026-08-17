import Crypto from 'node:crypto';
import Fs from 'node:fs';
import Path from 'node:path';
import type { OutputBundle } from 'rollup';
import type { Plugin } from 'vite';
import { MediaPipeWebAssemblyPlugin } from './media_pipe_web_assembly_plugin';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ServiceWorkerPlugin — writes the precache list of the built site into the service worker
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The service worker source that the build fills in and emits as `sw.js`. */
const TEMPLATE_PATH = Path.join(__dirname, '..', 'web', 'sw.js');

/** The folder whose whole contents are copied to the built site untouched, and precached. */
const PUBLIC_DIRECTORY = Path.join(__dirname, '..', 'web', 'public');

/**
 * The address a navigation asks for. The built `index.html` is precached under this address rather
 * than under its own file name, because that is the address the browser requests when a person opens
 * the application.
 */
const DOCUMENT_PATH = './';

/** The placeholder names the template carries, each replaced with a value taken from the build. */
const PLACEHOLDERS = {
	buildIdentifier: "'__BUILD_IDENTIFIER__'",
	precachePaths: "'__PRECACHE_PATHS__'",
	singleInstructionPaths: "'__SINGLE_INSTRUCTION_PATHS__'",
	noSingleInstructionPaths: "'__NO_SINGLE_INSTRUCTION_PATHS__'",
} as const;

/** One file the service worker precaches, with the bytes used to identify the build it belongs to. */
type PrecacheEntry = {
	/** The address the service worker asks for, relative to its own folder. */
	path: string;
	/** The contents of that file in the built site. */
	contents: string | Uint8Array;
};

/**
 * Generates the service worker of the built site from the template at `web/sw.js`, filling in the
 * complete list of files a start needs and an identifier for this build.
 *
 * The list has to be generated rather than written by hand for two reasons. The JavaScript bundle and
 * the stylesheet bundle carry a content hash in their file names, which is only known once the build
 * has run. And a first visit registers the service worker after the browser has already asked for
 * those two files, so a service worker that only watches later requests never sees them and never
 * stores them. Naming every file at install time is what lets one online visit be enough, whether or
 * not the camera was ever started.
 */
export class ServiceWorkerPlugin {
	/**
	 * Returns the Vite plugin that emits the filled-in service worker.
	 *
	 * @returns The plugin to add to the `plugins` array in `vite.config.ts`.
	 */
	static create(): Plugin {
		return {
			name: 'sit-up-please-service-worker',
			apply: 'build',
			// Runs last, so that the built `index.html` is already part of the bundle. Vite emits the
			// document from its own `generateBundle` hook, which an ordinary plugin runs ahead of.
			enforce: 'post',
			generateBundle(_options, bundle) {
				const entries = ServiceWorkerPlugin._collectEntries(bundle);
				this.emitFile({
					type: 'asset',
					fileName: 'sw.js',
					source: ServiceWorkerPlugin._fillTemplate(entries),
				});
			},
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Gathers every file the service worker precaches: the document, everything the bundle produced,
	 * and everything copied out of the public folder.
	 *
	 * The WebAssembly runtime is left out here on purpose. Both of its variants are shipped, but only
	 * the one the browser asks for is precached, which the service worker decides for itself.
	 *
	 * @param bundle - The finished Rollup output, keyed by file name inside the built site.
	 * @returns One entry per precached file.
	 */
	private static _collectEntries(bundle: OutputBundle): PrecacheEntry[] {
		const entries: PrecacheEntry[] = [];

		const webAssemblyPrefix = `${MediaPipeWebAssemblyPlugin.OUTPUT_DIRECTORY}/`;
		for (const [fileName, output] of Object.entries(bundle)) {
			if (fileName.startsWith(webAssemblyPrefix)) {
				continue;
			}
			const contents = output.type === 'chunk' ? output.code : output.source;
			// The document is precached under the address a navigation asks for, not under its own
			// file name, so that one stored copy answers both.
			const path = fileName === 'index.html' ? DOCUMENT_PATH : `./${fileName}`;
			entries.push({ path, contents });
		}

		for (const relativePath of ServiceWorkerPlugin._publicFilePaths(PUBLIC_DIRECTORY, '')) {
			entries.push({
				path: `./${relativePath}`,
				contents: Fs.readFileSync(Path.join(PUBLIC_DIRECTORY, relativePath)),
			});
		}

		return entries.sort((left, right) => left.path.localeCompare(right.path));
	}

	/**
	 * Lists every file under the public folder, as paths relative to that folder, walking subfolders.
	 *
	 * @param directory - The folder to read.
	 * @param prefix - The path of `directory` relative to the public folder, empty at the top.
	 * @returns Every file path found, with forward slashes.
	 */
	private static _publicFilePaths(directory: string, prefix: string): string[] {
		const paths: string[] = [];
		for (const entry of Fs.readdirSync(directory, { withFileTypes: true })) {
			const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
			if (entry.isDirectory()) {
				paths.push(...ServiceWorkerPlugin._publicFilePaths(Path.join(directory, entry.name), relativePath));
				continue;
			}
			paths.push(relativePath);
		}
		return paths;
	}

	/**
	 * Replaces every placeholder in the template with a value taken from this build.
	 *
	 * @param entries - Every file the service worker precaches, apart from the WebAssembly runtime.
	 * @returns The finished service worker source.
	 */
	private static _fillTemplate(entries: PrecacheEntry[]): string {
		const template = Fs.readFileSync(TEMPLATE_PATH, 'utf8');
		const webAssemblyPrefix = `./${MediaPipeWebAssemblyPlugin.OUTPUT_DIRECTORY}/`;
		const replacements: Record<keyof typeof PLACEHOLDERS, string> = {
			buildIdentifier: JSON.stringify(ServiceWorkerPlugin._buildIdentifier(entries)),
			precachePaths: JSON.stringify(entries.map((entry) => entry.path), undefined, '\t'),
			singleInstructionPaths: JSON.stringify(
				MediaPipeWebAssemblyPlugin.SINGLE_INSTRUCTION_FILE_NAMES.map((name) => `${webAssemblyPrefix}${name}`),
			),
			noSingleInstructionPaths: JSON.stringify(
				MediaPipeWebAssemblyPlugin.NO_SINGLE_INSTRUCTION_FILE_NAMES.map((name) => `${webAssemblyPrefix}${name}`),
			),
		};

		let source = template;
		for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) {
			if (source.includes(placeholder) === false) {
				throw new Error(`The service worker template no longer carries the placeholder ${placeholder}.`);
			}
			source = source.replace(placeholder, replacements[key as keyof typeof PLACEHOLDERS]);
		}
		return source;
	}

	/**
	 * Builds the identifier that names the caches of this build. It changes whenever the contents of
	 * any precached file change, or whenever the installed MediaPipe package changes, so that a new
	 * deployment always produces a service worker the browser sees as new. Without that, a deployment
	 * that only edits the document would leave every device serving the previous document from its
	 * cache for good.
	 *
	 * @param entries - Every file the service worker precaches, apart from the WebAssembly runtime.
	 * @returns The first twelve characters of the SHA-256 sum over the whole build.
	 */
	private static _buildIdentifier(entries: PrecacheEntry[]): string {
		const hash = Crypto.createHash('sha256');
		hash.update(`@mediapipe/tasks-vision@${MediaPipeWebAssemblyPlugin.packageVersion()}\n`);
		for (const entry of entries) {
			hash.update(entry.path);
			hash.update(Crypto.createHash('sha256').update(entry.contents).digest());
		}
		return hash.digest('hex').slice(0, 12);
	}
}
