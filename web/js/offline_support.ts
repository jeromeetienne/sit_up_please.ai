///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	OfflineSupport — registers the service worker that caches the app shell
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Registers the service worker that lets the monitor open without a network
 * connection after a first visit.
 *
 * Only registers in the built production bundle: the Vite development server
 * serves unbundled modules that a cached service worker would make stale.
 */
export class OfflineSupport {
	static register(): void {
		if (import.meta.env.PROD === false) return;
		if ('serviceWorker' in navigator === false) return;

		window.addEventListener('load', () => {
			void navigator.serviceWorker.register('./sw.js').catch(() => {
				// The interface keeps working online; only offline startup is lost.
			});
		});
	}
}
