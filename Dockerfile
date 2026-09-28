# Используем официальный образ PyTorch с поддержкой CUDA 11.8 (совместимо с GTX 1060 / sm_61)
FROM pytorch/pytorch:2.2.0-cuda11.8-cudnn8-runtime

# Задаем рабочую директорию внутри контейнера
WORKDIR /app

# Устанавливаем системные библиотеки, необходимые для torchaudio и soundfile
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Копируем файл зависимостей
# (создайте requirements.txt или оставьте RUN pip install как ниже)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Заранее скачиваем модели Meta MMS в кэш образа, чтобы оффлайн-режим работал корректно
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface/hub
RUN python -c "\
from transformers import pipeline; \
print('Downloading RU...'); pipeline('text-to-speech', model='facebook/mms-tts-rus'); \
print('Downloading EN...'); pipeline('text-to-speech', model='facebook/mms-tts-eng'); \
print('Downloading HE...'); pipeline('text-to-speech', model='facebook/mms-tts-heb'); \
"

# Копируем весь код проекта в контейнер (app, frontend, config.ini)
COPY . .

# Открываем порт, на котором работает сервер
EXPOSE 8000

# Запускаем Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]