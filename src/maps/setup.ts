// One-time MapLibre setup. Map modules import this file before creating maps.

import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre decodes tiles in a Web Worker (a background thread) and looks for
// the worker script next to its own file. Vite moves files around when it
// bundles, so point MapLibre at the copy Vite serves (`?url` makes Vite
// include the file and give us its final URL, base path included).
setWorkerUrl(workerUrl)
