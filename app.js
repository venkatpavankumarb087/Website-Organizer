/**
 * app.js
 * Main Application Orchestrator & Cloud Data Store
 * Loads default categories, coordinates with AuthService & UI, handles import/export, and Sync & Share presets.
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'websiteOrganizerCategoriesV4';
  const QA_STORAGE_KEY = 'websiteOrganizerQuickAccessV2';

  // 13 Rich Default Categories from Dashboard
  const defaultCategories = [
    {
      id: 'work',
      name: 'Work',
      links: [
        { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com', createdAt: 1715000000000, description: 'Professional networking', history: [] },
        { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', createdAt: 1715001000000, description: 'Email and inbox', history: [] },
        { id: 'gdrive', name: 'Google Drive', url: 'https://drive.google.com', createdAt: 1715002000000, description: 'Cloud docs and storage', history: [] },
        { id: 'slack', name: 'Slack', url: 'https://slack.com', createdAt: 1715003000000, description: 'Team messaging', history: [] }
      ]
    },
    {
      id: 'ai',
      name: 'Ai',
      links: [
        { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', createdAt: 1715004000000, description: 'Google AI Assistant', history: [] },
        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', createdAt: 1715005000000, description: 'OpenAI Chat', history: [] },
        { id: 'claude', name: 'Claude', url: 'https://claude.ai', createdAt: 1715006000000, description: 'Anthropic AI Assistant', history: [] },
        { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai', createdAt: 1715007000000, description: 'AI Search Engine', history: [] }
      ]
    },
    {
      id: 'hackathon',
      name: 'Hackathon',
      links: [
        { id: 'devfolio', name: 'Devfolio', url: 'https://devfolio.co', createdAt: 1715008000000, description: 'India hackathon portal', history: [] },
        { id: 'unstop', name: 'Unstop', url: 'https://unstop.com', createdAt: 1715009000000, description: 'Competitions & hackathons', history: [] },
        { id: 'devpost', name: 'Devpost', url: 'https://devpost.com', createdAt: 1715010000000, description: 'Global hackathons', history: [] }
      ]
    },
    {
      id: 'tools',
      name: 'Tools',
      links: [
        { id: 'canva', name: 'Canva', url: 'https://www.canva.com', createdAt: 1715011000000, description: 'Graphic design tool', history: [] },
        { id: 'figma', name: 'Figma', url: 'https://www.figma.com', createdAt: 1715012000000, description: 'UI/UX design tool', history: [] },
        { id: 'tinypng', name: 'TinyPNG', url: 'https://tinypng.com', createdAt: 1715013000000, description: 'Image compression', history: [] }
      ]
    },
    {
      id: 'typing',
      name: 'Typing',
      links: [
        { id: 'monkeytype', name: 'Monkeytype', url: 'https://monkeytype.com', createdAt: 1715014000000, description: 'Custom typing test', history: [] },
        { id: 'testtype', name: 'TestType', url: 'https://typetest-gules.vercel.app/', createdAt: 1715015000000, description: 'Typing speed test', history: [] },
        { id: 'nitrotype', name: 'Nitro Type', url: 'https://www.nitrotype.com/', createdAt: 1715016000000, description: 'Typing race game', history: [] }
      ]
    },
    {
      id: 'coding',
      name: 'Coding',
      links: [
        { id: 'leetcode', name: 'LeetCode', url: 'https://www.leetcode.com', createdAt: 1715017000000, description: 'DSA problem solving', history: [] },
        { id: 'hackerrank', name: 'HackerRank', url: 'https://www.hackerrank.com', createdAt: 1715018000000, description: 'Coding practice & certificates', history: [] },
        { id: 'codechef', name: 'CodeChef', url: 'https://www.codechef.com', createdAt: 1715019000000, description: 'Competitive programming', history: [] }
      ]
    },
    {
      id: 'course',
      name: 'COURSE',
      links: [
        { id: 'coursera', name: 'Coursera', url: 'https://www.coursera.org', createdAt: 1715020000000, description: 'Online university courses', history: [] },
        { id: 'nptel', name: 'NPTEL', url: 'https://nptel.ac.in', createdAt: 1715021000000, description: 'IIT engineering courses', history: [] },
        { id: 'udemy', name: 'Udemy', url: 'https://www.udemy.com', createdAt: 1715022000000, description: 'Skill video courses', history: [] }
      ]
    },
    {
      id: 'hack-labs',
      name: 'HACK LABS',
      links: [
        { id: 'htb', name: 'Hack The Box', url: 'https://www.hackthebox.com', createdAt: 1715023000000, description: 'Cybersecurity training labs', history: [] },
        { id: 'tryhackme', name: 'TryHackMe', url: 'https://tryhackme.com', createdAt: 1715024000000, description: 'Hands-on hacking labs', history: [] }
      ]
    },
    {
      id: 'dsa',
      name: 'DSA',
      links: [
        { id: 'neetcode', name: 'NeetCode', url: 'https://neetcode.io', createdAt: 1715025000000, description: 'Algorithms study roadmap', history: [] },
        { id: 'striver', name: 'Take U Forward', url: 'https://takeuforward.org', createdAt: 1715026000000, description: 'Striver A2Z DSA sheet', history: [] },
        { id: 'gfg', name: 'GeeksforGeeks', url: 'https://www.geeksforgeeks.org', createdAt: 1715027000000, description: 'Computer science portal', history: [] }
      ]
    },
    {
      id: 'useful-websites',
      name: 'Useful websites',
      links: [
        { id: 'github', name: 'GitHub', url: 'https://www.github.com', createdAt: 1715028000000, description: 'Code repositories and git', history: [] },
        { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com', createdAt: 1715029000000, description: 'Developer Q&A community', history: [] },
        { id: 'mdn', name: 'MDN Web Docs', url: 'https://developer.mozilla.org', createdAt: 1715030000000, description: 'Web standards documentation', history: [] }
      ]
    },
    {
      id: 'online-shopping',
      name: 'online shopping',
      links: [
        { id: 'amazon', name: 'Amazon', url: 'https://www.amazon.in', createdAt: 1715031000000, description: 'Online store', history: [] },
        { id: 'flipkart', name: 'Flipkart', url: 'https://www.flipkart.com', createdAt: 1715032000000, description: 'Electronics & shopping', history: [] }
      ]
    },
    {
      id: 'ai-coding',
      name: 'AI Coding',
      links: [
        { id: 'cursor', name: 'Cursor', url: 'https://www.cursor.com', createdAt: 1715033000000, description: 'AI Code Editor', history: [] },
        { id: 'v0', name: 'v0 by Vercel', url: 'https://v0.dev', createdAt: 1715034000000, description: 'Generative UI with AI', history: [] },
        { id: 'replit', name: 'Replit', url: 'https://replit.com', createdAt: 1715035000000, description: 'Online collaborative IDE', history: [] }
      ]
    },
    {
      id: 'unexplored',
      name: 'Unexplored',
      links: [
        { id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co', createdAt: 1715036000000, description: 'AI models and datasets', history: [] },
        { id: 'producthunt', name: 'Product Hunt', url: 'https://www.producthunt.com', createdAt: 1715037000000, description: 'Discover new tech products', history: [] }
      ]
    }
  ];

  // 5 Default Quick Access Logos (Requirement 2)
  const defaultQuickAccess = [
    { name: 'Gemini', url: 'https://gemini.google.com', icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64' },
    { name: 'ChatGPT', url: 'https://chatgpt.com', icon: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=64' },
    { name: 'Claude', url: 'https://claude.ai', icon: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=64' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com', icon: 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=64' },
    { name: 'GitHub', url: 'https://github.com', icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64' }
  ];

  const App = {
    categories: [],
    quickAccessList: [],
    draggedQAIndex: null,

    init() {
      this.loadCategories();
      this.loadQuickAccess();
      this.initSavedTheme();

      // Initialize Modular Components
      if (window.AuthService) window.AuthService.init();
      if (window.UI) {
        window.UI.init();
        window.UI.render();
      }

      this.bindImportExport();
      this.bindSyncShare();
    },

    loadCategories() {
      const keys = [
        STORAGE_KEY,
        'websiteOrganizerCategoriesV3',
        'websiteOrganizerCategoriesV2',
        'websiteOrganizerCategories',
        'website_organizer_data'
      ];

      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.categories = parsed;
              return;
            }
          }
        } catch (e) {}
      }

      // Guest / First time load: Load complete 13 default categories
      this.categories = JSON.parse(JSON.stringify(defaultCategories));
    },

    saveCategories() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.categories));
      } catch (e) {
        console.warn('Could not save categories to local storage.', e);
      }
    },

    loadQuickAccess() {
      try {
        const raw = localStorage.getItem(QA_STORAGE_KEY) || localStorage.getItem('websiteOrganizerQuickAccessV1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.quickAccessList = parsed.slice(0, 5);
            return;
          }
        }
      } catch (e) {}

      this.quickAccessList = [...defaultQuickAccess];
    },

    resetQuickAccessToDefault() {
      this.quickAccessList = JSON.parse(JSON.stringify(defaultQuickAccess));
      this.saveQuickAccess();
    },

    saveQuickAccess() {
      try {
        localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(this.quickAccessList));
      } catch (e) {}
    },

    recordLinkHistory(link) {
      if (!link) return;
      if (!Array.isArray(link.history)) link.history = [];
      link.history.unshift(Date.now());
      if (link.history.length > 15) {
        link.history = link.history.slice(0, 15);
      }
      this.saveCategories();
    },

    initSavedTheme() {
      try {
        const saved = localStorage.getItem('websiteOrganizerThemeSettingsV3');
        if (saved) {
          const theme = JSON.parse(saved);
          if (theme.type === 'color') {
            document.body.style.backgroundColor = theme.value;
            document.body.style.backgroundImage = 'none';
          } else if (theme.type === 'image') {
            document.body.style.backgroundColor = '#101820';
            document.body.style.backgroundImage = `linear-gradient(rgba(16, 24, 32, .38), rgba(16, 24, 32, .38)), url("${theme.value}")`;
          }
        }
      } catch (e) {}
    },

    // ── Import & Export Data ──────────────────────────────────────────

    bindImportExport() {
      const exportBtn = document.getElementById('exportDataButton');
      const importBtn = document.getElementById('importDataButton');
      const fileInput = document.getElementById('importFileInput');

      exportBtn?.addEventListener('click', () => {
        if (window.UI) window.UI.closeActionMenu();
        const backup = {
          version: 2,
          exportedAt: new Date().toISOString(),
          categories: this.categories,
          quickAccess: this.quickAccessList
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'websites-world-backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      importBtn?.addEventListener('click', () => {
        if (window.UI) window.UI.closeActionMenu();
        if (fileInput) {
          fileInput.value = '';
          fileInput.click();
        }
      });

      fileInput?.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            let importedCats = null;
            if (Array.isArray(data)) importedCats = data;
            else if (data && Array.isArray(data.categories)) importedCats = data.categories;

            if (importedCats && importedCats.length) {
              this.categories = importedCats;
              if (data && Array.isArray(data.quickAccess)) {
                this.quickAccessList = data.quickAccess.slice(0, 5);
                this.saveQuickAccess();
              }
              this.saveCategories();
              if (window.UI) window.UI.render();
              alert('✅ Backup imported successfully!');
            }
          } catch (err) {
            alert('Could not read the backup JSON file.');
          }
        };
        reader.readAsText(file);
      });
    },

    // ── Sync & Share Logic ────────────────────────────────────────────

    bindSyncShare() {
      const syncShareBtn = document.getElementById('syncShareButton');
      const overlay = document.getElementById('syncShareOverlay');
      const genBtn = document.getElementById('syncShareGenerateBtn');
      const loadBtn = document.getElementById('syncShareLoadBtn');
      const codeInput = document.getElementById('syncShareCodeInput');
      const codeDisplay = document.getElementById('syncShareCodeDisplay');
      const resultBox = document.getElementById('syncShareResultBox');
      const copyBtn = document.getElementById('syncShareCopyBtn');
      const statusEl = document.getElementById('syncShareLoadStatus');

      syncShareBtn?.addEventListener('click', () => {
        if (window.UI) window.UI.closeActionMenu();
        if (overlay) overlay.hidden = false;
        if (codeInput) codeInput.value = '';
        if (resultBox) resultBox.style.display = 'none';
        if (statusEl) statusEl.style.display = 'none';
      });

      genBtn?.addEventListener('click', async () => {
        genBtn.disabled = true;
        genBtn.textContent = '⏳ Generating code...';

        try {
          const payload = this.categories.map(c => ({
            n: c.name,
            l: (c.links || []).map(l => ({ n: l.name, u: l.url, d: l.description || '' }))
          }));
          const token = 'WW-' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
          if (codeDisplay) codeDisplay.textContent = token;
          if (resultBox) resultBox.style.display = 'flex';
        } catch (e) {
          alert('Could not generate share code.');
        } finally {
          genBtn.disabled = false;
          genBtn.textContent = '⚡ Generate Share Code';
        }
      });

      copyBtn?.addEventListener('click', async () => {
        const code = codeDisplay ? codeDisplay.textContent : '';
        if (code) {
          try {
            await navigator.clipboard.writeText(code);
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
          } catch (e) {
            prompt('Your share code:', code);
          }
        }
      });

      loadBtn?.addEventListener('click', () => {
        const code = codeInput ? codeInput.value.trim() : '';
        if (!code) {
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#f87171';
            statusEl.textContent = 'Please enter a valid share code.';
          }
          return;
        }

        try {
          if (code.startsWith('WW-')) {
            const raw = decodeURIComponent(escape(atob(code.slice(3))));
            const compact = JSON.parse(raw);
            if (Array.isArray(compact)) {
              this.categories = compact.map((c, i) => ({
                id: 'cat-' + Date.now() + '-' + i,
                name: c.n || 'Category ' + (i + 1),
                links: (c.l || []).map((l, j) => ({
                  id: 'link-' + Date.now() + '-' + j,
                  name: l.n || 'Site',
                  url: l.u || 'https://google.com',
                  description: l.d || '',
                  createdAt: Date.now(),
                  history: []
                }))
              }));
              this.saveCategories();
              if (window.UI) window.UI.render();

              if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = '#4ade80';
                statusEl.textContent = '✅ Preset loaded successfully!';
              }
              setTimeout(() => {
                if (overlay) overlay.hidden = true;
              }, 1200);
              return;
            }
          }
          throw new Error('Unrecognized preset format.');
        } catch (err) {
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#f87171';
            statusEl.textContent = '❌ Failed to load preset. Check the code.';
          }
        }
      });
    }
  };

  window.App = App;

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})(window);
