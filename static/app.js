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
  language: 'pt-BR', // Primary default language: Português (BR)
  isRunning: false,
  isMicActive: false,
  isCameraActive: false,
  cameraStream: null,
  hadVideoInSession: false,
  videoObservations: [],
  secondsLeft: 300,
  timerInterval: null,
  recognition: null,
  isInputAllowed: false,
  
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
});

function toggleSimulationLanguage() {
  state.language = (state.language === 'en-US') ? 'pt-BR' : 'en-US';
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

  const typeTextEl = document.getElementById('btn-type-text');
  if (typeTextEl) typeTextEl.innerText = isEn ? 'Type' : 'Digitar';

  const endTextEl = document.getElementById('btn-end-text');
  if (endTextEl) endTextEl.innerText = isEn ? 'End Simulation' : 'Encerrar Simulação';

  const newSimTextEl = document.getElementById('btn-new-sim-text');
  if (newSimTextEl) newSimTextEl.innerText = isEn ? 'Start New Simulation' : 'Iniciar Nova Simulação';

  const historyTextEl = document.getElementById('btn-history-text');
  if (historyTextEl) historyTextEl.innerText = isEn ? 'View Session History' : 'Ver Histórico de Sessões';

  const cameraTextEl = document.getElementById('camera-text');
  if (cameraTextEl) {
    if (state.isCameraActive) {
      cameraTextEl.innerText = isEn ? 'Camera (On)' : 'Câmera (Ligada)';
    } else {
      cameraTextEl.innerText = isEn ? 'Camera (Off)' : 'Câmera (Desligada)';
    }
  }

  setUserInputEnabled(state.isInputAllowed);
}

function setUserInputEnabled(enabled, reason = '') {
  state.isInputAllowed = Boolean(enabled);
  const micBtn = document.getElementById('btn-mic');
  const typeBtn = document.getElementById('btn-type');
  const finishBtn = document.getElementById('btn-finish-speech');
  const isEn = (state.language === 'en-US');

  if (micBtn) {
    if (state.isInputAllowed) {
      micBtn.disabled = false;
      micBtn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
      micBtn.classList.add('hover:bg-slate-200');
      micBtn.title = isEn ? 'Click to speak' : 'Clique para falar no microfone';
    } else {
      micBtn.disabled = true;
      micBtn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
      micBtn.classList.remove('hover:bg-slate-200', 'bg-red-600', 'hover:bg-red-700', 'animate-pulse');
      micBtn.className = 'opacity-40 cursor-not-allowed pointer-events-none px-5 py-3 rounded-xl bg-slate-100 text-slate-700 text-[14px] font-medium transition-all flex items-center gap-2 border border-slate-200';
      const micIcon = document.getElementById('mic-icon');
      if (micIcon) micIcon.innerText = '🎙️';
      const micText = document.getElementById('mic-text');
      if (micText) micText.innerText = isEn ? 'Microphone' : 'Microfone';
      micBtn.title = reason || (isEn ? 'Wait for interviewer to speak' : 'Aguarde o entrevistador fazer a pergunta');
    }
  }

  if (typeBtn) {
    if (state.isInputAllowed) {
      typeBtn.disabled = false;
      typeBtn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
      typeBtn.classList.add('hover:bg-slate-200');
      typeBtn.title = isEn ? 'Click to type response' : 'Clique para digitar sua resposta';
    } else {
      typeBtn.disabled = true;
      typeBtn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
      typeBtn.classList.remove('hover:bg-slate-200');
      typeBtn.title = reason || (isEn ? 'Wait for interviewer to speak' : 'Aguarde o entrevistador fazer a pergunta');
    }
  }

  if (!state.isInputAllowed) {
    if (finishBtn) {
      finishBtn.classList.add('hidden');
      finishBtn.classList.remove('flex');
    }
    const modal = document.getElementById('modal-text-input');
    if (modal) modal.classList.add('hidden');
  }
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
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.currentTime = 0;
  }
  setSpeakingState(null);
  stopMic();

  // If leaving simulation stage, deactivate camera hardware stream
  if (stage !== 'one-on-one' && stage !== 'group' && state.isCameraActive) {
    toggleCamera();
  }

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
  if (state.dialogueHistory.length === 0) {
    setUserInputEnabled(false, isEn ? 'Wait for interviewer to ask opening question' : 'Aguarde o entrevistador fazer a primeira pergunta');
  }

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

    const domainBadge = document.getElementById('analysis-domain-badge');
    if (domainBadge) domainBadge.innerText = data.domain ? `ATS Ingestion • ${data.domain}` : 'ATS Ingestion Complete';

    const domainTitle = document.getElementById('analysis-domain-title');
    if (domainTitle) domainTitle.innerText = data.domain ? `${data.domain} Alignment Overview` : 'Resume Alignment Overview';

    const startBtnText = document.getElementById('btn-start-analysis-text');
    if (startBtnText) {
      startBtnText.innerText = data.interviewer_name 
        ? `Start 1:1 Interview with ${data.interviewer_name}` 
        : (data.domain ? `Start 1:1 Interview (${data.domain})` : 'Start 1:1 Technical Interview');
    }

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
  setUserInputEnabled(false, state.language === 'en-US' ? 'Awaiting opening question...' : 'Aguardando pergunta inicial do entrevistador...');
  toggleSimulation();
}

async function requestBotTurn(userMsg = '') {
  if (state.isTurnLoading) return;
  state.isTurnLoading = true;
  setUserInputEnabled(false, state.language === 'en-US' ? 'Interviewer is thinking...' : 'Entrevistador está pensando...');

  const expertName = (state.analysisContext && state.analysisContext.interviewer_name) || 'Carlos Mendes';
  const speakerIndicator = state.currentMode === 'one-on-one' ? expertName : 'Entrevistador';

  if (userMsg) {
    const isEn = (state.language === 'en-US');
    const captionSpeaker = document.getElementById('caption-speaker');
    if (captionSpeaker) captionSpeaker.innerText = isEn ? `${speakerIndicator} (Thinking...)` : `${speakerIndicator} (Analisando resposta...)`;
    const captionText = document.getElementById('caption-text');
    if (captionText) captionText.innerText = isEn ? 'Analyzing your answer and formulating the next challenge...' : 'Processando sua resposta...';
  }

  // Multimodal agentic snapshot: capture 1 compressed JPEG frame if camera is active
  const userSnapshot = (state.isCameraActive && userMsg) ? captureWebcamSnapshot() : null;

  try {
    const res = await fetch('/api/simulation/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: state.currentMode,
        dialogue_history: state.dialogueHistory,
        user_message: userMsg,
        user_image: userSnapshot,
        context: state.analysisContext,
        language: state.language || 'pt-BR'
      })
    });

    const bot = await res.json();
    setSpeakingState(bot.speaker_id);
    
    // Track agentic visual observations if returned
    if (bot.visual_observation) {
      state.videoObservations.push(bot.visual_observation);
      console.log("Agentic Vision Observation:", bot.visual_observation);
    }

    // 1. Instantly display live closed captions & dialogue on screen (0ms perceived delay)
    document.getElementById('caption-speaker').innerText = `${bot.speaker_name} (${bot.role})`;
    document.getElementById('caption-text').innerText = `"${bot.text}"`;

    appendDialogue(bot.speaker_id, bot.speaker_name, bot.avatar, bot.text);
    updateMetrics(bot.tokens_estimated || 45, bot.speaker_id, bot.text);

    // Keep input locked while bot audio is playing
    setUserInputEnabled(false, state.language === 'en-US' ? 'Interviewer is speaking...' : 'Entrevistador falando...');

    // 2. Play Neural Voice in background with immediate visual feedback
    speakText(bot.text, bot.speaker_id, () => {
      setSpeakingState(null);
      const isEn = (state.language === 'en-US');
      document.getElementById('caption-speaker').innerText = isEn ? 'Your Turn to Speak' : 'Sua vez de falar';
      document.getElementById('caption-text').innerText = isEn ? 'Speak into the microphone or click "Type" to reply.' : 'Fale no microfone ou clique em "Digitar" para responder.';
      // Interviewer finished asking question -> candidate may speak/type now!
      setUserInputEnabled(true);
    });
  } catch (err) {
    console.error("Erro no turno da simulação:", err);
    if (state.dialogueHistory.length > 0) {
      setUserInputEnabled(true);
    }
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
      setUserInputEnabled(false, state.language === 'en-US' ? 'Interviewer is preparing the opening question...' : 'Aguarde a pergunta inicial do entrevistador...');
      requestBotTurn('');
    }
  } else {
    btn.innerHTML = '<span>▶</span> <span>Resume</span>';
    btn.className = 'px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-medium transition shadow-md flex items-center gap-2';
    if (currentAudioPlayer) {
      currentAudioPlayer.pause();
      currentAudioPlayer.currentTime = 0;
    }
    setSpeakingState(null);
    setUserInputEnabled(false, state.language === 'en-US' ? 'Interview paused' : 'Entrevista pausada');
  }
}

function sendUserMessage() {
  const input = document.getElementById('user-text-input');
  const text = input.value.trim();
  if (!text) return;

  const modal = document.getElementById('modal-text-input');
  if (modal) modal.classList.add('hidden');
  setUserInputEnabled(false, state.language === 'en-US' ? 'Interviewer is analyzing your response...' : 'Entrevistador analisando sua resposta...');

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
  if (!state.isInputAllowed || state.dialogueHistory.length === 0 || state.isTurnLoading) {
    return;
  }
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

async function speakText(text, persona, callback) {
  const audioEnabled = document.getElementById('toggle-audio-synthesis')?.checked;
  if (!audioEnabled) {
    if (callback) setTimeout(callback, 600);
    return;
  }

  // Stop any previous audio
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.currentTime = 0;
  }

  try {
    const currentLang = state.language || 'en-US';
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
        URL.revokeObjectURL(audioUrl);
        if (callback) callback();
      };
      currentAudioPlayer.onerror = (err) => {
        console.warn("Audio playback error:", err);
        setSpeakingState(null);
        URL.revokeObjectURL(audioUrl);
        if (callback) callback();
      };

      await currentAudioPlayer.play();
    } else {
      if (callback) setTimeout(callback, 800);
    }
  } catch (err) {
    console.error("Erro no TTS Neural:", err);
    setSpeakingState(null);
    if (callback) setTimeout(callback, 800);
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

async function toggleCamera() {
  const btnCamera = document.getElementById('btn-camera');
  const camIcon = document.getElementById('camera-icon');
  const camText = document.getElementById('camera-text');
  const webcamContainer = document.getElementById('webcam-container');
  const webcamVideo = document.getElementById('webcam-preview');
  const avatarUser = document.getElementById('avatar-user');
  const videoBadge = document.getElementById('video-badge');
  const isEn = (state.language === 'en-US');

  if (state.isCameraActive) {
    // 1. Turn Camera OFF and cleanly stop hardware tracks
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      state.cameraStream = null;
    }
    if (webcamVideo) webcamVideo.srcObject = null;
    state.isCameraActive = false;

    if (webcamContainer) webcamContainer.classList.add('hidden');
    if (avatarUser) avatarUser.classList.remove('hidden');
    if (videoBadge) videoBadge.classList.add('hidden');

    if (btnCamera) {
      btnCamera.className = 'px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[14px] font-medium transition-all flex items-center gap-2 border border-slate-200';
    }
    if (camIcon) camIcon.innerText = '📷';
    if (camText) camText.innerText = isEn ? 'Camera (Off)' : 'Câmera (Desligada)';
  } else {
    // 2. Turn Camera ON with standard getUserMedia
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert(isEn ? 'Webcam is not supported on this browser.' : 'Câmera não suportada neste navegador.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      state.cameraStream = stream;
      state.isCameraActive = true;
      state.hadVideoInSession = true;

      if (webcamVideo) {
        webcamVideo.srcObject = stream;
        try { await webcamVideo.play(); } catch (e) {}
      }

      if (webcamContainer) webcamContainer.classList.remove('hidden');
      if (avatarUser) avatarUser.classList.add('hidden');
      if (videoBadge) videoBadge.classList.remove('hidden');

      if (btnCamera) {
        btnCamera.className = 'px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[14px] font-semibold transition-all flex items-center gap-2 shadow-md border border-indigo-500';
      }
      if (camIcon) camIcon.innerText = '📹';
      if (camText) camText.innerText = isEn ? 'Camera (On)' : 'Câmera (Ligada)';
    } catch (err) {
      console.error("Camera access error:", err);
      alert(isEn 
        ? "Unable to access webcam. Please check browser permissions." 
        : "Não foi possível acessar a câmera. Verifique as permissões de vídeo.");
    }
  }
}

function captureWebcamSnapshot() {
  if (!state.isCameraActive || !state.cameraStream) return null;
  const video = document.getElementById('webcam-preview');
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Returns data:image/jpeg;base64,... (~20-30KB compressed)
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch (err) {
    console.warn("Failed to capture snapshot:", err);
    return null;
  }
}

function toggleMicrophone() {
  if (!state.isInputAllowed || state.dialogueHistory.length === 0 || state.isTurnLoading) {
    console.warn("Speech input blocked: waiting for interviewer.");
    return;
  }

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

  // 1. Immediately stop simulation loop, timers, mic, camera and active audio
  state.isRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (currentAudioPlayer) {
    try {
      currentAudioPlayer.pause();
      currentAudioPlayer.currentTime = 0;
      currentAudioPlayer.src = '';
    } catch (e) {}
    currentAudioPlayer = null;
  }

  // Abort speech recognition immediately so it cannot receive any audio
  if (state.recognition) {
    try {
      state.recognition.abort();
    } catch (e) {}
  }
  stopMic();

  // Stop camera hardware tracks physically
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    state.cameraStream = null;
  }
  const webcamVideo = document.getElementById('webcam-preview');
  if (webcamVideo) webcamVideo.srcObject = null;
  state.isCameraActive = false;

  const webcamContainer = document.getElementById('webcam-container');
  if (webcamContainer) webcamContainer.classList.add('hidden');
  const avatarUser = document.getElementById('avatar-user');
  if (avatarUser) avatarUser.classList.remove('hidden');
  const videoBadge = document.getElementById('video-badge');
  if (videoBadge) videoBadge.classList.add('hidden');

  const btnCamera = document.getElementById('btn-camera');
  if (btnCamera) {
    btnCamera.className = 'px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[14px] font-medium transition-all flex items-center gap-2 border border-slate-200';
  }
  const camIcon = document.getElementById('camera-icon');
  if (camIcon) camIcon.innerText = '📷';
  const camText = document.getElementById('camera-text');
  if (camText) camText.innerText = (state.language === 'en-US') ? 'Camera (Off)' : 'Câmera (Desligada)';

  // Disable user input completely
  setUserInputEnabled(false, (state.language === 'en-US') ? 'Simulation ended' : 'Simulação encerrada');

  const modal = document.getElementById('modal-text-input');
  if (modal) modal.classList.add('hidden');

  const drawer = document.getElementById('transcript-drawer');
  if (drawer) {
    drawer.classList.add('hidden');
    drawer.classList.remove('flex');
  }

  setSpeakingState(null);

  const startBtn = document.getElementById('btn-start-sim');
  if (startBtn) {
    startBtn.innerHTML = '<span class="text-emerald-400">▶</span> <span id="btn-start-sim-text">Start</span>';
    startBtn.className = 'px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-semibold transition-all shadow-md flex items-center gap-2';
  }

  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) timerDisplay.innerText = '05:00';

  // 2. Snapshot current dialogue and video observations to evaluate before clearing
  const sessionDialogue = [...state.dialogueHistory];
  const sessionHadVideo = state.hadVideoInSession;
  const sessionVideoObs = [...state.videoObservations];
  
  // If no dialogue took place, simply reset and open a new session directly
  if (sessionDialogue.length === 0) {
    state.isEvaluating = false;
    startNewInterview();
    return;
  }

  // Show Scorecard view with loading indicator
  switchStage('report');
  document.getElementById('overall-score-display').innerHTML = `<span class="animate-pulse text-2xl font-mono text-slate-400">${state.language === 'en-US' ? 'Evaluating...' : 'Avaliando...'}</span>`;

  try {
    const res = await fetch('/api/evaluate-simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dialogue_history: sessionDialogue,
        job_context: state.analysisContext,
        user_id: state.userId,
        had_video: sessionHadVideo,
        video_observations: sessionVideoObs,
        language: state.language || 'pt-BR'
      })
    });
    
    const evalData = await res.json();
    
    // Update Scorecard with Real AI evaluation
    const cvMatch = state.analysisContext ? state.analysisContext.match_score : 85;
    const cvMatchEl = document.getElementById('scorecard-cv-match');
    if (cvMatchEl) cvMatchEl.innerText = `${cvMatch}%`;

    document.getElementById('overall-score-display').innerHTML = `${evalData.overall_score.toFixed(1)}<span class="text-lg text-slate-400 font-medium">/10</span>`;
    
    // 1. FAANG Decision Matrix & Seniority Calibration
    const recBadge = document.getElementById('rec-badge');
    const seniorityDisplay = document.getElementById('seniority-display');
    const salaryDisplay = document.getElementById('salary-display');
    const summaryText = document.getElementById('eval-summary-text');

    const rec = evalData.recommendation || (evalData.overall_score >= 8.5 ? "Strong Hire" : evalData.overall_score >= 7.0 ? "Hire" : evalData.overall_score >= 5.5 ? "Lean Hire" : "Lean No Hire");
    if (recBadge) {
      recBadge.innerText = rec;
      if (rec === "Strong Hire") {
        recBadge.className = 'px-4 py-1.5 rounded-xl text-sm font-extrabold uppercase tracking-wider font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm';
      } else if (rec === "Hire") {
        recBadge.className = 'px-4 py-1.5 rounded-xl text-sm font-extrabold uppercase tracking-wider font-mono bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm';
      } else if (rec === "Lean Hire") {
        recBadge.className = 'px-4 py-1.5 rounded-xl text-sm font-extrabold uppercase tracking-wider font-mono bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm';
      } else {
        recBadge.className = 'px-4 py-1.5 rounded-xl text-sm font-extrabold uppercase tracking-wider font-mono bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm';
      }
    }

    if (seniorityDisplay) seniorityDisplay.innerText = evalData.seniority_level_estimated || "Senior Software Engineer (L5)";
    if (salaryDisplay) salaryDisplay.innerText = evalData.market_salary_estimate || "$125,000 - $155,000 / yr";
    if (summaryText) summaryText.innerText = evalData.summary || "";

    // 2. Advanced Seniority Diagnostics (Trade-off, STAR, Signal-to-Noise)
    const tradeoffScore = evalData.trade_off_score ?? 6.5;
    const starScore = evalData.star_method_score ?? 6.0;
    const snrScore = evalData.signal_to_noise_score ?? 7.0;

    const elTradeoffScore = document.getElementById('tradeoff-score');
    const elTradeoffBar = document.getElementById('tradeoff-bar');
    const elTradeoffFeedback = document.getElementById('tradeoff-feedback');
    if (elTradeoffScore) elTradeoffScore.innerText = `${tradeoffScore.toFixed(1)} / 10`;
    if (elTradeoffBar) elTradeoffBar.style.width = `${Math.min(tradeoffScore * 10, 100)}%`;
    if (elTradeoffFeedback) elTradeoffFeedback.innerText = evalData.trade_off_feedback || "Demonstrated reasonable balance of technical trade-offs.";

    const elStarScore = document.getElementById('star-score');
    const elStarBar = document.getElementById('star-bar');
    const elStarFeedback = document.getElementById('star-feedback');
    if (elStarScore) elStarScore.innerText = `${starScore.toFixed(1)} / 10`;
    if (elStarBar) elStarBar.style.width = `${Math.min(starScore * 10, 100)}%`;
    if (elStarFeedback) elStarFeedback.innerText = evalData.star_method_feedback || "Included situation and actions; could emphasize measurable outcomes.";

    const elSnrScore = document.getElementById('snr-score');
    const elSnrBar = document.getElementById('snr-bar');
    const elSnrFeedback = document.getElementById('snr-feedback');
    if (elSnrScore) elSnrScore.innerText = `${snrScore.toFixed(1)} / 10`;
    if (elSnrBar) elSnrBar.style.width = `${Math.min(snrScore * 10, 100)}%`;
    if (elSnrFeedback) elSnrFeedback.innerText = evalData.signal_to_noise_feedback || "Direct communication with high technical signal.";

    // 3. Forensic Moments (Peak vs Critical Gap)
    if (evalData.peak_moment) {
      const elPeakBadge = document.getElementById('peak-turn-badge');
      const elPeakQuote = document.getElementById('peak-quote');
      const elPeakAnalysis = document.getElementById('peak-analysis');
      if (elPeakBadge) elPeakBadge.innerText = `Turn ${evalData.peak_moment.turn_index || 1}`;
      if (elPeakQuote) elPeakQuote.innerText = `"${evalData.peak_moment.quote || ''}"`;
      if (elPeakAnalysis) elPeakAnalysis.innerText = evalData.peak_moment.analysis || '';
    }

    if (evalData.critical_gap_moment) {
      const elGapBadge = document.getElementById('gap-turn-badge');
      const elGapQuote = document.getElementById('gap-quote');
      const elGapAnalysis = document.getElementById('gap-analysis');
      if (elGapBadge) elGapBadge.innerText = `Turn ${evalData.critical_gap_moment.turn_index || 2}`;
      if (elGapQuote) elGapQuote.innerText = `"${evalData.critical_gap_moment.quote || ''}"`;
      if (elGapAnalysis) elGapAnalysis.innerText = evalData.critical_gap_moment.analysis || '';
    }

    // 4. Shadow Answer Coaching
    const shadowContainer = document.getElementById('shadow-coaching-container');
    if (shadowContainer) {
      if (evalData.shadow_coaching && evalData.shadow_coaching.length > 0) {
        shadowContainer.innerHTML = evalData.shadow_coaching.map(item => `
          <div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-blue-300 font-mono">Turn ${item.turn_index} Comparison</span>
              <span class="text-[11px] text-slate-400">FAANG Bar Raiser Calibration</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div class="p-3 rounded-xl bg-slate-950/70 border border-red-500/20 flex flex-col gap-1">
                <span class="text-[10.5px] uppercase tracking-wider font-bold text-rose-400">What You Answered:</span>
                <p class="text-slate-300 italic">"${item.user_answer}"</p>
              </div>
              <div class="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col gap-1">
                <span class="text-[10.5px] uppercase tracking-wider font-bold text-emerald-400">Principal Engineer Rewrite:</span>
                <p class="text-emerald-100 font-medium">"${item.senior_rewrite}"</p>
              </div>
            </div>
            <div class="flex items-center gap-2 pt-1 text-[12px] text-slate-300 bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-800/30">
              <span class="text-amber-400 font-bold">💡 Key Takeaway:</span>
              <span>${item.key_takeaway}</span>
            </div>
          </div>
        `).join('');
      } else {
        shadowContainer.innerHTML = `
          <p class="text-xs text-slate-400 italic">Your answers demonstrated solid technical depth across the board.</p>
        `;
      }
    }

    // 5. Agentic Video Understanding feedback in Scorecard
    const visualCard = document.getElementById('visual-presence-card');
    const visualScoreEl = document.getElementById('visual-score-display');
    const visualFeedbackEl = document.getElementById('visual-feedback-display');

    if (evalData.visual_presence_score != null && visualCard) {
      if (visualScoreEl) visualScoreEl.innerText = `${evalData.visual_presence_score.toFixed(1)} / 10`;
      if (visualFeedbackEl) visualFeedbackEl.innerText = evalData.visual_presence_feedback || "Candidate maintained positive composure and steady engagement throughout the video interview.";
      visualCard.classList.remove('hidden');
    } else if (visualCard) {
      visualCard.classList.add('hidden');
    }

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
        recommendation: rec,
        seniorityLevel: evalData.seniority_level_estimated,
        salaryEstimate: evalData.market_salary_estimate,
        summary: evalData.summary,
        skills: evalData.skills,
        tradeOffScore: evalData.trade_off_score,
        starScore: evalData.star_method_score,
        snrScore: evalData.signal_to_noise_score,
        peakMoment: evalData.peak_moment,
        gapMoment: evalData.critical_gap_moment,
        shadowCoaching: evalData.shadow_coaching,
        hadVideo: sessionHadVideo,
        visualPresenceScore: evalData.visual_presence_score,
        visualPresenceFeedback: evalData.visual_presence_feedback,
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
    state.hadVideoInSession = false;
    state.videoObservations = [];
    // Clear live transcript feed for next session
    state.dialogueHistory = [];
    state.secondsLeft = 300;
    const feed = document.getElementById('dialogue-feed');
  }
}

function startNewInterview() {
  // 1. Immediately terminate and clean up all ongoing streams & timers
  state.isRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (currentAudioPlayer) {
    try {
      currentAudioPlayer.pause();
      currentAudioPlayer.currentTime = 0;
      currentAudioPlayer.src = '';
    } catch (e) {}
    currentAudioPlayer = null;
  }
  if (state.recognition) {
    try { state.recognition.abort(); } catch (e) {}
  }
  stopMic();

  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    state.cameraStream = null;
  }
  const webcamVideo = document.getElementById('webcam-preview');
  if (webcamVideo) webcamVideo.srcObject = null;
  state.isCameraActive = false;

  const webcamContainer = document.getElementById('webcam-container');
  if (webcamContainer) webcamContainer.classList.add('hidden');
  const avatarUser = document.getElementById('avatar-user');
  if (avatarUser) avatarUser.classList.remove('hidden');
  const videoBadge = document.getElementById('video-badge');
  if (videoBadge) videoBadge.classList.add('hidden');

  const btnCamera = document.getElementById('btn-camera');
  if (btnCamera) {
    btnCamera.className = 'px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[14px] font-medium transition-all flex items-center gap-2 border border-slate-200';
  }
  const camIcon = document.getElementById('camera-icon');
  if (camIcon) camIcon.innerText = '📷';
  const camText = document.getElementById('camera-text');
  if (camText) camText.innerText = (state.language === 'en-US') ? 'Camera (Off)' : 'Câmera (Desligada)';

  setSpeakingState(null);

  // 2. Reset simulation state and metrics
  state.dialogueHistory = [];
  state.secondsLeft = 300;
  state.isTurnLoading = false;
  state.hadVideoInSession = false;
  state.videoObservations = [];
  state.totalTokens = 0;
  state.totalCostUSD = 0;
  state.userWords = 0;
  state.botWords = { carlos: 0 };
  state.isInputAllowed = false;

  // 3. Reset DOM elements
  const feed = document.getElementById('dialogue-feed');
  if (feed) feed.innerHTML = '';

  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) timerDisplay.innerText = '05:00';

  const startBtn = document.getElementById('btn-start-sim');
  if (startBtn) {
    startBtn.innerHTML = '<span class="text-emerald-400">▶</span> <span id="btn-start-sim-text">Start</span>';
    startBtn.className = 'px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-semibold transition-all shadow-md flex items-center gap-2';
  }

  const modal = document.getElementById('modal-text-input');
  if (modal) modal.classList.add('hidden');

  const drawer = document.getElementById('transcript-drawer');
  if (drawer) {
    drawer.classList.add('hidden');
    drawer.classList.remove('flex');
  }

  setUserInputEnabled(false, state.language === 'en-US' ? 'Click Start to begin interview' : 'Clique em Iniciar para começar');

  // Reset diagnostic panel
  const formContainer = document.getElementById('cv-form-container');
  if (formContainer) formContainer.classList.remove('hidden');
  const resultPanel = document.getElementById('analysis-result-panel');
  if (resultPanel) {
    resultPanel.classList.add('hidden');
    resultPanel.classList.remove('flex');
  }

  // 4. Return to Diagnostic stage
  switchStage('cv');
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

  feed.innerHTML = list.map(item => {
    const rec = item.recommendation;
    let recBadgeHtml = '';
    if (rec) {
      const recColor = rec.includes('Strong Hire') ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300' :
                       rec.includes('Hire') ? 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-300' :
                       rec.includes('Lean Hire') ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300' :
                       'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-300';
      recBadgeHtml = `<span class="micro-label ${recColor} px-2 py-0.5 rounded border font-mono font-bold">${rec}</span>`;
    }

    return `
    <div class="card-frame p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col gap-4 shadow-sm relative overflow-hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <span class="text-2xl">👨‍💻</span>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white">${item.mode || '1:1 Technical Interview'}</h4>
              <span class="micro-label ${item.overallScore >= 7 ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' : 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200'} px-2 py-0.5 rounded border font-mono">
                Grade: ${item.overallScore.toFixed(1)} / 10
              </span>
              ${recBadgeHtml}
              ${item.seniorityLevel ? `
                <span class="micro-label text-slate-700 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded border font-mono">
                  ${item.seniorityLevel}
                </span>
              ` : ''}
              ${item.hadVideo ? `
                <span class="micro-label text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded border font-mono">
                  📹 Video: ${(item.visualPresenceScore || 0).toFixed(1)}/10
                </span>
              ` : ''}
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
        ${item.hadVideo && item.visualPresenceFeedback ? `
          <div class="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col gap-1 text-xs">
            <div class="flex items-center justify-between text-indigo-900 dark:text-indigo-200 font-bold">
              <span class="flex items-center gap-1.5"><span>📹</span> Multimodal Video Feedback:</span>
              <span class="font-mono">${(item.visualPresenceScore || 0).toFixed(1)}/10</span>
            </div>
            <p class="text-indigo-800 dark:text-indigo-300 text-[11.5px] leading-relaxed">${item.visualPresenceFeedback}</p>
          </div>
        ` : ''}

        ${item.shadowCoaching && item.shadowCoaching.length > 0 ? `
          <div class="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col gap-2 text-xs">
            <span class="font-bold text-blue-300 flex items-center gap-1.5"><span>🎓</span> Shadow Coaching (Senior Rewrite):</span>
            <div class="p-2.5 rounded-lg bg-slate-950/80 border border-emerald-500/20 text-emerald-200 italic">
              "${item.shadowCoaching[0].senior_rewrite}"
            </div>
            <span class="text-[11px] text-slate-400">💡 <strong>Lesson:</strong> ${item.shadowCoaching[0].key_takeaway}</span>
          </div>
        ` : ''}

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
    `;
  }).join('');
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
