# TODO


## Library Manager

Organise downloaded files into a clean top-level folder structure.

- Rename and move completed downloads into Jellyfin-compatible structure:
  ```
  Movies/
    Movie Name (Year) {imdb-ttXXXXXXX}/
      Movie Name (Year).mkv
      poster.jpg        ← optional, from TMDB
      fanart.jpg        ← optional, from TMDB
  ```
- Trigger on download completion (hook into `torrent.on('done')` in `downloader.js`)
- Use TMDB data already fetched during collection lookup to get title, year, and artwork
- Skip if folder already exists and contains a video file
- Handle edge cases: multiple video files in torrent, nested folders, sample files


## Local File Streaming

Serve downloaded files directly to Stremio over LAN.

- Mount `savePath` as a static Express route: `addon.use('/files', express.static(config.savePath))`
- On stream request, scan `savePath` for a folder matching `imdbId`, return matching video file as a stream object
- Return alongside Jackett torrent results so Stremio shows local copy first (highest priority)
- Stream object:
  ```javascript
  {
      url: `http://[server-ip]:${config.addonPort}/files/${folder}/${filename}`,
      name: 'Local',
      behaviorHints: { notWebReady: true, filename: filename }
  }
  ```
- Detect server LAN IP automatically (`os.networkInterfaces()`) rather than hardcoding


## Local Transcoding (HLS)

For low-powered clients (FireStick, older Macs) that struggle with raw MKV/HEVC.

- Spawn `ffmpeg` child process on stream request, transcode to HLS on the fly
- Serve HLS playlist (`m3u8`) and segments from a temp directory
- Target H.264 video + AAC audio for maximum client compatibility
- Kill ffmpeg process when Stremio stops requesting segments (idle timeout)
- Config options to add:
  - `transcoding` — enable/disable
  - `transcodingRes` — target resolution e.g. `1080`, `720`, `480`
  - `transcodingBitrate` — target bitrate
- Removes need for `notWebReady` flag — HLS plays natively in Stremio
- Only transcode if source is not already H.264/AAC — pass through if compatible
