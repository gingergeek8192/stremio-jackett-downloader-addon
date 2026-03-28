import axios from 'axios'

const helper = {
    followRedirect: async (url) => {
        if (!url.startsWith('magnet:')) {
            try {
                await axios.get(url, { maxRedirects: 0 })
            } catch(e) {
                if (e.response?.headers?.location) return e.response.headers.location
            }
        }
        return url
    },

    episodeTag: (season, episode) => {
        return 'S' + ('0' + season).slice(-2) + 'E' + ('0' + episode).slice(-2)
    }
}

export default helper
