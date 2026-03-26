import { createRequire } from 'module'
const require = createRequire(import.meta.url)
// amazonq-ignore-next-line
const parseTorrent = require('parse-torrent')

import needle from 'needle'
import async from 'async'
import getPort from 'get-port'
import { Downloader, defaults } from './downloader.js'
import express from 'express'
import jackettApi from './jackett.js'
import tunnel from './tunnel.js'
import helper from './helpers.js'
import config from './config.js'
import autoLaunch from './autoLaunch.js'
import { createRequire as cr } from 'module'
const _require = cr(import.meta.url)
const { version } = _require('./package.json')

const addon = express()
let downloadTimer = null

process.on('uncaughtException', err => console.error('Uncaught:', err.message))

autoLaunch('Jackett Add-on', config.autoLaunch)

const respond = (res, data) => {

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Content-Type', 'application/json')
  
    res.send(data)
}

const manifest = {
    "id": "org.stremio.jackett",
    "version": version,
    "name": "Stremio Jackett Addon",
    "description": "Stremio Add-on to get torrent results from Jackett",
    "icon": "https://static1.squarespace.com/static/55c17e7ae4b08ccd27be814e/t/599b81c32994ca8ff6c1cd37/1508813048508/Jackett-logo-2.jpg",
    "resources": ["stream"],
    "types": ["movie", "series"],
    "idPrefixes": ["tt"],
    "catalogs": []
}

addon.get('/:jackettKey/manifest.json', (req, res) => {
    respond(res, manifest)
})

const streamFromMagnet = (tor, uri, type, cb) => {
    const toStream = (parsed) => {
        const infoHash = parsed.infoHash.toLowerCase()
        let title = tor.extraTag || parsed.name
        const subtitle = 'Seeds: ' + tor.seeders + ' / Peers: ' + tor.peers
        title += (title.indexOf('\n') > -1 ? '\r\n' : '\r\n\r\n') + subtitle
        cb({
            name: tor.from,
            type: type,
            infoHash: infoHash,
            sources: (parsed.announce || []).map(x => { return "tracker:"+x }).concat(["dht:"+infoHash]),
            title: title
        })
    }
    if (uri.startsWith("magnet:?")) {
        toStream(parseTorrent(uri))
    } else {
        parseTorrent.remote(uri, (err, parsed) => {
            if (err) { cb(false); return }
            toStream(parsed)
        })
    }
}

addon.get('/:jackettKey/stream/:type/:id.json', (req, res) => {
    if (!req.params.id || !req.params.jackettKey)
        return respond(res, { streams: [] })

    let results = []
    let sentResponse = false

    const respondStreams = (imdbId, name) => {
        if (sentResponse) return
        sentResponse = true

        if (results && results.length) {
            let tempResults = results

            if (config.minimumSeeds)
                tempResults = tempResults.filter(el => !!(el.seeders && el.seeders > config.minimumSeeds - 1))

            tempResults = tempResults.sort((a, b) => a.seeders < b.seeders ? 1 : -1)

            const passToDL = tempResults

            if (config.maximumResults)
                tempResults = tempResults.slice(0, config.maximumResults)

            const streams = []

            const q = async.queue((task, callback) => {
                if (task && (task.magneturl || task.link)) {
                    const url = task.magneturl || task.link
                    helper.followRedirect(url, url => {
                        streamFromMagnet(task, url, req.params.type, stream => {
                            if (stream) streams.push(stream)
                            callback()
                        })
                    })
                    return
                }
                callback()
            }, 1)

            q.drain = () => respond(res, { streams: streams })
            

            tempResults.forEach(elm => { q.push(elm) })

            if (downloadTimer) clearTimeout(downloadTimer)
            if (req.params.type === 'movie') {
                downloadTimer = setTimeout(() => {
                    const data = { imdbId: imdbId, name: name, results: passToDL, config: config }
                    if (defaults.idle()) void new Downloader(data).handleResults().catch(err => console.error('Downloader error:', err.message))
                    else defaults.enqueue(data)
                }, config.downloadAfter > 0 ? config.downloadAfter * 60000 : 20000)
            }

        } else {
            respond(res, { streams: [] })
        }
    }

    const idParts = req.params.id.split(':')
    const imdbId = idParts[0]

    
    needle.get('https://v3-cinemeta.strem.io/meta/' + req.params.type + '/' + imdbId + '.json', (err, resp, body) => {
        if (body && body.meta && body.meta.name && body.meta.year) {
            const searchQuery = {
                name: body.meta.name,
                year: body.meta.year,
                type: req.params.type
            }

            if (idParts.length == 3) {
                searchQuery.season = idParts[1]
                searchQuery.episode = idParts[2]
            }

            jackettApi.search(req.params.jackettKey, searchQuery,
                (tempResults) => { results = results.concat(tempResults) },
                (tempResults) => { results = tempResults; respondStreams(imdbId, searchQuery.name) }
            )

            if (config.responseTimeout)
                setTimeout(() => respondStreams(imdbId, searchQuery.name), config.responseTimeout)
        } else {
            respond(res, { streams: [] })
        }
    })
})

if (process && process.argv)
    process.argv.forEach((cmdLineArg) => {
        if (cmdLineArg == '--remote')
            config.remote = true
        else if (cmdLineArg == '-v') {
            console.log('v' + version)
            process.exit()
        }
    })

const runAddon = async () => {
    config.addonPort = await getPort({ port: config.addonPort })
    addon.listen(config.addonPort, () => {
        console.log('Add-on URL: http://127.0.0.1:'+config.addonPort+'/[my-jackett-key]/manifest.json')
        if (config.remote) {
            const remoteOpts = {}
            if (config.subdomain) remoteOpts.subdomain = config.subdomain
            tunnel(config.addonPort, remoteOpts)
        } else {
            console.log('Replace "[my-jackett-key]" with your Jackett API Key')
        }
    })
}

runAddon()
