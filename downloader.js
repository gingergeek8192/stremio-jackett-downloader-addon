
import WebTorrent from 'webtorrent'
import helper from './helpers.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
let downloadTimer = null

let states = {
    _next: false,
    enqueued: [],
    currentCandidates: [],
    path: path.join(os.homedir(), 'Downloads'),
    waiting: () => states.enqueued.length > 0,
    idle: () => !states.currentCandidates.length && !client.torrents.length,
    enqueue: (data) => states.enqueued.push(data),
    dequeue: () => states.enqueued.shift(),

    createDownloader({ imdbId, name, results, config } = data) {
     //   downloadTimer = setTimeout(() => {
            if (states.idle()) {
                void new Downloader({ imdbId: imdbId, name: name, results: results, config: config }).handleResults().catch(err => console.error('Downloader error:', err.message))
                console.log("Downloading", imdbId)
            }
            else {
        states.enqueue({ imdbId: imdbId, name: name, results: results, config: config })
        console.log("Enqueueing", imdbId)
    }
    //    }, config.downloadAfter > 0 ? config.downloadAfter * 60000 : 20000)

    }
}


const client = new WebTorrent({ maxConns: 55 })
client.on('error', err => console.error('WebTorrent error:', err.message))

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
            states.currentCandidates = []
            if (states.idle() && states.waiting()) {
                console.log("_next")
                states._next = true // Edge trigger
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

      //  if (/^[a-f0-9]{32}$|^[a-zA-Z0-9_.-]{100,}$/.test(this.config.tmdbApiKey) && !this.isCollectionPart)
      //  await getTMDB(this.imdbId)

        if (remove && this.savePath) await fs.promises.rm(this.savePath, { recursive: true, force: true })
        else {
            console.log('running handlePath')

            this.savePath = (this.config.savePath && fs.existsSync(this.config.savePath)) ? this.config.savePath : states.path
            const entries = await fs.promises.readdir(this.savePath)

            if (entries.some(e => e.includes(`${this.imdbId}`))) return false
            const folder = this.name === this.imdbId ? this.name : `${this.name}-${this.imdbId}`
            this.savePath = path.join(this.savePath, folder)
            await fs.promises.mkdir(this.savePath, { recursive: true })
            return true  // No imdbId found, path created, return true downloading and new movie
        }
    }


    // Process metadata 
    async handleResults() {
        if (!this.results || !this.results.length) return

        this.candidateDownloads = this.results
            .filter(el => el.title && el.title.toLowerCase().includes(String(this.config.targetRes)))
            .sort((a, b) => b.seeders - a.seeders)
            .slice(0, this.config.candidates) || [] // user defined slice

        console.log(`Selected ${this.candidateDownloads.length} candidates`)
        this.initial = this.candidateDownloads.length
        
        states.currentCandidates = await Promise.all(
            this.candidateDownloads
                .filter(c => c.magneturl || c.link)
                .map(c => helper.followRedirect(c.magneturl || c.link))
        )


        for (const magnet of states.currentCandidates) {
            if (this.downloading) return // Additionally handle path will block next downloading with imdbId if the last was a success 
            const downloadTime = await this.handlePath()
            if (downloadTime) await this.tryTorrent(magnet)
        }
    }


    async tryTorrent(magnet) {

        const torrent = client.add(magnet, { path: this.savePath })
        console.log(`Trying ${this.initial - this.config.candidates + 1} of ${this.initial} candidates`)

        const interval = setInterval( async() => {
            if (this.lastProgress === this.progress || !this.downloading) {
                console.log('Timeout - no progress')
                await this.handlePath(true)
                await this.reset(interval, torrent, states.currentCandidates.length == 0)
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
            await this.reset(interval, torrent, true)
            console.log("done")
        })

        torrent.on('error', async () => {
            try {
                await this.handlePath(true) // Remove the failed downloading and allow handlePath to setup for the next
                await this.reset(interval, torrent, states.currentCandidates.length == 0)
            } catch (err) { console.error('Error handling torrent error:', err.message)  } // Stop bubble up
        })
    }

}

// REACTIVE PROCESSING TRIGGER: Edge-triggered queue processing system
// - Uses JavaScript property setter to automatically trigger processing
// - Critical: DO NOT change this to set _next = value!
let  _next = false
Object.defineProperty(states, '_next', {
    get() { return _next },
    set(value) {
        if (value && states.waiting()) {
            console.log('Trying next torrent')
            void new Downloader(states.dequeue()).handleResults()
        }
    }
})
export { Downloader, downloadTimer, states }