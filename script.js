const MONTHS_DATA = [
  { id: 1, question: "janvier", answer: "january", pronunciation: "zhahn-vee-ay" },
  { id: 2, question: "février", answer: "february", pronunciation: "fay-vree-ay" },
  { id: 3, question: "mars", answer: "march", pronunciation: "mahrs" },
  { id: 4, question: "avril", answer: "april", pronunciation: "ah-vreel" },
  { id: 5, question: "mai", answer: "may", pronunciation: "meh" },
  { id: 6, question: "juin", answer: "june", pronunciation: "zhwan" },
  { id: 7, question: "juillet", answer: "july", pronunciation: "zhwee-eh" },
  { id: 8, question: "août", answer: "august", pronunciation: "oot" },
  { id: 9, question: "septembre", answer: "september", pronunciation: "sep-tahm-bruh" },
  { id: 10, question: "octobre", answer: "october", pronunciation: "ok-toh-bruh" },
  { id: 11, question: "novembre", answer: "november", pronunciation: "noh-vahm-bruh" },
  { id: 12, question: "décembre", answer: "december", pronunciation: "day-sahm-bruh" }
];

const VOICE_THRESHOLD = 30;
const SILENCE_TIMEOUT = 3000;

class FrenchMonthsGame {
  constructor() {
    this.currentIndex = 0;
    this.sessionResults = [];
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isListening = false;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.microphoneStream = null;
    this.animationFrame = null;
    this.silenceTimer = null;
    this.hasDetectedSpeech = false;
    
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.isAndroid = /Android/i.test(navigator.userAgent);
    
    this.recognition = null;
    this.setupSpeechRecognition();
    this.setupEventListeners();
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      const message = this.isMobile 
        ? 'Speech recognition is not supported on this device. Please use Chrome on Android or Safari on iOS 14.5+.'
        : 'Speech recognition is not supported in your browser. Please use Chrome or Edge.';
      alert(message);
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = this.isMobile ? 3 : 5;
    
    console.log('✅ ASR initialized:', {
      device: this.isMobile ? (this.isIOS ? 'iOS' : this.isAndroid ? 'Android' : 'Mobile') : 'Desktop',
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults,
      lang: this.recognition.lang,
      maxAlternatives: this.recognition.maxAlternatives,
      userAgent: navigator.userAgent.substring(0, 80)
    });

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
    };

    this.recognition.onresult = (event) => {
      console.log('Recognition result received:', event);
      const result = event.results[0];
      const transcript = result[0].transcript.toLowerCase().trim();
      const confidence = result[0].confidence;
      
      console.log('✅ Final transcript:', transcript, 'Confidence:', confidence);
      this.hasDetectedSpeech = true;
      
      this.handleSpeechResult(transcript, confidence);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error, event);
      
      if (event.error === 'no-speech') {
        this.handleNoSpeech();
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.showFeedback('Microphone access denied. Please allow microphone access.', 'error');
        this.stopListening();
        this.resetButtonState();
      } else if (event.error === 'aborted') {
        console.log('Recognition aborted, likely due to no speech');
        this.handleNoSpeech();
      } else if (event.error === 'network') {
        this.showFeedback('Network error. Please check your internet connection.', 'error');
        this.stopListening();
        this.resetButtonState();
      } else {
        this.handleMicError(event.error);
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended. hasDetectedSpeech:', this.hasDetectedSpeech, 'isListening:', this.isListening);
      if (this.isListening && !this.hasDetectedSpeech) {
        console.log('Recognition ended without speech, triggering handleNoSpeech');
        this.stopListening();
        this.handleNoSpeech();
      } else if (this.isListening) {
        this.stopListening();
      }
    };

    this.recognition.onspeechstart = () => {
      console.log('Speech detected');
      document.getElementById('mic-status').textContent = 'Speech detected...';
    };

    this.recognition.onspeechend = () => {
      console.log('Speech ended');
    };
  }

  setupEventListeners() {
    document.getElementById('begin-btn').addEventListener('click', () => this.startGame());
    document.getElementById('start-btn').addEventListener('click', () => this.startListening());
    document.getElementById('next-btn').addEventListener('click', () => this.nextPrompt());
    document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
    document.getElementById('download-report-btn').addEventListener('click', () => this.downloadReport());
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    
    this.initTheme();
  }
  
  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('prompt-container').style.display = 'block';
    this.currentIndex = 0;
    this.sessionResults = [];
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('score').textContent = 'Score: 0/12';
    this.showPrompt();
  }

  async showPrompt() {
    const month = MONTHS_DATA[this.currentIndex];
    document.getElementById('french-word').textContent = month.question;
    document.getElementById('pronunciation-hint').textContent = `Pronunciation: ${month.pronunciation}`;
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('start-btn').style.display = 'inline-block';
    document.getElementById('start-btn').disabled = false;
    
    this.retryCount = 0;
    this.hasDetectedSpeech = false;
    this.updateProgress();
    
    try {
      await this.setupAudioContext();
      
      document.getElementById('mic-animation').style.display = 'none';
      document.getElementById('spectrum-container').style.display = 'flex';
      
      this.startVADVisualization();
      
      document.getElementById('mic-status').textContent = 'Mic ready - Click button to speak';
    } catch (error) {
      console.error('Error setting up microphone:', error);
      document.getElementById('mic-status').textContent = 'Click button to enable microphone';
      document.getElementById('mic-animation').style.display = 'block';
      document.getElementById('spectrum-container').style.display = 'none';
    }
  }

  async startListening() {
    if (this.isListening) return;
    
    if (!this.recognition) {
      const errorMsg = this.isIOS 
        ? 'Sorry, speech recognition is not supported on iOS devices yet. Please use Chrome on Android or a desktop browser.'
        : 'Speech recognition not available. Please use Chrome or Edge browser.';
      this.showFeedback(errorMsg, 'error');
      return;
    }
    
    this.isListening = true;
    this.hasDetectedSpeech = false;
    document.getElementById('start-btn').disabled = true;
    
    const statusText = this.isMobile 
      ? 'Listening... speak clearly!' 
      : 'Listening... speak now!';
    document.getElementById('mic-status').textContent = statusText;
    
    try {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
      }
      
      if (this.isAndroid && this.microphoneStream) {
        console.log('📱 Android: Releasing mic for ASR...');
        this.microphoneStream.getTracks().forEach(track => track.stop());
        if (this.audioContext) {
          await this.audioContext.suspend();
        }
      } else {
        this.startVAD();
      }
      
      console.log('Starting speech recognition...');
      this.recognition.start();
      console.log('Speech recognition start command sent');
      
      if (this.isMobile) {
        console.log('📱 Mobile device detected - using optimized ASR settings');
      }
    } catch (error) {
      console.error('Error starting listening:', error);
      if (error.message && error.message.includes('already started')) {
        console.log('Recognition already running, stopping and restarting');
        this.recognition.stop();
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
            this.showFeedback('Could not start speech recognition. Please refresh the page.', 'error');
            this.stopListening();
            this.resetButtonState();
          }
        }, 100);
      } else {
        const errorMessage = this.isMobile
          ? 'Could not start microphone. Please check app permissions in your device settings.'
          : 'Could not start speech recognition. Please check microphone permissions.';
        this.showFeedback(errorMessage, 'error');
        this.stopListening();
        this.resetButtonState();
      }
    }
  }

  async setupAudioContext() {
    if (this.audioContext && this.audioContext.state === 'running') return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = this.isMobile ? 0.85 : 0.8;

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(this.isMobile && {
            sampleRate: 48000,
            channelCount: 1
          })
        }
      };

      console.log('🎤 Requesting microphone access with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Microphone access granted');
      
      this.microphoneStream = stream;
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      if (this.isMobile) {
        console.log('📱 Mobile audio context configured with optimized settings');
      }
    } catch (error) {
      console.error('❌ Failed to setup audio context:', error);
      throw error;
    }
  }

  startVADVisualization() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const bars = document.querySelectorAll('.bar');

    const updateAnimation = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      
      bars.forEach((bar, index) => {
        const dataIndex = Math.floor((index / bars.length) * dataArray.length);
        const value = dataArray[dataIndex] || 0;
        const height = Math.max(10, Math.min(60, (value / 255) * 60));
        bar.style.height = `${height}px`;
        
        if (average > VOICE_THRESHOLD) {
          bar.classList.add('active');
        } else {
          bar.classList.remove('active');
        }
      });

      if (!this.isListening) {
        this.animationFrame = requestAnimationFrame(updateAnimation);
      }
    };

    updateAnimation();
  }

  startVAD() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const bars = document.querySelectorAll('.bar');
    const questionCard = document.querySelector('.question-card');
    let isSpeaking = false;
    let speechStartTime = null;
    const MIN_SPEECH_DURATION = 1000;

    if (questionCard) {
      questionCard.classList.add('vad-active');
    }

    const updateAnimation = () => {
      if (!this.isListening) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      
      bars.forEach((bar, index) => {
        const dataIndex = Math.floor((index / bars.length) * dataArray.length);
        const value = dataArray[dataIndex] || 0;
        const height = Math.max(10, Math.min(60, (value / 255) * 60));
        bar.style.height = `${height}px`;
        
        if (average > VOICE_THRESHOLD) {
          bar.classList.add('active');
        } else {
          bar.classList.remove('active');
        }
      });

      if (average > VOICE_THRESHOLD) {
        if (questionCard && !questionCard.classList.contains('vad-speaking')) {
          questionCard.classList.add('vad-speaking');
        }
        
        if (!isSpeaking) {
          isSpeaking = true;
          speechStartTime = Date.now();
          console.log('VAD detected speech start');
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        }
      } else {
        if (questionCard && questionCard.classList.contains('vad-speaking')) {
          questionCard.classList.remove('vad-speaking');
        }
        
        if (isSpeaking && !this.hasDetectedSpeech) {
          const speechDuration = Date.now() - speechStartTime;
          console.log('VAD detected speech end, duration:', speechDuration, 'ms');
          
          if (speechDuration >= MIN_SPEECH_DURATION && !this.silenceTimer) {
            console.log('VAD detected sufficient speech, will stop recognition after silence');
            this.silenceTimer = setTimeout(() => {
              if (this.isListening && !this.hasDetectedSpeech) {
                console.log('Manually stopping recognition after VAD detected speech');
                try {
                  this.recognition.stop();
                } catch (e) {
                  console.log('Recognition already stopped');
                }
              }
            }, 1500);
          }
          
          isSpeaking = false;
        }
      }

      this.animationFrame = requestAnimationFrame(updateAnimation);
    };

    updateAnimation();
  }

  stopListening() {
    this.isListening = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    const bars = document.querySelectorAll('.bar');
    bars.forEach(bar => {
      bar.classList.remove('active');
    });
    
    const questionCard = document.querySelector('.question-card');
    if (questionCard) {
      questionCard.classList.remove('vad-active');
      questionCard.classList.remove('vad-speaking');
    }
    
    if (this.analyser) {
      this.startVADVisualization();
    }
  }

  resetButtonState() {
    document.getElementById('start-btn').disabled = false;
    document.getElementById('mic-status').textContent = 'Mic ready - Click button to retry';
  }

  async handleSpeechResult(transcript, confidence) {
    this.stopListening();
    
    if (this.isAndroid) {
      console.log('📱 Android: Restarting mic for visualization...');
      try {
        await this.setupAudioContext();
        this.startVADVisualization();
      } catch (e) {
        console.log('Could not restart audio context:', e);
      }
    }
    
    const month = MONTHS_DATA[this.currentIndex];
    const expected = month.answer.toLowerCase();
    
    const isCorrect = transcript === expected;
    const similarity = this.calculateSimilarity(transcript, expected);
    
    let status;
    let feedbackMessage;
    
    if (isCorrect) {
      status = 'correct';
      feedbackMessage = `Correct! "${month.question}" → "${month.answer}"`;
      this.showFeedback(feedbackMessage, 'correct');
    } else if (similarity >= 0.7) {
      status = 'partial';
      feedbackMessage = `Close! You said "${transcript}". Correct answer: "${month.answer}"`;
      this.showFeedback(feedbackMessage, 'warning');
    } else {
      status = 'incorrect';
      feedbackMessage = `Incorrect. You said "${transcript}". Correct answer: "${month.answer}"`;
      this.showFeedback(feedbackMessage, 'incorrect');
    }
    
    this.sessionResults.push({
      promptId: month.id,
      question: month.question,
      expected: month.answer,
      pronunciation: month.pronunciation,
      transcript: transcript,
      confidence: confidence,
      confidencePercent: Math.round(confidence * 100),
      speechDetected: true,
      status: status,
      similarity: similarity,
      retries: this.retryCount
    });
    
    this.updateProgress();
    this.showNextButton();
  }

  async handleNoSpeech() {
    this.stopListening();
    
    if (this.isAndroid) {
      console.log('📱 Android: Restarting mic after no-speech...');
      try {
        await this.setupAudioContext();
        this.startVADVisualization();
      } catch (e) {
        console.log('Could not restart audio context:', e);
      }
    }
    
    this.retryCount++;
    
    if (this.retryCount >= this.maxRetries) {
      const month = MONTHS_DATA[this.currentIndex];
      this.showFeedback(`No speech detected after ${this.maxRetries} attempts. Moving to next question.`, 'warning');
      
      this.sessionResults.push({
        promptId: month.id,
        question: month.question,
        expected: month.answer,
        pronunciation: month.pronunciation,
        transcript: '',
        confidence: 0,
        confidencePercent: 0,
        speechDetected: false,
        status: 'skipped',
        retries: this.retryCount
      });
      
      this.updateProgress();
      this.showNextButton();
    } else {
      this.showFeedback(`No speech detected. Try again (${this.retryCount}/${this.maxRetries})`, 'warning');
      this.resetButtonState();
    }
  }

  async handleMicError(error) {
    this.stopListening();
    
    if (this.isAndroid) {
      console.log('📱 Android: Restarting mic after error...');
      try {
        await this.setupAudioContext();
        this.startVADVisualization();
      } catch (e) {
        console.log('Could not restart audio context:', e);
      }
    }
    
    const month = MONTHS_DATA[this.currentIndex];
    this.showFeedback(`Microphone error: ${error}. Click Next to continue.`, 'error');
    
    this.sessionResults.push({
      promptId: month.id,
      question: month.question,
      expected: month.answer,
      pronunciation: month.pronunciation,
      transcript: '',
      confidence: 0,
      confidencePercent: 0,
      speechDetected: false,
      status: 'micError',
      error: error,
      retries: this.retryCount
    });
    
    this.updateProgress();
    this.showNextButton();
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  showFeedback(message, type) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
    document.getElementById('mic-status').textContent = type === 'correct' || type === 'incorrect' || type === 'warning' ? 'Ready for next question' : 'Error occurred';
  }

  showNextButton() {
    document.getElementById('next-btn').style.display = 'inline-block';
    document.getElementById('start-btn').style.display = 'none';
  }

  nextPrompt() {
    this.currentIndex++;
    
    if (this.currentIndex < MONTHS_DATA.length) {
      this.showPrompt();
    } else {
      this.showResults();
    }
  }

  updateProgress() {
    const progress = ((this.currentIndex + 1) / MONTHS_DATA.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    
    const correct = this.sessionResults.filter(r => r.status === 'correct').length;
    document.getElementById('score').textContent = `Score: ${correct}/${MONTHS_DATA.length}`;
  }

  showResults() {
    this.cleanupAudio();
    
    document.getElementById('prompt-container').style.display = 'none';
    document.getElementById('results-screen').style.display = 'block';
    
    const correct = this.sessionResults.filter(r => r.status === 'correct').length;
    const partial = this.sessionResults.filter(r => r.status === 'partial').length;
    const incorrect = this.sessionResults.filter(r => r.status === 'incorrect').length;
    const skipped = this.sessionResults.filter(r => r.status === 'skipped').length;
    const errors = this.sessionResults.filter(r => r.status === 'micError').length;
    
    const totalAttempts = this.sessionResults.length;
    const validResults = this.sessionResults.filter(r => r.confidence > 0);
    const avgConfidence = validResults.length > 0 
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length 
      : 0;
    
    const percentage = ((correct / MONTHS_DATA.length) * 100).toFixed(1);
    const accuracyRate = totalAttempts > 0 ? ((correct / totalAttempts) * 100).toFixed(1) : 0;
    
    let summaryHTML = `
      <div class="summary-stats">
        <strong>Final Score: ${correct}/${MONTHS_DATA.length}</strong> (${percentage}%)
      </div>
      <div class="summary-stats">
        <span class="stat-icon stat-icon-accuracy"></span> Accuracy Rate: ${accuracyRate}%
      </div>
      <div class="summary-stats">
        <span class="stat-icon stat-icon-correct"></span> Correct: ${correct}
      </div>
      <div class="summary-stats">
        <span class="stat-icon stat-icon-partial"></span> Partial/Close: ${partial}
      </div>
      <div class="summary-stats">
        <span class="stat-icon stat-icon-incorrect"></span> Incorrect: ${incorrect}
      </div>
      <div class="summary-stats">
        <span class="stat-icon stat-icon-skipped"></span> Skipped: ${skipped}
      </div>
      ${errors > 0 ? `<div class="summary-stats"><span class="stat-icon stat-icon-error"></span> Errors: ${errors}</div>` : ''}
      <div class="summary-stats">
        <span class="stat-icon stat-icon-confidence"></span> Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%
      </div>
      <hr style="margin: 20px 0;">
    `;
    
    this.sessionResults.forEach(result => {
      const iconClass = result.status === 'correct' ? 'stat-icon-correct' : 
                        result.status === 'partial' ? 'stat-icon-partial' :
                        result.status === 'incorrect' ? 'stat-icon-incorrect' : 
                        result.status === 'skipped' ? 'stat-icon-skipped' : 'stat-icon-error';
      
      summaryHTML += `
        <div class="result-item">
          <span class="stat-icon ${iconClass}"></span>
          <div>
            <strong>${result.question}</strong> → ${result.expected}
            <br><small>You said: "${result.transcript || 'No response'}" 
            ${result.confidence > 0 ? `(${result.confidencePercent}% confidence)` : ''}
            ${result.retries > 0 ? ` [${result.retries} retries]` : ''}</small>
          </div>
        </div>
      `;
    });
    
    document.getElementById('results-summary').innerHTML = summaryHTML;
  }

  restartGame() {
    this.cleanupAudio();
    
    document.getElementById('results-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    this.currentIndex = 0;
    this.sessionResults = [];
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('score').textContent = 'Score: 0/12';
  }

  cleanupAudio() {
    console.log('Cleaning up audio resources');
    this.isListening = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => {
        track.stop();
        console.log('Microphone track stopped');
      });
      this.microphoneStream = null;
    }
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().then(() => {
        console.log('Audio context closed');
      });
      this.audioContext = null;
    }
    
    this.analyser = null;
    
    const bars = document.querySelectorAll('.bar');
    bars.forEach(bar => {
      bar.classList.remove('active');
      bar.style.height = '15px';
    });
  }

  downloadReport() {
    const timestamp = new Date().toISOString().split('T')[0];
    const sessionId = `french-months-${timestamp}-${Date.now()}`;
    
    const correct = this.sessionResults.filter(r => r.status === 'correct').length;
    const partial = this.sessionResults.filter(r => r.status === 'partial').length;
    const incorrect = this.sessionResults.filter(r => r.status === 'incorrect').length;
    const skipped = this.sessionResults.filter(r => r.status === 'skipped').length;
    const errors = this.sessionResults.filter(r => r.status === 'micError').length;
    
    const totalAttempts = this.sessionResults.length;
    const validResults = this.sessionResults.filter(r => r.confidence > 0);
    const avgConfidence = validResults.length > 0 
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length 
      : 0;
    
    const accuracyRate = totalAttempts > 0 ? (correct / totalAttempts) : 0;
    const totalRetries = this.sessionResults.reduce((sum, r) => sum + (r.retries || 0), 0);
    
    const report = {
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      gameInfo: {
        title: "French Months - Lingotran",
        platform: "Lingotran",
        totalQuestions: MONTHS_DATA.length
      },
      results: this.sessionResults,
      summary: {
        total: MONTHS_DATA.length,
        totalAttempts: totalAttempts,
        correct: correct,
        partial: partial,
        incorrect: incorrect,
        skipped: skipped,
        errors: errors,
        totalRetries: totalRetries,
        avgConfidence: parseFloat(avgConfidence.toFixed(4)),
        avgConfidencePercent: parseFloat((avgConfidence * 100).toFixed(2)),
        accuracyRate: parseFloat(accuracyRate.toFixed(4)),
        accuracyRatePercent: parseFloat((accuracyRate * 100).toFixed(2)),
        scorePercentage: parseFloat(((correct / MONTHS_DATA.length) * 100).toFixed(2))
      }
    };
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sessionId}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FrenchMonthsGame();
});
