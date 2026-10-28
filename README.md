# alpintang portfolio

Static site served by Cloudflare (Workers static assets).

    public/            the website (index.html, css/, js/, images/, videos/)
    wrangler.jsonc     tells Cloudflare to serve ./public

Deploy command in Cloudflare: `npx wrangler deploy`
Preview locally: `cd public && python3 -m http.server`
