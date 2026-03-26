import WebTorrent from 'webtorrent'
import helper from './helpers.js'
import fs from 'fs'
import path from 'node:path'
import os from 'os'

const client = new WebTorrent({ maxConns: 55 })
client.on('error', err => console.error('WebTorrent error:', err.message))

const defaults = {
   path:  path.join(os.homedir(), 'Downloads')
}

// { imdbId: imdbId, name: name, results: passToDL, config: config }
class Downloader {
    constructor(data) {
        Object.assign(this, data)
        this.download = false
        this.lastProgress = 0
        this.progress = 0
        this.currentThrottle = -1
    }


    // TODO: Create a progress bar for download progress and logging
    report(torrent) {
        if (torrent.downloadSpeed > 0 && torrent.progress < 100)
            console.log(
            `Progress ${torrent.name} | ${this.progress.toFixed(1)}% 
             MB/s ${(torrent.downloadSpeed / 1024 / 1024).toFixed(2)}  
             Peers ${torrent.numPeers}`
            )
    }


    // resets if torrent complete or does not download
    async reset(interval, torrent=false) {
        if (interval) clearInterval(interval)
        if (torrent) {
            this.progress = 0
            await client.remove(torrent)
            client.throttleDownload(-1)
        }
        
    }


    // Attempt to mitigate ENOBUFS on completion - Maybe a fix
    regulate(doi, goHard) {
        let target = -1
        if (goHard) target = 1024 * 1024
        else if (doi) target = 2097152

        // Only update the client if the rate actually needs to change
        if (this.currentThrottle !== target) client.throttleDownload(target)
        this.currentThrottle = target
    }


    async handlePath(remove=false) {
        if (remove && this.savePath) 
            await fs.promises.rm(this.savePath, { recursive: true, force: true })
        else {
        //  First check the base path and default if the base path in config.json is wrong
        this.savePath = (this.config.savePath && fs.existsSync(this.config.savePath)) ? this.config.savePath : defaults.path
        const entries = await fs.promises.readdir(this.savePath)

        // Check if there is a folder with imdbID return false to cancel download
        if (entries.some(e => e.includes(`-${this.imdbId}-`))) return false 

        // Build the path and create the folder
        this.savePath = path.join(this.savePath, `${this.name}-${this.imdbId}-`)
        await fs.promises.mkdir(this.savePath, { recursive: true })
        // No imdbId found, path created, return true download and new movie
        return true 
        }
    }


    // Process metadata 
    async handleResults() {
        if (!this.results || !this.results.length) return

        this.candidateDownloads = this.results
            .filter(el => el.title && el.title.toLowerCase().includes(String(this.config.targetRes)))
            .sort((a, b) => b.seeders - a.seeders)
            .slice(0, this.config.candidates) || [] // user defined slice

        // Handle Jackett redirects
        this.attempts = await Promise.all(
            this.candidateDownloads
            .filter(c => c.magneturl || c.link)
            .map(c => new Promise(resolve => helper.followRedirect(c.magneturl || c.link, resolve)))
        )

        for (const magnet of this.attempts) {
            // Main control - But additionally handle path will block next download with imdbId if the last was a success 
            if (this.download) return
            const downloadTime = await this.handlePath()
            if (downloadTime) await this.tryTorrent(magnet)
        }
    }


    async tryTorrent(magnet) {

        const torrent = client.add(magnet, { path: this.savePath })

        const interval = setInterval( async() => {
            if (this.lastProgress === this.progress || !this.download) {
                // Try next condition
                this.download = false
                // Remove torrent from WebTorrent and this interval
                await this.reset(interval, torrent)
            } 
            this.lastProgress = this.progress
        }, this.config.waitFor > 10000 ? this.config.waitFor : 10000)

        torrent.on('download', async() => {
            this.progress = (torrent.progress * 100)
            if (this.progress >= 100) this.attempts = []
            // Don't try next condition
            this.download = true
            this.report(torrent)
            // Throttle the torrent toward the end - Maybe without it we get ENOBUFS error?
            this.regulate(this.progress >= 80, this.progress > 97)
        })

        torrent.on('done', async () => {
        console.log("done fires")
        // Don't try next condition
        this.download = true
        // Remove torrent from WebTorrent once done. Remove interval so it does not throw after class destroy 
        await this.reset(interval, torrent)
        })

        torrent.on('error', async(err) => {
            console.error('Torrent Error:', err.message)
            // Remove the failed download and allow handlePath to setup for the next
            await this.handlePath(true)
            // Try next condition
            this.download = false
            // Apparently WebTorrent will handle the torrent internally on error
            await this.reset(interval)
        })

    }
    

}

export { Downloader, defaults }


/*
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
*/

