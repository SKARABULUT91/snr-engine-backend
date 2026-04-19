# 1. Puppeteer için optimize edilmiş resmi imaj
FROM ghcr.io/puppeteer/puppeteer:21.11.0

# 2. İzin sorunlarını aşmak için root yetkisiyle işlemleri yapıyoruz
USER root

# 3. Çalışma dizinini oluştur ve izinlerini ayarla
WORKDIR /app

# 4. Bağımlılıkları kopyala ve kur
# Önce package.json kopyalamak Docker cache avantajı sağlar (daha hızlı build)
COPY package*.json ./
RUN npm install

# 5. Tüm proje dosyalarını kopyala
COPY . .

# 6. Dosya izinlerini kullanıcıya göre ayarla (Puppeteer'ın çökmemesi için)
RUN chown -R pptruser:pptruser /app

# 7. ÇEVRE DEĞİŞKENLERİ
# Chrome yolu bu imajda sabittir
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
# Render'ın atayacağı portu dinlemek için varsayılan değer
ENV PORT=10000

# 8. Render dış dünyadan bu porta ulaşabilsin diye açıyoruz
EXPOSE 10000

# 9. Güvenli kullanıcıya geri dön (Puppeteer root sevmez)
USER pptruser

# 10. Uygulamayı başlat
# Portu process.env.PORT üzerinden server.js'e paslayacak
CMD ["node", "server.js"]
