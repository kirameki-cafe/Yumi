FROM debian AS build
WORKDIR /home/node/app

COPY . .
RUN DEBIAN_FRONTEND=noninteractive
 
RUN apt-get update -y
RUN apt-get -y install curl gnupg git dh-python make g++ iputils-ping ffmpeg
RUN curl -sL https://deb.nodesource.com/setup_18.x  | bash -
RUN apt-get -y install nodejs
RUN npm i -g yarn

RUN yarn
RUN yarn build

FROM debian
WORKDIR /home/node/app

RUN apt-get update -y
RUN apt-get -y install software-properties-common curl gnupg git dh-python make g++ iputils-ping ffmpeg
RUN add-apt-repository ppa:tomtomtom/yt-dlp -y
RUN apt-get update -y
RUN apt-get -y install yt-dlp
RUN curl -sL https://deb.nodesource.com/setup_18.x  | bash -
RUN apt-get -y install nodejs
RUN npm i -g yarn

COPY --from=build /home/node/app/package.json .
COPY --from=build /home/node/app/yarn.lock .

RUN yarn

COPY --from=build /home/node/app/prisma ./prisma/
RUN yarn prisma generate

COPY --from=build /home/node/app/locales ./locales/

COPY --from=build /home/node/app/dist .

CMD [ "node", "index.js"]
