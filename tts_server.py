import torch
import torchaudio
import io
import requests
import os
from fastapi.responses import HTMLResponse, Response
from fastapi import FastAPI, Request, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware # Добавлено для работы HTML-страницы

app = FastAPI()

# Разрешаем CORS, чтобы наша HTML-страница могла отправлять запросы
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # В продакшене лучше указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Загрузка локальной нейросети Silero TTS
device = torch.device('cpu') 
model, _ = torch.hub.load(
    repo_or_dir='snakers4/silero-models',
    model='silero_tts',  
    language='ru',
    speaker='v4_ru'
)
model.to(device)

# IP-адрес Контроллера 2 (ESP32 с динамиком) - используется в старом эндпоинте
ESP32_SPEAKER_URL = "http://192.168.1.100/play" 

def send_audio_to_esp32(audio_tensor, sample_rate):
    """Функция потоковой передачи сгенерированного аудио на Контроллер 2"""
    buffer = io.BytesIO()
    torchaudio.save(buffer, audio_tensor.unsqueeze(0), sample_rate, format="wav")
    buffer.seek(0)
    
    try:
        requests.post(ESP32_SPEAKER_URL, data=buffer.read(), headers={'Content-Type': 'audio/wav'})
    except Exception as e:
        print(f"Ошибка отправки на динамик: {e}")

@app.post("/speak")
async def speak_text(request: Request, background_tasks: BackgroundTasks):
    """Старый эндпоинт: генерирует звук и сам отправляет его на дверь (ESP32)"""
    body = await request.body()
    text = body.decode('utf-8')
    
    if not text:
        return {"status": "error", "message": "Пустой текст"}

    sample_rate = 24000
    audio = model.apply_tts(text=text, speaker='aidar', sample_rate=sample_rate)

    background_tasks.add_task(send_audio_to_esp32, audio, sample_rate)

    return {"status": "ok", "text": text, "message": "Аудио генерируется и отправляется на дверь"}


@app.get("/")
async def serve_test_html():
    """Отдает HTML-страницу для тестирования TTS"""
    # Убедитесь, что ваш сохраненный HTML-файл называется tts_test.html 
    # и лежит в той же папке, что и этот python-скрипт.
    try:
        with open("tts_tester.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="Файл tts_test.html не найден рядом с сервером.", status_code=404)

# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ТЕСТИРОВАНИЯ ---
@app.post("/speak_stream")
async def speak_and_stream(request: Request):
    """Новый эндпоинт: получает текст, генерирует звук и ВОЗВРАЩАЕТ WAV-файл в ответе"""
    body = await request.body()
    text = body.decode('utf-8')
    
    if not text:
        return Response(content="Пустой текст", status_code=400)

    try:
        # Синтезируем аудио
        sample_rate = 24000
        audio = model.apply_tts(text=text, speaker='aidar', sample_rate=sample_rate)

        # Сохраняем аудио в виртуальный файл (буфер в памяти)
        buffer = io.BytesIO()
        torchaudio.save(buffer, audio.unsqueeze(0), sample_rate, format="wav")
        buffer.seek(0) # Возвращаем указатель в начало файла

        # Возвращаем буфер как бинарный ответ с правильным MIME-типом
        return Response(content=buffer.read(), media_type="audio/wav")

    except Exception as e:
        print(f"Ошибка генерации: {e}")
        return Response(content=f"Ошибка сервера: {e}", status_code=500)