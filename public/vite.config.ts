import fs from 'node:fs'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// En dev, les routes de l'application (/connexion, /carte…) doivent charger app.html,
// alors que / reste sur le site vitrine (public/index.html).
// En production, c'est vercel.json qui fait cette réécriture.
const appRoutesToAppHtml = (): Plugin => ({
  name: 'binofit-app-routes',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url?.split('?')[0] ?? ''
      if (url === '/') req.url = '/index.html'
      // Dossiers statiques servis tels quels (ex. /v2/ : site vitrine v2).
      const isStaticDir = fs.existsSync(path.join(__dirname, 'public', url, 'index.html'))
      if (isStaticDir && url !== '/') req.url = `${url.replace(/\/$/, '')}/index.html`
      const isAppRoute =
        url !== '/' &&
        !isStaticDir &&
        !url.includes('.') &&
        !url.startsWith('/@') &&
        !url.startsWith('/src/') &&
        !url.startsWith('/node_modules/')
      if (isAppRoute) req.url = '/app.html'
      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), appRoutesToAppHtml()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'app.html'),
    },
  },
})
