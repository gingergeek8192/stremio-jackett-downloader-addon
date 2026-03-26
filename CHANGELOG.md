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


### WebTorrent Reference

```

## From the WebTorrent docs:

client.add(torrentId, [opts], [cb])
client.remove(torrentId, [opts], [cb])
client.destroy([cb])
client.torrents — array of torrent instances
client.get(torrentId) — returns torrent or null
client.downloadSpeed / client.uploadSpeed / client.progress / client.ratio

torrent.infoHash
torrent.name
torrent.files — array of file instances
torrent.pieces
torrent.timeRemaining
torrent.downloaded / torrent.uploaded
torrent.downloadSpeed / torrent.uploadSpeed
torrent.progress / torrent.ratio
torrent.numPeers
torrent.path
torrent.ready / torrent.paused / torrent.done
torrent.destroy([opts], [cb])
torrent.addPeer(peer)
torrent.removePeer(peer)
torrent.pause() / torrent.resume()

Events
infoHash — got infoHash
metadata — got metadata
ready — torrent ready
warning
error
done — download complete
download — chunk downloaded
upload — chunk uploaded
wire — connected to peer
noPeers
File
file.name / file.path / file.length
file.downloaded / file.progress
file.select() / file.deselect()
file.stream([opts])
file.createReadStream([opts])

```