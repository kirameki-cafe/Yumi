# 🍭 Yumi

Multipurpose Discord Bot

## 👜 Prerequisites

- [NodeJS](https://nodejs.org/)
- [FFmpeg](https://ffmpeg.org/)
- [Python2](https://www.python.org/downloads/) (For building dependencies)
- C++ compiler (For building dependencies)

## 🔧 Building for production

1. Clone this repository
2. Install dependencies with ``yarn`` for yarn, or ``npm install`` for npm
3. Run the script ``yarn build`` or ``npm run build``

The output will be at ``/dist``, use ``node index.js`` to start

## 🔧 Building for production (Docker)

1. Clone this repository
2. Run ``yarn docker-build`` for yarn, or ``npm run docker-build`` for npm to build the image

Image will be tagged as ``ghcr.io/yuzuzensai/yumi:latest``

## 🔧 Debugging for development

1. Clone this repository
2. Install dependencies with ``yarn`` for yarn, or ``npm install`` for npm
3. Run the script ``yarn development`` or ``npm run development``

## 🌳 Environment Variables

Take a look inside [.env.example](https://github.com/YuzuZensai/Yumi/blob/main/.env.example) for example

- ``NODE_ENV`` Environment type, ``development`` or ``production``
- ``DATABASE_URL`` Connection URL to your database. [More info](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases/connect-your-database-typescript-postgres)
- ``DISCORD_TOKEN`` Your discord bot token
- ``DEVELOPER_IDS`` List of Discord Snowflake User ID that can access developer only modules, separated by ``,``
- ``PRIVATE_BOT`` Should the bot invite be public? ``true`` or ``false``
- ``SUPPORT_URL`` (Optional) URL to your support server (If not set, support module will show not available message)
- ``OSU_API_KEY`` [osu! API v1 key](https://github.com/ppy/osu-api/wiki)
- ``YOUTUBE_COOKIE_BASE64`` YouTube cookies encoded in base64 [How to get cookies?](https://github.com/play-dl/play-dl/tree/main/instructions#youtube-cookies=) *
- ``SPOTIFY_CLIENT_ID`` Spotify client ID
- ``SPOTIFY_CLIENT_SECRET`` Spotify client secret
- ``SPOTIFY_REFRESH_TOKEN`` Spotify refresh token **
- ``SPOTIFY_CLIENT_MARKET`` Spotify market country code

\* Encode the cookies from the request headers base64 and put it in here instead of creating new file with ``play.authorization();`` code
\*\* Get refresh token from ``https://accounts.spotify.com/en/authorize?client_id=<client id>&response_type=code&redirect_uri=<redirect uri>``
