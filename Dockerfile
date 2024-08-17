FROM debian AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

WORKDIR /home/node/app

COPY . .
RUN DEBIAN_FRONTEND=noninteractive
 
RUN apt-get update -y
RUN apt-get -y install curl gnupg git dh-python make g++ iputils-ping ffmpeg
RUN curl -sL https://deb.nodesource.com/setup_21.x  | bash -
RUN apt-get -y install nodejs

RUN corepack enable

RUN pnpm install

WORKDIR /home/node/app/NekoMelody
RUN pnpm install

WORKDIR /home/node/app
RUN pnpm run build

FROM debian
WORKDIR /home/node/app

RUN apt-get update -y
RUN apt-get -y install software-properties-common curl gnupg git dh-python make g++ iputils-ping ffmpeg python3-launchpadlib
RUN add-apt-repository ppa:tomtomtom/yt-dlp -y
RUN apt-get update -y
RUN apt-get -y install yt-dlp
RUN curl -sL https://deb.nodesource.com/setup_21.x  | bash -
RUN apt-get -y install nodejs

RUN corepack enable

COPY --from=build /home/node/app/package.json .
COPY --from=build /home/node/app/pnpm-lock.lock .

RUN pnpm install

COPY --from=build /home/node/app/prisma ./prisma/
RUN pnpm run prisma generate

COPY --from=build /home/node/app/locales ./locales/

COPY --from=build /home/node/app/dist .

CMD [ "node", "index.js"]
