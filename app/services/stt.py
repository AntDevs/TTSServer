import io
import os
import tempfile
import torch
import torchaudio
import logging
from typing import Dict, Any
from pydub import AudioSegment
from transformers import pipeline
import app.services.esp32 as esp32

# Правило 1: Уникальный логгер для модуля
logger = logging.getLogger("STT_Service")

def init_stt_model():
    """Инициализация модели Whisper при старте сервера"""
    logger.info("[ENTER] init_stt_model | params: none")
    try:
        device = 0 if torch.cuda.is_available() else -1
        pipe = pipeline(
            "automatic-speech-recognition", 
            model="openai/whisper-small", 
            device=device
        )
        logger.info("[EXIT] init_stt_model | return: Whisper model loaded successfully")
        return pipe
    except Exception as e:
        logger.error(f"[EXIT ERROR] init_stt_model | error: {e}")
        return None

# Загружаем модель один раз при импорте сервиса
logger.info("[ENTER] module stt.py | params: load stt_pipe")
try:
    stt_pipe = init_stt_model()
    logger.info("[EXIT] module stt.py | return: stt_pipe initialized")
except Exception as e:
    logger.error(f"[EXIT ERROR] module stt.py | error: {e}")
    stt_pipe = None

def transcribe_audio(audio_bytes: bytes) -> Dict[str, Any]:
    """Распознавание текста и языка из сырых аудио байтов через временный файл"""
    logger.info(f"[ENTER] transcribe_audio | params: audio_bytes_length={len(audio_bytes)}")
    
    tmp_in_path = None
    try:
        if not stt_pipe:
            raise RuntimeError("STT Pipeline was not initialized properly.")

        # Сохраняем байты на диск с расширением .ogg для корректного парсинга ffmpeg
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ogg") as tmp_in:
            tmp_in.write(audio_bytes)
            tmp_in_path = tmp_in.name

        # Правило 3: Чтение и конвертация аудио обернуты в try/except
        try:
            # Читаем аудио с физического диска
            audio_segment = AudioSegment.from_file(tmp_in_path)
            audio_segment = audio_segment.set_frame_rate(16000).set_channels(1)
            
            wav_buffer = io.BytesIO()
            audio_segment.export(wav_buffer, format="wav")
            wav_buffer.seek(0)
        except Exception as conv_e:
            logger.error(f"[ERROR] transcribe_audio | Audio format conversion failed: {conv_e}")
            raise ValueError(f"Ошибка конвертации аудиофайла: {conv_e}")

        # torchaudio читает стандартизированный WAV из памяти
        waveform, sample_rate = torchaudio.load(wav_buffer)
        audio_np = waveform.squeeze().numpy()

        # Распознавание текста с запросом языка напрямую из модели
        result = stt_pipe(audio_np, return_language=True)
        recognized_text = result.get("text", "").strip()

        # Извлечение языка (поддержка как прямого ключа, так и формата с chunks)
        raw_language = result.get("language")
        if not raw_language and "chunks" in result and len(result["chunks"]) > 0:
            raw_language = result["chunks"][0].get("language", "auto")
        if not raw_language:
            raw_language = "auto"
            
        # Маппинг названий языков модели (english -> en)
        lang_map = {
            "russian": "ru",
            "english": "en",
            "hebrew": "he"
        }
        detected_lang = lang_map.get(str(raw_language).lower(), raw_language)

        # Гость договорил, снимаем флаг отмены через глобальную переменную в ESP32-модуле
        if hasattr(esp32, 'is_speaking_cancelled'):
            esp32.is_speaking_cancelled = False 

        response_data = {
            "text": recognized_text,
            "language": detected_lang
        }

        logger.info(f"[EXIT] transcribe_audio | return: {response_data}")
        return response_data

    except Exception as e:
        logger.error(f"[EXIT ERROR] transcribe_audio | error: {e}")
        raise e
    finally:
        # Всегда очищаем файловую систему
        if tmp_in_path and os.path.exists(tmp_in_path):
            try:
                os.remove(tmp_in_path)
            except Exception as cleanup_e:
                logger.error(f"[EXIT ERROR] transcribe_audio cleanup | error: {cleanup_e}")