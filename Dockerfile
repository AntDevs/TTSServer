# Используем официальный образ PyTorch с поддержкой CUDA 11.8 (совместимо с GTX 1060 / sm_61)
FROM pytorch/pytorch:2.2.0-cuda11.8-cudnn8-runtime

# Задаем рабочую директорию внутри контейнера
WORKDIR /app

# Устанавливаем системные библиотеки, необходимые для torchaudio, soundfile и pydub
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Копируем файл зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Заранее скачиваем модели Meta MMS и Whisper в кэш образа, чтобы оффлайн-режим работал корректно
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface/hub
RUN python -c "\
from transformers import pipeline; \
print('Downloading RU MMS...'); pipeline('text-to-speech', model='facebook/mms-tts-rus'); \
print('Downloading EN MMS...'); pipeline('text-to-speech', model='facebook/mms-tts-eng'); \
print('Downloading HE MMS...'); pipeline('text-to-speech', model='facebook/mms-tts-heb'); \
print('Downloading Whisper Small...'); pipeline('automatic-speech-recognition', model='openai/whisper-small'); \
"

# Копируем весь код проекта в контейнер (app, frontend, config.ini)
COPY . .

# Открываем порт, на котором работает сервер
EXPOSE 8000

ENV TRANSFORMERS_OFFLINE=1

# Запускаем Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]