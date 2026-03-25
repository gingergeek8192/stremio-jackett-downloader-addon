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

class Downloader {
    constructor(data) {
        Object.assign(this, data)
        this.download = false
        this.torrent = null
        // default to downloads
        if (!fs.existsSync(data.config.savePath)) this.savePath = defaults.path
        // build dl folder, to mark this torrent is in media library
        this.savePath = path.join(this.savePath, `${data.name} -${data.imdbId}-`)
        this.lastProgress = 0
        this.progress = 0
        this.currentThrottle = -1
    }


    // Process metadata
    async handleResults() {
        if (!this.results || !this.results.length) return

        // if the folder exists skip the download entirely
        const entries = await fs.promises.readdir(this.savePath)
        if (entries.some(e => e.includes(`-${this.imdbId}-`))) return
        await fs.promises.mkdir(this.savePath, { recursive: true })

        // user defined slice
        this.candidateDownloads = this.results
            .filter(el => el.title && el.title.toLowerCase().includes(String(this.config.targetRes)))
            .sort((a, b) => b.seeders - a.seeders)
            .slice(0, this.config.candidates) || []

        // Handle Jackett redirects
        const redirects = this.candidateDownloads
            .filter(c => c.magneturl || c.link)
            .map(c => new Promise(resolve => helper.followRedirect(c.magneturl || c.link, resolve)))

        // Try magnets. 
        this.attempts = await Promise.all(redirects)
        for (const magnet of this.attempts) {
            if (this.download) return
                await this.tryTorrent(magnet)
        }
    }


    // TODO: Create a progress bar for download progress and logging
    report(_log) {
        if (this.torrent.downloadSpeed > 0 && this.torrent.progress < 100)
            console.log(
            `Progress ${this.torrent.name} | ${this.progress.toFixed(1)}% 
             MB/s ${(this.torrent.downloadSpeed / 1024 / 1024).toFixed(2)}  
             Peers ${this.torrent.numPeers}`
            )
    }

    // resets if torrent complete or does not download
    reset(interval) {
        if (interval) clearInterval(interval)
        if (this.torrent) client.remove(this.torrent) // Safe check
        this.torrent = null // Clear the ref
        this.progress = 0
        this.download = false
        client.throttleDownload(-1)
    }


    // Attempt to mitigate ENOBUFS on completion 
    regulate(doi, goHard) {
        let target = -1
        if (goHard) target = 1024 * 1024
        else if (doi) target = 2097152

        // Only update the client if the rate actually needs to change
        if (this.currentThrottle !== target) {
            client.throttleDownload(target)
            this.currentThrottle = target
        }
    }


    async tryTorrent(magnet) {
            this.torrent = client.add(magnet, { path: this.savePath })

            // User defined check, to bail and start another if no progress ** ! < 10 SEC **
            const interval = setInterval(() => {
                if (this.lastProgress == this.progress || (!this.download)) this.reset(interval)
                this.lastProgress = this.progress
            }, this.config.waitFor > 10000 ? this.config.waitFor : 10000)

            // Report and control 
            this.torrent.on('download', () => {
                this.progress =  (this.torrent.progress * 100)
                this.download = true
                this.report()
                this.regulate(this.progress >= 80, this.progress > 97)
            })

            this.torrent.on('done', () => {
                this.attempts = []
                this.reset(interval)
            })

            this.torrent.on('error', (err) => {
                console.error('Torrent Error:', err.message)
            })
    }
}

export { Downloader, defaults }


/*
                clearTimeout(timeout)
                clearInterval(interval)
                resolve(result)
const timeout = setTimeout(() => {
    
    resolve(null)
}, this.config.waitFor)


client.throttleDownload(rate)
this.torrent.pause()
this.torrent.removePeer(peer)
this.torrent.deselect(start, end)

this.torrent.on('download', () => this.report())
this.torrent.on('noPeers', () => {})
this.torrent.on('infoHash', () =>{})
this.torrent.on('ready', () => {})
client.on('remove')
this.torrent.on('error', (err) => { 

    })


torrent.on('done', async () => {
  torrent.pause()

  // Optional: wait for any in-flight writes
  await new Promise(r => setTimeout(r, 500))

  client.remove(torrent.infoHash, {
    destroyStore: true
  })
})
  From the WebTorrent docs:

Client

client.add(torrentId, [opts], [cb])

client.remove(torrentId, [opts], [cb])

client.destroy([cb])

client.torrents — array of torrent instances

client.get(torrentId) — returns torrent or null

client.downloadSpeed / client.uploadSpeed / client.progress / client.ratio

Torrent

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

Torrent Events

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

