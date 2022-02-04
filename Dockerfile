FROM debian

RUN mkdir -p /home/node/app/node_modules
WORKDIR /home/node/app

COPY package*.json ./
COPY prisma ./prisma/

RUN DEBIAN_FRONTEND=noninteractive
 
RUN apt-get update -y
RUN apt-get -y install curl gnupg git python2 make g++ iputils-ping ffmpeg
RUN curl -sL https://deb.nodesource.com/setup_17.x  | bash -
RUN apt-get -y install nodejs

RUN npm i -g yarn

RUN yarn
RUN yarn prisma generate
COPY . . 

RUN yarn build
CMD [ "yarn", "start"]