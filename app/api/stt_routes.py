import logging
from fastapi import APIRouter, Request, Response, BackgroundTasks, UploadFile, File, HTTPException
from typing import Optional

# Импорты разделенных сервисов STT и ESP32
from app.services.stt import transcribe_audio
from app.services.esp32 import stop_speaker_hardware

# Правило 1: Уникальный логгер для модуля
logger = logging.getLogger("STT_Route")
stt_router = APIRouter()

@stt_router.post("/listen-file")
async def listen_file(file: UploadFile = File(...), language: Optional[str] = None):
    """Эндпоинт загрузки аудиофайла из браузера для распознавания"""
    logger.info(f"[ENTER] listen_endpoint | filename={file.filename}")
    try:
        contents = await file.read()
        if len(contents) < 500:
            raise HTTPException(status_code=400, detail="Аудиофайл слишком короткий или пуст")

        # Передаем байты напрямую в сервис транскрибации (он сам обрабатывает конвертацию)
        text = transcribe_audio(contents)
        
        logger.info("[EXIT] listen_endpoint | return: success")
        return {"status": "ok", "text": text}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXIT ERROR] listen_endpoint | error: {e}")
        raise HTTPException(status_code=400, detail=f"Ошибка обработки аудиофайла: {str(e)}")

@stt_router.post("/listen")
async def listen_guest(request: Request, background_tasks: BackgroundTasks):
    """Эндпоинт: получает аудио от гостя, останавливает динамик и распознает язык/текст"""
    logger.info("[ENTER] listen_guest | params: request(Request), background_tasks(BackgroundTasks)")
    try:
        # Мгновенная остановка железа через фоновую задачу (через сервис ESP32)
        background_tasks.add_task(stop_speaker_hardware)

        # Чтение байтов
        audio_bytes = await request.body()
        if not audio_bytes:
            error_response = {"status": "error", "message": "Пустой аудиопоток"}
            logger.info(f"[EXIT] listen_guest | return: {error_response}")
            return error_response

        # Передача байтов в сервис обработки STT
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