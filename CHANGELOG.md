# Changelog

## [Unreleased]

### Changed
- Replaced `needle` with `axios` across `index.js`, `jackett.js` and `helpers.js` — `needle` removed from dependencies
- `jackett.js` — `search` converted from callback-based to async, returns results directly via `Promise.all` across all indexers; both streaming and completion callbacks removed
- `jackett.js` — `getIndexers` converted to async
- `index.js` — `respondStreams` lifted out of the route handler into a top-level `async function`, matching the style of `collections`
- `index.js` — `streamFromMagnet` converted to async, returns stream object directly instead of taking a callback
- `index.js` — replaced `async.queue` with a plain `for...of` loop; `async` library removed from dependencies
- `index.js` — Jackett search query uses `imdbId` instead of movie name for more consistent results
- `index.js` — response timeout guard uses `res.headersSent` instead of a manual `sentResponse` flag
- `index.js` — result filtering uses a single chained `.filter().sort().slice()` with `Math.max` to enforce a minimum of 20 results
- `helpers.js` — `followRedirect` converted to async, returns url directly instead of taking a callback
- `helpers.js` — removed `extraTag`, `simpleName`, `isObject` and `setTicker` — no longer needed with imdbId-based search and Promise-based jackett
- `helpers.js` — removed `video-name-parser` dependency
- `config.js` — simplified `readConfig`, removed nested try/catch and recursive call
- `downloader.js` — `followRedirect` call updated to use new async return style
- Removed `pkg` build script and dependency
- Removed `auto-launch` dependency and `autoLaunch.js`
- Removed `localtunnel` dependency and `tunnel.js`
- README restructured to lead with fork features; added LAN usage section; install instructions updated to run-from-source only

### Added
- `index.js` — `collections()` function: when a movie is streamed, fetches its TMDB collection, searches Jackett for each other part, and enqueues them for sequential download
- `index.js` — TMDB API key validation guard (`config.tmdbApiKey` regex check) before triggering collection lookup
- `downloader.js` — `isCollectionPart` flag passed through to `Downloader` to support collection-aware path handling
- `downloader.js` — queue (`enqueued`) and reactive edge-triggered `_next` setter: when a download finishes, the next enqueued item starts automatically
- `downloader.js` — `handlePath` detects already-downloaded titles by scanning folder names for the `imdbId`, skipping re-download if found

### Added
- `downloader.js` — new module that automatically downloads torrents via WebTorrent after a configurable delay
- `webtorrent` dependency for torrent downloading
- New config keys: `saveTorrent`, `savePath`, `waitFor`, `targetRes`, `candidates`, `downloadAfter`
- Configuration Reference table in README

### Changed
- Converted all modules from CommonJS (`require`/`module.exports`) to ES Modules (`import`/`export default`)
- `config.js` now resolves paths relative to source files (`import.meta.url`) instead of the executable (`process.execPath`)
- `config.js` writes clean JSON (no comment-json annotations) and merges missing defaults on read
- `index.js` passes `imdbId` and `name` to `respondStreams`, which triggers the downloader after `downloadAfter` minutes for movies; resets timer if user browses to a new title
- Default `maximumResults` changed from `15` → `30`
- Default `remote` changed from `false` → `true`
- Build targets narrowed to `node18-macos-x64` and `node18-win-x64`
- Added `pkg.assets` for webtorrent in `package.json`
- Removed deprecation notice pointing to PimpMyStremio from README
