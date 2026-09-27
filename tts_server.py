import torch
import torchaudio
import io
import requests
import os
from fastapi import FastAPI, Request, Response, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

# Запрещаем PyTorch обращаться к интернету
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

app = FastAPI(title="Offline Intelligence Door TTS Server")

# Разрешаем локальные CORS-запросы
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Принудительное использование видеокарты GTX 1060 (CUDA)
if not torch.cuda.is_available():
    raise SystemError("CUDA недоступна! Вычисления на CPU i7-950 вызовут огромную задержку.")

device = torch.device('cuda')
print(f"[INIT] Запуск нейросети на видеокарте: {torch.cuda.get_device_name(0)}")

# 2. Загрузка модели из локального кеша (без интернета)
model, _ = torch.hub.load(
    repo_or_dir='snakers4/silero-models',
    model='silero_tts',
    language='ru',
    speaker='v4_ru',
    source='github' # Использует локальный кеш, если нет сети
)
model.to(device)

# IP-адрес Контроллера 2 (ESP32 с динамиком) в локальной сети
ESP32_SPEAKER_URL = "http://192.168.1.100/play" 

def send_audio_to_esp32(audio_tensor, sample_rate):
    """Асинхронная отправка готового аудиофайла на ESP32 у двери"""
    buffer = io.BytesIO()
    # Переносим тензор с GPU обратно в системную память для сохранения в файл
    torchaudio.save(buffer, audio_tensor.unsqueeze(0).cpu(), sample_rate, format="wav")
    buffer.seek(0)
    
    try:
        requests.post(ESP32_SPEAKER_URL, data=buffer.read(), headers={'Content-Type': 'audio/wav'}, timeout=3)
    except Exception as e:
        print(f"[ERROR] Не удалось отправить звук на дверной динамик: {e}")

@app.get("/", response_class=HTMLResponse)
async def serve_tester_page():
    """Отдает HTML-страницу тестирования напрямую из корня сервера"""
    try:
        with open("tts_tester.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return HTMLResponse(content="<h3>Файл tts_tester.html не найден в папке сервера.</h3>", status_code=404)

@app.post("/speak_stream")
async def speak_stream(request: Request):
    """
    Эндпоинт для веб-интерфейса и Центрального сервера:
    Принимает JSON {"text": "...", "speaker": "..."},
    генерирует аудио на GPU и ВОЗВРАЩАЕТ WAV-файл в ответе.
    """
    try:
        data = await request.json()
        text = data.get("text", "")
        speaker = data.get("speaker", "aidar")
    except Exception:
        body = await request.body()
        text = body.decode('utf-8')
        speaker = 'aidar'

    if not text:
        return Response(content="Пустой текст", status_code=400)

    sample_rate = 24000
    
    # Синтез речи на CUDA
    with torch.no_grad():
        audio = model.apply_tts(text=text, speaker=speaker, sample_rate=sample_rate)

    # Буферизация в ОЗУ
    buffer = io.BytesIO()
    torchaudio.save(buffer, audio.unsqueeze(0).cpu(), sample_rate, format="wav")
    buffer.seek(0)

    return Response(content=buffer.read(), media_type="audio/wav")

@app.post("/speak")
async def speak_to_door(request: Request, background_tasks: BackgroundTasks):
    """
    Эндпоинт для Сервера ИИ / Скрипта логики:
    Принимает текст, мгновенно ответит "ОК", а аудио отправляет
    напрямую на Контроллер 2 (ESP32 с динамиком) в фоновом режиме.
    """
    try:
        data = await request.json()
        text = data.get("text", "")
        speaker = data.get("speaker", "aidar")
    except Exception:
        body = await request.body()
        text = body.decode('utf-8')
        speaker = 'aidar'

    if not text:
        return {"status": "error", "message": "Пустой текст"}

    sample_rate = 24000
    
    with torch.no_grad():
        audio = model.apply_tts(text=text, speaker=speaker, sample_rate=sample_rate)

    # Отправка на динамик без блокировки ответа API
    background_tasks.add_task(send_audio_to_esp32, audio, sample_rate)

    return {"status": "ok", "text": text, "speaker": speaker}