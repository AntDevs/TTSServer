import requests
import logging
from app.core.config import config

# Правило 1: Уникальный логгер для модуля
logger = logging.getLogger("ESP32_Service")

# Глобальный флаг для отмены TTS[cite: 18]
is_speaking_cancelled = False

def send_audio_to_esp32(audio_bytes):
    """Асинхронная отправка готового аудиофайла на ESP32 у двери"""
    bytes_len = len(audio_bytes) if audio_bytes else 0
    logger.info(f"[ENTER] send_audio_to_esp32 | params: audio_bytes len={bytes_len}")
    try:
        response = requests.post(config.ESP32_SPEAKER_URL, data=audio_bytes, headers={'Content-Type': 'audio/wav'}, timeout=3)
        if response.status_code == 200:
            logger.info("Аудио успешно отправлено на ESP32.")
            logger.info(f"[EXIT] send_audio_to_esp32 | return: status_code={response.status_code}")
            return response.status_code
        else:
            logger.error(f"Ошибка при отправке на ESP32: статус {response.status_code}")
            logger.info(f"[EXIT] send_audio_to_esp32 | return: status_code={response.status_code}")
            return response.status_code
    except Exception as e:
        logger.error(f"Не удалось отправить звук на дверной динамик: {e}")
        logger.error(f"[EXIT ERROR] send_audio_to_esp32 | error: {e}")
        raise e

def stop_speaker_hardware() -> str:
    """Фоновая задача: мгновенная отправка команды СТОП на дверной динамик"""
    logger.info("[ENTER] stop_speaker_hardware | params: none")
    global is_speaking_cancelled
    try:
        is_speaking_cancelled = True
        
        # Формируем URL для остановки динамика Контроллера 2
        base_url = config.ESP32_SPEAKER_URL.rsplit('/', 1)[0]
        stop_url = f"{base_url}/stop"
        
        # Правило 3: Сетевой POST запрос обернут в try/except
        response = requests.post(stop_url, timeout=1)
        result_msg = f"Speaker stopped, status: {response.status_code}"
        
        logger.info(f"[EXIT] stop_speaker_hardware | return: '{result_msg}'")
        return result_msg
    except Exception as e:
        logger.error(f"[EXIT ERROR] stop_speaker_hardware | error: {e}")
        return f"Failed to stop: {e}"