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
  currentMode: 'group',
  isRunning: false,
  isMicActive: false,
  secondsLeft: 300,
  timerInterval: null,
  recognition: null,
  
  totalTokens: 0,
  totalCostUSD: 0,
  userWords: 0,
  botWords: { sofia: 0, carlos: 0, beatriz: 0, rodrigo: 0 },
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
    company: "Community & Peers",
    title: "Group Practice Dynamics",
    salary: "Open Community",
    desc: "Collaborate with over 40 pre-vetted engineers to practice live technical cases and group dynamic simulations.",
    tags: ["Networking", "Case Study", "Teamwork"]
  }
];

document.addEventListener('DOMContentLoaded', () => {
  setupKeyboardShortcuts();
  switchStage('landing');
});

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key >= '1' && e.key <= '5') {
      const stages = ['cv', 'group', 'one-on-one', 'report', 'match'];
      switchStage(stages[parseInt(e.key) - 1]);
    }
  });
}

function switchStage(stage) {
  state.currentStage = stage;
  window.speechSynthesis.cancel();
  setSpeakingState(null);

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

  ['cv', 'group', 'one-on-one', 'report', 'history'].forEach(s => {
    const btn = document.getElementById(`tab-${s}`);
    if (btn) {
      if (s === stage) {
        btn.className = 'px-3.5 py-1.5 rounded-lg transition-colors bg-white text-slate-900 font-bold text-xs shadow-sm';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-lg transition-colors text-slate-600 hover:text-slate-900 text-xs font-medium';
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
  } else if (stage === 'group' || stage === 'one-on-one') {
    state.currentMode = stage;
    showStage('stage-simulation');
    setupSimulationUI(stage);
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

function setupSimulationUI(mode) {
  const ctx = state.analysisContext || {};
  const expertName = ctx.interviewer_name || 'Executive Interviewer';
  const expertAvatar = ctx.interviewer_avatar || '👨‍💼';
  const domainName = ctx.domain || 'Domain Strategy';
  const grid = document.getElementById('call-grid');

  if (mode === 'one-on-one') {
    document.getElementById('context-subtitle').innerText = `1:1 Executive Interview`;
    document.getElementById('context-title').innerText = `Interview with ${expertName}`;
    
    document.getElementById('card-sofia').classList.add('hidden');
    document.getElementById('card-beatriz').classList.add('hidden');
    
    // Center the 2 cards in 1:1 mode
    if (grid) {
      grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-8 my-auto z-10 w-full max-w-3xl mx-auto py-10';
    }

    const cardCarlos = document.getElementById('card-carlos');
    cardCarlos.querySelector('h4').innerText = expertName;
    cardCarlos.querySelector('div').innerText = expertAvatar;
  } else {
    document.getElementById('context-subtitle').innerText = `Group Dynamics • ${domainName}`;
    document.getElementById('context-title').innerText = `Case: Strategic Alignment & Conflict Resolution`;
    
    document.getElementById('card-sofia').classList.remove('hidden');
    document.getElementById('card-beatriz').classList.remove('hidden');
    
    // 4 columns in Group Dynamics
    if (grid) {
      grid.className = 'grid grid-cols-2 md:grid-cols-4 gap-5 my-auto z-10 w-full max-w-6xl mx-auto py-10';
    }

    const cardCarlos = document.getElementById('card-carlos');
    cardCarlos.querySelector('h4').innerText = expertName;
    cardCarlos.querySelector('div').innerText = expertAvatar;
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
      document.getElementById('caption-speaker').innerText = 'Your Turn to Speak';
      document.getElementById('caption-text').innerText = 'Speak into your microphone or click "Type" to reply to the interviewers.';
    });
  } catch (err) {
    console.error(err);
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

  setTimeout(() => {
    requestBotTurn(text);
  }, 1000);
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

async function speakText(text, persona, callback) {
  const audioEnabled = document.getElementById('toggle-audio-synthesis')?.checked;
  if (!audioEnabled) {
    if (callback) setTimeout(callback, 1200);
    return;
  }

  // Stop previous audio
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.currentTime = 0;
  }

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker_id: persona })
    });

    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudioPlayer = new Audio(audioUrl);
      
      currentAudioPlayer.onended = () => {
        if (callback) callback();
      };
      currentAudioPlayer.onerror = () => {
        if (callback) callback();
      };

      currentAudioPlayer.play();
    } else {
      if (callback) setTimeout(callback, 1500);
    }
  } catch (err) {
    console.error("Erro no TTS Neural:", err);
    if (callback) setTimeout(callback, 1500);
  }
}

function setSpeakingState(speakerId) {
  ['sofia', 'carlos', 'beatriz', 'user'].forEach(id => {
    const card = document.getElementById(`card-${id}`);
    if (card) {
      if (id === speakerId) {
        card.classList.add('border-blue-600', 'ring-2', 'ring-blue-100');
      } else {
        card.classList.remove('border-blue-600', 'ring-2', 'ring-blue-100');
      }
    }
  });
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
    alert('Speech recognition is not supported in this browser. Please use the "Type" button.');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!state.isMicActive) {
    state.recognition = new SpeechRecognition();
    state.recognition.lang = 'en-US';
    state.recognition.continuous = false;
    state.recognition.interimResults = true; // Real-time live captioning stream

    let finalTranscript = '';

    state.recognition.onstart = () => {
      state.isMicActive = true;
      finalTranscript = '';
      document.getElementById('btn-mic').className = 'px-4 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-medium transition flex items-center gap-2 animate-pulse shadow-sm';
      document.getElementById('mic-icon').innerText = '🔴';
      document.getElementById('mic-text').innerText = 'Listening...';
      
      setSpeakingState('user');
      document.getElementById('caption-speaker').innerText = 'You (Candidate)';
      document.getElementById('caption-text').innerText = 'Listening to your microphone...';
    };

    state.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      // Live subtitle preview as user speaks
      document.getElementById('caption-text').innerText = `"${finalTranscript || interim}"`;
    };

    state.recognition.onend = () => {
      stopMic();
      if (finalTranscript.trim()) {
        document.getElementById('user-text-input').value = finalTranscript.trim();
        sendUserMessage();
      } else {
        setSpeakingState(null);
        document.getElementById('caption-speaker').innerText = 'Your Turn to Speak';
        document.getElementById('caption-text').innerText = 'Click Microphone or Type to answer.';
      }
    };

    state.recognition.onerror = (e) => {
      console.warn("Speech error:", e);
      stopMic();
    };

    state.recognition.start();
  } else {
    stopMic();
  }
}

function stopMic() {
  state.isMicActive = false;
  if (state.recognition) state.recognition.stop();
  const micBtn = document.getElementById('btn-mic');
  if (micBtn) {
    micBtn.className = 'px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[13px] font-medium transition flex items-center gap-2 border border-slate-200 dark:border-slate-700';
    document.getElementById('mic-icon').innerText = '🎙️';
    document.getElementById('mic-text').innerText = 'Microphone';
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
        mode: state.currentMode === 'one-on-one' ? '1:1 Technical Interview' : 'Group Dynamics',
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
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Complete a live group dynamic or 1:1 simulation and click 'End Simulation' to save your executive review and full transcript here.</p>
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
          <span class="text-2xl">${item.mode.includes('1:1') ? '👨‍💻' : '👥'}</span>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white">${item.mode === 'Entrevista 1:1' ? '1:1 Technical Interview' : 'Group Dynamics'}</h4>
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
