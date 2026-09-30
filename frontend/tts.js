// === ПЕРЕМЕННЫЕ TTS ===
const presets = {
    ru_short: "Привет! Это проверка синтеза речи.",
    he_sample: "מה נשתנה הלילה על ידי הזה מכל הלילות.",
    ru_long: "Синтез речи — это технология преобразования текста в голос.",
    en_sample: "Hello! This is a test for the text to speech server voice selection functionality."
};

let synth = window.speechSynthesis;
let voices = [];
let engineMode = 'browser';

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