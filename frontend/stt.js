// === ПЕРЕМЕННЫЕ STT ===
let currentSttMode = 'file';
let currentWavBlob = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// === ЛОГИКА STT ===
function setSttMode(mode) {
    currentSttMode = mode;
    currentWavBlob = null;
    document.getElementById('sttPreviewContainer').classList.add('hidden');
    
    // Прячем поле с языком при смене режима
    const langBadge = document.getElementById('detectedLangBadge');
    if (langBadge) langBadge.classList.add('hidden');
    
    if (mode === 'file') {
        document.getElementById('sttFileMode').classList.remove('hidden');
        document.getElementById('sttMicMode').classList.add('hidden');
        document.getElementById('btnModeFile').classList.replace('text-slate-400', 'text-slate-200');
        document.getElementById('btnModeFile').classList.replace('hover:text-slate-200', 'bg-slate-700');
        document.getElementById('btnModeMic').classList.replace('bg-slate-700', 'hover:text-slate-200');
        document.getElementById('btnModeMic').classList.replace('text-slate-200', 'text-slate-400');
    } else {
        document.getElementById('sttFileMode').classList.add('hidden');
        document.getElementById('sttMicMode').classList.remove('hidden');
        document.getElementById('btnModeMic').classList.replace('text-slate-400', 'text-slate-200');
        document.getElementById('btnModeMic').classList.replace('hover:text-slate-200', 'bg-slate-700');
        document.getElementById('btnModeFile').classList.replace('bg-slate-700', 'hover:text-slate-200');
        document.getElementById('btnModeFile').classList.replace('text-slate-200', 'text-slate-400');
    }
}

async function handleSttFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('fileNameDisplay').textContent = file.name;
    const arrayBuffer = await file.arrayBuffer();
    await processAudioBuffer(arrayBuffer);
}

async function toggleRecording() {
    const btn = document.getElementById('btnRecord');
    const status = document.getElementById('micStatusText');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();
                await processAudioBuffer(arrayBuffer);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('bg-rose-600', 'text-white', 'animate-pulse');
            status.textContent = "Идет запись...";
        } catch (err) {
            console.error("Ошибка доступа к микрофону:", err);
            status.textContent = "Ошибка микрофона";
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btn.classList.remove('bg-rose-600', 'text-white', 'animate-pulse');
        status.textContent = "Запись завершена, конвертация в WAV...";
    }
}

async function processAudioBuffer(arrayBuffer) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        currentWavBlob = audioBufferToWav(audioBuffer);
        
        const previewUrl = URL.createObjectURL(currentWavBlob);
        const previewAudio = document.getElementById('sttPreviewAudio');
        previewAudio.src = previewUrl;
        document.getElementById('sttPreviewContainer').classList.remove('hidden');
        
        if (currentSttMode === 'mic') {
            document.getElementById('micStatusText').textContent = "WAV готов к отправке";
        }
    } catch (e) {
        console.error("Ошибка декодирования аудио:", e);
        alert("Не удалось обработать аудиофайл.");
    }
}

function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numOfChan * 2 + 44;
    const outBuffer = new ArrayBuffer(length);
    const view = new DataView(outBuffer);
    let offset = 0;

    function writeString(str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
        offset += str.length;
    }

    writeString('RIFF');
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4; 
    view.setUint16(offset, 1, true); offset += 2; 
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * 2 * numOfChan, true); offset += 4; 
    view.setUint16(offset, numOfChan * 2, true); offset += 2; 
    view.setUint16(offset, 16, true); offset += 2; 
    writeString('data');
    view.setUint32(offset, length - offset - 4, true); offset += 4;

    const channelData = [];
    for (let i = 0; i < numOfChan; i++) channelData.push(buffer.getChannelData(i));
    
    let sample = 0;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
            sample = Math.max(-1, Math.min(1, channelData[channel][i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
    }
    return new Blob([outBuffer], { type: 'audio/wav' });
}

// Словарь для красивого отображения названия языка (убрано 'auto': 'Неизвестно')
const languageNames = {
    'ru': 'Русский',
    'en': 'English',
    'he': 'Hebrew'
};

async function recognizeAudio() {
    if (!currentWavBlob) {
        alert("Сначала выберите файл или запишите аудио.");
        return;
    }

    const url = document.getElementById('sttUrl').value;
    const btn = document.querySelector('button[onclick="recognizeAudio()"]');
    const originalText = btn.innerHTML;
    const langBadge = document.getElementById('detectedLangBadge');
    
    try {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Распознавание...';
        btn.disabled = true;
        if (langBadge) langBadge.classList.add('hidden'); // Скрываем поле перед новым запросом

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'audio/wav' },
            body: currentWavBlob
        });

        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        
        const result = await response.json();
        
        // Распаковка нового формата { status: "ok", data: { text: "...", language: "..." } }
        const responseData = result.data || result;
        const recognizedText = responseData.text || "Текст не распознан";
        const detectedLangCode = responseData.language; // Берем строго тот язык, который пришел

        document.getElementById('sttResult').value = recognizedText;
        
        // Обработка языка и отображение имени. Если языка нет в словаре — выведется сам код (без "Неизвестно")
        const detectedLangName = languageNames[detectedLangCode] || detectedLangCode;
        
        if (langBadge) {
            langBadge.innerHTML = `<i class="fa-solid fa-language"></i> Язык: ${detectedLangName}`;
            langBadge.classList.remove('hidden');
        }
        
        addToHistorySTT(`Успешно [${detectedLangCode}]. Текст: ${recognizedText.substring(0, 20)}...`);
    } catch (error) {
        console.error("Ошибка при отправке:", error);
        document.getElementById('sttResult').value = `Ошибка: ${error.message}`;
        addToHistorySTT(`Ошибка отправки`, true);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function addToHistorySTT(message, isError = false) {
    const historyList = document.getElementById('sttHistoryList');
    if (!historyList) return;
    if (historyList.innerHTML.includes('История пуста')) historyList.innerHTML = '';
    
    const p = document.createElement('p');
    p.className = `border-b border-slate-700/50 pb-1 ${isError ? 'text-rose-400' : 'text-emerald-400'}`;
    const time = new Date().toLocaleTimeString();
    p.innerHTML = `<span class="text-slate-500 mr-2">[${time}]</span> ${message}`;
    historyList.prepend(p);
}