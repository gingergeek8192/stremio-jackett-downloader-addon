# Stremio Jackett Add-on

Search on all your favorite torrent sites directly in Stremio — with automatic downloading, collection management, and more.

**This Add-on requires Stremio v4.4.10+**


## Automatic Downloader

This fork adds an automatic torrent downloader powered by [WebTorrent](https://webtorrent.io/). When you browse to a movie in Stremio, the add-on waits `downloadAfter` minutes before automatically downloading the best matching torrent to `savePath`. If you browse away to another title before the timer fires, it resets — so only the title you actually settle on gets downloaded.

The downloader picks candidates by filtering results to your preferred `targetRes`, sorts by seeds, and tries up to `candidates` torrents in order. If a torrent stalls (no progress within `waitFor` milliseconds) it moves on to the next candidate automatically.

Note: Currently only movies are auto-downloaded. Series support is planned.


## Collection Download

When you stream a movie that belongs to a TMDB collection (e.g. a franchise), the add-on automatically fetches the full collection via the TMDB API, searches Jackett for each other part, and enqueues them for sequential download. Each title is checked against your `savePath` by its IMDb ID — already-downloaded titles are skipped automatically.

Requires a valid `tmdbApiKey` in `config.json`. Collection downloads are queued behind any active download and processed one at a time.


## Planned Features

- Folder / library manager: organises and renames downloaded files according to the Jellyfin naming schema
- Local media streaming for downloaded files directly in Stremio
- Series support


## Configuration Reference

After first run, edit `config.json` in the project root.

| Key | Default | Description |
|-----|---------|-------------|
| `autoLaunch` | `false` | Run the add-on on system start-up |
| `responseTimeout` | `11000` | Stremio add-on response timeout in milliseconds; responds with partial results if reached. `0` = no timeout |
| `addonPort` | `7000` | Port for the Stremio add-on |
| `minimumSeeds` | `3` | Remove torrents with fewer than X seeds |
| `maximumResults` | `30` | Maximum number of torrents to return. `0` = no limit |
| `remote` | `true` | Make the add-on available remotely via LAN and the Internet |
| `subdomain` | `false` | Preferred subdomain (if available); only applies when `remote` is `true` |
| `saveTorrent` | `true` | Save the selected torrent file to the folder specified by `savePath` |
| `savePath` | `~/Downloads` | Download movies to this folder |
| `waitFor` | `30000` | Milliseconds to wait before checking if a download has started and trying the next candidate |
| `targetRes` | `1080` | Preferred resolution; the add-on picks the closest match when `saveTorrent` is `true` |
| `candidates` | `3` | Total number of matching torrent candidates to try |
| `downloadAfter` | `3` | Minutes to wait before downloading; resets if the user browses to another title — defaults to 20 seconds if set to `0` |
| `jackett.host` | `"http://127.0.0.1:9117/"` | Jackett server URL |
| `jackett.readTimeout` | `10000` | Read timeout in milliseconds for Jackett HTTP requests. `0` = no timeout |
| `jackett.openTimeout` | `10000` | Open/connect timeout in milliseconds for Jackett HTTP requests. `0` = no timeout |
| `tmdbApiKey` | `""` | TMDB API key; required for collection download |


## Install and Usage


### Install Jackett

- [Install Jackett on Windows](https://github.com/Jackett/Jackett#installation-on-windows)
- [Install Jackett on OSX](https://github.com/Jackett/Jackett#installation-on-macos)
- [Install Jackett on Linux](https://github.com/Jackett/Jackett#installation-on-linux)


### Setup Jackett

Open your browser, go on [http://127.0.0.1:9117/](http://127.0.0.1:9117/). Press "+ Add Indexer", add as many indexers as you want.

Copy the API key from the top-right of the Jackett UI — you'll need it below.


### Run the Add-on from Source

```bash
git clone https://github.com/BoredLama/stremio-jackett-addon.git
cd stremio-jackett-addon
pnpm install
pnpm start
```

On first run, `config.json` is created in the project root. Open it and set:

- `jackett.apiKey` — your Jackett API key
- `tmdbApiKey` — your [TMDB API key](https://www.themoviedb.org/settings/api) (required for collection download)

Then restart with `pnpm start`.


### Add the Add-on to Stremio

Add `http://127.0.0.1:7000/[my-jackett-key]/manifest.json` (replace `[my-jackett-key]` with your Jackett API key) as an Add-on URL in Stremio.

![addlink](https://user-images.githubusercontent.com/1777923/43146711-65a33ccc-8f6a-11e8-978e-4c69640e63e3.png)

Note: The add-on process must be running (along with Jackett) for the add-on to work in Stremio.

Note: Setting `autoLaunch` to `true` in `config.json` will make the add-on auto launch on system start-up.


### Using the Add-on Over LAN

If you run the add-on on a server or another machine on your network, you can use it as a client from other devices without running anything locally.

- macOS Stremio app: paste `http://[server-local-ip]:7000/[my-jackett-key]/manifest.json` directly into the Add-on URL field — it will work over LAN without any extra configuration.
- Chrome (web app at [app.stremio.com](https://app.stremio.com)): enable insecure content for the Stremio web app in Chrome's site settings (`Settings → Site settings → Insecure content`, add `app.stremio.com`), then add the LAN URL as above.
- Windows Stremio app: may not allow plain HTTP add-on URLs — untested.

The server needs `remote` set to `true` in `config.json` so it binds to all interfaces rather than just localhost.
