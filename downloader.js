
import WebTorrent from 'webtorrent'
import helper from './helpers.js'
import fs from 'fs'
import path from 'node:path'
import os from 'os'

const client = new WebTorrent({ maxConns: 55 })
client.on('error', err => console.error('WebTorrent error:', err.message))

const defaults = {
    _next: false,
    enqueued: [],
    currentCandidates: [],
    path:  path.join(os.homedir(), 'Downloads'),
    waiting: () => defaults.enqueued.length > 0,
    idle: () => !defaults.currentCandidates.length && !client.torrents.length,
    enqueue: (data) => defaults.enqueued.push(data),
    dequeue: () => defaults.enqueued.shift()
}

// { imdbId: imdbId, name: name, results: passToDL, config: config }
class Downloader {
    constructor(data) {
        Object.assign(this, data)
        this.downloading = false
        this.lastProgress = 0
        this.progress = 0
        this.currentThrottle = -1
    }


    // TODO: Create a progress bar for downloading progress and logging
    report(torrent) {
        if (torrent.downloadSpeed > 0 && torrent.progress < 100)
            console.log(
            `Progress ${torrent.name} | ${this.progress.toFixed(1)}% 
             MB/s ${(torrent.downloadSpeed / 1024 / 1024).toFixed(2)}  
             Peers ${torrent.numPeers}`
            )
    }


    // resets if torrent complete or does not downloading
    async reset(interval, torrent, done=false) {
        if (interval) clearInterval(interval)
        this.downloading = false // Try condition
        this.progress = 0
        await client.remove(torrent)
        client.throttleDownload(-1)
        if (done) {
            defaults.currentCandidates = []
            if (defaults.idle() && defaults.waiting()) {
                defaults._next = true // Edge trigger
            }
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

        // Check if there is a folder with imdbID return false to cancel downloading
        if (entries.some(e => e.includes(`-${this.imdbId}-`))) return false 

        // Build the path and create the folder
        this.savePath = path.join(this.savePath, `${this.name}-${this.imdbId}-`)
        await fs.promises.mkdir(this.savePath, { recursive: true })
        // No imdbId found, path created, return true downloading and new movie
        return true 
        }
    }


    // Process metadata 
    async handleResults() {
        if (!this.results || !this.results.length) return
      //  console.log('Found '+this.results.length+' results, processing '+this.candidateDownloads.length+' candidates')

        this.candidateDownloads = this.results
            .filter(el => el.title && el.title.toLowerCase().includes(String(this.config.targetRes)))
            .sort((a, b) => b.seeders - a.seeders)
            .slice(0, this.config.candidates) || [] // user defined slice

        console.log(`Selected ${this.candidateDownloads.length} candidates`)
        this.initial = this.candidateDownloads.length
        // Handle Jackett redirects
        defaults.currentCandidates = await Promise.all(
            this.candidateDownloads
            .filter(c => c.magneturl || c.link)
            .map(c => new Promise(resolve => helper.followRedirect(c.magneturl || c.link, resolve)))
        )

        for (const magnet of defaults.currentCandidates) {
            // Main control - But additionally handle path will block next downloading with imdbId if the last was a success 
            if (this.downloading) return
            const downloadTime = await this.handlePath()
            if (downloadTime) await this.tryTorrent(magnet)
        }
    }


    async tryTorrent(magnet) {

        const torrent = client.add(magnet, { path: this.savePath })
        console.log(`Trying ${this.initial - this.config.candidates} of ${this.initial} candidates`)
        const interval = setInterval( async() => {
            if (this.lastProgress === this.progress || !this.downloading) {
                console.log('Timeout - no progress')
                // Remove torrent from WebTorrent and this interval
                await this.reset(interval, torrent, defaults.currentCandidates.length == 0)
            } 
            this.lastProgress = this.progress
        }, this.config.waitFor > 10000 ? this.config.waitFor : 10000)

        torrent.on('download', async() => {
            this.progress = (torrent.progress * 100)
            this.downloading = true
            this.report(torrent)
            this.regulate(this.progress >= 80, this.progress > 97)
        })

        torrent.on('done', async () => {
        console.log("done") 
        await this.reset(interval, torrent, true)
        })

        torrent.on('error', async (err) => {
            try {
                console.error('Torrent Error:', err.message)
                // Remove the failed downloading and allow handlePath to setup for the next
                await this.handlePath(true)
                await this.reset(interval, torrent, defaults.currentCandidates.length == 0)
            } 
            catch (innerErr) { console.error('Error handling torrent error:', innerErr)  } // Stop bubble up
        })
    }
    

}

// REACTIVE PROCESSING TRIGGER: Edge-triggered queue processing system
// - Uses JavaScript property setter to automatically trigger processing
// - Critical: DO NOT change this to set _next = value!
let  _next = false
Object.defineProperty(defaults, '_next', {
    get() { return _next },
    set(value) {
        if (value && defaults.waiting()) {
            console.log('Trying next torrent')
            void new Downloader(defaults.dequeue()).handleResults()
        }
    }
})


export { Downloader, defaults }