import configparser
import logging
import os

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
            
            # Models
            self.MODEL_RU = self.parser.get("Models", "Russian", fallback="facebook/mms-tts-rus")
            self.MODEL_EN = self.parser.get("Models", "English", fallback="facebook/mms-tts-eng")
            self.MODEL_HE = self.parser.get("Models", "Hebrew", fallback="facebook/mms-tts-heb")

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