import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const parseTorrent = require('parse-torrent')
const { version } = require('./package.json')
import axios from 'axios'
import needle from 'needle'
import async from 'async'
import getPort from 'get-port'
import { downloadTimer, states } from './downloader.js'
import express from 'express'
import jackettApi from './jackett.js'
import tunnel from './tunnel.js'
import helper from './helpers.js'
import config from './config.js'
import autoLaunch from './autoLaunch.js'


const addon = express()
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

addon.get('/:jackettKey/manifest.json', (req, res) => respond(res, manifest))

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
    if (uri.startsWith("magnet:?")) toStream(parseTorrent(uri))
    else {
        parseTorrent.remote(uri, (err, parsed) => {
            if (err) { cb(false); return }
            toStream(parsed)
        })
    }
}


 async function collections(id) {
    let meta = { imdbId: id, parts: [] };

    const fetch = async(path, id, append = ``) => {
       
       const res = await axios.get(`https://api.themoviedb.org/3/${path}/${id}?${append}api_key=${config.tmdbApiKey}`)
       return res.data
    } 

    let data = await fetch(`movie`, id)
    if (!data) return
    meta.title = data.title ?? ``
    meta.id = data.id ?? null
    meta.collection = data.belongs_to_collection?.id ?? false
    
    if (!meta.collection) return 
    data = await fetch(`collection`, meta.collection)
    const type = data.parts[0].media_type
    
    if (data?.parts.length > 1) { // Because a tmdb 'collection' can be 1!
       for (const part of data.parts.filter(p => p.id !== meta.id)) {
        const response = await fetch(`movie`, part.id, `append_to_response=external_ids&`)
        let results = []
        jackettApi.search(config.jackettApiKey, { name: response.title, year: response.release_date.slice(0, 4), type: type },
                (tempResults) => results = results.concat(tempResults),
                () => states.createDownloader({ imdbId: response.external_ids.imdb_id, name: response.title, results: results, config: config, isCollectionPart: true }))  
       }
    }
}


addon.get('/:jackettKey/stream/:type/:id.json', (req, res) => {
    if (!req.params.id || !req.params.jackettKey)
        return respond(res, { streams: [] })

    let results = []
    let sentResponse = false

    const respondStreams = async(imdbId, name) => {
        if (sentResponse) return
        sentResponse = true

        if (results && results.length) {
            let tempResults = results

            if (config.minimumSeeds) tempResults = tempResults.filter(el => !!(el.seeders && el.seeders > config.minimumSeeds - 1))
            tempResults = tempResults.sort((a, b) => a.seeders < b.seeders ? 1 : -1)

            const passToDL = tempResults
            if (config.maximumResults) tempResults = tempResults.slice(0, config.maximumResults)

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
                states.createDownloader({ imdbId: imdbId, name: name, results: passToDL, config: config, isCollectionPart: true })
                if (/^[a-f0-9]{32}$|^[a-zA-Z0-9_.-]{100,}$/.test(config.tmdbApiKey)) {
                setTimeout( async()=> {
                    await collections(imdbId)
                }, 2000)  
                }

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
                name: imdbId,
                year: body.meta.year,
                type: req.params.type
            }

            if (idParts.length == 3) {
                searchQuery.season = idParts[1]
                searchQuery.episode = idParts[2]
            }

            jackettApi.search(req.params.jackettKey, searchQuery,
                (tempResults) => results = results.concat(tempResults) ,
                () =>  respondStreams(imdbId, searchQuery.name))

            if (config.responseTimeout) setTimeout(() => respondStreams(imdbId, searchQuery.name), config.responseTimeout)
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
