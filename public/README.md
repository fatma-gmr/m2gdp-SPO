# BINOFIT — Front

Front de BINOFIT : Vue 3 + Vite + TypeScript + Shadcn-Vue, carte Leaflet, hébergé sur
Vercel (https://bino-fit.vercel.app). Firebase Authentication sert uniquement à la
connexion par lien e-mail ; toutes les données passent par l'API (Cloudflare Workers),
qui les stocke dans Supabase Postgres.

```bash
npm install
cp .env.example .env   # variables VITE_FIREBASE_* et VITE_API_BASE_URL
npm run dev            # http://localhost:5173
npm run build          # vue-tsc -b && vite build, sortie dans dist/
```

Pour le reste (architecture, écrans, variables, déploiement), voir le
[README racine](../README.md) et le [guide technique](../docs/guide-technique.md).
