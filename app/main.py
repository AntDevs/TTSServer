import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import config
from app.api.routes import router

# Уникальный логгер для главного модуля приложения
logger = logging.getLogger("TTS_Main")

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

# Подключаем роуты из папки api
app.include_router(router)

# Событие запуска FastAPI
@app.on_event("startup")
async def startup_event():
    """Событие старта веб-сервера Uvicorn"""
    logger.info("[ENTER] startup_event | params: none")
    try:
        logger.info(f"Запуск веб-сервера Uvicorn на {config.HOST}:{config.PORT}...")
        logger.info("[EXIT] startup_event | return: success")
    except Exception as e:
        logger.error(f"[EXIT ERROR] startup_event | error: {e}")
        raise e

if __name__ == "__main__":
    import uvicorn
    
    # Uvicorn требует строковое название модуля для режима reload
    if config.RELOAD:
        uvicorn.run(config.APP_MODULE, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())
    else:
        uvicorn.run(app, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())