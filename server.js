import express from "express";
import cors from "cors";
import verifyRouter from "./routes/verify.js";
import { createClient } from '@supabase/supabase-js';
import { startBot } from './bot-engine.js'; 

const app = express();

// CORS ve JSON ayarları
app.use(cors());
app.use(express.json());

// ÇEVRE DEĞİŞKENLERİ
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
);

// --- SANTRAL DEĞİŞKENLERİ ---
let currentBotStatus = "idle";
let activeProxy = null; 
let lastStartTime = null;

// 1. VEKİL (PROXY) KAYDETME YOLU
app.post('/api/save-proxy', (req, res) => {
  const { host, port, user, pass } = req.body;
  if (!host || !port) {
    return res.status(400).json({ message: "Geçersiz proxy bilgisi!" });
  }
  activeProxy = { host, port, user, pass };
  console.log(`[PROXY CONFIG] SNR ENGINE Yeni Kimlik: ${host}:${port}`);
  res.status(200).json({ message: "Vekil güncellendi!", active_ip: host });
});

// 2. OTOMASYON BAŞLATMA (İsim Frontend ile uyumlu hale getirildi)
app.post('/api/start-bot', async (req, res) => {
  const { url } = req.body;

  if (currentBotStatus === "running") {
    return res.status(400).json({ success: false, message: "Bot zaten operasyonda!" });
  }

  lastStartTime = new Date().toISOString();
  currentBotStatus = "running";

  // Frontend'e anında yanıt ver (Bağlantı kopmasın)
  res.status(200).json({ 
    success: true,
    message: "SNR ENGINE: Hayalet Ateşlendi!", 
    status: "active"
  });

  try {
    console.log(`[EXEC] Operasyon tetiklendi: ${url || 'Varsayılan URL'}`);
    await startBot(url, activeProxy); 
    console.log("[SUCCESS] Operasyon tamamlandı.");
  } catch (error) {
    console.error("[FATAL ERROR] Bot motoru durdu:", error.message);
  } finally {
    currentBotStatus = "idle";
  }
});

// 3. OTOMASYON DURDURMA (Yeni eklendi)
app.post('/api/stop-bot', (req, res) => {
  currentBotStatus = "idle";
  console.log("[STOP] Operasyon durduruldu.");
  res.status(200).json({ success: true, message: "Operasyon durduruldu" });
});

// 4. DASHBOARD DURUM SİNYALİ
app.get('/api/bot-report', (req, res) => {
  res.status(200).json({ 
    status: currentBotStatus === "running" ? "working" : "active", 
    engine: "SNR ENGINE",
    proxy_connected: !!activeProxy,
    current_proxy_ip: activeProxy ? activeProxy.host : "Local Machine",
    last_run: lastStartTime,
    timestamp: new Date().toISOString()
  });
});

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

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SNR ENGINE Motoru Port ${PORT} üzerinde gazlıyor...`);
});
