import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import config
from app.api.routes import router

# Настройка встроенного логгера Python на основе конфига
logging.basicConfig(
    level=config.NUMERIC_LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("TTS_Server")

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

# Событие запуска FastAPI — гарантированно выполнится при старте сервера
@app.on_event("startup")
async def startup_event():
    logger.info(f"Запуск startup веб-сервера Uvicorn на {config.HOST}:{config.PORT}...")

if __name__ == "__main__":
    import uvicorn
    
    # Uvicorn требует строковое название модуля для режима reload
    if config.RELOAD:
        uvicorn.run(config.APP_MODULE, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())
    else:
        uvicorn.run(app, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Запуск веб-сервера Uvicorn на {config.HOST}:{config.PORT}...")
    
    # Uvicorn требует строковое название модуля для режима reload
    if config.RELOAD:
        uvicorn.run(config.APP_MODULE, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())
    else:
        uvicorn.run(app, host=config.HOST, port=config.PORT, reload=config.RELOAD, log_level=config.LOG_LEVEL_STR.lower())