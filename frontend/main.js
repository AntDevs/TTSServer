// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let visualizerInterval = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("[ENTER] DOMContentLoaded | params: none");
    openTab('tts'); 
    
    if (window.speechSynthesis) {
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