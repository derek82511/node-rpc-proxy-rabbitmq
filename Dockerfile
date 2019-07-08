FROM node:10.16.0-stretch-slim

WORKDIR /app

ADD . /app

RUN npm install

ENTRYPOINT [ "npm", "start" ]
