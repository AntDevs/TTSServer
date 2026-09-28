import os
import logging
from fastapi import APIRouter, Request, Response, BackgroundTasks
from fastapi.responses import HTMLResponse
from app.services.audio import generate_audio_bytes, send_audio_to_esp32, resolve_language
from app.core.config import BASE_DIR

logger = logging.getLogger("TTS_Server")
router = APIRouter()

@router.get("/", response_class=HTMLResponse)
async def serve_tester_page():
    """Отдает HTML-страницу тестирования напрямую из корня сервера"""
    logger.info("[ENTER] serve_tester_page | params: none")
    try:
        html_path = os.path.join(BASE_DIR, "tts_tester.html")
        with open(html_path, "r", encoding="utf-8") as f:
            content = f.read()
            logger.info("[EXIT] serve_tester_page | return: tts_tester.html loaded successfully")
            return content
    except FileNotFoundError as e:
        logger.warning("Файл tts_tester.html не найден при обращении к корню.")
        logger.error(f"[EXIT ERROR] serve_tester_page | error: {e}")
        return HTMLResponse(content="<h3>Файл tts_tester.html не найден.</h3>", status_code=404)

@router.post("/speak_stream")
async def speak_stream(request: Request):
    """
    Эндпоинт для веб-интерфейса:
    Генерирует аудио и возвращает WAV-файл в ответе.
    """
    logger.info(f"[ENTER] speak_stream | params: client={request.client}")
    try:
        data = await request.json()
        text = data.get("input") or data.get("text", "")
        speaker = data.get("voice") or data.get("speaker", "ru")
    except Exception:
        body = await request.body()
        text = body.decode('utf-8')
        speaker = 'ru'

    if not text:
        logger.warning("Получен пустой текст на эндпоинт /speak_stream")
        res = Response(content="Пустой текст", status_code=400)
        logger.info("[EXIT] speak_stream | return: Response(400, 'Пустой текст')")
        return res

    try:
        lang = resolve_language(speaker)
        audio_bytes, _ = generate_audio_bytes(text, lang)
        res = Response(content=audio_bytes, media_type="audio/wav")
        logger.info(f"[EXIT] speak_stream | return: Response(200, media_type='audio/wav', bytes={len(audio_bytes)})")
        return res
    except Exception as e:
        logger.exception("Внутренняя ошибка генерации в /speak_stream:")
        res = Response(content=f"Ошибка генерации: {str(e)}", status_code=500)
        logger.error(f"[EXIT ERROR] speak_stream | error: {e}")
        return res

@router.post("/speak")
async def speak_to_door(request: Request, background_tasks: BackgroundTasks):
    """
    Эндпоинт для логики умной двери:
    Мгновенно отвечает клиенту, а аудио отправляет на Контроллер 2 (ESP32) в фоне.
    """
    logger.info(f"[ENTER] speak_to_door | params: client={request.client}")
    try:
        data = await request.json()
        text = data.get("input") or data.get("text", "")
        speaker = data.get("voice") or data.get("speaker", "ru")
    except Exception:
        body = await request.body()
        text = body.decode('utf-8')
        speaker = 'ru'

    if not text:
        logger.warning("Получен пустой текст на эндпоинт /speak")
        res = {"status": "error", "message": "Пустой текст"}
        logger.info(f"[EXIT] speak_to_door | return: {res}")
        return res

    try:
        lang = resolve_language(speaker)
        audio_bytes, _ = generate_audio_bytes(text, lang)
        
        # Фоновая отправка на дверной динамик
        background_tasks.add_task(send_audio_to_esp32, audio_bytes)
        
        res = {"status": "ok", "text": text, "language_used": lang}
        logger.info(f"[EXIT] speak_to_door | return: {res}")
        return res
    except Exception as e:
        logger.exception("Внутренняя ошибка генерации в /speak:")
        res = {"status": "error", "message": str(e)}
        logger.error(f"[EXIT ERROR] speak_to_door | error: {res}")
        return res