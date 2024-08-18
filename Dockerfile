FROM debian AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

WORKDIR /home/node/app

COPY . .
RUN DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y
RUN apt-get -y install curl gnupg git dh-python make g++ libasound2-dev iputils-ping ffmpeg libnss3
RUN curl -sL https://deb.nodesource.com/setup_21.x  | bash -
RUN apt-get -y install nodejs

RUN corepack enable

RUN pnpm install

WORKDIR /home/node/app/NekoMelody
RUN pnpm install
RUN pnpx playwright install --with-deps chromium
RUN pnpm run build

WORKDIR /home/node/app
RUN pnpm run build

FROM debian
WORKDIR /home/node/app

RUN apt-get update -y
RUN apt-get -y install software-properties-common curl gnupg git dh-python make g++ libasound2-dev iputils-ping ffmpeg python3-launchpadlib libnss3
RUN add-apt-repository ppa:tomtomtom/yt-dlp -y
RUN apt-get update -y
RUN apt-get -y install yt-dlp
RUN curl -sL https://deb.nodesource.com/setup_21.x  | bash -
RUN apt-get -y install nodejs

RUN corepack enable

COPY --from=build /home/node/app/package.json .
COPY --from=build /home/node/app/pnpm-lock.yaml .

RUN pnpm install

COPY --from=build /home/node/app/prisma ./prisma/
RUN pnpm prisma generate

COPY --from=build /home/node/app/locales ./locales/

COPY --from=build /home/node/app/dist .
COPY --from=build /home/node/app/NekoMelody/dist ./NekoMelody/dist
COPY --from=build /home/node/app/NekoMelody/package.json ./NekoMelody/package.json
COPY --from=build /home/node/app/NekoMelody/pnpm-lock.yaml ./NekoMelody/pnpm-lock.yaml

WORKDIR /home/node/app/NekoMelody
RUN pnpm install
RUN pnpx playwright install --with-deps chromium

RUN useradd -m node
RUN chown -R node:node /home/node
USER node

WORKDIR /home/node/app

CMD [ "node", "src/index.js"]
