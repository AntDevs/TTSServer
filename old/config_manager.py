import configparser
import logging

class ProjectConfig:
    """Объект конфигурации проекта. Считывает настройки из файла .ini."""
    def __init__(self, config_file="config.ini"):
        self.parser = configparser.ConfigParser()
        self.parser.read(config_file)
        
        # Server
        self.LOG_LEVEL_STR = self.parser.get("Server", "LogLevel", fallback="INFO").upper()
        self.HOST = self.parser.get("Server", "Host", fallback="0.0.0.0")
        self.PORT = self.parser.getint("Server", "Port", fallback=8000)
        self.RELOAD = self.parser.getboolean("Server", "Reload", fallback=False)
        self.APP_MODULE = self.parser.get("Server", "AppModule", fallback="tts_server:app")
        
        # Device
        self.ESP32_SPEAKER_URL = self.parser.get("Device", "ESP32_Speaker_URL", fallback="http://192.168.1.100/play")
        
        # Models
        self.MODEL_RU = self.parser.get("Models", "Russian", fallback="facebook/mms-tts-rus")
        self.MODEL_EN = self.parser.get("Models", "English", fallback="facebook/mms-tts-eng")
        self.MODEL_HE = self.parser.get("Models", "Hebrew", fallback="facebook/mms-tts-heb")

        # Utils
        self.NUMERIC_LOG_LEVEL = getattr(logging, self.LOG_LEVEL_STR, logging.INFO)

# Создаем глобальный объект конфигурации (синглтон), который будем импортировать в другие файлы
config = ProjectConfig()