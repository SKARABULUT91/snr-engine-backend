import subprocess
import sys
import os
import asyncio
import json
import random
import time
import logging
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- ENJEKTE EDİLEN KURULUM BLOĞU (4. DOSYADAN GÜNCELLENDİ) ---
def initialize_vps():
    print("🚀 VPS ortamı kontrol ediliyor...")
    required_libs = [
        "fastapi", "uvicorn", "twikit", "playwright", "pydantic", 
        "pyotp", "aiohttp", "playwright-stealth", "fake-useragent"
    ]
    for lib in required_libs:
        try:
            __import__(lib.replace("-", "_"))
        except ImportError:
            print(f"Eksik paket kuruluyor: {lib}")
            subprocess.check_call([sys.executable, "-m", "pip", "install", lib])

    try:
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
        subprocess.run([sys.executable, "-m", "playwright", "install-deps", "chromium"], check=True)
    except Exception as e:
        print(f"Playwright kurulumunda uyarı: {e}")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("xkodcum")

initialize_vps()

from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from fake_useragent import UserAgent

# Dinamik User-Agent Üretici (4. Dosyadan)
ua_factory = UserAgent()

app = FastAPI(title="X-KODCUM Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Session Manager ====================
class SessionManager:
    """Twikit oturum yöneticisi - çerez tabanlı"""
    def __init__(self):
        self.sessions = {}  # username -> twikit.Client
        self.cookies_dir = "cookies"
        os.makedirs(self.cookies_dir, exist_ok=True)

    async def login(self, username: str, password: str, two_fa_secret: str = None, proxy: str = None, user_agent: str = None):
        try:
            import twikit
            client = twikit.Client(language="tr")

            # 4. Dosyadaki dinamik UA entegrasyonu
            client._user_agent = user_agent or ua_factory.random

            if proxy:
                client.set_proxy(proxy)

            cookie_file = os.path.join(self.cookies_dir, f"{username}.json")
            if os.path.exists(cookie_file):
                try:
                    client.load_cookies(cookie_file)
                    me = await client.user()
                    self.sessions[username] = client
                    logger.info(f"✅ @{username} çerezlerle giriş yapıldı")
                    return {"success": True, "message": "Çerezlerle giriş yapıldı", "user": {"name": me.name, "username": me.screen_name}}
                except Exception:
                    logger.info(f"Çerezler geçersiz, yeniden giriş yapılıyor: @{username}")

            # Yeni giriş
            await client.login(
                auth_info_1=username,
                auth_info_2=None,
                password=password,
                totp_secret=two_fa_secret
            )

            client.save_cookies(cookie_file)
            self.sessions[username] = client
            
            me = await client.user()
            logger.info(f"✅ @{username} başarıyla giriş yapıldı")
            return {
                "success": True,
                "message": "Giriş başarılı",
                "user": {
                    "name": me.name,
                    "username": me.screen_name,
                    "followers_count": me.followers_count,
                    "following_count": me.following_count,
                }
            }
        except Exception as e:
            logger.error(f"❌ @{username} giriş hatası: {str(e)}")
            raise HTTPException(status_code=401, detail=str(e))

    def get_client(self, username: str):
        client = self.sessions.get(username)
        if not client:
            raise HTTPException(status_code=401, detail=f"@{username} oturumu bulunamadı. Önce giriş yapın.")
        return client

    async def logout(self, username: str):
        if username in self.sessions:
            try:
                await self.sessions[username].logout()
            except Exception:
                pass
            del self.sessions[username]
            cookie_file = os.path.join(self.cookies_dir, f"{username}.json")
            if os.path.exists(cookie_file):
                os.remove(cookie_file)

sessions = SessionManager()

# ==================== Human-like Delays ====================
async def human_delay(min_sec=1.0, max_sec=3.0):
    delay = random.uniform(min_sec, max_sec)
    await asyncio.sleep(delay)

# ==================== Request Models ====================
class LoginRequest(BaseModel):
    username: str
    password: str
    two_fa_secret: Optional[str] = None
    proxy: Optional[str] = None
    user_agent: Optional[str] = None

class UsernameRequest(BaseModel):
    username: str

class AccountInfoRequest(BaseModel):
    username: str

class TweetActionRequest(BaseModel):
    username: str
    tweet_id: str

class FollowActionRequest(BaseModel):
    username: str
    target_username: str

class TweetRequest(BaseModel):
    username: str
    text: str
    reply_to_id: Optional[str] = None

class DMRequest(BaseModel):
    username: str
    target_username: str
    text: str

class TimelineRequest(BaseModel):
    username: str
    count: int = 20

class FollowListRequest(BaseModel):
    username: str
    target_username: Optional[str] = None
    count: int = 100

class SearchRequest(BaseModel):
    username: str
    query: str
    count: int = 20

class SearchVerifiedRequest(BaseModel):
    username: str
    keyword: str
    count: int = 20

class ViewBoostRequest(BaseModel):
    username: str
    tweet_url: str
    view_count: int = 10

class ProxyTestRequest(BaseModel):
    address: str
    port: str
    type: str = "http"
    username: Optional[str] = None
    password: Optional[str] = None

class BulkFollowRequest(BaseModel):
    username: str
    targets: List[str]
    delay: float = 3.0
    random_jitter: bool = True

class BulkUnfollowRequest(BaseModel):
    username: str
    count: int = 50
    delay: float = 3.0
    mode: str = "all"  # all, non_followers, non_verified

class DeleteTweetRequest(BaseModel):
    username: str
    tweet_id: str

class BotDataRequest(BaseModel):
    url: str
    durum: str
    bot_id: str

# ==================== Endpoints ====================

@app.get("/")
def root():
    return {"status": "X-KODCUM Backend Aktif", "version": "2.0.0", "engine": "Twikit"}

@app.get("/health")
def health():
    return {"status": "ok", "active_sessions": len(sessions.sessions), "engine": "twikit"}

# ===== Auth =====
@app.post("/auth/login")
async def login(req: LoginRequest):
    result = await sessions.login(req.username, req.password, req.two_fa_secret, req.proxy, req.user_agent)
    return result

@app.post("/auth/logout")
async def logout(req: UsernameRequest):
    await sessions.logout(req.username)
    return {"success": True, "message": f"@{req.username} oturumu kapatıldı"}

@app.post("/auth/check-session")
async def check_session(req: UsernameRequest):
    try:
        client = sessions.get_client(req.username)
        me = await client.user()
        return {"success": True, "logged_in": True, "username": me.screen_name}
    except Exception:
        return {"success": True, "logged_in": False, "username": req.username}

@app.post("/auth/account-info")
async def account_info(req: AccountInfoRequest):
    client = sessions.get_client(req.username)
    try:
        me = await client.user()
        return {
            "success": True,
            "name": me.name,
            "username": me.screen_name,
            "followers_count": me.followers_count,
            "following_count": me.following_count,
            "tweet_count": me.statuses_count,
            "profile_image_url": me.profile_image_url,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Actions =====
@app.post("/actions/like")
async def like_tweet(req: TweetActionRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(0.5, 2.0)
        await client.favorite_tweet(req.tweet_id)
        return {"success": True, "message": f"Tweet {req.tweet_id} beğenildi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/unlike")
async def unlike_tweet(req: TweetActionRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(0.5, 2.0)
        await client.unfavorite_tweet(req.tweet_id)
        return {"success": True, "message": f"Tweet {req.tweet_id} beğenisi kaldırıldı"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/retweet")
async def retweet_tweet(req: TweetActionRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(0.5, 2.0)
        await client.retweet(req.tweet_id)
        return {"success": True, "message": f"Tweet {req.tweet_id} RT yapıldı"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/unretweet")
async def unretweet_tweet(req: TweetActionRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(0.5, 2.0)
        await client.delete_retweet(req.tweet_id)
        return {"success": True, "message": f"RT kaldırıldı"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/follow")
async def follow_user(req: FollowActionRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(1.0, 3.0)
        user = await client.get_user_by_screen_name(req.target_username)
        await client.follow_user(user.id)
        return {"success": True, "message": f"@{req.target_username} takip edildi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/unfollow")
async def unfollow_user(req: FollowActionRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(1.0, 3.0)
        user = await client.get_user_by_screen_name(req.target_username)
        await client.unfollow_user(user.id)
        return {"success": True, "message": f"@{req.target_username} takipten çıkıldı"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/tweet")
async def post_tweet(req: TweetRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(1.0, 3.0)
        if req.reply_to_id:
            result = await client.create_tweet(text=req.text, reply_to=req.reply_to_id)
        else:
            result = await client.create_tweet(text=req.text)
        return {"success": True, "message": "Tweet gönderildi", "tweet_id": result.id if result else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/delete-tweet")
async def delete_tweet(req: DeleteTweetRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(0.5, 1.5)
        await client.delete_tweet(req.tweet_id)
        return {"success": True, "message": f"Tweet {req.tweet_id} silindi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actions/send-dm")
async def send_dm(req: DMRequest):
    client = sessions.get_client(req.username)
    try:
        await human_delay(1.0, 3.0)
        user = await client.get_user_by_screen_name(req.target_username)
        await client.send_dm(user.id, req.text)
        return {"success": True, "message": f"@{req.target_username} kullanıcısına DM gönderildi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Data / Scraping =====
@app.post("/data/timeline")
async def get_timeline(req: TimelineRequest):
    client = sessions.get_client(req.username)
    try:
        tweets = await client.get_user_tweets("latest", count=req.count)
        return {
            "success": True,
            "tweets": [
                {
                    "id": t.id,
                    "text": t.text,
                    "created_at": str(t.created_at) if hasattr(t, 'created_at') else None,
                    "like_count": t.favorite_count if hasattr(t, 'favorite_count') else 0,
                    "retweet_count": t.retweet_count if hasattr(t, 'retweet_count') else 0,
                }
                for t in (tweets or [])[:req.count]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/home-timeline")
async def get_home_timeline(req: TimelineRequest):
    client = sessions.get_client(req.username)
    try:
        tweets = await client.get_timeline(count=req.count)
        return {
            "success": True,
            "tweets": [
                {
                    "id": t.id,
                    "text": t.text,
                    "created_at": str(t.created_at) if hasattr(t, 'created_at') else None,
                    "like_count": t.favorite_count if hasattr(t, 'favorite_count') else 0,
                    "retweet_count": t.retweet_count if hasattr(t, 'retweet_count') else 0,
                    "author_username": t.user.screen_name if hasattr(t, 'user') and t.user else None,
                    "author_name": t.user.name if hasattr(t, 'user') and t.user else None,
                }
                for t in (tweets or [])[:req.count]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/followers")
async def get_followers(req: FollowListRequest):
    client = sessions.get_client(req.username)
    try:
        target = req.target_username or req.username
        user = await client.get_user_by_screen_name(target)
        followers = await client.get_user_followers(user.id, count=req.count)
        return {
            "success": True,
            "users": [
                {
                    "id": u.id,
                    "name": u.name,
                    "username": u.screen_name,
                    "followers_count": u.followers_count if hasattr(u, 'followers_count') else 0,
                    "following_count": u.following_count if hasattr(u, 'following_count') else 0,
                    "verified": u.is_blue_verified if hasattr(u, 'is_blue_verified') else False,
                    "profile_image_url": u.profile_image_url if hasattr(u, 'profile_image_url') else None,
                }
                for u in (followers or [])[:req.count]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/following")
async def get_following(req: FollowListRequest):
    client = sessions.get_client(req.username)
    try:
        target = req.target_username or req.username
        user = await client.get_user_by_screen_name(target)
        following = await client.get_user_following(user.id, count=req.count)
        return {
            "success": True,
            "users": [
                {
                    "id": u.id,
                    "name": u.name,
                    "username": u.screen_name,
                    "followers_count": u.followers_count if hasattr(u, 'followers_count') else 0,
                    "following_count": u.following_count if hasattr(u, 'following_count') else 0,
                    "verified": u.is_blue_verified if hasattr(u, 'is_blue_verified') else False,
                }
                for u in (following or [])[:req.count]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/search")
async def search_tweets(req: SearchRequest):
    client = sessions.get_client(req.username)
    try:
        tweets = await client.search_tweet(req.query, product="Latest", count=req.count)
        return {
            "success": True,
            "tweets": [
                {
                    "id": t.id,
                    "text": t.text,
                    "created_at": str(t.created_at) if hasattr(t, 'created_at') else None,
                    "like_count": t.favorite_count if hasattr(t, 'favorite_count') else 0,
                    "retweet_count": t.retweet_count if hasattr(t, 'retweet_count') else 0,
                    "author_username": t.user.screen_name if hasattr(t, 'user') and t.user else None,
                }
                for t in (tweets or [])[:req.count]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/search-verified")
async def search_verified(req: SearchVerifiedRequest):
    client = sessions.get_client(req.username)
    try:
        tweets = await client.search_tweet(f"{req.keyword} filter:verified", product="Latest", count=req.count * 2)
        seen_users = {}
        for t in (tweets or []):
            if hasattr(t, 'user') and t.user and t.user.screen_name not in seen_users:
                if hasattr(t.user, 'is_blue_verified') and t.user.is_blue_verified:
                    seen_users[t.user.screen_name] = {
                        "id": t.user.id,
                        "name": t.user.name,
                        "username": t.user.screen_name,
                        "followers_count": t.user.followers_count if hasattr(t.user, 'followers_count') else 0,
                        "verified": True,
                    }
        return {"success": True, "users": list(seen_users.values())[:req.count]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Bot Veri Kapısı (JS'den Çevrildi) =====
@app.post('/api/bot-data')
async def bot_data_receiver(req: BotDataRequest, x_api_key: Optional[str] = Header(None)):
    if x_api_key != 'KODCUM_SECURE_KEY_2026':
        return HTTPException(status_code=403, detail="Yetkisiz bot erişimi!")
    
    logger.info(f"🤖 {req.bot_id} botundan veri geldi: {req.url}")
    # Buraya Supabase veya DB kayıt mantığını ekleyebilirsin
    return {"status": "Başarılı", "message": "Veri işlendi."}

# ===== View Boost (4. Dosyadan Stealth + Render Path İyileştirmesi) =====
@app.post("/boost/views")
async def boost_views(req: ViewBoostRequest):
    # Render ortamı için dinamik tarayıcı yolu
    chrome_path = os.environ.get("PUPPETEER_EXECUTABLE_PATH")
    try:
        results = {"success": True, "message": f"Görüntülenme artırma başlatıldı", "completed": 0}
        async with async_playwright() as p:
            for i in range(req.view_count):
                browser = await p.chromium.launch(
                    headless=True,
                    executable_path=chrome_path if chrome_path else None
                )
                context = await browser.new_context(
                    user_agent=ua_factory.random,
                    viewport={"width": random.randint(1024, 1920), "height": random.randint(768, 1080)},
                )
                page = await context.new_page()
                
                # Stealth (Gizlilik) Modu aktif ediliyor
                await stealth_async(page)
                
                try:
                    await page.goto(req.tweet_url, wait_until="domcontentloaded", timeout=15000)
                    await page.evaluate("window.scrollBy(0, Math.random() * 500 + 200)")
                    await asyncio.sleep(random.uniform(2, 5))
                    results["completed"] = i + 1
                except Exception:
                    pass
                finally:
                    await browser.close()
                await asyncio.sleep(random.uniform(1, 3))
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Proxy Test =====
@app.post("/proxy/test")
async def test_proxy(req: ProxyTestRequest):
    try:
        import aiohttp
        proxy_url = f"{req.type}://"
        if req.username and req.password:
            proxy_url += f"{req.username}:{req.password}@"
        proxy_url += f"{req.address}:{req.port}"

        start = time.time()
        async with aiohttp.ClientSession() as session:
            async with session.get("https://httpbin.org/ip", proxy=proxy_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    latency = int((time.time() - start) * 1000)
                    return {"success": True, "alive": True, "latency_ms": latency}
        return {"success": True, "alive": False, "latency_ms": 0}
    except Exception as e:
        return {"success": True, "alive": False, "latency_ms": 0, "error": str(e)}

# ===== Bulk Operations =====
@app.post("/bulk/follow")
async def bulk_follow(req: BulkFollowRequest):
    client = sessions.get_client(req.username)
    results = {"success": True, "completed": 0, "failed": 0, "errors": []}
    for target in req.targets:
        try:
            user = await client.get_user_by_screen_name(target.replace("@", ""))
            await client.follow_user(user.id)
            results["completed"] += 1
            delay = req.delay + (random.uniform(0, 2) if req.random_jitter else 0)
            await asyncio.sleep(delay)
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"@{target}: {str(e)}")
    return results

@app.post("/bulk/unfollow")
async def bulk_unfollow(req: BulkUnfollowRequest):
    client = sessions.get_client(req.username)
    try:
        me = await client.user()
        following = await client.get_user_following(me.id, count=req.count)
        
        results = {"success": True, "completed": 0, "failed": 0}
        for user in (following or [])[:req.count]:
            try:
                should_unfollow = True
                if req.mode == "non_followers":
                    followers = await client.get_user_followers(me.id, count=5000)
                    follower_ids = {f.id for f in (followers or [])}
                    should_unfollow = user.id not in follower_ids
                elif req.mode == "non_verified":
                    should_unfollow = not (hasattr(user, 'is_blue_verified') and user.is_blue_verified)

                if should_unfollow:
                    await client.unfollow_user(user.id)
                    results["completed"] += 1
                    delay = req.delay + random.uniform(0, 2)
                    await asyncio.sleep(delay)
            except Exception:
                results["failed"] += 1
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Startup ====================
if __name__ == "__main__":
    import uvicorn
    # Port 8000 kaldırıldı, dinamik port eklendi
    target_port = int(os.environ.get("PORT", 10000))
    logger.info(f"🔥 SNR ENGINE V2 başlatılıyor - Hedef Port: {target_port}")
    uvicorn.run(app, host="0.0.0.0", port=target_port)
