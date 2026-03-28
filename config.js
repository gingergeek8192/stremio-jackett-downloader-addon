import commentJson from 'comment-json'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { states } from './downloader.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const configFile = 'config.json'

const defaultConfig = {
    "autoLaunch": false,
    "responseTimeout": 11000,
    "addonPort": 7000,
    "minimumSeeds": 3,
    "maximumResults": 30,
    "remote": true,
    "subdomain": false,
    "saveTorrent": true,
    "savePath": states.path,
    "waitFor": 30000,
    "targetRes": 1080,
    "candidates": 3,
    "downloadAfter": 0.1,
    "tmdbApiKey": '589ff144d41b0b9bc3c349f148a82d1c',
    "jackettApiKey": 'b922yowc0wydj8p78q1oiel5jrd2fqfw',
    "jackett": {
        "host": "http://127.0.0.1:9117/",
        "readTimeout": 10000,
        "openTimeout": 10000
    }
}

function readConfig() {
    const configFilePath = path.join(rootDir, configFile)
    if (!fs.existsSync(configFilePath))
        fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 4))

    let parsed
    try { parsed = commentJson.parse(fs.readFileSync(configFilePath).toString()) }
    catch (e) { return defaultConfig }

    const clean = { ...defaultConfig, ...JSON.parse(JSON.stringify(parsed)) }
    if (parsed.jackett) clean.jackett = { ...defaultConfig.jackett, ...JSON.parse(JSON.stringify(parsed.jackett)) }
    fs.writeFileSync(configFilePath, JSON.stringify(clean, null, 4))
    return clean
}


export default readConfig()
