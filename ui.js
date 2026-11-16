/**
 * ui.js
 * User Interface Controller & Renderer
 * Handles the 4-column category grid, top-nav quick access bar, theme side-panel with click-outside dismissal,
 * keyboard shortcuts (Ctrl+A, Ctrl+F, Esc), and modal dialogs.
 */

(function (window) {
  'use strict';

  const $ = id => document.getElementById(id);

  const CURATED_FONTS = [
    { id: 'newsreader', name: 'Newsreader', family: "'Newsreader', Georgia, serif", style: 'italic' },
    { id: 'playfair', name: 'Playfair Display', family: "'Playfair Display', Georgia, serif", style: 'normal' },
    { id: 'lora', name: 'Lora', family: "'Lora', Georgia, serif", style: 'normal' },
    { id: 'merriweather', name: 'Merriweather', family: "'Merriweather', Georgia, serif", style: 'normal' },
    { id: 'cinzel', name: 'Cinzel', family: "'Cinzel', serif", style: 'normal' },
    { id: 'inter', name: 'Inter', family: "'Inter', sans-serif", style: 'normal' },
    { id: 'roboto', name: 'Roboto', family: "'Roboto', sans-serif", style: 'normal' },
    { id: 'outfit', name: 'Outfit', family: "'Outfit', sans-serif", style: 'normal' },
    { id: 'plus-jakarta', name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", style: 'normal' },
    { id: 'space-grotesk', name: 'Space Grotesk', family: "'Space Grotesk', sans-serif", style: 'normal' },
    { id: 'fira-code', name: 'Fira Code', family: "'Fira Code', monospace", style: 'normal' },
    { id: 'caveat', name: 'Caveat', family: "'Caveat', cursive", style: 'normal' }
  ];


  // State
  let openCategoryIds = new Set();
  let searchAutoOpenIds = new Set();
  let editMode = false;
  let editingCategoryId = null;
  let renamingCategoryId = null;
  let editingLinkId = null;
  let draftCategoryActive = false;
  let linkFormCategoryId = null;
  let formError = '';
  let editLinkFormError = '';
  let activeDialogLink = null;
  let pendingUnsavedSite = null;
  let undoAction = null;
  let undoTimer = null;
  let lastColumnCount = 4;

  const UI = {
    
    // ── Favicon 3-Source Fallback (Section 4) ─────────────────────────

    getCleanRootHost(url) {
      if (!url) return '';
      try {
        const formatted = /^https?:\/\//i.test(url) ? url : 'https://' + url;
        const u = new URL(formatted);
        return u.hostname.replace(/^www\./i, '');
      } catch (e) {
        return '';
      }
    },

    loadFaviconWithFallback(imgEl, rawUrl, onAllFailed) {
      const host = this.getCleanRootHost(rawUrl);
      if (!host) {
        if (typeof onAllFailed === 'function') onAllFailed();
        return;
      }

      const sources = [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
        `https://${host}/favicon.ico`
      ];

      let sourceIndex = 0;
      imgEl.onerror = () => {
        sourceIndex++;
        if (sourceIndex < sources.length) {
          imgEl.src = sources[sourceIndex];
        } else {
          imgEl.onerror = null;
          if (typeof onAllFailed === 'function') onAllFailed();
        }
      };

      imgEl.src = sources[0];
    },

    // ── Text Font Picker (Section 4) ──────────────────────────────────

    initFontPicker() {
      const pickerBtn = $('fontPickerBtn');
      const dropdown = $('fontDropdownList');
      if (!pickerBtn || !dropdown) return;

      dropdown.replaceChildren();
      const savedFontId = localStorage.getItem('websiteOrganizerFontPreference') || 'newsreader';

      CURATED_FONTS.forEach(font => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'font-option-btn' + (font.id === savedFontId ? ' active' : '');
        opt.dataset.fontId = font.id;
        opt.style.fontFamily = font.family;
        opt.style.fontStyle = font.style;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-option-name';
        nameSpan.textContent = font.name;

        const sampleSpan = document.createElement('span');
        sampleSpan.className = 'font-option-sample';
        sampleSpan.textContent = 'Website Organizer';

        opt.append(nameSpan, sampleSpan);

        opt.addEventListener('click', e => {
          e.stopPropagation();
          this.applyFont(font.id);
          dropdown.hidden = true;
          pickerBtn.setAttribute('aria-expanded', 'false');
        });

        dropdown.appendChild(opt);
      });

      pickerBtn.addEventListener('click', e => {
        e.stopPropagation();
        const willOpen = dropdown.hidden;
        dropdown.hidden = !willOpen;
        pickerBtn.setAttribute('aria-expanded', String(willOpen));
      });

      document.addEventListener('click', e => {
        if (!dropdown.hidden && !pickerBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.hidden = true;
          pickerBtn.setAttribute('aria-expanded', 'false');
        }
      });
    },

    applyFont(fontId) {
      const font = CURATED_FONTS.find(f => f.id === fontId) || CURATED_FONTS[0];
      document.documentElement.style.setProperty('--app-font-family', font.family);
      document.documentElement.style.setProperty('--app-font-style', font.style);

      const activeName = $('fontPickerActiveName');
      if (activeName) activeName.textContent = font.name;

      const preview = $('fontPickerPreview');
      if (preview) {
        preview.style.fontFamily = font.family;
        preview.style.fontStyle = font.style;
      }

      document.querySelectorAll('.font-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fontId === font.id);
      });

      localStorage.setItem('websiteOrganizerFontPreference', font.id);
    },

    init() {
      this.bindThemePanel();
      this.bindShortcuts();
      this.bindSystemModals();
      this.initFontPicker();
      this.bindActionMenu();
      this.bindSearch();
    },

    // ── Toast & Undo Notifications ──────────────────────────────────

    showToast(message) {
      const toast = $('undoToast');
      const msg = $('undoMessage');
      const undoBtn = $('undoButton');
      if (!toast || !msg) return;

      clearTimeout(undoTimer);
      undoAction = null;
      msg.textContent = message;
      if (undoBtn) undoBtn.hidden = true;
      toast.hidden = false;

      undoTimer = setTimeout(() => {
        toast.hidden = true;
      }, 3500);
    },

    showUndo(message, action) {
      const toast = $('undoToast');
      const msg = $('undoMessage');
      const undoBtn = $('undoButton');
      if (!toast || !msg) return;

      clearTimeout(undoTimer);
      undoAction = action;
      msg.textContent = message;
      if (undoBtn) undoBtn.hidden = false;
      toast.hidden = false;

      undoTimer = setTimeout(() => {
        undoAction = null;
        toast.hidden = true;
      }, 8000);
    },

    performUndo() {
      if (!undoAction) return;
      const action = undoAction;
      clearTimeout(undoTimer);
      undoAction = null;
      $('undoToast').hidden = true;

      if (action.type === 'link') {
        const category = window.App.categories.find(item => item.id === action.categoryId);
        if (category) {
          category.links.splice(Math.min(action.index, category.links.length), 0, action.link);
        }
      } else if (action.type === 'category') {
        window.App.categories.splice(Math.min(action.index, window.App.categories.length), 0, action.category);
        if (action.wasOpen || editMode) openCategoryIds.add(action.category.id);
      }

      window.App.saveCategories();
      this.render();
    },

    // ── Top Navigation Bar: Quick Access Slots ───────────────────────

    renderQuickAccessBar() {
      const container = $('quickNavSlots');
      if (!container) return;
      container.innerHTML = '';

      const isEdit = document.body.classList.contains('edit-mode');
      const list = window.App.quickAccessList.slice(0, 5);

      list.forEach((item, index) => {
        const slot = document.createElement('div');
        slot.className = 'qa-slot';
        slot.dataset.index = index;

        if (isEdit) {
          slot.setAttribute('draggable', 'true');

          slot.addEventListener('dragstart', e => {
            window.App.draggedQAIndex = index;
            slot.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
          });

          slot.addEventListener('dragend', () => {
            slot.classList.remove('dragging');
            window.App.draggedQAIndex = null;
            document.querySelectorAll('.qa-slot').forEach(s => s.classList.remove('drag-over'));
          });

          slot.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            slot.classList.add('drag-over');
          });

          slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
          });

          slot.addEventListener('drop', e => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            const dragged = window.App.draggedQAIndex;
            if (dragged !== null && dragged !== index) {
              const moved = window.App.quickAccessList.splice(dragged, 1)[0];
              window.App.quickAccessList.splice(index, 0, moved);
              window.App.saveQuickAccess();
              UI.renderQuickAccessBar();
            }
          });
        }

        const btn = document.createElement('button');
        btn.className = 'qa-logo-btn';
        btn.type = 'button';
        btn.title = item.name || 'Quick Access';

        let faviconUrl = item.icon;
        if (!faviconUrl && item.url) {
          try {
            const u = new URL(item.url);
            faviconUrl = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(u.hostname) + '&sz=64';
          } catch (e) {
            faviconUrl = '';
          }
        }

        const img = document.createElement('img');
        img.alt = item.name || 'Site';
        this.loadFaviconWithFallback(img, item.url || item.icon, () => {
          img.remove();
          const fallback = document.createElement('span');
          fallback.className = 'qa-fallback-icon emoji-icon';
          const initials = (item.name || 'W').trim().charAt(0).toUpperCase();
          fallback.textContent = initials || '🌐';
          btn.appendChild(fallback);
        });
        btn.appendChild(img);

        // Guest Auth Trigger on Click & History Tracking
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (editMode) return;
          const targetUrl = item.url;
          if (!window.App.isValidHttpUrl(targetUrl)) {
            UI.showToast('⚠️ Blocked opening unsafe website address.');
            return;
          }

          // Record history if website exists in categories
          let foundLink = null;
          for (const cat of (window.App.categories || [])) {
            const match = (cat.links || []).find(l => l.url === targetUrl || l.name === item.name);
            if (match) {
              foundLink = match;
              break;
            }
          }
          if (foundLink) {
            window.App.recordLinkHistory(foundLink);
          }
          if (window.AuthService) {
            window.AuthService.requireAuth(() => {
              if (item.url) window.open(item.url, '_blank');
            }, 'Sign in to access quick-navigation websites.');
          } else if (item.url) {
            window.open(item.url, '_blank');
          }
        });

        slot.appendChild(btn);

        // Minus badge in Edit Mode
        const removeBadge = document.createElement('button');
        removeBadge.className = 'qa-remove-badge';
        removeBadge.type = 'button';
        removeBadge.title = 'Remove ' + item.name;
        const removeIcon = document.createElement('span');
        removeIcon.className = 'emoji-icon';
        removeIcon.textContent = '−';
        removeBadge.appendChild(removeIcon);
        removeBadge.addEventListener('click', e => {
          e.stopPropagation();
          window.App.quickAccessList.splice(index, 1);
          window.App.saveQuickAccess();
          UI.renderQuickAccessBar();
        });
        slot.appendChild(removeBadge);

        container.appendChild(slot);
      });

      // Show plus button for empty slots (< 5) when in edit mode
      if (isEdit && window.App.quickAccessList.length < 5) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'qa-slot';
        const addBtn = document.createElement('button');
        addBtn.className = 'qa-empty-slot-btn';
        addBtn.type = 'button';
        addBtn.title = 'Add Quick Access Website';
        const addIcon = document.createElement('span');
        addIcon.className = 'emoji-icon';
        addIcon.textContent = '＋';
        addBtn.appendChild(addIcon);
        addBtn.addEventListener('click', e => {
          e.stopPropagation();
          UI.openQAPicker();
        });
        emptySlot.appendChild(addBtn);
        container.appendChild(emptySlot);
      }
    },

    openQAPicker() {
      const modal = $('qaPickerModal');
      const bodyEl = $('qaPickerBody');
      if (!modal || !bodyEl) return;

      bodyEl.innerHTML = '';
      const categories = window.App.categories || [];

      if (categories.length === 0) {
        bodyEl.innerHTML = '<p style="color:rgba(255,255,255,0.6);text-align:center;padding:16px;">No categories found.</p>';
      } else {
        categories.forEach(cat => {
          if (!cat.links || cat.links.length === 0) return;
          const group = document.createElement('div');
          group.className = 'qa-picker-cat-group';

          const head = document.createElement('div');
          head.className = 'qa-picker-cat-head';

          // Safe DOM rendering (Section 5)
          const catNameSpan = document.createElement('span');
          catNameSpan.textContent = `${cat.name} (${cat.links.length})`;
          const catArrowSpan = document.createElement('span');
          catArrowSpan.className = 'emoji-icon';
          catArrowSpan.style.fontSize = '11px';
          catArrowSpan.style.opacity = '0.6';
          catArrowSpan.textContent = '▾';
          head.append(catNameSpan, catArrowSpan);

          head.addEventListener('click', () => {
            document.querySelectorAll('.qa-picker-cat-group.open').forEach(g => {
              if (g !== group) g.classList.remove('open');
            });
            group.classList.toggle('open');
          });

          const linksCont = document.createElement('div');
          linksCont.className = 'qa-picker-links';

          cat.links.forEach(l => {
            const itemRow = document.createElement('div');
            itemRow.className = 'qa-picker-link-item';

            const iconSlot = document.createElement('span');
            iconSlot.className = 'qa-picker-icon-slot';

            const img = document.createElement('img');
            img.alt = '';
            img.className = 'qa-picker-icon-img';
            this.loadFaviconWithFallback(img, l.url || l.icon, () => {
              img.remove();
              const globe = document.createElement('span');
              globe.className = 'globe-fallback emoji-icon';
              globe.textContent = '🌐';
              iconSlot.appendChild(globe);
            });
            iconSlot.appendChild(img);

            const titleSpan = document.createElement('span');
            titleSpan.className = 'qa-picker-link-title';
            titleSpan.textContent = l.name || l.url;

            itemRow.appendChild(iconSlot);
            itemRow.appendChild(titleSpan);

            itemRow.addEventListener('click', () => {
              if (window.App.quickAccessList.length >= 5) {
                alert('Maximum 5 quick access websites allowed. Remove one first.');
                modal.hidden = true;
                return;
              }
              window.App.quickAccessList.push({
                name: l.name || 'Site',
                url: l.url,
                icon: iconSrc || ''
              });
              window.App.saveQuickAccess();
              UI.renderQuickAccessBar();
              modal.hidden = true;
            });

            linksCont.appendChild(itemRow);
          });

          group.appendChild(head);
          group.appendChild(linksCont);
          bodyEl.appendChild(group);
        });
      }

      modal.hidden = false;
    },

    // ── Main Category Grid Rendering (4-Column Layout) ───────────────

    getColumnCount() {
      const containerWidth = $('mainContent').clientWidth || window.innerWidth;
      if (containerWidth < 600) return 1;
      if (containerWidth < 900) return 2;
      if (containerWidth < 1150) return 3;
      return 4;
    },

    render() {
      const searchInput = $('siteSearch');
      const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const categoriesContainer = $('categories');
      if (!categoriesContainer) return;

      const columnCount = this.getColumnCount();
      lastColumnCount = columnCount;
      categoriesContainer.replaceChildren();

      const columns = [];
      for (let i = 0; i < columnCount; i++) {
        const col = document.createElement('div');
        col.className = 'category-column';
        columns.push(col);
        categoriesContainer.append(col);
      }

      let hasVisibleCategory = false;
      const categories = window.App.categories || [];

      categories.forEach((category, index) => {
        const card = this.buildCategoryCard(category, query);
        if (!card.hidden) hasVisibleCategory = true;
        columns[index % columnCount].append(card);
      });

      if (draftCategoryActive) {
        columns[categories.length % columnCount].append(this.buildDraftCard());
      }

      const noRes = $('noResults');
      if (noRes) noRes.hidden = !query || hasVisibleCategory;

      const editBtn = $('editModeButton');
      if (editBtn) {
        editBtn.textContent = editMode ? '✓ Finish editing' : '✏ Edit category';
      }

      this.renderQuickAccessBar();
    },

    buildCategoryCard(category, query) {
      // Section 1: Strictly preserve manual priority order (no auto-sorting by history)
      const links = category.links || [];
      const matchingLinks = links.filter(link =>
        !query || (link.name && link.name.toLowerCase().includes(query))
      );

      const card = document.createElement('section');
      card.className = 'card';
      card.dataset.categoryId = category.id;
      card.hidden = Boolean(query && matchingLinks.length === 0);

      // Section 3: Handle-free Category Drag-and-Drop & live shift preview animation
      if (editMode) {
        card.setAttribute('draggable', 'true');

        card.addEventListener('dragstart', e => {
          if (e.target.closest('.link-row') || e.target.closest('input') || e.target.closest('button')) {
            return;
          }
          window.App.draggedCategory = category;
          card.classList.add('dragging-card');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', 'category:' + category.id);
        });

        card.addEventListener('dragover', e => {
          if (window.App.draggedCategory && window.App.draggedCategory.id !== category.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
              card.classList.add('shift-down');
              card.classList.remove('shift-up');
            } else {
              card.classList.add('shift-up');
              card.classList.remove('shift-down');
            }
          } else if (window.App.draggedLinkInfo && window.App.draggedLinkInfo.categoryId !== category.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('category-target');
          }
        });

        card.addEventListener('dragleave', () => {
          card.classList.remove('shift-down', 'shift-up', 'category-target');
        });

        card.addEventListener('drop', e => {
          e.preventDefault();
          card.classList.remove('shift-down', 'shift-up', 'category-target');
          if (window.App.draggedCategory) {
            const fromId = window.App.draggedCategory.id;
            const toId = category.id;
            if (fromId !== toId) {
              const categories = window.App.categories;
              const fromIdx = categories.findIndex(c => c.id === fromId);
              const toIdx = categories.findIndex(c => c.id === toId);
              if (fromIdx !== -1 && toIdx !== -1) {
                const [moved] = categories.splice(fromIdx, 1);
                categories.splice(toIdx, 0, moved);
                window.App.saveCategories();
                UI.render();
              }
            }
          } else if (window.App.draggedLinkInfo) {
            const info = window.App.draggedLinkInfo;
            if (info.categoryId !== category.id) {
              const fromCat = window.App.categories.find(c => c.id === info.categoryId);
              if (fromCat) {
                const lIdx = fromCat.links.findIndex(l => l.id === info.linkId);
                if (lIdx !== -1) {
                  const [moved] = fromCat.links.splice(lIdx, 1);
                  category.links.push(moved);
                  window.App.saveCategories();
                  UI.render();
                }
              }
            }
          }
        });

        card.addEventListener('dragend', () => {
          document.querySelectorAll('.card, .link-row').forEach(el => {
            el.classList.remove('dragging-card', 'dragging-row', 'shift-down', 'shift-up', 'category-target');
          });
          window.App.draggedCategory = null;
          window.App.draggedLinkInfo = null;
        });
      }

      const heading = document.createElement('h2');
      heading.className = 'category-heading';

      // Renaming in edit mode
      if (editMode && renamingCategoryId === category.id) {
        const renameForm = document.createElement('form');
        renameForm.className = 'category-rename-form';
        const renameInput = document.createElement('input');
        renameInput.className = 'category-rename-input';
        renameInput.value = category.name;
        renameInput.maxLength = 50;
        renameInput.required = true;

        renameForm.append(renameInput);
        heading.append(renameForm);

        requestAnimationFrame(() => {
          renameInput.focus();
          renameInput.select();
        });

        const commitRename = () => {
          const newName = renameInput.value.trim();
          if (newName && newName !== category.name) {
            category.name = newName;
            window.App.saveCategories();
          }
          renamingCategoryId = null;
          UI.render();
        };

        renameForm.addEventListener('submit', e => {
          e.preventDefault();
          commitRename();
        });

        renameInput.addEventListener('blur', () => {
          setTimeout(() => {
            if (renamingCategoryId === category.id) commitRename();
          }, 140);
        });
      } else {
        const titleButton = document.createElement('button');
        titleButton.className = 'category-title';
        titleButton.type = 'button';
        titleButton.textContent = category.name;
        titleButton.title = editMode ? 'Double-click to rename' : 'Click to open/close';

        const isOpen = editMode || openCategoryIds.has(category.id) || searchAutoOpenIds.has(category.id);
        titleButton.setAttribute('aria-expanded', String(isOpen));
        // Section 2 Fix: Never disable titleButton so dblclick works cleanly in Edit Mode
        titleButton.disabled = false;

        titleButton.addEventListener('click', e => {
          if (editMode) return;
          const currentlyOpen = openCategoryIds.has(category.id) || searchAutoOpenIds.has(category.id);
          if (e.ctrlKey) {
            if (currentlyOpen) {
              openCategoryIds.delete(category.id);
              searchAutoOpenIds.delete(category.id);
            } else {
              openCategoryIds.add(category.id);
              searchAutoOpenIds.delete(category.id);
            }
          } else {
            openCategoryIds.clear();
            searchAutoOpenIds.clear();
            if (!currentlyOpen) openCategoryIds.add(category.id);
          }
          UI.render();
        });

        if (editMode) {
          titleButton.addEventListener('dblclick', e => {
            e.preventDefault();
            e.stopPropagation();
            renamingCategoryId = category.id;
            UI.render();
          });
        }

        heading.append(titleButton);
      }

      if (editMode) {
        const pencil = document.createElement('button');
        pencil.className = 'pencil-button';
        pencil.type = 'button';
        const pencilIcon = document.createElement('span');
        pencilIcon.className = 'emoji-icon';
        pencilIcon.textContent = '✏';
        pencil.appendChild(pencilIcon);
        pencil.title = 'Edit links in ' + category.name;
        pencil.addEventListener('click', e => {
          e.stopPropagation();
          editingCategoryId = editingCategoryId === category.id ? null : category.id;
          linkFormCategoryId = null;
          formError = '';
          UI.render();
        });
        heading.append(pencil);
      }

      card.append(heading);

      const isOpen = editMode || openCategoryIds.has(category.id) || searchAutoOpenIds.has(category.id);
      const linksPanel = document.createElement('div');
      linksPanel.className = 'category-links';
      linksPanel.hidden = !isOpen;
      card.classList.toggle('is-collapsed', !isOpen);

      if (matchingLinks.length === 0 && !query) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-category';
        emptyMsg.textContent = 'No websites yet. Click pencil to add.';
        linksPanel.append(emptyMsg);
      }

      const showRemove = editMode && editingCategoryId === category.id;
      matchingLinks.forEach(link => {
        linksPanel.append(this.buildWebsiteLink(category, link, showRemove));
      });

      if (showRemove) {
        if (linkFormCategoryId === category.id) {
          linksPanel.append(this.buildAddLinkForm(category));
        }

        const editorActions = document.createElement('div');
        editorActions.className = 'category-editor-actions';

        const addLinkBtn = document.createElement('button');
        addLinkBtn.className = 'editor-button add-link-button';
        addLinkBtn.type = 'button';
        addLinkBtn.textContent = '＋ Add link';
        addLinkBtn.addEventListener('click', () => {
          linkFormCategoryId = category.id;
          formError = '';
          UI.render();
        });

        const removeCatBtn = document.createElement('button');
        removeCatBtn.className = 'editor-button remove-category-button';
        removeCatBtn.type = 'button';
        removeCatBtn.textContent = '− Remove category';
        removeCatBtn.addEventListener('click', () => {
          this.removeCategory(category);
        });

        editorActions.append(addLinkBtn, removeCatBtn);
        linksPanel.append(editorActions);
      }

      card.append(linksPanel);
      return card;
    },

    buildWebsiteLink(category, link, showRemove) {
      if (editMode && editingLinkId === link.id) {
        return this.buildEditLinkForm(category, link);
      }

      const row = document.createElement('div');
      row.className = 'link-row';
      row.dataset.categoryId = category.id;
      row.dataset.linkId = link.id;

      // Section 3: Handle-free Link Drag-and-Drop & live shift preview animation in Edit Mode
      if (editMode) {
        row.setAttribute('draggable', 'true');

        row.addEventListener('dragstart', e => {
          e.stopPropagation();
          window.App.draggedLinkInfo = { categoryId: category.id, linkId: link.id, link: link };
          row.classList.add('dragging-row');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', 'link:' + link.id);
        });

        row.addEventListener('dragover', e => {
          if (window.App.draggedLinkInfo) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (window.App.draggedLinkInfo.linkId !== link.id) {
              const rect = row.getBoundingClientRect();
              const midY = rect.top + rect.height / 2;
              if (e.clientY < midY) {
                row.classList.add('shift-down');
                row.classList.remove('shift-up');
              } else {
                row.classList.add('shift-up');
                row.classList.remove('shift-down');
              }
            }
          }
        });

        row.addEventListener('dragleave', () => {
          row.classList.remove('shift-down', 'shift-up');
        });

        row.addEventListener('drop', e => {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('shift-down', 'shift-up');
          if (window.App.draggedLinkInfo) {
            const info = window.App.draggedLinkInfo;
            const fromCat = window.App.categories.find(c => c.id === info.categoryId);
            const toCat = category;
            if (fromCat && toCat) {
              const fromIdx = fromCat.links.findIndex(l => l.id === info.linkId);
              const toIdx = toCat.links.findIndex(l => l.id === link.id);
              if (fromIdx !== -1 && toIdx !== -1) {
                const [moved] = fromCat.links.splice(fromIdx, 1);
                const rect = row.getBoundingClientRect();
                const insertIdx = (e.clientY > rect.top + rect.height / 2) ? toIdx + 1 : toIdx;
                toCat.links.splice(insertIdx, 0, moved);
                window.App.saveCategories();
                UI.render();
              }
            }
          }
        });

        row.addEventListener('dragend', () => {
          document.querySelectorAll('.card, .link-row').forEach(el => {
            el.classList.remove('dragging-card', 'dragging-row', 'shift-down', 'shift-up', 'category-target');
          });
          window.App.draggedLinkInfo = null;
        });
      }

      const anchor = document.createElement('a');
      anchor.className = 'website-link';
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.draggable = false;

      const dot = document.createElement('span');
      dot.className = 'dot emoji-icon';
      dot.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'website-name';
      name.textContent = link.name;

      const logo = this.makeLogo(link.url, link.name);
      anchor.append(dot, name, logo);

      // Guest Auth Intercept on Click & Strict URL Validation (Section 5)
      anchor.addEventListener('click', e => {
        if (editMode) {
          e.preventDefault();
          return;
        }

        e.preventDefault();
        if (!window.App.isValidHttpUrl(link.url)) {
          UI.showToast('⚠️ Blocked opening unsafe website address.');
          return;
        }

        if (window.AuthService) {
          window.AuthService.requireAuth(() => {
            window.App.recordLinkHistory(link);
            window.open(link.url, '_blank');
          }, 'Sign in to access and open saved websites.');
        } else {
          window.open(link.url, '_blank');
        }
      });

      if (editMode) {
        anchor.title = link.name + ' · Double-click to edit name or address';
        anchor.addEventListener('dblclick', e => {
          e.preventDefault();
          editingLinkId = link.id;
          UI.render();
        });
      } else {
        anchor.title = link.name + ' · Right-click for details & history';
        anchor.addEventListener('contextmenu', e => {
          e.preventDefault();
          UI.openLinkDetailsDialog(category, link);
        });
      }

      row.append(anchor);

      if (showRemove) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-link';
        removeBtn.type = 'button';
        removeBtn.textContent = '−';
        removeBtn.title = 'Remove ' + link.name;
        removeBtn.addEventListener('click', () => {
          this.removeLink(category, link);
        });
        row.append(removeBtn);
      }

      return row;
    },

    makeLogo(url, websiteName) {
      const slot = document.createElement('span');
      slot.className = 'logo-slot';

      const img = document.createElement('img');
      img.className = 'site-logo';
      img.alt = '';
      img.loading = 'lazy';
      img.draggable = false;

      const fallback = document.createElement('span');
      fallback.className = 'logo-fallback emoji-icon';
      const initials = (websiteName || 'W').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
      fallback.textContent = initials || '🌐';
      fallback.hidden = true;
      slot.append(img, fallback);

      // Chained 3-source favicon fallback (Section 4)
      this.loadFaviconWithFallback(img, url, () => {
        img.hidden = true;
        fallback.hidden = false;
      });

      return slot;
    },

    buildAddLinkForm(category) {
      const form = document.createElement('form');
      form.className = 'link-form';

      const nameInput = document.createElement('input');
      nameInput.name = 'websiteName';
      nameInput.placeholder = 'Website name';
      nameInput.required = true;

      const urlInput = document.createElement('input');
      urlInput.name = 'websiteUrl';
      urlInput.placeholder = 'Website address (e.g. example.com)';
      urlInput.required = true;

      const actions = document.createElement('div');
      actions.className = 'form-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'editor-button save-link-button';
      saveBtn.type = 'submit';
      saveBtn.textContent = 'Save link';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'editor-button cancel-link-button';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        linkFormCategoryId = null;
        formError = '';
        UI.render();
      });

      actions.append(saveBtn, cancelBtn);
      form.append(nameInput, urlInput, actions);

      form.addEventListener('submit', e => {
        e.preventDefault();
        const n = nameInput.value.trim();
        let u = urlInput.value.trim();
        if (!n || !u) return;

        if (!window.App.isValidHttpUrl(u)) {
          alert('Please enter a valid website address starting with http:// or https://');
          return;
        }

        u = window.App.sanitizeHttpUrl(u);
        category.links.push({
          id: 'link-' + Date.now(),
          name: n,
          url: u,
          createdAt: Date.now(),
          description: '',
          history: []
        });

        window.App.saveCategories();
        linkFormCategoryId = null;
        UI.render();
      });

      return form;
    },

    buildEditLinkForm(category, link) {
      const form = document.createElement('form');
      form.className = 'link-form link-edit-form';

      const title = document.createElement('div');
      title.className = 'form-title';
      title.textContent = 'Edit website link';

      const nameInput = document.createElement('input');
      nameInput.value = link.name;
      nameInput.required = true;

      const urlInput = document.createElement('input');
      urlInput.value = link.url;
      urlInput.required = true;

      const actions = document.createElement('div');
      actions.className = 'form-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'editor-button save-link-button';
      saveBtn.type = 'submit';
      saveBtn.textContent = 'Save changes';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'editor-button cancel-link-button';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        editingLinkId = null;
        UI.render();
      });

      actions.append(saveBtn, cancelBtn);
      form.append(title, nameInput, urlInput, actions);

      form.addEventListener('submit', e => {
        e.preventDefault();
        const n = nameInput.value.trim();
        let u = urlInput.value.trim();
        if (!n || !u) return;

        if (!window.App.isValidHttpUrl(u)) {
          alert('Please enter a valid website address starting with http:// or https://');
          return;
        }

        u = window.App.sanitizeHttpUrl(u);
        link.name = n;
        link.url = u;
        window.App.saveCategories();
        editingLinkId = null;
        UI.render();
      });

      return form;
    },

    buildDraftCard() {
      const card = document.createElement('section');
      card.className = 'card draft-card';
      const form = document.createElement('form');
      const heading = document.createElement('h2');
      heading.className = 'category-heading';

      const input = document.createElement('input');
      input.className = 'draft-name';
      input.placeholder = 'New category name';
      input.required = true;

      heading.append(input);
      form.append(heading);

      const cancel = document.createElement('button');
      cancel.className = 'cancel-draft-button';
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => {
        draftCategoryActive = false;
        UI.render();
      });

      form.append(cancel);

      form.addEventListener('submit', e => {
        e.preventDefault();
        const n = input.value.trim();
        if (!n) return;

        window.App.categories.push({
          id: 'cat-' + Date.now(),
          name: n,
          links: []
        });

        draftCategoryActive = false;
        window.App.saveCategories();
        UI.render();
      });

      card.append(form);
      return card;
    },

    removeLink(category, link) {
      const idx = category.links.findIndex(l => l.id === link.id);
      if (idx >= 0) {
        category.links.splice(idx, 1);
        window.App.saveCategories();
        this.showUndo(`Removed “${link.name}”.`, { type: 'link', categoryId: category.id, link, index: idx });
        this.render();
      }
    },

    removeCategory(category) {
      const idx = window.App.categories.findIndex(c => c.id === category.id);
      if (idx >= 0) {
        window.App.categories.splice(idx, 1);
        window.App.saveCategories();
        this.showUndo(`Removed category “${category.name}”.`, { type: 'category', category, index: idx, wasOpen: openCategoryIds.has(category.id) });
        this.render();
      }
    },

    toggleAllCategories() {
      const categories = window.App.categories || [];
      const allOpen = categories.every(cat => openCategoryIds.has(cat.id));

      if (allOpen) {
        openCategoryIds.clear();
        searchAutoOpenIds.clear();
      } else {
        categories.forEach(cat => openCategoryIds.add(cat.id));
      }
      this.render();
    },

    // ── Global Keyboard Shortcuts (Requirement 5) ────────────────────

    bindShortcuts() {
      window.addEventListener('keydown', e => {
        const active = document.activeElement;
        const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

        // Ctrl + A (or Cmd + A): Expand/open all categories simultaneously
        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
          if (!isInput) {
            e.preventDefault();
            this.toggleAllCategories();
            return;
          }
        }

        // Ctrl + F: Focus search box
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          const sb = $('siteSearch');
          if (sb) {
            sb.focus();
            sb.select();
          }
          return;
        }

        // Escape: Dismiss active modals and exit edit mode
        if (e.key === 'Escape') {
          if (!$('qaPickerModal').hidden) { $('qaPickerModal').hidden = true; return; }
          if (!$('quickSaveOverlay').hidden) { $('quickSaveOverlay').hidden = true; return; }
          if (!$('syncShareOverlay').hidden) { $('syncShareOverlay').hidden = true; return; }
          if (!$('contactOverlay').hidden) { $('contactOverlay').hidden = true; return; }
          if (!$('dialogOverlay').hidden) { $('dialogOverlay').hidden = true; return; }
          if (window.AuthService) window.AuthService.closeAllAuthModals();
          if (!$('sidePanel').hidden) { this.closeSidePanel(); return; }

          if (editMode) {
            this.exitEditMode();
            return;
          }

          const sb = $('siteSearch');
          if (sb && sb.value) {
            sb.value = '';
            searchAutoOpenIds.clear();
            this.render();
            sb.blur();
          }
        }
      });
    },

    // ── Theme Side-Panel UX & Click-Outside Dismissal (Requirement 4) ──

    bindThemePanel() {
      const panel = $('sidePanel');
      const trigger = $('themePencilBtn');
      const closeBtn = $('sidePanelClose');
      const resizer = $('panelResizer');

      const openSidePanel = () => {
        panel.hidden = false;
        if (resizer) resizer.hidden = false;
        requestAnimationFrame(() => {
          panel.classList.add('is-open');
        });
      };

      const closeSidePanel = () => {
        panel.classList.remove('is-open');
        setTimeout(() => {
          if (!panel.classList.contains('is-open')) {
            panel.hidden = true;
            if (resizer) resizer.hidden = true;
          }
        }, 320);
      };

      this.closeSidePanel = closeSidePanel;

      trigger?.addEventListener('click', e => {
        e.stopPropagation();
        if (panel.classList.contains('is-open')) closeSidePanel();
        else openSidePanel();
      });

      closeBtn?.addEventListener('click', () => closeSidePanel());

      // Click-Outside Dismissal (Requirement 4)
      document.addEventListener('click', e => {
        if (!panel.hidden && panel.classList.contains('is-open')) {
          if (!panel.contains(e.target) && !trigger.contains(e.target) && !resizer.contains(e.target)) {
            closeSidePanel();
          }
        }
      });

      // Swatches selection
      $('colorsGrid')?.addEventListener('click', e => {
        const btn = e.target.closest('.color-swatch-btn');
        if (!btn) return;
        const color = btn.dataset.color;
        document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.style.backgroundColor = color;
        document.body.style.backgroundImage = 'none';
        try { localStorage.setItem('websiteOrganizerThemeSettingsV3', JSON.stringify({ type: 'color', value: color })); } catch(err){}
      });

      // Themes selection (Misty Valley as default)
      const applyWallpaper = url => {
        document.body.style.backgroundColor = '#101820';
        document.body.style.backgroundImage = `linear-gradient(rgba(16, 24, 32, .38), rgba(16, 24, 32, .38)), url("${url}")`;
        document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
        try { localStorage.setItem('websiteOrganizerThemeSettingsV3', JSON.stringify({ type: 'image', value: url })); } catch(err){}
      };

      $('themesGreeneryGrid')?.addEventListener('click', e => {
        const btn = e.target.closest('.theme-card-btn');
        if (btn && btn.dataset.url) applyWallpaper(btn.dataset.url);
      });

      $('themesStudyGrid')?.addEventListener('click', e => {
        const btn = e.target.closest('.theme-card-btn');
        if (btn && btn.dataset.url) applyWallpaper(btn.dataset.url);
      });

      // Upload Custom Image
      $('uploadImageBtn')?.addEventListener('click', () => $('imageFileInput')?.click());
      $('imageFileInput')?.addEventListener('change', () => {
        const file = $('imageFileInput').files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => applyWallpaper(ev.target.result);
        reader.readAsDataURL(file);
      });

      // Reset to Default "Misty Valley"
      $('resetBgBtn')?.addEventListener('click', () => {
        document.body.style.backgroundColor = '#101820';
        document.body.style.backgroundImage = 'var(--default-bg-image)';
        document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
        try { localStorage.removeItem('websiteOrganizerThemeSettingsV3'); } catch(err){}
      });
    },

    // ── Plus Menu Actions ─────────────────────────────────────────────

    bindActionMenu() {
      const plusBtn = $('plusButton');
      const menu = $('actionMenu');

      const openMenu = () => {
        menu.hidden = false;
        requestAnimationFrame(() => menu.classList.add('is-open'));
      };

      const closeMenu = () => {
        menu.classList.remove('is-open');
        setTimeout(() => {
          if (!menu.classList.contains('is-open')) menu.hidden = true;
        }, 200);
      };

      this.closeActionMenu = closeMenu;

      plusBtn?.addEventListener('click', e => {
        e.stopPropagation();
        if (menu.classList.contains('is-open')) closeMenu();
        else openMenu();
      });

            // Click-Outside to Close Category (Requirement 4)
      document.addEventListener('click', e => {
        if (editMode) return;
        if (openCategoryIds.size === 0 && searchAutoOpenIds.size === 0) return;
        if (
          !e.target.closest('.card') &&
          !e.target.closest('.side-panel') &&
          !e.target.closest('.dialog-overlay') &&
          !e.target.closest('.action-area') &&
          !e.target.closest('.search-field-container') &&
          !e.target.closest('.top-nav-grid') &&
          !e.target.closest('.header')
        ) {
          openCategoryIds.clear();
          searchAutoOpenIds.clear();
          UI.render();
        }
      });
      document.addEventListener('click', e => {
        if (!menu.hidden && !menu.contains(e.target) && !plusBtn.contains(e.target)) {
          closeMenu();
        }
      });

      $('newCategoryButton')?.addEventListener('click', () => {
        closeMenu();
        if (window.AuthService) {
          window.AuthService.requireAuth(() => {
            UI.enterEditMode();
            draftCategoryActive = true;
            UI.render();
          }, 'Sign in to create categories.');
        }
      });

      $('editModeButton')?.addEventListener('click', () => {
        closeMenu();
        if (window.AuthService) {
          window.AuthService.requireAuth(() => {
            if (editMode) UI.exitEditMode();
            else UI.enterEditMode();
          }, 'Sign in to enter edit mode.');
        }
      });
    },

    enterEditMode() {
      editMode = true;
      document.body.classList.add('edit-mode');
      this.render();
    },

    exitEditMode() {
      editMode = false;
      document.body.classList.remove('edit-mode');
      editingCategoryId = null;
      renamingCategoryId = null;
      editingLinkId = null;
      draftCategoryActive = false;
      this.render();
    },

    // ── Search & Fallback Engine ──────────────────────────────────────

    bindSearch() {
      const sb = $('siteSearch');
      const clearBtn = $('searchClearBtn');
      if (!sb) return;

      const updateClearVisibility = () => {
        if (clearBtn) clearBtn.hidden = !sb.value;
      };

      sb.addEventListener('input', () => {
        updateClearVisibility();
        const query = sb.value.trim().toLowerCase();
        searchAutoOpenIds.clear();
        if (query) {
          (window.App.categories || []).forEach(cat => {
            if (cat.links.some(l => (l.name && l.name.toLowerCase().includes(query)) || (l.url && l.url.toLowerCase().includes(query)))) {
              searchAutoOpenIds.add(cat.id);
            }
          });
        }
        UI.render();
        document.querySelectorAll('.fallback-query').forEach(el => el.textContent = query);
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', e => {
          e.preventDefault();
          sb.value = '';
          updateClearVisibility();
          searchAutoOpenIds.clear();
          UI.render();
          sb.focus();
        });
      }

      $('searchGoogleBtn')?.addEventListener('click', () => {
        const q = sb.value.trim();
        if (q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
      });

      $('searchEdgeBtn')?.addEventListener('click', () => {
        const q = sb.value.trim();
        if (q) window.open(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, '_blank');
      });
    },

    // ── System Modals: Link Details, QA Picker, Sync ──────────────────

    bindSystemModals() {
      $('qaPickerCloseBtn')?.addEventListener('click', () => { $('qaPickerModal').hidden = true; });
      $('dialogCloseBtn')?.addEventListener('click', () => { $('dialogOverlay').hidden = true; });
      $('quickSaveCloseBtn')?.addEventListener('click', () => { $('quickSaveOverlay').hidden = true; });
      $('contactCloseBtn')?.addEventListener('click', () => { $('contactOverlay').hidden = true; });
      $('historyToggleBtn')?.addEventListener('click', () => {
        const listEl = $('dialogHistoryList');
        const arrow = $('historyToggleArrow');
        if (!listEl) return;
        const isHidden = listEl.hidden;
        listEl.hidden = !isHidden;
        if (arrow) arrow.textContent = isHidden ? '▴' : '▾';
      });

      // Section 4: Save & Edit Link Description
      $('dialogSaveDescBtn')?.addEventListener('click', () => {
        if (!activeDialogLink) return;
        const newDesc = ($('dialogDescInput').value || '').trim();
        activeDialogLink.description = newDesc;
        window.App.saveCategories();

        if (newDesc) {
          $('dialogDescDisplay').textContent = newDesc;
          $('dialogDescDisplay').hidden = false;
          $('dialogDescInputContainer').hidden = true;
        } else {
          $('dialogDescDisplay').hidden = true;
          $('dialogDescInputContainer').hidden = false;
        }
        UI.showToast('Description saved successfully.');
      });

      $('dialogDescDisplay')?.addEventListener('click', () => {
        $('dialogDescDisplay').hidden = true;
        $('dialogDescInputContainer').hidden = false;
        $('dialogDescInput').focus();
      });
      $('syncShareCloseBtn')?.addEventListener('click', () => { $('syncShareOverlay').hidden = true; });

      $('contactButton')?.addEventListener('click', () => {
        this.closeActionMenu();
        $('contactOverlay').hidden = false;
      });

      $('undoButton')?.addEventListener('click', () => this.performUndo());
    },

    openLinkDetailsDialog(category, link) {
      activeDialogLink = link;
      $('dialogLinkTitle').textContent = link.name;
      $('dialogUploadedTime').textContent = 'Uploaded: ' + new Date(link.createdAt || Date.now()).toLocaleDateString();

      const desc = (link.description || '').trim();
      $('dialogDescInput').value = desc;

      if (desc) {
        $('dialogDescDisplay').textContent = desc;
        $('dialogDescDisplay').hidden = false;
        $('dialogDescInputContainer').hidden = true;
      } else {
        $('dialogDescDisplay').hidden = true;
        $('dialogDescInputContainer').hidden = false;
      }

      // History & Daily Click Counter (Requirement 6)
      const history = Array.isArray(link.history) ? link.history : [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const openedToday = history.filter(ts => new Date(ts).getTime() >= todayStart.getTime()).length;
      const totalCount = history.length;

      const toggleLabel = $('historyToggleLabel');
      if (toggleLabel) {
        toggleLabel.textContent = `🕒 View History (Opened ${openedToday} ${openedToday === 1 ? 'time' : 'times'} today · ${totalCount} total)`;
      }

      const listEl = $('dialogHistoryList');
      const arrow = $('historyToggleArrow');
      if (listEl) {
        listEl.hidden = true;
        listEl.innerHTML = '';
        if (history.length === 0) {
          const li = document.createElement('li');
          li.className = 'dialog-history-item';
          li.style.color = '#94a3b8';
          li.textContent = 'No access history recorded yet.';
          listEl.appendChild(li);
        } else {
          history.slice(0, 15).forEach((ts, idx) => {
            const li = document.createElement('li');
            li.className = 'dialog-history-item';
            const d = new Date(ts);
            const isToday = d.getTime() >= todayStart.getTime();
            li.textContent = `#${idx + 1}: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}${isToday ? ' (Today)' : ''}`;
            listEl.appendChild(li);
          });
        }
      }
      if (arrow) arrow.textContent = '▾';

      $('dialogOverlay').hidden = false;
    }
  };

  window.UI = UI;

})(window);
