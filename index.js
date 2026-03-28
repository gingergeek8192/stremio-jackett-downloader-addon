import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const parseTorrent = require('parse-torrent')
const { version } = require('./package.json')
import axios from 'axios'
import getPort from 'get-port'
import { states } from './downloader.js'
import express from 'express'
import jackettApi from './jackett.js'
import helper from './helpers.js'
import config from './config.js'

const addon = express()

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

async function streamFromMagnet(tor, uri, type) {
    const toStream = (parsed) => {
        const infoHash = parsed.infoHash.toLowerCase()
        let title = parsed.name
        title += (title.indexOf('\n') > -1 ? '\r\n' : '\r\n\r\n') + 'Seeds: ' + tor.seeders + ' / Peers: ' + tor.peers
        return {
            name: tor.from,
            type: type,
            infoHash: infoHash,
            sources: (parsed.announce || []).map(x => 'tracker:' + x).concat(['dht:' + infoHash]),
            title: title
        }
    }
    if (uri.startsWith('magnet:?')) return toStream(parseTorrent(uri))
    return new Promise(resolve => {
        parseTorrent.remote(uri, (err, parsed) => resolve(err ? null : toStream(parsed)))
    })
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
            const results = await jackettApi.search(config.jackettApiKey, { name: response.title, year: response.release_date.slice(0, 4), type: type })
            states.createDownloader({ imdbId: response.external_ids.imdb_id, name: response.title, results, config, isCollectionPart: true })
       }
    }
}


async function respondStreams(res, type, jackettKey, imdbId, name, idParts) {
    const { data: meta } = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`)
        .catch(() => ({ data: null }))

    if (!meta?.meta?.year) return respond(res, { streams: [] })

    const searchQuery = { name: imdbId, year: meta.meta.year, type }
    if (idParts.length == 3) { searchQuery.season = idParts[1]; searchQuery.episode = idParts[2] }

    const results = await jackettApi.search(jackettKey, searchQuery)
    if (!results?.length) return respond(res, { streams: [] })

    let filtered = results
    .filter(el => el.seeders && el.seeders >= (config.minimumSeeds ?? 3))
    .sort((a, b) => b.seeders - a.seeders)
    .slice(0, (Math.max(config.maximumResults || 20, 20)))

    const streams = []
    
    for (const task of filtered) {
        if (task?.magneturl || task?.link) {
            const url = await helper.followRedirect(task.magneturl || task.link)
            const stream = await streamFromMagnet(task, url, type)
            if (stream) streams.push(stream)
        }
    }
    respond(res, { streams })

    if (type === 'movie') {
        states.createDownloader({ imdbId, name, results: filtered, config, isCollectionPart: true })
        if (/^[a-f0-9]{32}$|^[a-zA-Z0-9_.-]{100,}$/.test(config.tmdbApiKey)) setTimeout(() => collections(imdbId), 2000)
    }
}

addon.get('/:jackettKey/stream/:type/:id.json', (req, res) => {
    if (!req.params.id || !req.params.jackettKey) return respond(res, { streams: [] })

    const idParts = req.params.id.split(':')
    const imdbId = idParts[0]

    if (config.responseTimeout) setTimeout(() => { if (!res.headersSent) respond(res, { streams: [] }) }, config.responseTimeout)
    respondStreams(res, req.params.type, req.params.jackettKey, imdbId, imdbId, idParts)
        .catch(() => respond(res, { streams: [] }))
})

    
async function runAddon() {
    config.addonPort = await getPort({ port: config.addonPort })
    addon.listen(config.addonPort, () => {
        console.log('Add-on URL: http://127.0.0.1:'+config.addonPort+'/[my-jackett-key]/manifest.json')
        console.log('Replace "[my-jackett-key]" with your Jackett API Key')
    })
}

runAddon()
