import io
import os
import torch
import torchaudio
import numpy as np
import requests
from fastapi import FastAPI, Request, Response, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline

# Запрещаем Hugging Face обращаться к интернету (полный оффлайн-режим)
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

app = FastAPI(title="Offline Intelligence Door TTS Server (Meta MMS)")

# Разрешаем локальные CORS-запросы
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Проверка доступности видеокарты GTX 1060 (CUDA)
if not torch.cuda.is_available():
    raise SystemError("CUDA недоступна! Вычисления на процессоре вызовут задержку.")

print(f"[INIT] Запуск Meta MMS на видеокарте: {torch.cuda.get_device_name(0)}")

# 2. Загрузка языковых моделей Meta MMS из локального кэша
tts_pipes = {}

try:
    print("[INIT] Загрузка модели для русского (facebook/mms-tts-rus)...")
    tts_pipes['ru'] = pipeline("text-to-speech", model="facebook/mms-tts-rus", device=0)
    
    print("[INIT] Загрузка модели для английского (facebook/mms-tts-eng)...")
    tts_pipes['en'] = pipeline("text-to-speech", model="facebook/mms-tts-eng", device=0)
    
    print("[INIT] Загрузка модели для иврита (facebook/mms-tts-heb)...")
    tts_pipes['he'] = pipeline("text-to-speech", model="facebook/mms-tts-heb", device=0)
    
    print("[INIT] Все языковые модели Meta MMS (RU, EN, HE) успешно загружены!")
except Exception as e:
    print(f"[ERROR] Ошибка загрузки моделей. Убедитесь, что они были скачаны ранее: {e}")

# IP-адрес Контроллера 2 (ESP32 с динамиком) в локальной сети
ESP32_SPEAKER_URL = "http://192.168.1.100/play" 

def resolve_language(speaker_id: str) -> str:
    """Определяет нужный язык на основе ID диктора/языка из фронтенда"""
    speaker_id = speaker_id.lower()
    if speaker_id in ["hebrew", "he", "he_il", "heb"]:
        return "he"
    elif speaker_id in ["english", "en", "en_us", "en_gb", "eng"]:
        return "en"
    return "ru" # По умолчанию русский

def generate_audio_bytes(text: str, lang: str):
    """Генерирует WAV-файл в памяти с помощью Meta MMS"""
    pipe = tts_pipes.get(lang)
    if not pipe:
        raise ValueError(f"Модель для языка '{lang}' не инициализирована.")
    
    # Генерация через пайплайн Meta MMS (возвращает словарь с аудио numpy-массивом и частотой)
    output = pipe(text)
    audio_data = output["audio"] 
    sampling_rate = output["sampling_rate"] # Обычно 16000 Гц для MMS
    
    # Нормализация и перевод в 16-bit PCM WAV
    audio_int16 = np.clip(audio_data.squeeze() * 32767.0, -32768.0, 32767.0).astype(np.int16)
    
    buffer = io.BytesIO()
    torchaudio.save(
        buffer, 
        torch.tensor(audio_int16).unsqueeze(0), 
        sampling_rate, 
        format="wav"
    )
    buffer.seek(0)
    return buffer.read(), sampling_rate

def send_audio_to_esp32(audio_bytes):
    """Асинхронная отправка готового аудиофайла на ESP32 у двери"""
    try:
        requests.post(ESP32_SPEAKER_URL, data=audio_bytes, headers={'Content-Type': 'audio/wav'}, timeout=3)
    except Exception as e:
        print(f"[ERROR] Не удалось отправить звук на дверной динамик: {e}")

@app.get("/", response_class=HTMLResponse)
async def serve_tester_page():
    """Отдает HTML-страницу тестирования напрямую из корня сервера"""
    try:
        with open("tts_tester.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return HTMLResponse(content="<h3>Файл tts_tester.html не найден.</h3>", status_code=404)

@app.post("/speak_stream")
async def speak_stream(request: Request):
    """
    Эндпоинт для веб-интерфейса:
    Генерирует аудио и возвращает WAV-файл в ответе.
    """
    try:
        data = await request.json()
        text = data.get("text", "")
        speaker = data.get("speaker", "ru")
    except Exception:
        body = await request.body()
        text = body.decode('utf-8')
        speaker = 'ru'

    if not text:
        return Response(content="Пустой текст", status_code=400)

    try:
        lang = resolve_language(speaker)
        audio_bytes, _ = generate_audio_bytes(text, lang)
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        return Response(content=f"Ошибка генерации: {str(e)}", status_code=500)

@app.post("/speak")
async def speak_to_door(request: Request, background_tasks: BackgroundTasks):
    """
    Эндпоинт для логики умной двери:
    Мгновенно отвечает клиенту, а аудио отправляет на Контроллер 2 (ESP32) в фоне.
    """
    try:
        data = await request.json()
        text = data.get("text", "")
        speaker = data.get("speaker", "ru")
    except Exception:
        body = await request.body()
        text = body.decode('utf-8')
        speaker = 'ru'

    if not text:
        return {"status": "error", "message": "Пустой текст"}

    try:
        lang = resolve_language(speaker)
        audio_bytes, _ = generate_audio_bytes(text, lang)
        
        # Фоновая отправка на дверной динамик
        background_tasks.add_task(send_audio_to_esp32, audio_bytes)
        
        return {"status": "ok", "text": text, "language_used": lang}
    except Exception as e:
        return {"status": "error", "message": str(e)}