import xmlJs from 'xml-js'
import axios from 'axios'
import helper from './helpers.js'
import config from './config.js'

async function getIndexers(apiKey) {
    const resp = await axios.get(config.jackett.host + 'api/v2.0/indexers/all/results/torznab/api?apikey='+apiKey+'&t=indexers&configured=true', {
        timeout: config.jackett.openTimeout || config.jackett.readTimeout,
        responseType: 'text'
    })
    const indexers = xmlJs.xml2js(resp.data)
    if (indexers?.elements?.[0]?.elements) return indexers.elements[0].elements
    throw new Error('No Indexers... Is Jackett Configured?')
}

export default {
    search: async (apiKey, query) => {
        let apiIndexers
        try { apiIndexers = await getIndexers(apiKey) } catch(e) { return [] }
        if (!apiIndexers?.length) return []

        const cat = query.type === 'movie' ? 2000 : 5000
        let searchQuery = query.name
        if (query.season && query.episode)
            searchQuery += ' ' + helper.episodeTag(query.season, query.episode)

        const results = await Promise.all(apiIndexers.map(indexer => {
            if (!indexer?.attributes?.id) return []
            return axios.get(config.jackett.host + 'api/v2.0/indexers/'+indexer.attributes.id+'/results/torznab/api?apikey='+apiKey+'&t=search&cat='+cat+'&q='+encodeURI(searchQuery), {
                timeout: config.jackett.readTimeout,
                responseType: 'text'
            }).then(resp => {
                const tors = xmlJs.xml2js(resp.data)
                const elements = tors?.elements?.[0]?.elements?.[0]?.elements
                if (!elements) return []
                const tempResults = []

                elements.forEach(elem => {
                    if (elem.type == 'element' && elem.name == 'item' && elem.elements) {
                        const newObj = {}
                        const tempObj = {}
                        elem.elements.forEach(subElm => {
                            if (subElm.name == 'torznab:attr' && subElm.attributes?.name && subElm.attributes?.value)
                                tempObj[subElm.attributes.name] = subElm.attributes.value
                            else if (subElm.elements?.length)
                                tempObj[subElm.name] = subElm.elements[0].text
                        })
                        ;['title', 'link', 'magneturl'].forEach(k => { if (tempObj[k]) newObj[k] = tempObj[k] })
                        ;['seeders', 'peers', 'size', 'files'].forEach(k => { if (tempObj[k]) newObj[k] = parseInt(tempObj[k]) })
                        if (tempObj.pubDate) newObj.jackettDate = new Date(tempObj.pubDate).getTime()
                        newObj.from = indexer.attributes.id
                        tempResults.push(newObj)
                    }
                })
                return tempResults
            }).catch(() => [])
        }))

        return results.flat()
    }
}
