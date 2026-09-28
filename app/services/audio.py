import io
import os
import torch
import torchaudio
import numpy as np
import requests
import logging
from transformers import pipeline
from transformers.tokenization_utils_base import BatchEncoding
from app.core.config import config

# Уникальный логгер для модуля обработки аудио
logger = logging.getLogger("TTS_Audio")

# Исправленный патч: не меняет dtype для индексов токенов (input_ids), оставляя их Long/Int
old_batch_encoding_to = BatchEncoding.to
def patched_batch_encoding_to(self, device=None, *, non_blocking=False, dtype=None, **kwargs):
    logger.info(f"[ENTER] patched_batch_encoding_to | params: device={device}, dtype={dtype}")
    try:
        if dtype is not None:
            for k, v in self.items():
                if hasattr(v, "to"):
                    # Индексы токенов должны оставаться целочисленными (Long/Int), иначе ломается embedding слой
                    if k in ("input_ids", "token_type_ids") or (isinstance(v, torch.Tensor) and not torch.is_floating_point(v)):
                        if device is not None:
                            self[k] = v.to(device=device, non_blocking=non_blocking)
                    else:
                        if device is not None:
                            self[k] = v.to(device=device, dtype=dtype, non_blocking=non_blocking)
                        else:
                            self[k] = v.to(dtype=dtype)
            logger.info(f"[EXIT] patched_batch_encoding_to | return: self (patched safely)")
            return self
        if device is not None:
            res = old_batch_encoding_to(self, device, non_blocking=non_blocking, **kwargs)
            logger.info(f"[EXIT] patched_batch_encoding_to | return: old_batch_encoding_to result")
            return res
        logger.info(f"[EXIT] patched_batch_encoding_to | return: self")
        return self
    except Exception as e:
        logger.error(f"[EXIT ERROR] patched_batch_encoding_to | error: {e}")
        raise e

BatchEncoding.to = patched_batch_encoding_to

# Запрещаем Hugging Face обращаться к интернету (полный оффлайн-режим)
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

# 1. Проверка доступности и выполнения ядер на видеокарте GTX 1060 (CUDA)
if not torch.cuda.is_available():
    logger.critical("CUDA недоступна! Вычисления на процессоре вызовут задержку.")
    raise SystemError("CUDA недоступна! Вычисления на процессоре вызовут задержку.")

device = -1
try:
    # Проверка возможности выполнения Cuda-ядер на GPU
    test_tensor = torch.zeros(1, device="cuda")
    _ = test_tensor + 1
    device = 0
    logger.info(f"Запуск Meta MMS на видеокарте: {torch.cuda.get_device_name(0)}")
except Exception as e:
    logger.warning(f"CUDA ядра недоступны для текущей версии PyTorch ({e}). Переключение на CPU (-1).")
    device = -1

# 2. Загрузка языковых моделей Meta MMS из локального кэша
tts_pipes = {}

try:
    logger.info(f"Загрузка модели для русского ({config.MODEL_RU})...")
    tts_pipes['ru'] = pipeline("text-to-speech", model=config.MODEL_RU, device=device)
    
    logger.info(f"Загрузка модели для английского ({config.MODEL_EN})...")
    tts_pipes['en'] = pipeline("text-to-speech", model=config.MODEL_EN, device=device)
    
    logger.info(f"Загрузка модели для иврита ({config.MODEL_HE})...")
    tts_pipes['he'] = pipeline("text-to-speech", model=config.MODEL_HE, device=device)
    
    logger.info("Все языковые модели Meta MMS (RU, EN, HE) успешно загружены!")
except Exception as e:
    logger.exception(f"Ошибка загрузки моделей. Убедитесь, что они были скачаны ранее: {e}")

def resolve_language(speaker_id: str) -> str:
    """Определяет нужный язык на основе ID диктора/языка из фронтенда"""
    logger.info(f"[ENTER] resolve_language | params: speaker_id='{speaker_id}'")
    try:
        speaker_id_lower = speaker_id.lower()
        if speaker_id_lower in ["hebrew", "he", "he_il", "heb"]:
            result = "he"
        elif speaker_id_lower in ["english", "en", "en_us", "en_gb", "eng"]:
            result = "en"
        else:
            result = "ru" # По умолчанию русский
        logger.info(f"[EXIT] resolve_language | return: '{result}'")
        return result
    except Exception as e:
        logger.error(f"[EXIT ERROR] resolve_language | error: {e}")
        raise e

def generate_audio_bytes(text: str, lang: str):
    """Генерирует WAV-файл в памяти с помощью Meta MMS"""
    logger.info(f"[ENTER] generate_audio_bytes | params: text='{text}', lang='{lang}'")
    try:
        pipe = tts_pipes.get(lang)
        if not pipe:
            logger.error(f"Модель для языка '{lang}' не инициализирована.")
            raise ValueError(f"Модель для языка '{lang}' не инициализирована.")
        
        # ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        logger.info(f"Генерация | Язык: {lang} | Текст: '{text}'")

        # Генерация через пайплайн Meta MMS
        output = pipe(text)
        audio_data = output["audio"] 
        sampling_rate = output["sampling_rate"] # Обычно 16000 Гц для MMS
        
        # ПРОВЕРКА НА ТИШИНУ
        if audio_data.size == 0 or np.all(audio_data == 0):
            logger.warning(f"Модель {lang} сгенерировала тишину. Возможно, текст содержит недопустимые для языка символы.")
            raise ValueError(f"Модель {lang} сгенерировала тишину. Возможно, текст содержит недопустимые для языка символы.")

        # Нормализация и перевод в 16-bit PCM WAV
        audio_int16 = np.clip(audio_data.squeeze() * 32767.0, -32768.0, 32767.0).astype(np.int16)
        
        buffer = io.BytesIO()
        torchaudio.save(
            buffer, 
            torch.tensor(audio_int16).unsqueeze(0), 
            sampling_rate, 
            format="wav"
        )
        buffer.seek(0)
        logger.debug(f"Аудио успешно сгенерировано. Размер: {len(buffer.getvalue())} байт")
        
        result_bytes = buffer.read()
        logger.info(f"[EXIT] generate_audio_bytes | return: (audio_bytes len={len(result_bytes)}, sampling_rate={sampling_rate})")
        return result_bytes, sampling_rate
    except Exception as e:
        logger.error(f"[EXIT ERROR] generate_audio_bytes | error: {e}")
        raise e

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