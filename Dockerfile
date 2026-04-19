# Puppeteer için özel hazırlanmış resmi imajı kullanıyoruz (Chrome içinde hazır gelir)
FROM ghcr.io/puppeteer/puppeteer:21.11.0

USER root

# Proje dosyalarını kopyala
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Puppeteer'a Chrome'un yerini Docker içindeki sabit yolla gösteriyoruz
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Uygulamayı başlat
CMD ["node", "server.js"]
