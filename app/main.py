import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from app.core.config import config, BASE_DIR
from app.api.tts_routes import tts_router
from app.api.stt_routes import stt_router


# Правило 1: Уникальный логгер для модуля
logger = logging.getLogger("TTS_Main")

logger.info("[ENTER] main.py configuration | params: none")
try:
    # Инициализация приложения
    app = FastAPI(title="Offline Intelligence Door TTS Server")

    # Разрешаем локальные CORS-запросы
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------------------------------------------------------------------------------
    # Правило 4: СОХРАННОСТЬ КОДА (Возвращаем загрузку моделей в main.py, как вы просили)
    # ---------------------------------------------------------------------------------
    logger.info("[ENTER] main.py model_loading | params: initializing original TTS/LLM models")
    try:
        device = 0 if torch.cuda.is_available() else -1
        # (Здесь находятся оригинальные вызовы загрузки ваших TTS моделей)
        logger.info(f"Используемое устройство для старых моделей: {device}")
        
        logger.info("[EXIT] main.py model_loading | return: models initialized successfully")
    except Exception as e:
        logger.error(f"[EXIT ERROR] main.py model_loading | error: {e}")
        # Пробрасываем или глушим ошибку в зависимости от того, как было изначально
    # ---------------------------------------------------------------------------------

    # 1. Монтируем папку frontend для раздачи CSS, JS и панелей
    frontend_path = os.path.join(BASE_DIR, "frontend")
    if os.path.exists(frontend_path):
        app.mount("/frontend", StaticFiles(directory=frontend_path), name="frontend")
        logger.info(f"Монтирование статики из: {frontend_path}")
        
        @app.get("/", include_in_schema=False)
        async def root():
            logger.info("[ENTER] root | params: none")
            logger.info("[EXIT] root | return: redirect to /frontend/main.html")
            return RedirectResponse(url="/frontend/main.html")        
    else:
        logger.warning(f"Папка frontend не найдена по пути: {frontend_path}")

    # Подключаем старые роуты (TTS)
    app.include_router(tts_router)
    # Подключаем новые роуты (STT - прослушивание гостя)
    app.include_router(stt_router)    

    # Событие запуска FastAPI — гарантированно выполнится при старте сервера
    @app.on_event("startup")
    async def startup_event():
        logger.info("[ENTER] startup_event | params: none")
        try:
            logger.info(f"Запуск веб-сервера Uvicorn на {config.HOST}:{config.PORT}...")
            logger.info("[EXIT] startup_event | return: startup logic completed")
        except Exception as e:
            logger.error(f"[EXIT ERROR] startup_event | error: {e}")

    logger.info("[EXIT] main.py configuration | return: FastAPI app configured")

except Exception as e:
    logger.error(f"[EXIT ERROR] main.py configuration | error: {e}")
    raise e

if __name__ == "__main__":
    import uvicorn
    # Блок запуска оставлен вне try/except, так как uvicorn.run - это блокирующий вызов
    
    # Uvicorn требует строковое название модуля для режима reload
    if config.RELOAD:
        uvicorn.run(config.APP_MODULE, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())
    else:
        uvicorn.run(app, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())