import logging
from fastapi import APIRouter, Request, Response, BackgroundTasks
from app.services.stt import stop_speaker_hardware, transcribe_audio

# Правило 1: Уникальный логгер для модуля
logger = logging.getLogger("TTS_ListenRoutes")
listen_router = APIRouter()

@listen_router.post("/listen")
async def listen_guest(request: Request, background_tasks: BackgroundTasks):
    """Эндпоинт: получает аудио от гостя, останавливает динамик и распознает язык/текст"""
    logger.info("[ENTER] listen_guest | params: request(Request), background_tasks(BackgroundTasks)")
    try:
        # Мгновенная остановка железа через фоновую задачу
        background_tasks.add_task(stop_speaker_hardware)

        # Чтение байтов
        audio_bytes = await request.body()
        if not audio_bytes:
            error_response = {"status": "error", "message": "Пустой аудиопоток"}
            logger.info(f"[EXIT] listen_guest | return: {error_response}")
            return error_response

        # Передача байтов в сервис обработки
        recognized_text = transcribe_audio(audio_bytes)

        success_response = {
            "status": "ok", 
            "text": recognized_text
        }
        logger.info(f"[EXIT] listen_guest | return: {success_response}")
        return success_response

    except Exception as e:
        # Правило 3: Обработка ошибок для эндпоинта
        logger.error(f"[EXIT ERROR] listen_guest | error: {e}")
        return Response(content=f"Ошибка сервера: {e}", status_code=500)