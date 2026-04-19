FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Proje dosyalarını kopyala
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Puppeteer'ın kurulu olduğu yeri sisteme tanıt
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

CMD ["node", "server.js"]
