// Глобальные переменные TTS/STT
let visualizerInterval = null;
const presets = {
    ru_short: "Привет! Это проверка синтеза речи.",
    he_sample: "מה נשתנה הלילה על ידי הזה מכל הלילות.",
    ru_long: "Синтез речи — это технология преобразования текста в голос.",
    en_sample: "Hello! This is a test for the text to speech server voice selection functionality."
};

// Глобальные переменные для Микрофона и Браузерного TTS
let sttAudioBlob = null;
let currentSttMode = 'file';
let currentWavBlob = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;


let synth = window.speechSynthesis;
let voices = [];
let engineMode = 'browser';

document.addEventListener('DOMContentLoaded', () => {
    console.log("[ENTER] DOMContentLoaded | params: none");
    openTab('tts'); 
    
    if (synth) {
        populateVoiceList();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
    }
    console.log("[EXIT] DOMContentLoaded | return: success");
});

// === СИСТЕМА ТАБОВ ===
function openTab(tabName) {
    console.log(`[ENTER] openTab | params: tabName=${tabName}`);
    
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'border-slate-700', 'bg-slate-800');
        btn.classList.add('border-transparent', 'text-slate-400');
    });
    
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.add('active', 'border-slate-700', 'bg-slate-800');
        activeBtn.classList.remove('border-transparent', 'text-slate-400');
    }

    const panelContainer = document.getElementById('panel-content');
    const fileName = tabName === 'tts' ? 'tts_panel.html' : 'stt_panel.html';
    
    fetch(fileName)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(html => {
            panelContainer.innerHTML = html;
            if (tabName === 'tts') initTTS();
            console.log(`[EXIT] openTab | return: loaded ${fileName}`);
        })
        .catch(error => {
            console.error(`[EXIT ERROR] openTab | error: ${error.message}`);
            panelContainer.innerHTML = `<p class="text-rose-500 text-center">Ошибка загрузки: ${error.message}</p>`;
        });
}

// === ЛОГИКА TTS ===
function initTTS() {
    console.log("[ENTER] initTTS | params: none");
    const textarea = document.getElementById('ttsText');
    if(textarea) {
        textarea.value = presets.ru_short;
        textarea.addEventListener('input', () => {
            const countEl = document.getElementById('charCount');
            if(countEl) countEl.textContent = `${textarea.value.length} символов`;
        });
        const countEl = document.getElementById('charCount');
        if(countEl) countEl.textContent = `${textarea.value.length} символов`;
    }
    filterVoices();
    console.log("[EXIT] initTTS | return: success");
}

function setPreset(key) {
    console.log(`[ENTER] setPreset | params: key=${key}`);
    const textarea = document.getElementById('ttsText');
    if (presets[key] && textarea) {
        textarea.value = presets[key];
        const countEl = document.getElementById('charCount');
        if(countEl) countEl.textContent = `${textarea.value.length} символов`;
    }
    console.log("[EXIT] setPreset | return: success");
}

// Популяция голосов браузера
function populateVoiceList() {
    console.log("[ENTER] populateVoiceList | params: none");
    if (!synth) return;
    voices = synth.getVoices();
    filterVoices();
    console.log("[EXIT] populateVoiceList | return: success");
}

function filterVoices() {
    console.log("[ENTER] filterVoices | params: none");
    const langSelectElem = document.getElementById('langFilter');
    const browserGroup = document.getElementById('browserVoices');
    
    if (!browserGroup || !langSelectElem) return;
    const langFilter = langSelectElem.value;
    browserGroup.innerHTML = ''; 

    let filteredVoices = voices;
    if (langFilter !== 'all') {
        filteredVoices = voices.filter(v => v.lang.startsWith(langFilter));
    }

    if (filteredVoices.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "Голоса не найдены для выбранного фильтра";
        browserGroup.appendChild(opt);
        return;
    }

    filteredVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — [По умолчанию]' : ''}`;
        browserGroup.appendChild(option);
    });
    console.log("[EXIT] filterVoices | return: success");
}

function setEngineMode(mode) {
    console.log(`[ENTER] setEngineMode | params: mode=${mode}`);
    engineMode = mode;
    const browserBtn = document.getElementById('modeBrowserBtn');
    const serverBtn = document.getElementById('modeServerBtn');
    const serverConfig = document.getElementById('serverConfigSection');
    const customVoiceContainer = document.getElementById('customVoiceContainer');

    if (!browserBtn || !serverBtn) return;

    if (mode === 'browser') {
        browserBtn.className = "py-2 px-3 text-xs font-medium rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 flex items-center justify-center gap-1.5";
        serverBtn.className = "py-2 px-3 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5";
        if(serverConfig) serverConfig.classList.add('hidden');
        if(customVoiceContainer) customVoiceContainer.classList.add('hidden');
    } else {
        serverBtn.className = "py-2 px-3 text-xs font-medium rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 flex items-center justify-center gap-1.5";
        browserBtn.className = "py-2 px-3 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5";
        if(serverConfig) serverConfig.classList.remove('hidden');
        if(customVoiceContainer) customVoiceContainer.classList.remove('hidden');
    }
    console.log("[EXIT] setEngineMode | return: success");
}

function speakText() {
    console.log(`[ENTER] speakText | params: engineMode=${engineMode}`);
    const textarea = document.getElementById('ttsText');
    if (!textarea) return;
    const text = textarea.value.trim();
    
    if (!text) {
        alert('Пожалуйста, введите текст для воспроизведения');
        console.log("[EXIT ERROR] speakText | error: empty text");
        return;
    }

    stopSpeech(); 

    if (engineMode === 'browser') {
        speakBrowser(text);
    } else {
        speakServer(text);
    }
    console.log("[EXIT] speakText | return: success");
}

function speakBrowser(text) {
    console.log(`[ENTER] speakBrowser | params: text_length=${text.length}`);
    if (!synth) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const voiceSelectElem = document.getElementById('voiceSelect');
    const selectedVoiceName = voiceSelectElem ? voiceSelectElem.value : '';
    const selectedVoice = voices.find(v => v.name === selectedVoiceName);

    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    const rateElem = document.getElementById('rate');
    const pitchElem = document.getElementById('pitch');
    const volumeElem = document.getElementById('volume');

    if(rateElem) utterance.rate = parseFloat(rateElem.value);
    if(pitchElem) utterance.pitch = parseFloat(pitchElem.value);
    if(volumeElem) utterance.volume = parseFloat(volumeElem.value);

    utterance.onstart = () => {
        startVisualizer();
        addHistoryItem('historyList', 'Web Speech API', selectedVoice ? selectedVoice.name : 'По умолчанию', text);
    };

    utterance.onend = () => {
        stopVisualizer();
    };

    utterance.onerror = (e) => {
        stopVisualizer();
        console.error(`[EXIT ERROR] speakBrowser | error: ${e.error}`);
    };

    synth.speak(utterance);
    console.log("[EXIT] speakBrowser | return: success");
}

async function speakServer(text) {
    console.log(`[ENTER] speakServer | params: text_length=${text.length}`);
    const serverUrlElem = document.getElementById('serverUrl');
    const apiKeyElem = document.getElementById('apiKey');
    const formatElem = document.getElementById('audioFormat');
    const customVoiceElem = document.getElementById('customVoiceInput');
    const voiceSelectElem = document.getElementById('voiceSelect');

    const serverUrl = serverUrlElem ? serverUrlElem.value : 'http://localhost:8000/speak_stream';
    const apiKey = apiKeyElem ? apiKeyElem.value : '';
    const format = formatElem ? formatElem.value : 'mp3';
    let voiceId = customVoiceElem ? customVoiceElem.value.trim() : '';

    if (!voiceId) {
        voiceId = voiceSelectElem ? voiceSelectElem.value : 'default';
    }

    startVisualizer();
    updateStatus('Генерация TTS...', 'playing');

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                text: text,
                input: text,
                voice: voiceId,
                response_format: format,
                speed: document.getElementById('rate') ? parseFloat(document.getElementById('rate').value) : 1.0
            })
        });

        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const player = document.getElementById('audioPlayer');

        if(player) {
            player.src = audioUrl;
            if(document.getElementById('volume')) {
                player.volume = parseFloat(document.getElementById('volume').value);
            }
            player.onended = () => {
                updateStatus('Готов к работе', 'ready');
                stopVisualizer();
            };
            await player.play();
        }

        addHistoryItem('historyList', 'REST API Server', voiceId, text);
        updateStatus('Готов к работе', 'ready');
        console.log("[EXIT] speakServer | return: success");
    } catch (error) {
        console.error(`[EXIT ERROR] speakServer | error: ${error.message}`);
        updateStatus('Ошибка TTS', 'error');
        stopVisualizer();
        alert(`Не удалось получить аудио с сервера:\n${error.message}`);
    }
}

function pauseSpeech() {
    console.log("[ENTER] pauseSpeech | params: none");
    if (engineMode === 'browser' && synth) {
        if (synth.speaking && !synth.paused) {
            synth.pause();
            stopVisualizer();
        } else if (synth.paused) {
            synth.resume();
            startVisualizer();
        }
    } else {
        const player = document.getElementById('audioPlayer');
        if (player) {
            if (!player.paused) {
                player.pause();
                stopVisualizer();
            } else if (player.src) {
                player.play();
                startVisualizer();
            }
        }
    }
    console.log("[EXIT] pauseSpeech | return: success");
}

function stopSpeech() {
    console.log("[ENTER] stopSpeech | params: none");
    if (synth) synth.cancel();
    
    const player = document.getElementById('audioPlayer');
    if(player) {
        player.pause();
        player.currentTime = 0;
    }
    stopVisualizer();
    updateStatus('Готов к работе', 'ready');
    console.log("[EXIT] stopSpeech | return: success");
}

// === ЛОГИКА STT ===
function setSttMode(mode) {
    console.log(`[ENTER] setSttMode | params: mode=${mode}`);
    const fileMode = document.getElementById('sttFileMode');
    const micMode = document.getElementById('sttMicMode');
    const btnFile = document.getElementById('btnModeFile');
    const btnMic = document.getElementById('btnModeMic');

    if (!fileMode || !micMode) return;

    if (mode === 'file') {
        fileMode.classList.remove('hidden');
        micMode.classList.add('hidden');
        if(btnFile) btnFile.className = 'px-3 py-1 text-xs font-medium rounded bg-slate-700 text-slate-200 transition';
        if(btnMic) btnMic.className = 'px-3 py-1 text-xs font-medium rounded text-slate-400 hover:text-slate-200 transition';
    } else {
        fileMode.classList.add('hidden');
        micMode.classList.remove('hidden');
        if(btnFile) btnFile.className = 'px-3 py-1 text-xs font-medium rounded text-slate-400 hover:text-slate-200 transition';
        if(btnMic) btnMic.className = 'px-3 py-1 text-xs font-medium rounded bg-slate-700 text-slate-200 transition';
    }
    
    sttAudioBlob = null;
    const previewContainer = document.getElementById('sttPreviewContainer');
    if(previewContainer) previewContainer.classList.add('hidden');
    console.log("[EXIT] setSttMode | return: success");
}

function handleSttFileSelect(event) {
    console.log("[ENTER] handleSttFileSelect | params: event");
    try {
        const file = event.target.files[0];
        if (!file) return;

        sttAudioBlob = file;
        const display = document.getElementById('fileNameDisplay');
        if(display) {
            display.textContent = file.name;
            display.classList.add("text-emerald-400");
        }

        const previewContainer = document.getElementById('sttPreviewContainer');
        const previewAudio = document.getElementById('sttPreviewAudio');
        
        if(previewAudio && previewContainer) {
            previewAudio.src = URL.createObjectURL(file);
            previewContainer.classList.remove('hidden');
        }
        console.log(`[EXIT] handleSttFileSelect | return: loaded file ${file.name}`);
    } catch (error) {
        console.error(`[EXIT ERROR] handleSttFileSelect | error: ${error.message}`);
    }
}

// В функции toggleRecording обязательно проверяем наличие данных
async function toggleRecording() {
    console.log(`[ENTER] toggleRecording | params: isRecording=${isRecording}`);
    const btn = document.getElementById('btnRecord');
    const icon = document.getElementById('iconRecord');
    const statusText = document.getElementById('micStatusText');

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Выбираем лучший поддерживаемый формат браузером
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options = { mimeType: 'audio/webm;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                options = { mimeType: 'audio/ogg;codecs=opus' };
            }

            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                sttAudioBlob = new Blob(audioChunks, { type: mimeType });
                
                const previewAudio = document.getElementById('sttPreviewAudio');
                if (previewAudio) previewAudio.src = URL.createObjectURL(sttAudioBlob);
                const previewContainer = document.getElementById('sttPreviewContainer');
                if (previewContainer) previewContainer.classList.remove('hidden');
            };

            // Запрашиваем чанки каждые 250 мс для стабильного формирования файла
            mediaRecorder.start(250);
            isRecording = true;
            
            if (btn && icon && statusText) {
                btn.classList.replace('bg-rose-600/20', 'bg-rose-600');
                btn.classList.replace('text-rose-500', 'text-white');
                btn.classList.add('animate-pulse');
                icon.classList.replace('fa-microphone', 'fa-stop');
                statusText.textContent = 'Идет запись...';
                statusText.classList.replace('text-slate-400', 'text-rose-400');
            }
            updateStatus('Запись микрофона...', 'error');
            console.log("[EXIT] toggleRecording | return: recording started");
        } catch (error) {
            console.error(`[EXIT ERROR] toggleRecording | error: ${error.message}`);
            alert("Не удалось получить доступ к микрофону");
        }
    } else {
        try {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            
            if (btn && icon && statusText) {
                btn.classList.replace('bg-rose-600', 'bg-rose-600/20');
                btn.classList.replace('text-white', 'text-rose-500');
                btn.classList.remove('animate-pulse');
                icon.classList.replace('fa-stop', 'fa-microphone');
                statusText.textContent = 'Запись завершена';
                statusText.classList.replace('text-rose-400', 'text-emerald-400');
            }
            updateStatus('Готов к работе', 'ready');
            console.log("[EXIT] toggleRecording | return: recording stopped");
        } catch (error) {
            console.error(`[EXIT ERROR] toggleRecording | error: ${error.message}`);
        }
    }
}

async function recognizeAudio() {
    console.log("[ENTER] recognizeAudio | params: none");
    if (!sttAudioBlob) {
        alert("Пожалуйста, выберите файл или запишите аудио с микрофона.");
        console.log("[EXIT ERROR] recognizeAudio | error: no audio data");
        return;
    }

    // Проверка на минимальный размер файла (меньше 1 КБ — пустая или поврежденная запись)
    if (sttAudioBlob.size < 1000) {
        alert("Аудиозапись слишком короткая или пустая. Запишите звук дольше (минимум 1 секунда).");
        console.log(`[EXIT ERROR] recognizeAudio | error: blob size too small (${sttAudioBlob.size} bytes)`);
        return;
    }

    const urlElem = document.getElementById('sttUrl');
    const langSelectElem = document.getElementById('sttLangSelect');
    const resultBox = document.getElementById('sttResult');
    const badge = document.getElementById('detectedLangBadge');

    const url = urlElem ? urlElem.value : 'http://localhost:8000/listen';
    const langSelect = langSelectElem ? langSelectElem.value : 'auto';

    updateStatus('Распознавание...', 'playing');
    if (resultBox) resultBox.value = "Отправка аудио на сервер...";
    if (badge) badge.classList.add('hidden');

    try {
        const formData = new FormData();

        // Определяем расширение по реальному MIME-типу Blob
        let fileName = "audio.wav";
        if (sttAudioBlob.type.includes("webm")) {
            fileName = "audio.webm";
        } else if (sttAudioBlob.type.includes("ogg")) {
            fileName = "audio.ogg";
        }

        formData.append("file", sttAudioBlob, fileName);
        if (langSelect !== 'auto') {
            formData.append("language", langSelect);
        }

        const response = await fetch(url, {
            method: 'POST',
            body: formData 
        });

        const data = await response.json();
        if (response.ok && (data.status === "ok" || data.text)) {
            if (resultBox) resultBox.value = data.text;
            
            if (data.language && badge) {
                badge.textContent = `Lang: ${data.language}`;
                badge.classList.remove('hidden');
            }

            addHistoryItem('sttHistoryList', 'API STT', data.language || langSelect, data.text);
            updateStatus('Готов к работе', 'ready');
            console.log("[EXIT] recognizeAudio | return: text recognized");
        } else {
            throw new Error(data.detail || data.message || `Ошибка сервера (${response.status})`);
        }
    } catch (error) {
        console.error(`[EXIT ERROR] recognizeAudio | error: ${error.message}`);
        if (resultBox) resultBox.value = `Ошибка: ${error.message}`;
        updateStatus('Ошибка STT', 'error');
    }
}

async function recognizeAudio() {
    console.log("[ENTER] recognizeAudio | params: none");
    if (!sttAudioBlob) {
        alert("Пожалуйста, выберите файл или запишите аудио с микрофона.");
        console.log("[EXIT ERROR] recognizeAudio | error: no audio data");
        return;
    }

    const urlElem = document.getElementById('sttUrl');
    const langSelectElem = document.getElementById('sttLangSelect');
    const resultBox = document.getElementById('sttResult');
    const badge = document.getElementById('detectedLangBadge');

    const url = urlElem ? urlElem.value : '';
    const langSelect = langSelectElem ? langSelectElem.value : 'auto';

    updateStatus('Распознавание...', 'playing');
    if(resultBox) resultBox.value = "Отправка аудио на сервер...";
    if(badge) badge.classList.add('hidden');

    try {
        const formData = new FormData();

        // Определяем, это файл, выбранный пользователем, или запись с микрофона
        let fileName = "audio.wav"; // по умолчанию для режима file
        if (sttAudioBlob.type.includes("webm")) {
            fileName = "audio.webm";
        } else if (sttAudioBlob.type.includes("ogg")) {
            fileName = "audio.ogg";
        }

        formData.append("file", sttAudioBlob, fileName);
        if (langSelect !== 'auto') {
            formData.append("language", langSelect);
        }

        const response = await fetch(url, {
            method: 'POST',
            body: formData 
        });

        const data = await response.json();
        if (data.status === "ok" || data.text) {
            if(resultBox) resultBox.value = data.text;
            
            if (data.language && badge) {
                badge.textContent = `Lang: ${data.language}`;
                badge.classList.remove('hidden');
            }

            addHistoryItem('sttHistoryList', 'API STT', data.language || langSelect, data.text);
            updateStatus('Готов к работе', 'ready');
            console.log("[EXIT] recognizeAudio | return: text recognized");
        } else {
            throw new Error(data.message || "Ошибка сервера STT");
        }
    } catch (error) {
        console.error(`[EXIT ERROR] recognizeAudio | error: ${error.message}`);
        if(resultBox) resultBox.value = `Ошибка: ${error.message}`;
        updateStatus('Ошибка STT', 'error');
    }
}

// === ОБЩИЕ УТИЛИТЫ UI ===
function updateStatus(text, type) {
    const badge = document.getElementById('statusBadge');
    if(!badge) return;

    let colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    let dotClass = 'bg-emerald-400';

    if (type === 'playing') {
        colorClasses = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
        dotClass = 'bg-indigo-400';
    } else if (type === 'error') {
        colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        dotClass = 'bg-rose-400';
    }

    badge.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colorClasses}`;
    badge.innerHTML = `<span class="w-2 h-2 rounded-full ${dotClass} animate-pulse"></span> <span id="statusText">${text}</span>`;
}

function startVisualizer() {
    const bars = document.querySelectorAll('.waveform-bar');
    if (visualizerInterval) clearInterval(visualizerInterval);
    
    visualizerInterval = setInterval(() => {
        bars.forEach(bar => {
            const h = Math.floor(Math.random() * 28) + 6;
            bar.style.height = `${h}px`;
            bar.classList.replace('bg-indigo-500/40', 'bg-indigo-400');
        });
    }, 120);
}

function stopVisualizer() {
    if (visualizerInterval) clearInterval(visualizerInterval);
    const bars = document.querySelectorAll('.waveform-bar');
    bars.forEach(bar => {
        bar.style.height = '8px';
        bar.classList.replace('bg-indigo-400', 'bg-indigo-500/40');
    });
}

function addHistoryItem(listId, engine, subtitle, text) {
    console.log(`[ENTER] addHistoryItem | params: listId=${listId}`);
    const historyList = document.getElementById(listId);
    if (!historyList) return;
    
    if (historyList.querySelector('p.text-center')) {
        historyList.innerHTML = '';
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const item = document.createElement('div');
    item.className = 'bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1 hover:border-slate-600 transition';
    item.innerHTML = `
        <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-indigo-400">${engine}</span>
            <span class="text-slate-500 font-mono">${time}</span>
        </div>
        <div class="text-slate-300 font-semibold truncate text-xs">🎤 ${subtitle || 'auto'}</div>
        <p class="text-slate-400 truncate text-[11px] font-sans">"${text}"</p>
    `;

    historyList.prepend(item);
    console.log("[EXIT] addHistoryItem | return: success");
}

function clearHistory(listId) {
    console.log(`[ENTER] clearHistory | params: listId=${listId}`);
    const historyList = document.getElementById(listId);
    if(historyList) {
        historyList.innerHTML = '<p class="text-slate-500 text-center py-4">История пуста</p>';
    }
    console.log("[EXIT] clearHistory | return: success");
}

// Переключение интерфейса между файлом и микрофоном
function setSttMode(mode) {
    currentSttMode = mode;
    currentWavBlob = null;
    document.getElementById('sttPreviewContainer').classList.add('hidden');
    
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

// Обработка выбора файла (конвертация любого формата в WAV)
async function handleSttFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('fileNameDisplay').textContent = file.name;
    const arrayBuffer = await file.arrayBuffer();
    await processAudioBuffer(arrayBuffer);
}

// Запись с микрофона
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
                await processAudioBuffer(arrayBuffer); // Конвертируем запись в WAV
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

// Общая функция декодирования и конвертации в WAV
async function processAudioBuffer(arrayBuffer) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        currentWavBlob = audioBufferToWav(audioBuffer);
        
        // Подключение предпрослушивания
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

// Утилита для формирования структуры WAV файла
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
    view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size (16 для PCM)
    view.setUint16(offset, 1, true); offset += 2; // AudioFormat (1 для PCM)
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * 2 * numOfChan, true); offset += 4; // ByteRate
    view.setUint16(offset, numOfChan * 2, true); offset += 2; // BlockAlign
    view.setUint16(offset, 16, true); offset += 2; // BitsPerSample
    writeString('data');
    view.setUint32(offset, length - offset - 4, true); offset += 4;

    // Запись PCM данных
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

// Отправка WAV-байтов на сервер
async function recognizeAudio() {
    if (!currentWavBlob) {
        alert("Сначала выберите файл или запишите аудио.");
        return;
    }

    const url = document.getElementById('sttUrl').value;
    const btn = document.querySelector('button[onclick="recognizeAudio()"]');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Распознавание...';
        btn.disabled = true;

        // Эндпоинт /listen ожидает сырые байты, отправляем Blob напрямую в body
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'audio/wav'
            },
            body: currentWavBlob
        });

        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        
        const result = await response.json();
        document.getElementById('sttResult').value = result.text || "Текст не распознан";
        
        // Логирование успешного запроса в интерфейс
        addToHistory(`Успешно. Текст: ${result.text.substring(0, 20)}...`);
    } catch (error) {
        console.error("Ошибка при отправке:", error);
        document.getElementById('sttResult').value = `Ошибка: ${error.message}`;
        addToHistory(`Ошибка отправки`, true);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function addToHistory(message, isError = false) {
    const historyList = document.getElementById('sttHistoryList');
    if (historyList.innerHTML.includes('История пуста')) historyList.innerHTML = '';
    
    const p = document.createElement('p');
    p.className = `border-b border-slate-700/50 pb-1 ${isError ? 'text-rose-400' : 'text-emerald-400'}`;
    const time = new Date().toLocaleTimeString();
    p.innerHTML = `<span class="text-slate-500 mr-2">[${time}]</span> ${message}`;
    historyList.prepend(p);
}

function clearHistory() {
    document.getElementById('sttHistoryList').innerHTML = '<p class="text-slate-500 text-center py-4">История пуста</p>';
}
