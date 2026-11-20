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
    ['work', 'Work', [['LinkedIn', 'https://www.linkedin.com/'], ['GitHub', 'https://github.com/']]],
    ['coding', 'Coding', [['LeetCode', 'https://leetcode.com/'], ['CodeChef', 'https://www.codechef.com/']]],
    ['ai-coding', 'AI Coding', [['Lovable AI', 'https://lovable.dev/'], ['Base44', 'https://base44.com/']]],
    ['typing', 'Typing', [['TypingClub', 'https://www.edclub.com/sportal/'], ['Monkeytype', 'https://monkeytype.com/']]],
    ['social', 'Social', [['YouTube', 'https://www.youtube.com/'], ['Twitter', 'https://twitter.com/']]]
  ].map(([id, name, sites]) => ({
    id: 'cat-' + id,
    name,
    links: sites.map(([siteName, url], index) => ({
      id: 'link-' + id + '-' + (index + 1),
      name: siteName,
      url,
      description: '',
      history: []
    }))
  }));

  // 5 Default Quick Access Logos (Requirement 2)
  const quickAccessNames = new Set(['LinkedIn', 'GitHub', 'LeetCode', 'Monkeytype', 'YouTube']);
  const defaultQuickAccess = defaultCategories.flatMap(category => category.links)
    .filter(link => quickAccessNames.has(link.name))
    .map(({ name, url }) => ({
      name,
      url,
      icon: 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(new URL(url).hostname) + '&sz=64'
    }));

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

      // Seed first-time sessions with the default categories.
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

    moveLink(source, link, destination, anchor = null, after = false) {
      if (!this.categories.includes(source) || !this.categories.includes(destination)) return false;
      const from = source.links.indexOf(link);
      const target = anchor === null ? destination.links.length : destination.links.indexOf(anchor);
      if (from < 0 || target < 0 || anchor === link) return false;

      const boundary = target + Number(anchor !== null && after);
      const sameCategory = source === destination;
      const to = boundary - Number(sameCategory && from < boundary);
      if (sameCategory && from === to) return false;

      source.links.splice(from, 1);
      destination.links.splice(to, 0, link);
      this.saveCategories();
      return true;
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

    
    // ── Security Hardening: Strict URL Validation (Section 5) ─────────

    isValidHttpUrl(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return false;
      const trimmed = rawUrl.trim();
      // Block dangerous schemes explicitly
      if (/^(javascript|data|file|vbscript|about|blob):/i.test(trimmed)) {
        return false;
      }
      try {
        const formatted = /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
        const parsed = new URL(formatted);
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
      } catch (e) {
        return false;
      }
    },

    sanitizeHttpUrl(rawUrl) {
      if (!this.isValidHttpUrl(rawUrl)) return null;
      const trimmed = rawUrl.trim();
      return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
    },

    cleanImportedCategories(categories) {
      if (!Array.isArray(categories)) return [];
      return categories.map(cat => ({
        id: String(cat.id || 'cat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
        name: String(cat.name || 'Category').trim().slice(0, 100),
        links: Array.isArray(cat.links) ? cat.links.filter(l => l && this.isValidHttpUrl(l.url)).map(l => ({
          id: String(l.id || 'link-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
          name: String(l.name || 'Website').trim().slice(0, 100),
          url: this.sanitizeHttpUrl(l.url),
          createdAt: Number(l.createdAt) || Date.now(),
          description: String(l.description || '').slice(0, 500),
          history: Array.isArray(l.history) ? l.history.slice(0, 15) : []
        })) : []
      }));
    },

    cleanImportedQuickAccess(qaList) {
      if (!Array.isArray(qaList)) return [];
      return qaList.filter(item => item && this.isValidHttpUrl(item.url)).map(item => ({
        name: String(item.name || 'Website').trim().slice(0, 50),
        url: this.sanitizeHttpUrl(item.url),
        icon: (item.icon && this.isValidHttpUrl(item.icon)) ? item.icon : ''
      })).slice(0, 5);
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
              this.categories = this.cleanImportedCategories(importedCats);
              if (data && Array.isArray(data.quickAccess)) {
                this.quickAccessList = this.cleanImportedQuickAccess(data.quickAccess);
                this.saveQuickAccess();
              }
              this.saveCategories();
              if (window.UI) window.UI.render();
              alert('✅ Backup imported and validated successfully!');
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
              this.categories = this.cleanImportedCategories(
            compact.map((c, i) => ({
                id: 'cat-' + Date.now() + '-' + i,
                name: c.n || 'Category ' + (i + 1),
                links: (c.l || []).map((l, j) => ({
                  id: 'link-' + Date.now() + '-' + j,
                  name: l.n || 'Site',
                  url: l.u,
                  description: l.d || '',
                  }))
                }))
              );
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
