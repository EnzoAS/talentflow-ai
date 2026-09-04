// Generate or retrieve persistent Anonymous User Session ID
function getOrCreateUserId() {
  let uid = localStorage.getItem('talentflow_user_id');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem('talentflow_user_id', uid);
  }
  return uid;
}

const state = {
  userId: getOrCreateUserId(),
  currentStage: 'landing',
  currentMode: 'one-on-one',
  language: 'en-US', // Primary default language: English (US)
  isRunning: false,
  isMicActive: false,
  secondsLeft: 300,
  timerInterval: null,
  recognition: null,
  
  totalTokens: 0,
  totalCostUSD: 0,
  userWords: 0,
  botWords: { carlos: 0 },
  dialogueHistory: [],
  analysisContext: null,
  selectedJobIndex: 0
};

const jobsData = [
  {
    company: "Fintech Nexus",
    title: "Tech Lead / Senior Fullstack",
    salary: "$120,000 - $160,000 / year",
    desc: "Technical leadership of engineering squads delivering high-throughput real-time payment solutions and resilient microservices architecture.",
    tags: ["TypeScript", "Next.js", "Tech Leadership", "Node.js"]
  },
  {
    company: "HealthTech SaaS",
    title: "Senior Software Engineer",
    salary: "$110,000 - $140,000 / year",
    desc: "Architecting high-scale REST APIs, real-time telemetry, and distributed microservices on Google Cloud Platform.",
    tags: ["Node.js", "REST APIs", "Cloud Architecture"]
  },
  {
    company: "CloudScale AI",
    title: "AI Engineer / Backend Specialist",
    salary: "$130,000 - $170,000 / year",
    desc: "Developing scalable LLM pipelines, autonomous multi-agent systems, and robust RAG architectures in Python.",
    tags: ["Python", "FastAPI", "LLMs", "System Design"]
  }
];

document.addEventListener('DOMContentLoaded', () => {
  setupKeyboardShortcuts();
  switchStage('landing');
  updateLanguageUI();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      // Pre-select and lock the single interviewer voice if simulation has not started
      if (!state.isRunning && state.dialogueHistory.length === 0) {
        lockedInterviewerVoice = null;
        getLockedInterviewerVoice();
      }
    };
  }
});

function toggleSimulationLanguage() {
  state.language = (state.language === 'en-US') ? 'pt-BR' : 'en-US';
  lockedInterviewerVoice = null;
  lockedInterviewerLang = null;
  getLockedInterviewerVoice();
  updateLanguageUI();

  // If mic is currently running, restart with the new language model
  if (state.isMicActive && state.recognition) {
    stopMic();
    setTimeout(() => {
      toggleMicrophone();
    }, 200);
  }
}

function updateLanguageUI() {
  const isEn = (state.language === 'en-US');
  const flagEl = document.getElementById('lang-flag');
  if (flagEl) flagEl.innerText = isEn ? '🇺🇸' : '🇧🇷';
  const textEl = document.getElementById('lang-text');
  if (textEl) textEl.innerText = isEn ? 'English (US)' : 'Português (BR)';

  const btn = document.getElementById('btn-lang-toggle');
  if (btn) {
    btn.className = isEn 
      ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-2 text-xs font-semibold transition cursor-pointer'
      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-2 text-xs font-semibold transition cursor-pointer';
  }

  // Update button finish text
  const finishTextEl = document.getElementById('btn-finish-text');
  if (finishTextEl) finishTextEl.innerText = isEn ? 'Finish Speaking' : 'Concluir Fala';
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key >= '1' && e.key <= '4') {
      const stages = ['cv', 'one-on-one', 'report', 'history'];
      switchStage(stages[parseInt(e.key) - 1]);
    }
  });
}

function switchStage(stage) {
  state.currentStage = stage;
  window.speechSynthesis.cancel();
  setSpeakingState(null);
  stopMic();

  const headerSteps = document.getElementById('header-steps');
  if (headerSteps) {
    if (stage === 'landing') {
      headerSteps.classList.add('hidden');
      headerSteps.classList.remove('flex');
    } else {
      headerSteps.classList.remove('hidden');
      headerSteps.classList.add('flex');
    }
  }

  ['cv', 'one-on-one', 'report', 'history'].forEach(s => {
    const btn = document.getElementById(`tab-${s}`);
    if (btn) {
      if (s === stage) {
        btn.className = 'px-3.5 py-1.5 rounded-lg transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs shadow-sm';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium';
      }
    }
  });

  ['stage-landing', 'stage-cv', 'stage-simulation', 'stage-report', 'stage-history'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('flex', 'fade-enter');
      // trigger reflow to restart animation
      void el.offsetWidth;
    }
  });

  const showStage = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('flex', 'fade-enter');
    }
  };

  if (stage === 'landing') {
    showStage('stage-landing');
  } else if (stage === 'cv') {
    showStage('stage-cv');
  } else if (stage === 'one-on-one' || stage === 'group') {
    state.currentMode = 'one-on-one';
    showStage('stage-simulation');
    setupSimulationUI('one-on-one');
  } else if (stage === 'report') {
    showStage('stage-report');
    renderRadarChart();
  } else if (stage === 'history') {
    showStage('stage-history');
    renderHistoryUI();
  }
}

let radarChartInstance = null;
function renderRadarChart(customScores = null, customLabels = null) {
  const ctx = document.getElementById('skillsRadarChart');
  if (!ctx) return;
  
  if (radarChartInstance) {
    radarChartInstance.destroy();
  }

  const labels = customLabels || ['Leadership & Mediation', 'Assertive Communication', 'CV Gap Defense', 'Time & Focus'];
  const scores = customScores || state.lastSkillsScores || [4.0, 4.0, 4.0, 4.0];
  const targetScores = [8.0, 8.0, 8.0, 8.0];

  radarChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Your Performance',
        data: scores,
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
        borderColor: 'rgba(16, 185, 129, 1)',
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2.5,
      }, {
        label: 'Role Target',
        data: targetScores,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        borderColor: 'rgba(148, 163, 184, 0.6)',
        pointBackgroundColor: 'rgba(148, 163, 184, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(148, 163, 184, 1)',
        borderWidth: 2,
        borderDash: [4, 4]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 0,
          max: 10,
          angleLines: { color: 'rgba(0,0,0,0.08)' },
          grid: { color: 'rgba(0,0,0,0.08)' },
          pointLabels: {
            font: { size: 10.5, family: 'Inter, sans-serif', weight: '600' },
            color: '#334155'
          },
          ticks: { display: false, stepSize: 2 }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 7,
            font: { size: 11, family: 'Inter, sans-serif', weight: '500' },
            padding: 16
          }
        }
      }
    }
  });
}

function renderAvatar(elementId, avatarData, fallbackEmoji = '👨‍💻') {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (avatarData && (avatarData.startsWith('http://') || avatarData.startsWith('https://'))) {
    el.innerHTML = `<img src="${avatarData}" alt="Avatar" class="w-full h-full object-cover rounded-2xl" onerror="this.outerHTML='<span class=\\'text-4xl\\'>${fallbackEmoji}</span>'" />`;
  } else {
    el.innerHTML = `<span class="text-4xl">${avatarData || fallbackEmoji}</span>`;
  }
}

function setupSimulationUI(mode) {
  const ctx = state.analysisContext || {};
  const expertName = ctx.interviewer_name || 'Carlos Mendes';
  const expertRole = ctx.interviewer_role || 'Senior Tech Lead';
  const expertAvatar = ctx.interviewer_avatar || '👨‍💻';
  const domainName = ctx.domain || 'Software Engineering';

  const subEl = document.getElementById('context-subtitle');
  if (subEl) subEl.innerText = `1:1 Executive Interview • ${domainName}`;
  const titleEl = document.getElementById('context-title');
  if (titleEl) titleEl.innerText = `Interview with ${expertName}`;

  const nameEl = document.getElementById('name-carlos');
  if (nameEl) nameEl.innerText = expertName;
  const roleEl = document.getElementById('role-carlos');
  if (roleEl) roleEl.innerText = expertRole;

  renderAvatar('avatar-carlos', expertAvatar, '👨‍💻');
  renderAvatar('avatar-user', '🧑‍💼', '🧑‍💼');

  const isEn = (state.language === 'en-US');
  if (!state.isRunning && state.dialogueHistory.length === 0) {
    const captionSpeaker = document.getElementById('caption-speaker');
    if (captionSpeaker) captionSpeaker.innerText = `${expertName} (${expertRole})`;
    const captionText = document.getElementById('caption-text');
    if (captionText) captionText.innerText = isEn
      ? `Click "▶ Start" below to begin the 1:1 technical interview with ${expertName}.`
      : `Clique em "▶ Start" para começar a entrevista técnica 1:1 com ${expertName}.`;
  }
}

function loadSampleData() {
  document.getElementById('cv-input').value = `SENIOR FULLSTACK SOFTWARE ENGINEER
- 5+ years architecting scalable web apps with TypeScript, React, Next.js, and Node.js.
- Designed high-throughput microservices and integrated PostgreSQL & Redis caching.
- Spearheaded CI/CD pipelines, Docker containerization, and unit test automation.
- Mentored mid-level developers and led agile sprint ceremonies.`;

  document.getElementById('job-input').value = `ROLE: TECH LEAD / SENIOR SOFTWARE ENGINEER
- Deep expertise in TypeScript, Node.js, Next.js, and distributed cloud systems.
- Proven track record in technical squad leadership and crisis management.
- Strong background in high-availability microservices and database failover strategies.
- Excellent communication and conflict-resolution skills in cross-functional teams.`;
}

function triggerPdfUpload() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.docx,.txt';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const btn = document.getElementById('btn-upload-pdf');
      btn.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400">✅ Anexado: ${file.name}</span>`;
      
      const cvArea = document.getElementById('cv-input');
      cvArea.value = `[ARQUIVO ANEXADO: ${file.name}]\n\nO conteúdo deste documento será extraído e analisado pela IA no servidor ao clicar em 'Analisar Compatibilidade'.`;
      cvArea.classList.add('bg-emerald-50/30', 'dark:bg-emerald-900/10', 'border-emerald-300', 'dark:border-emerald-700/50');
    }
  };
  input.click();
}

async function analyzeCVAndJob() {
  const cv = document.getElementById('cv-input').value.trim();
  const job = document.getElementById('job-input').value.trim();

  if (!cv || !job) {
    alert('Please enter or generate your resume and target job description.');
    return;
  }

  const btn = document.getElementById('btn-run-analysis');
  btn.innerHTML = '<span>Analyzing Profile...</span>';
  btn.disabled = true;

  try {
    const res = await fetch('/api/analyze-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cv_text: cv, job_text: job })
    });

    const data = await res.json();
    state.analysisContext = data;

    document.getElementById('ats-score-display').innerText = `${data.match_score}%`;
    document.getElementById('analysis-summary-text').innerText = data.summary;

    document.getElementById('present-keywords').innerHTML = data.present_keywords.map(k => 
      `<span class="micro-label bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-mono">${k}</span>`
    ).join('');

    document.getElementById('missing-keywords').innerHTML = data.missing_keywords.map(k => 
      `<span class="micro-label bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-mono">${k}</span>`
    ).join('');

    document.getElementById('analysis-focus-text').innerText = data.simulation_focus;

    updateMetrics(160, 'analysis', 'cv_ats_run');

    document.getElementById('cv-form-container').classList.add('hidden');
    
    const resultPanel = document.getElementById('analysis-result-panel');
    resultPanel.classList.remove('hidden');
    resultPanel.classList.add('flex', 'fade-enter');
  } catch (err) {
    console.error(err);
  } finally {
    btn.innerHTML = '<span>Analyze Match & Gaps</span>';
    btn.disabled = false;
  }
}

function startSimulationFromAnalysis(mode) {
  switchStage(mode);
  toggleSimulation();
}

async function requestBotTurn(userMsg = '') {
  if (state.isTurnLoading) return;
  state.isTurnLoading = true;

  const expertName = (state.analysisContext && state.analysisContext.interviewer_name) || 'Carlos Mendes';
  const speakerIndicator = state.currentMode === 'one-on-one' ? expertName : 'Entrevistador';

  if (userMsg) {
    const isEn = (state.language === 'en-US');
    const captionSpeaker = document.getElementById('caption-speaker');
    if (captionSpeaker) captionSpeaker.innerText = isEn ? `${speakerIndicator} (Thinking...)` : `${speakerIndicator} (Analisando resposta...)`;
    const captionText = document.getElementById('caption-text');
    if (captionText) captionText.innerText = isEn ? 'Analyzing your answer and formulating the next challenge...' : 'Processando sua resposta...';
  }

  try {
    const res = await fetch('/api/simulation/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: state.currentMode,
        dialogue_history: state.dialogueHistory,
        user_message: userMsg,
        context: state.analysisContext
      })
    });

    const bot = await res.json();
    setSpeakingState(bot.speaker_id);
    
    // 1. Instantly display live closed captions & dialogue on screen (0ms perceived delay)
    document.getElementById('caption-speaker').innerText = `${bot.speaker_name} (${bot.role})`;
    document.getElementById('caption-text').innerText = `"${bot.text}"`;

    appendDialogue(bot.speaker_id, bot.speaker_name, bot.avatar, bot.text);
    updateMetrics(bot.tokens_estimated || 45, bot.speaker_id, bot.text);

    // 2. Play Neural Voice in background with immediate visual feedback
    speakText(bot.text, bot.speaker_id, () => {
      setSpeakingState(null);
      const isEn = (state.language === 'en-US');
      document.getElementById('caption-speaker').innerText = isEn ? 'Your Turn to Speak' : 'Sua vez de falar';
      document.getElementById('caption-text').innerText = isEn ? 'Speak into the microphone or click "Type" to reply.' : 'Fale no microfone ou clique em "Digitar Fala" para responder.';
    });
  } catch (err) {
    console.error("Erro no turno da simulação:", err);
  } finally {
    state.isTurnLoading = false;
  }
}

function toggleSimulation() {
  state.isRunning = !state.isRunning;
  const btn = document.getElementById('btn-start-sim');

  if (state.isRunning) {
    btn.innerHTML = '<span>⏸️</span> <span>Pause</span>';
    btn.className = 'px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[13px] font-medium transition shadow-md flex items-center gap-2';
    
    if (!state.timerInterval) {
      state.timerInterval = setInterval(() => {
        if (state.secondsLeft > 0) {
          state.secondsLeft--;
          const min = String(Math.floor(state.secondsLeft / 60)).padStart(2, '0');
          const sec = String(state.secondsLeft % 60).padStart(2, '0');
          document.getElementById('timer-display').innerText = `${min}:${sec}`;
        } else {
          clearInterval(state.timerInterval);
          finishSimulationAndGenerateReport();
        }
      }, 1000);
    }

    if (state.dialogueHistory.length === 0) {
      requestBotTurn('');
    }
  } else {
    btn.innerHTML = '<span>▶</span> <span>Resume</span>';
    btn.className = 'px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-medium transition shadow-md flex items-center gap-2';
    window.speechSynthesis.cancel();
    setSpeakingState(null);
  }
}

function sendUserMessage() {
  const input = document.getElementById('user-text-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  setSpeakingState('user');
  
  document.getElementById('caption-speaker').innerText = 'You (Candidate)';
  document.getElementById('caption-text').innerText = `"${text}"`;

  appendDialogue('user', 'You (Candidate)', '🧑‍💼', text);
  updateMetrics(Math.round(text.length / 3), 'user', text);

  // Immediate send with zero delay
  requestBotTurn(text);
}

function insertQuickResponse(text) {
  document.getElementById('user-text-input').value = text;
  sendUserMessage();
}

function toggleTextInputModal() {
  const modal = document.getElementById('modal-text-input');
  modal.classList.toggle('hidden');
  if (!modal.classList.contains('hidden')) {
    document.getElementById('user-text-input').focus();
  }
}

function toggleTranscriptDrawer() {
  const drawer = document.getElementById('transcript-drawer');
  drawer.classList.toggle('hidden');
  drawer.classList.toggle('flex');
}

let currentAudioPlayer = null;
let lockedInterviewerVoice = null;
let lockedInterviewerLang = null;

function getLockedInterviewerVoice() {
  const currentLang = state.language || 'en-US';

  // If already locked for this language and valid, strictly reuse the exact same voice
  if (lockedInterviewerVoice && lockedInterviewerLang === currentLang) {
    return lockedInterviewerVoice;
  }

  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const isEn = (currentLang === 'en-US');
  const langPrefix = isEn ? 'en' : 'pt';
  const matchingVoices = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(langPrefix));

  if (matchingVoices.length === 0) {
    lockedInterviewerVoice = voices[0];
    lockedInterviewerLang = currentLang;
    return lockedInterviewerVoice;
  }

  let selectedVoice = null;

  if (isEn) {
    // Lock onto ONE consistent male voice for Carlos Mendes in English
    // Priority: Guy -> Christopher -> Andrew -> Brian -> David -> Mark -> George -> any male
    const preferredMaleNames = ['guy', 'christopher', 'andrew', 'brian', 'david', 'mark', 'george', 'ryan'];
    for (const name of preferredMaleNames) {
      selectedVoice = matchingVoices.find(v => v.name.toLowerCase().includes(name));
      if (selectedVoice) break;
    }

    // If preferred male name not explicitly found, filter out explicitly female voices
    if (!selectedVoice) {
      selectedVoice = matchingVoices.find(v => {
        const n = v.name.toLowerCase();
        return !n.includes('female') && !n.includes('zira') && !n.includes('jenny') && !n.includes('aria') && !n.includes('susan') && !n.includes('hazel') && !n.includes('linda');
      });
    }
  } else {
    // Lock onto ONE consistent male voice in Portuguese
    const preferredPtNames = ['antonio', 'daniel', 'fabio', 'julio'];
    for (const name of preferredPtNames) {
      selectedVoice = matchingVoices.find(v => v.name.toLowerCase().includes(name));
      if (selectedVoice) break;
    }
  }

  if (!selectedVoice) {
    selectedVoice = matchingVoices[0];
  }

  lockedInterviewerVoice = selectedVoice;
  lockedInterviewerLang = currentLang;
  console.log(`[TTS Voice Locked] Single interviewer voice locked to: "${selectedVoice.name}" (${selectedVoice.lang})`);
  return lockedInterviewerVoice;
}

function speakText(text, persona, callback) {
  const audioEnabled = document.getElementById('toggle-audio-synthesis')?.checked;
  if (!audioEnabled) {
    if (callback) setTimeout(callback, 800);
    return;
  }

  const currentLang = state.language || 'en-US';

  // 1. Prioritize browser-native SpeechSynthesis for INSTANT (0ms) zero-latency playback with ONE locked voice
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    if (currentAudioPlayer) {
      currentAudioPlayer.pause();
      currentAudioPlayer.currentTime = 0;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLang;
    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    // Strictly enforce the single locked voice
    const lockedVoice = getLockedInterviewerVoice();
    if (lockedVoice) {
      utterance.voice = lockedVoice;
      utterance.lang = lockedVoice.lang;
    }

    utterance.onstart = () => {
      setSpeakingState(persona);
    };

    utterance.onend = () => {
      setSpeakingState(null);
      if (callback) callback();
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      setSpeakingState(null);
      if (callback) callback();
    };

    window.speechSynthesis.speak(utterance);
    return;
  }

  // 2. Fallback to /api/tts only if browser has no speechSynthesis
  fallbackFetchTTS(text, persona, currentLang, callback);
}

async function fallbackFetchTTS(text, persona, lang, callback) {
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.currentTime = 0;
  }

  try {
    const currentLang = lang || state.language || 'en-US';
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker_id: persona, lang: currentLang })
    });

    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudioPlayer = new Audio(audioUrl);
      
      currentAudioPlayer.onplay = () => {
        setSpeakingState(persona);
      };
      currentAudioPlayer.onended = () => {
        setSpeakingState(null);
        if (callback) callback();
      };
      currentAudioPlayer.onerror = () => {
        setSpeakingState(null);
        if (callback) callback();
      };

      currentAudioPlayer.play();
    } else {
      if (callback) setTimeout(callback, 1000);
    }
  } catch (err) {
    console.error("Erro no TTS Neural fallback:", err);
    if (callback) setTimeout(callback, 1000);
  }
}

function setSpeakingState(speakerId) {
  const isCarlosSpeaking = (speakerId === 'expert' || speakerId === 'carlos');
  const isUserSpeaking = (speakerId === 'user');

  const cardCarlos = document.getElementById('card-carlos');
  if (cardCarlos) {
    if (isCarlosSpeaking) {
      cardCarlos.classList.add('border-blue-600', 'ring-2', 'ring-blue-100');
    } else {
      cardCarlos.classList.remove('border-blue-600', 'ring-2', 'ring-blue-100');
    }
  }

  const cardUser = document.getElementById('card-user');
  if (cardUser) {
    if (isUserSpeaking) {
      cardUser.classList.add('border-blue-600', 'ring-2', 'ring-blue-100');
    } else {
      cardUser.classList.remove('border-blue-600', 'ring-2', 'ring-blue-100');
    }
  }
}

function appendDialogue(speaker, name, avatar, text) {
  const feed = document.getElementById('dialogue-feed');
  const msg = document.createElement('div');
  msg.className = `p-2.5 rounded bg-slate-50 border border-slate-200 flex flex-col gap-0.5 text-xs`;

  msg.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="micro-label ${speaker === 'user' ? 'text-blue-600' : 'text-slate-700'}">${name}</span>
      <span class="text-[9px] text-slate-400 font-mono">${new Date().toLocaleTimeString().slice(3,8)}</span>
    </div>
    <p class="text-slate-800 mt-0.5">${text}</p>
  `;

  feed.appendChild(msg);
  feed.scrollTop = feed.scrollHeight;
  state.dialogueHistory.push({ speaker, name, text });
}

function updateMetrics(addedTokens, speaker, text) {
  state.totalTokens += addedTokens;
  state.totalCostUSD = (state.totalTokens / 1000000) * 0.15;
  const costEl = document.getElementById('cost-badge');
  if (costEl) {
    costEl.innerText = `$${state.totalCostUSD.toFixed(4)}`;
  }
}

function toggleMicrophone() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Speech recognition is not supported in this browser. Please use Google Chrome or click the "Type" button.');
    return;
  }

  if (state.isMicActive) {
    // If mic is already recording, clicking the mic button again sends the message immediately
    finishSpeechAndSend();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SpeechRecognition();
  
  // Explicitly use state.language (defaults to 'en-US' English)
  state.recognition.lang = state.language || 'en-US';
  state.recognition.continuous = true;
  state.recognition.interimResults = true;

  accumulatedFinalText = '';
  currentInterimText = '';
  isUserExplicitStop = false;

  state.recognition.onstart = () => {
    state.isMicActive = true;
    
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) {
      micBtn.className = 'px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold transition flex items-center gap-2 animate-pulse shadow-md border border-red-500';
    }
    const micIcon = document.getElementById('mic-icon');
    if (micIcon) micIcon.innerText = '🔴';
    const micText = document.getElementById('mic-text');
    if (micText) micText.innerText = (state.language === 'en-US') ? 'Recording...' : 'Gravando...';

    // Show explicit 'Finish / Concluir' button
    const finishBtn = document.getElementById('btn-finish-speech');
    if (finishBtn) {
      finishBtn.classList.remove('hidden');
      finishBtn.classList.add('flex');
    }

    setSpeakingState('user');
    const isEn = (state.language === 'en-US');
    const capSpeaker = document.getElementById('caption-speaker');
    if (capSpeaker) capSpeaker.innerText = isEn ? 'You (Candidate) • Microphone Active' : 'Você (Candidato) • Microfone Aberto';
    const capText = document.getElementById('caption-text');
    if (capText) capText.innerText = isEn 
      ? 'Listening in English... Speak freely. (Click "Finish Speaking" or pause for 4s to submit)' 
      : 'Ouvindo em Português... Fale com tranquilidade. (Clique em "Concluir Fala" ou faça uma pausa de 4s para enviar)';
  };

  state.recognition.onresult = (event) => {
    currentInterimText = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        accumulatedFinalText += (accumulatedFinalText ? ' ' : '') + transcript.trim();
      } else {
        currentInterimText += transcript;
      }
    }

    const fullCurrentText = (accumulatedFinalText + ' ' + currentInterimText).trim();
    if (fullCurrentText) {
      const capSpeaker = document.getElementById('caption-speaker');
      if (capSpeaker) capSpeaker.innerText = 'Você (Candidato)';
      const capText = document.getElementById('caption-text');
      if (capText) capText.innerText = `"${fullCurrentText}"`;
      
      const userTextEl = document.getElementById('user-text-input');
      if (userTextEl) userTextEl.value = fullCurrentText;

      // Generous silence threshold: 4.0s pause before auto-submitting
      if (speechSilenceTimer) clearTimeout(speechSilenceTimer);
      speechSilenceTimer = setTimeout(() => {
        if (state.isMicActive) {
          finishSpeechAndSend();
        }
      }, 4000);
    }
  };

  state.recognition.onend = () => {
    // If browser stops recognition unexpectedly while user is still in speaking mode
    if (state.isMicActive && !isUserExplicitStop) {
      try {
        state.recognition.start();
        return;
      } catch (e) {
        console.warn("Speech recognition restart note:", e);
      }
    }
    stopMic();
  };

  state.recognition.onerror = (e) => {
    console.warn("Speech error:", e.error);
    if (e.error === 'no-speech') {
      // User hasn't spoken yet; keep mic open and listening
      return;
    }
    stopMic();
  };

  try {
    state.recognition.start();
  } catch (err) {
    console.error("Erro ao iniciar SpeechRecognition:", err);
    stopMic();
  }
}

let speechSilenceTimer = null;
let accumulatedFinalText = '';
let currentInterimText = '';
let isUserExplicitStop = false;

function finishSpeechAndSend() {
  isUserExplicitStop = true;
  if (speechSilenceTimer) {
    clearTimeout(speechSilenceTimer);
    speechSilenceTimer = null;
  }

  const finalMessage = (accumulatedFinalText + ' ' + currentInterimText).trim();
  stopMic();

  if (finalMessage) {
    const userTextEl = document.getElementById('user-text-input');
    if (userTextEl) userTextEl.value = finalMessage;
    sendUserMessage();
  } else {
    setSpeakingState(null);
    const isEn = (state.language === 'en-US');
    const capSpeaker = document.getElementById('caption-speaker');
    if (capSpeaker) capSpeaker.innerText = isEn ? 'Your Turn to Speak' : 'Sua vez de falar';
    const capText = document.getElementById('caption-text');
    if (capText) capText.innerText = isEn 
      ? 'No speech detected. Click Microphone or Type to reply.' 
      : 'Nenhuma fala detectada. Clique no Microfone ou em Digitar para responder.';
  }
}

function stopMic() {
  state.isMicActive = false;
  if (speechSilenceTimer) {
    clearTimeout(speechSilenceTimer);
    speechSilenceTimer = null;
  }
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }

  const micBtn = document.getElementById('btn-mic');
  if (micBtn) {
    micBtn.className = 'px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[14px] font-medium transition-all flex items-center gap-2 border border-slate-200';
  }
  const micIcon = document.getElementById('mic-icon');
  if (micIcon) micIcon.innerText = '🎙️';
  const micText = document.getElementById('mic-text');
  if (micText) micText.innerText = 'Microfone';

  const finishBtn = document.getElementById('btn-finish-speech');
  if (finishBtn) {
    finishBtn.classList.add('hidden');
    finishBtn.classList.remove('flex');
  }
}

async function finishSimulationAndGenerateReport() {
  if (state.isEvaluating) return; // Prevent double invocation
  state.isEvaluating = true;

  // 1. Immediately stop simulation loop, timers, mic and active audio
  state.isRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.currentTime = 0;
  }
  stopMic();
  setSpeakingState(null);

  const startBtn = document.getElementById('btn-start-sim');
  if (startBtn) {
    startBtn.innerHTML = '<span>▶</span> <span>Start</span>';
    startBtn.className = 'px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-semibold transition-all shadow-md flex items-center gap-2';
  }

  // 2. Snapshot current dialogue to evaluate before clearing
  const sessionDialogue = [...state.dialogueHistory];
  
  // Show Scorecard view with loading indicator
  switchStage('report');
  document.getElementById('overall-score-display').innerHTML = `<span class="animate-pulse text-2xl font-mono text-slate-400">Evaluating...</span>`;

  try {
    const res = await fetch('/api/evaluate-simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dialogue_history: sessionDialogue,
        job_context: state.analysisContext,
        user_id: state.userId
      })
    });
    
    const evalData = await res.json();
    
    // Update Scorecard with Real AI evaluation
    const cvMatch = state.analysisContext ? state.analysisContext.match_score : 85;
    const cvMatchEl = document.getElementById('scorecard-cv-match');
    if (cvMatchEl) cvMatchEl.innerText = `${cvMatch}%`;

    document.getElementById('overall-score-display').innerHTML = `${evalData.overall_score.toFixed(1)}<span class="text-lg text-slate-400 font-medium">/10</span>`;
    
    if (evalData.skills && evalData.skills.length > 0) {
      evalData.skills.forEach((skill, idx) => {
        const scoreEl = document.getElementById(`skill-score-${idx}`);
        const barEl = document.getElementById(`skill-bar-${idx}`);
        const feedbackEl = document.getElementById(`skill-feedback-${idx}`);
        
        if (scoreEl) scoreEl.innerText = `${skill.score.toFixed(1)} / 10`;
        if (barEl) barEl.style.width = `${Math.min(skill.score * 10, 100)}%`;
        if (feedbackEl) feedbackEl.innerText = skill.feedback;
      });
      
      // Save session to Local Storage for Persistent History
      const historyItem = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        mode: '1:1 Technical Interview',
        overallScore: evalData.overall_score,
        summary: evalData.summary,
        skills: evalData.skills,
        dialogue: sessionDialogue
      };

      saveSessionToHistory(historyItem);
      
      // Update Radar Chart data dynamically with 100% exact alignment
      const scores = evalData.skills.map(s => s.score);
      const labels = evalData.skills.map(s => s.name);
      state.lastSkillsScores = scores;
      renderRadarChart(scores, labels);
    }
  } catch (err) {
    console.error("Erro na avaliação:", err);
  } finally {
    state.isEvaluating = false;
    // Clear live transcript feed for next session
    state.dialogueHistory = [];
    state.secondsLeft = 300;
    const feed = document.getElementById('dialogue-feed');
    if (feed) feed.innerHTML = '';
  }
}

function saveSessionToHistory(session) {
  try {
    const list = JSON.parse(localStorage.getItem('talentflow_history') || '[]');
    list.unshift(session); // most recent first
    localStorage.setItem('talentflow_history', JSON.stringify(list));
  } catch (e) {
    console.error("Erro ao salvar histórico local:", e);
  }
}

function renderHistoryUI() {
  const feed = document.getElementById('history-feed');
  if (!feed) return;
  
  const list = JSON.parse(localStorage.getItem('talentflow_history') || '[]');
  
  if (list.length === 0) {
    feed.innerHTML = `
      <div class="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center">
        <span class="text-4xl mb-3">📜</span>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">No interview sessions recorded yet</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Complete a live 1:1 interview and click 'End Simulation' to save your executive review and full transcript here.</p>
        <button onclick="switchStage('cv')" class="mt-4 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 transition">
          Start New Simulation
        </button>
      </div>
    `;
    return;
  }

  feed.innerHTML = list.map(item => `
    <div class="card-frame p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col gap-4 shadow-sm relative overflow-hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <span class="text-2xl">👨‍💻</span>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white">${item.mode || '1:1 Technical Interview'}</h4>
              <span class="micro-label ${item.overallScore >= 7 ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' : 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200'} px-2 py-0.5 rounded border font-mono">
                Grade: ${item.overallScore.toFixed(1)} / 10
              </span>
            </div>
            <span class="text-[11px] text-slate-400 font-mono">${item.date}</span>
          </div>
        </div>
        <button onclick="toggleHistoryDetails(${item.id})" class="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium self-start sm:self-auto">
          View Details & Transcript ▾
        </button>
      </div>

      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
        "${item.summary || 'Simulation successfully completed with verified metrics.'}"
      </p>

      <!-- Expandable Details -->
      <div id="history-details-${item.id}" class="hidden flex-col gap-4 pt-2">
        <!-- Competencies -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${(item.skills || []).map(s => `
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col gap-1">
              <div class="flex justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span>${s.name}</span>
                <span class="font-mono text-blue-600 dark:text-blue-400">${s.score.toFixed(1)}/10</span>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">${s.feedback}</p>
            </div>
          `).join('')}
        </div>

        <!-- Full Transcript -->
        <div class="mt-2">
          <span class="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block mb-2">Full Dialogue Transcript:</span>
          <div class="max-h-60 overflow-y-auto bg-slate-100 dark:bg-slate-800 p-4 rounded-xl flex flex-col gap-2.5 text-xs font-mono">
            ${(item.dialogue || []).map(d => `
              <div>
                <span class="font-bold ${d.speaker === 'user' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}">${d.name}:</span>
                <span class="text-slate-700 dark:text-slate-300"> "${d.text}"</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleHistoryDetails(id) {
  const el = document.getElementById(`history-details-${id}`);
  if (el) {
    el.classList.toggle('hidden');
    el.classList.toggle('flex');
  }
}

function clearAllHistory() {
  if (confirm('Tem certeza que deseja apagar todo o histórico de simulações salvas?')) {
    localStorage.removeItem('talentflow_history');
    renderHistoryUI();
  }
}

function selectJob(idx) {
  state.selectedJobIndex = idx;
  const job = jobsData[idx];

  [0, 1, 2].forEach(i => {
    const el = document.getElementById(`job-card-${i}`);
    if (el) {
      if (i === idx) {
        el.className = 'bg-white border-2 border-slate-900 rounded-2xl p-5 cursor-pointer shadow-md relative overflow-hidden transition-all scale-[1.01]';
      } else {
        el.className = 'bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 cursor-pointer hover:shadow-sm transition-all';
      }
    }
  });

  const compEl = document.getElementById('detail-job-company');
  if (compEl) compEl.innerText = job.company;
  
  const titleEl = document.getElementById('detail-job-title');
  if (titleEl) titleEl.innerText = job.title;
  
  const salEl = document.getElementById('detail-job-salary');
  if (salEl) salEl.innerText = job.salary;
  
  const descEl = document.getElementById('detail-job-desc');
  if (descEl) descEl.innerText = job.desc;

  const tagsEl = document.getElementById('detail-job-tags');
  if (tagsEl) {
    tagsEl.innerHTML = job.tags.map(t => 
      `<span class="text-xs font-semibold bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 border border-slate-200">${t}</span>`
    ).join('');
  }
}

function switchMatchView(view) {
  const candView = document.getElementById('match-candidate-view');
  const recView = document.getElementById('match-recruiter-view');
  const btnCand = document.getElementById('view-mode-candidate');
  const btnRec = document.getElementById('view-mode-recruiter');

  if (view === 'candidate') {
    if (candView) candView.classList.remove('hidden');
    if (recView) recView.classList.add('hidden');
    if (btnCand) btnCand.className = 'flex-1 sm:flex-none px-4 py-2 rounded-lg bg-white text-slate-900 font-bold shadow-sm transition text-xs';
    if (btnRec) btnRec.className = 'flex-1 sm:flex-none px-4 py-2 rounded-lg text-slate-500 hover:text-slate-900 font-medium transition text-xs';
  } else {
    if (candView) candView.classList.add('hidden');
    if (recView) {
      recView.classList.remove('hidden');
      recView.classList.add('flex');
    }
    if (btnCand) btnCand.className = 'flex-1 sm:flex-none px-4 py-2 rounded-lg text-slate-500 hover:text-slate-900 font-medium transition text-xs';
    if (btnRec) btnRec.className = 'flex-1 sm:flex-none px-4 py-2 rounded-lg bg-white text-slate-900 font-bold shadow-sm transition text-xs';
  }
}

function applyJob(btn) {
  btn.innerText = '✅ Candidatura Enviada com Scorecard!';
  btn.className = 'w-full py-3 rounded-lg bg-emerald-600 text-white font-medium text-xs cursor-default shadow-sm';
  btn.disabled = true;
  alert('Candidatura enviada com sucesso! O recrutador recebeu seu Scorecard de 8.9/10.');
}
