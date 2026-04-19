import express from "express";
import cors from "cors";
import verifyRouter from "./routes/verify.js";
import { createClient } from '@supabase/supabase-js';
import { startBot } from './bot-engine.js'; 

const app = express();

// CORS ve JSON ayarları (Frontend ile haberleşme için şart)
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// --- SANTRAL DEĞİŞKENLERİ ---
let currentBotStatus = "idle";
let activeProxy = null; 
let lastStartTime = null;

// 1. VEKİL (PROXY) KAYDETME YOLU
app.post('/api/save-proxy', (req, res) => {
  const { host, port, user, pass } = req.body;
  
  if (!host || !port) {
    console.error("[PROXY ERROR] IP veya Port eksik geldi.");
    return res.status(400).json({ message: "Geçersiz proxy bilgisi!" });
  }

  // Hafızaya SOCKS5 formatında kaydet
  activeProxy = { host, port, user, pass };
  
  console.log(`[PROXY CONFIG] SNR ENGINE Yeni Kimlik: ${host}:${port}`);
  res.status(200).json({ 
    message: "Vekil sunucu yapılandırması güncellendi!",
    active_ip: host 
  });
});

// 2. OTOMASYON BAŞLATMA
app.post('/api/start-automation', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: "Hedef URL belirtilmedi!" });
  }

  if (currentBotStatus === "running") {
    return res.status(400).json({ message: "Bot zaten operasyonda!" });
  }

  // Operasyon bilgilerini hazırla
  lastStartTime = new Date().toISOString();
  currentBotStatus = "running";

  // Frontend'e hızlıca yanıt dön (Vercel Timeout'u önlemek için önemli)
  res.status(200).json({ 
    message: "SNR ENGINE: Operasyon Başlatıldı", 
    status: "active",
    proxy_mode: activeProxy ? "SOCKS5 Active" : "Direct (No Proxy)",
    target: url
  });

  // Arka plan operasyonu
  try {
    console.log(`[EXEC] Hayalet operasyonu tetiklendi: ${url}`);
    
    // bot-engine.js'e hem URL'yi hem de varsa Proxy'yi paslıyoruz
    await startBot(url, activeProxy); 
    
    console.log("[SUCCESS] Operasyon tamamlandı.");
  } catch (error) {
    console.error("[FATAL ERROR] Bot motoru durdu:", error.message);
    // İstersen burada hatayı Supabase'e loglayabilirsin
  } finally {
    currentBotStatus = "idle";
  }
});

// 3. DASHBOARD DURUM SİNYALİ (Frontend bu adresi sürekli sorgular)
app.get('/api/bot-report', (req, res) => {
  res.status(200).json({ 
    status: currentBotStatus === "running" ? "working" : "active", 
    engine: "SNR ENGINE",
    proxy_connected: activeProxy ? true : false,
    current_proxy_ip: activeProxy ? activeProxy.host : "Local Machine",
    last_run: lastStartTime,
    timestamp: new Date().toISOString()
  });
});

// API Rotaları
app.use("/api/verify", verifyRouter);

// Supabase Günlüğü
app.post('/api/bot-data', async (req, res) => {
  try {
    const { url, durum, bot_id } = req.body;
    const { error } = await supabase
      .from('bot_logs')
      .insert([{ 
        bot_id: bot_id || 'SNR-BOT', 
        target_url: url, 
        status: durum,
        proxy_used: activeProxy ? activeProxy.host : 'direct'
      }]);

    if (error) throw error;
    res.status(200).json({ message: "Başarıyla kaydedildi" });
  } catch (err) {
    console.error("[DB ERROR] Kayıt başarısız:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default app;
// server.js en alt kısmı
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 SNR ENGINE Motoru Port ${PORT} üzerinde gazlıyor...`);
});
