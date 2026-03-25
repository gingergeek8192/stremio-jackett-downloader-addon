# Changelog

## [Unreleased]

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

### Removed
- Comment-json annotations from default config
