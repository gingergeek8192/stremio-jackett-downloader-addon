import commentJson from 'comment-json'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { defaults } from './downloader.js'

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
    "savePath": defaults.path,
    "waitFor": 30000,
    "targetRes": 1080,
    "candidates": 3,
    "downloadAfter": 0,
    "jackett": {
        "host": "http://127.0.0.1:9117/",
        "readTimeout": 10000,
        "openTimeout": 10000
    }
}

const readConfig = () => {
    const configFilePath = path.join(rootDir, configFile)
    if (fs.existsSync(configFilePath)) {
        var parsed
        try {
            const raw = fs.readFileSync(configFilePath)
            parsed = commentJson.parse(raw.toString())
        } catch (e) {
            return defaultConfig
        }
        // Strip comment-json symbol keys, merge missing defaults, save clean file
        const clean = { ...defaultConfig, ...JSON.parse(JSON.stringify(parsed)) }
        if (parsed.jackett) clean.jackett = { ...defaultConfig.jackett, ...JSON.parse(JSON.stringify(parsed.jackett)) }
        try {
            fs.writeFileSync(configFilePath, JSON.stringify(clean, null, 4))
        } catch (e) {}
        return clean
    } else {
        try {
            fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 4))
        } catch (e) {
            return defaultConfig
        }
        return readConfig()
    }
}

export default readConfig()
