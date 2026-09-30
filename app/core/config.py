import configparser
import logging
import os
import json

# Уникальный логгер для модуля конфигурации
logger = logging.getLogger("TTS_Config")

# Вычисляем путь к корню проекта
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_PATH = os.path.join(BASE_DIR, "config.ini")

class ProjectConfig:
    """Объект конфигурации проекта. Считывает настройки из файла .ini."""
    def __init__(self, config_file=CONFIG_PATH):
        logger.info(f"[ENTER] ProjectConfig.__init__ | params: config_file='{config_file}'")
        try:
            self.parser = configparser.ConfigParser()
            self.parser.read(config_file)
            
            # Server
            self.LOG_LEVEL_STR = self.parser.get("Server", "LogLevel", fallback="INFO").upper()
            self.HOST = self.parser.get("Server", "Host", fallback="0.0.0.0")
            self.PORT = self.parser.getint("Server", "Port", fallback=8000)
            self.RELOAD = self.parser.getboolean("Server", "Reload", fallback=False)
            self.APP_MODULE = self.parser.get("Server", "AppModule", fallback="app.main:app")
            
            # Device
            self.ESP32_SPEAKER_URL = self.parser.get("Device", "ESP32_Speaker_URL", fallback="http://192.168.1.100/play")
            
            # Models - Выровнено по новым именам из config.ini
            self.TTS_RUSSIAN = self.parser.get("Models", "TTS_Russian", fallback="facebook/mms-tts-rus")
            self.TTS_ENGLISH = self.parser.get("Models", "TTS_English", fallback="facebook/mms-tts-eng")
            self.TTS_HEBREW = self.parser.get("Models", "TTS_Hebrew", fallback="facebook/mms-tts-heb")
            
            # Сохраняем старые алиасы для совместимости с сервисом TTS (Правило сохранности кода)
            self.MODEL_RU = self.TTS_RUSSIAN
            self.MODEL_EN = self.TTS_ENGLISH
            self.MODEL_HE = self.TTS_HEBREW
            
            # Конфигурация STT
            self.STT_MODEL = self.parser.get("Models", "STT_Model", fallback="openai/whisper-small")
            
            # Парсинг JSON-строки словаря аргументов STT
            try:
                kwargs_str = self.parser.get("Models", "STT_Generate_Kwargs", fallback='{"task": "transcribe"}')
                self.STT_GENERATE_KWARGS = json.loads(kwargs_str)
            except Exception as json_e:
                logger.error(f"[ERROR] ProjectConfig.__init__ | Failed to parse STT_Generate_Kwargs, using default: {json_e}")
                self.STT_GENERATE_KWARGS = {"task": "transcribe"}

            # Utils
            self.NUMERIC_LOG_LEVEL = getattr(logging, self.LOG_LEVEL_STR, logging.INFO)
            logger.info(f"[EXIT] ProjectConfig.__init__ | return: config loaded successfully")
        except Exception as e:
            logger.error(f"[EXIT ERROR] ProjectConfig.__init__ | error: {e}")
            raise e

# Создаем глобальный объект конфигурации (синглтон)
config = ProjectConfig()

# Настройка встроенного логгера Python происходит здесь
logging.basicConfig(
    level=config.NUMERIC_LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",    
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True
)