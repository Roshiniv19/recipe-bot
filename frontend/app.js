/**
 * Recipe Bot - Frontend Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const messagesList = document.getElementById('messages-list');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const welcomeBanner = document.getElementById('welcome-banner');
  const typingIndicator = document.getElementById('typing-indicator');
  const suggestionsContainer = document.getElementById('suggestions-container');
  const connectionStatus = document.getElementById('connection-status');
  const ingredientCounter = document.getElementById('ingredient-detected-tag');

  // Actions & Buttons
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const btnClearChat = document.getElementById('btn-clear-chat');
  const btnRecipeBook = document.getElementById('btn-recipe-book');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const recipeDrawer = document.getElementById('recipe-drawer');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const recipeDrawerList = document.getElementById('recipe-drawer-list');
  const recipeSearchInput = document.getElementById('recipe-search-input');
  const recipeCountBadge = document.getElementById('recipe-count-badge');
  const btnVoiceInput = document.getElementById('btn-voice-input');
  const voiceIcon = document.getElementById('voice-icon');
  const btnInsertPantry = document.getElementById('btn-insert-pantry');

  // State
  let chatHistory = [];
  let allRecipes = [];
  let isSoundEnabled = localStorage.getItem('recipe_bot_sound') !== 'false';
  let isDarkMode = localStorage.getItem('recipe_bot_theme') === 'dark';
  let isRecognizingSpeech = false;
  let recognition = null;

  // Web Audio Context for Chimes
  let audioCtx = null;
  function playChime(type = 'receive') {
    if (!isSoundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (type === 'send') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch (e) {
      // Audio autoplay policy catch
    }
  }

  // Initialize Theme
  function applyTheme() {
    if (isDarkMode) {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
      themeIcon.className = 'fa-solid fa-sun';
    } else {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
      themeIcon.className = 'fa-solid fa-moon';
    }
  }
  applyTheme();

  btnThemeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('recipe_bot_theme', isDarkMode ? 'dark' : 'light');
    applyTheme();
  });

  // Sound Toggle
  function updateSoundIcon() {
    soundIcon.className = isSoundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  }
  updateSoundIcon();

  btnSoundToggle.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('recipe_bot_sound', isSoundEnabled ? 'true' : 'false');
    updateSoundIcon();
  });

  // Check Backend Status & Load Recipes
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        const statusText = connectionStatus.querySelector('.status-text');
        if (data.hasApiKey) {
          connectionStatus.classList.add('ready');
          statusText.textContent = 'AI Ready (Gemini)';
        } else {
          connectionStatus.classList.remove('ready');
          statusText.textContent = 'Demo Mode (Local Engine)';
        }
      }
    } catch (err) {
      console.warn('Backend status check failed:', err);
      const statusText = connectionStatus.querySelector('.status-text');
      statusText.textContent = 'Offline / Connecting';
    }
  }
  checkServerStatus();

  async function fetchRecipes() {
    try {
      const res = await fetch('/api/recipes');
      if (res.ok) {
        const data = await res.json();
        allRecipes = data.recipes || [];
        recipeCountBadge.textContent = allRecipes.length;
        renderRecipeDrawer(allRecipes);
      }
    } catch (err) {
      console.warn('Could not fetch recipes list:', err);
    }
  }
  fetchRecipes();

  // Recipe Book Drawer Open / Close
  function toggleDrawer(open) {
    if (open) {
      recipeDrawer.classList.add('open');
      drawerOverlay.classList.add('active');
      recipeDrawer.setAttribute('aria-hidden', 'false');
    } else {
      recipeDrawer.classList.remove('open');
      drawerOverlay.classList.remove('active');
      recipeDrawer.setAttribute('aria-hidden', 'true');
    }
  }

  btnRecipeBook.addEventListener('click', () => toggleDrawer(true));
  btnCloseDrawer.addEventListener('click', () => toggleDrawer(false));
  drawerOverlay.addEventListener('click', () => toggleDrawer(false));

  // Render Recipe Book in Drawer
  function renderRecipeDrawer(recipes) {
    recipeDrawerList.innerHTML = '';
    if (!recipes.length) {
      recipeDrawerList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:20px;text-align:center;">No recipes found matching your search.</p>';
      return;
    }

    recipes.forEach(r => {
      const card = document.createElement('div');
      card.className = 'drawer-recipe-card';
      const ingsPreview = (r.ingredients || []).slice(0, 5).join(', ');

      card.innerHTML = `
        <div class="drawer-recipe-header">
          <div class="drawer-recipe-title">${escapeHtml(r.name)}</div>
        </div>
        <div class="drawer-recipe-meta">
          <span class="pill-badge">🌍 ${escapeHtml(r.cuisine || 'Global')}</span>
          <span class="pill-badge">⏱️ ${escapeHtml(r.cookingTime || '15 mins')}</span>
          <span class="pill-badge">🥣 ${escapeHtml(r.difficulty || 'Easy')}</span>
        </div>
        <div class="drawer-recipe-ingredients">
          <strong>Key Ingredients:</strong> ${escapeHtml(ingsPreview)}...
        </div>
        <button class="drawer-btn-cook" data-name="${escapeHtml(r.name)}">
          <i class="fa-solid fa-fire-burner"></i> Cook This Recipe
        </button>
      `;

      card.querySelector('.drawer-btn-cook').addEventListener('click', () => {
        toggleDrawer(false);
        const prompt = `Give me the detailed recipe and chef tips for "${r.name}".`;
        submitMessage(prompt);
      });

      recipeDrawerList.appendChild(card);
    });
  }

  // Drawer Search Filtering
  recipeSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderRecipeDrawer(allRecipes);
      return;
    }
    const filtered = allRecipes.filter(r => {
      const nameMatch = (r.name || '').toLowerCase().includes(q);
      const cuisineMatch = (r.cuisine || '').toLowerCase().includes(q);
      const ingMatch = (r.ingredients || []).some(i => i.toLowerCase().includes(q));
      const tagMatch = (r.tags || []).some(t => t.toLowerCase().includes(q));
      return nameMatch || cuisineMatch || ingMatch || tagMatch;
    });
    renderRecipeDrawer(filtered);
  });

  // Textarea Auto-expand & Input Listener
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';

    // Simple ingredient detection hint in bottom bar
    const text = userInput.value.trim();
    if (!text) {
      ingredientCounter.textContent = 'Ready to cook';
      return;
    }

    const items = text.split(/,|\band\b|\bwith\b|\bplus\b/gi).filter(i => i.trim().length > 1);
    if (items.length > 1) {
      ingredientCounter.textContent = `🛒 ${items.length} ingredients detected`;
    } else {
      ingredientCounter.textContent = `Ready to cook`;
    }
  });

  // Enter to send (Shift+Enter for newline)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Suggestion Chips
  suggestionsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const prompt = chip.getAttribute('data-prompt');
    if (prompt) {
      submitMessage(prompt);
    }
  });

  // Quick Pantry Insert Helper
  btnInsertPantry.addEventListener('click', () => {
    const pantryItems = ['chicken, garlic, spinach', 'eggs, avocado, sourdough', 'salmon, rice, soy sauce', 'paneer, tomatoes, butter', 'noodles, scallions, chili flakes'];
    const randomPick = pantryItems[Math.floor(Math.random() * pantryItems.length)];
    userInput.value = `I have ${randomPick}. What can I make?`;
    userInput.focus();
    userInput.dispatchEvent(new Event('input'));
  });

  // Voice Input Speech Recognition
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isRecognizingSpeech = true;
      btnVoiceInput.classList.add('recording');
      voiceIcon.className = 'fa-solid fa-microphone-slash';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      userInput.value = (userInput.value ? userInput.value + ' ' : '') + transcript;
      userInput.dispatchEvent(new Event('input'));
    };

    recognition.onend = () => {
      isRecognizingSpeech = false;
      btnVoiceInput.classList.remove('recording');
      voiceIcon.className = 'fa-solid fa-microphone';
    };

    recognition.onerror = () => {
      isRecognizingSpeech = false;
      btnVoiceInput.classList.remove('recording');
      voiceIcon.className = 'fa-solid fa-microphone';
    };

    btnVoiceInput.addEventListener('click', () => {
      if (isRecognizingSpeech) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  } else {
    btnVoiceInput.style.display = 'none';
  }

  // Clear Chat History
  btnClearChat.addEventListener('click', () => {
    if (confirm('Clear the current conversation and start fresh?')) {
      messagesList.innerHTML = '';
      chatHistory = [];
      if (welcomeBanner) welcomeBanner.style.display = 'block';
    }
  });

  // Chat Form Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    submitMessage(message);
    userInput.value = '';
    userInput.style.height = 'auto';
    ingredientCounter.textContent = 'Ready to cook';
  });

  /**
   * Submit Message to Backend POST /chat
   */
  async function submitMessage(message) {
    // Hide welcome banner on first message
    if (welcomeBanner && welcomeBanner.style.display !== 'none') {
      welcomeBanner.style.display = 'none';
    }

    // Append User Message
    appendMessage({
      role: 'user',
      content: message,
      timestamp: formatTime(new Date())
    });

    playChime('send');
    showTypingIndicator(true);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          history: chatHistory.slice(-6) // send last 6 turns for context
        })
      });

      showTypingIndicator(false);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      
      appendMessage({
        role: 'bot',
        content: data.reply || 'Sorry, I could not generate a recipe for that.',
        matchedRecipes: data.matchedRecipes || [],
        notice: data.notice,
        source: data.source,
        timestamp: formatTime(new Date())
      });

      playChime('receive');

      // Update state history
      chatHistory.push({ role: 'user', content: message });
      chatHistory.push({ role: 'assistant', content: data.reply });

    } catch (error) {
      showTypingIndicator(false);
      console.error('Chat error:', error);

      appendMessage({
        role: 'bot',
        content: `⚠️ **Oops! Couldn't reach Recipe Bot server.**\n\n*Details: ${escapeHtml(error.message)}*\n\nPlease make sure the backend is running at \`http://localhost:3000\` by starting \`node backend/server.js\`.`,
        timestamp: formatTime(new Date())
      });
    }
  }

  /**
   * Append Message to UI
   */
  function appendMessage({ role, content, matchedRecipes = [], notice, source, timestamp }) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'user' 
      ? '<i class="fa-solid fa-user"></i>' 
      : '<i class="fa-solid fa-utensils"></i>';

    // Content Wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';

    // Meta Header (Name + Time)
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const senderName = role === 'user' ? 'You' : 'Recipe Bot';
    meta.innerHTML = `<span>${senderName}</span> • <span>${timestamp}</span>`;
    contentWrapper.appendChild(meta);

    // Message Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'user') {
      bubble.textContent = content;
    } else {
      bubble.innerHTML = renderMarkdown(content);

      // Render Matched Recipes Cards if available
      if (matchedRecipes && matchedRecipes.length > 0) {
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'matched-recipes-container';

        matchedRecipes.forEach(match => {
          const card = document.createElement('div');
          card.className = 'matched-recipe-card';
          card.innerHTML = `
            <div class="matched-recipe-info">
              <h5>${escapeHtml(match.name)}</h5>
              <div class="matched-recipe-badges">
                <span class="pill-badge">🌍 ${escapeHtml(match.cuisine)}</span>
                <span class="pill-badge">⏱️ ${escapeHtml(match.cookingTime)}</span>
                ${match.matchRatio > 0 ? `<span class="pill-badge match-ratio">🎯 ${match.matchRatio}% Match</span>` : ''}
              </div>
            </div>
            <button class="drawer-btn-cook" data-name="${escapeHtml(match.name)}" style="margin-top:0;">
              View Steps
            </button>
          `;

          card.querySelector('.drawer-btn-cook').addEventListener('click', () => {
            submitMessage(`Show me full steps and tips for ${match.name}`);
          });

          matchesContainer.appendChild(card);
        });

        bubble.appendChild(matchesContainer);
      }

      // Add Notice Banner if in demo/fallback mode
      if (notice) {
        const noticeDiv = document.createElement('div');
        noticeDiv.style.cssText = 'margin-top:12px;padding:8px 12px;border-radius:8px;font-size:0.75rem;background:var(--bg-subtle);border:1px dashed var(--border-color);color:var(--text-muted);';
        noticeDiv.innerHTML = `ℹ️ <em>${escapeHtml(notice)}</em>`;
        bubble.appendChild(noticeDiv);
      }
    }

    contentWrapper.appendChild(bubble);

    // Message Actions for Bot (Copy response)
    if (role === 'bot') {
      const actions = document.createElement('div');
      actions.className = 'message-actions';

      const btnCopy = document.createElement('button');
      btnCopy.className = 'btn-msg-action';
      btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Recipe';
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
          btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          setTimeout(() => {
            btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Recipe';
          }, 2000);
        });
      });

      actions.appendChild(btnCopy);
      contentWrapper.appendChild(actions);
    }

    row.appendChild(avatar);
    row.appendChild(contentWrapper);
    messagesList.appendChild(row);

    // Scroll to bottom
    scrollToBottom();
  }

  function showTypingIndicator(show) {
    if (show) {
      typingIndicator.classList.remove('hidden');
    } else {
      typingIndicator.classList.add('hidden');
    }
    scrollToBottom();
  }

  function scrollToBottom() {
    setTimeout(() => {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }, 50);
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Lightweight, robust Markdown to HTML renderer
   */
  function renderMarkdown(md) {
    if (!md) return '';

    let html = md;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

    // Bold & Italics
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/gim, '');

    // Ordered lists
    html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<ol><li>$2</li></ol>');
    html = html.replace(/<\/ol>\s*<ol>/gim, '');

    // Markdown Tables
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:\s|]+\|[\r\n]+((?:\|.+[\|\r\n]+)+)/g;
    html = html.replace(tableRegex, (match, headerLine, bodyLines) => {
      const headers = headerLine.split('|').filter(h => h.trim().length > 0);
      const rows = bodyLines.trim().split('\n');

      let tableHtml = '<table><thead><tr>';
      headers.forEach(h => {
        tableHtml += `<th>${h.trim()}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      rows.forEach(row => {
        const cells = row.split('|').filter(c => c.trim().length > 0);
        if (cells.length > 0) {
          tableHtml += '<tr>';
          cells.forEach(c => {
            tableHtml += `<td>${c.trim()}</td>`;
          });
          tableHtml += '</tr>';
        }
      });
      tableHtml += '</tbody></table>';
      return tableHtml;
    });

    // Paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-4]>[\s\S]*?<\/h[1-4]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>[\s\S]*?<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ol>[\s\S]*?<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table>[\s\S]*?<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>[\s\S]*?<\/blockquote>)<\/p>/g, '$1');

    return html;
  }
});
