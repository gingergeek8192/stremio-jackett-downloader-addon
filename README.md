# Stremio Jackett Add-on

Search on all your favorite torrent sites directly in Stremio!

**This Add-on requires Stremio v4.4.10+**

Note: After running the Stremio Jackett Add-on for the first time, a `config.json` file will be created in the same folder as the add-on executable. You can edit this file to configure the add-on.

Note 2: The Stremio Jackett Add-on executable needs to be running (along with Jackett) in order for this add-on to work in Stremio.

Note 3: Run the add-on with `--remote` (or set `remote` to `true` in `config.json`) to also receive an add-on url that will work through LAN and the Internet (instead of just locally).

Note 4: Setting `autoLaunch` to `true` in `config.json` will make the add-on auto launch on system start-up.


## Install and Usage


### Install Jackett

- [Install Jackett on Windows](https://github.com/Jackett/Jackett#installation-on-windows)
- [Install Jackett on OSX](https://github.com/Jackett/Jackett#installation-on-macos)
- [Install Jackett on Linux](https://github.com/Jackett/Jackett#installation-on-linux)


### Setup Jackett

Open your browser, go on [http://127.0.0.1:9117/](http://127.0.0.1:9117/). Press "+ Add Indexer", add as many indexers as you want.

Copy the text from the input where it writes "API Key" from top right of the menu in Jackett.


### Run Jackett Add-on

[Download Jackett Add-on](https://github.com/BoredLama/stremio-jackett-addon/releases) for your operating system, unpack it, run it.


### Add Jackett Add-on to Stremio

Add `http://127.0.0.1:7000/[my-jackett-key]/manifest.json` (replace `[my-jackett-key]` with your Jackett API Key) as an Add-on URL in Stremio.

![addlink](https://user-images.githubusercontent.com/1777923/43146711-65a33ccc-8f6a-11e8-978e-4c69640e63e3.png)


## Automatic Downloader

This fork adds an automatic torrent downloader powered by [WebTorrent](https://webtorrent.io/). When you browse to a movie in Stremio, the add-on waits `downloadAfter` minutes before automatically downloading the best matching torrent to `savePath`. If you browse away to another title before the timer fires, it resets — so only the title you actually settle on gets downloaded.

The downloader picks candidates by filtering results to your preferred `targetRes`, sorts by seeds, and tries up to `candidates` torrents in order. If a torrent stalls (no progress within `waitFor` milliseconds) it moves on to the next candidate automatically.

Note: Currently only movies are auto-downloaded. Series support is planned.


## Configuration Reference

After first run, edit `config.json` in the same folder as the executable.

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
| `savePath` | `~/Downloads` | download Movies to This Folder - Defaults to Downloads |
| `waitFor` | `30000` | Milliseconds to wait before checking if a download has started and trying the next candidate |
| `targetRes` | `1080` | Preferred resolution; the add-on picks the closest match when `saveTorrent` is `true` |
| `candidates` | `3` | Total number of matching torrent candidates to try |
| `downloadAfter` | `3` | Minutes to wait before downloading; resets if the user browses to another title - Defaults to 20 seconds if set 0 |
| `jackett.host` | `"http://127.0.0.1:9117/"` | Jackett server URL |
| `jackett.readTimeout` | `10000` | Read timeout in milliseconds for Jackett HTTP requests. `0` = no timeout |
| `jackett.openTimeout` | `10000` | Open/connect timeout in milliseconds for Jackett HTTP requests. `0` = no timeout |
