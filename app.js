/* ══════════════════════════════════════════════════════════
   Notes App — Core Logic
   ══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Storage Key ──
  const STORAGE_KEY = 'notesAppData';

  // ── State ──
  let items = [];
  let currentFolderId = null; // null = root
  let currentEditingNoteId = null;
  let contextMenuItemId = null;
  let saveTimeout = null;

  // ── DOM References ──
  const topBarBack = document.getElementById('top-bar-back');
  const topBarTitle = document.getElementById('top-bar-title');
  const breadcrumbEl = document.getElementById('breadcrumb');
  const contentArea = document.getElementById('content-area');
  const itemList = document.getElementById('item-list');
  const emptyState = document.getElementById('empty-state');

  const fabNewFolder = document.getElementById('fab-new-folder');
  const fabNewNote = document.getElementById('fab-new-note');

  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalInput = document.getElementById('modal-input');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');

  const contextOverlay = document.getElementById('context-overlay');
  const contextTitle = document.getElementById('context-title');
  const contextType = document.getElementById('context-type');
  const contextRename = document.getElementById('context-rename');
  const contextDownload = document.getElementById('context-download');
  const contextDelete = document.getElementById('context-delete');

  const editorView = document.getElementById('editor-view');
  const editorBackBtn = document.getElementById('editor-back-btn');
  const editorTitleInput = document.getElementById('editor-title-input');
  const editorTextarea = document.getElementById('editor-textarea');
  const editorCharCount = document.getElementById('editor-char-count');

  // ── Utility ──
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function now() {
    return new Date().toISOString();
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return 'Oggi, ' + time;
    if (isYesterday) return 'Ieri, ' + time;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ', ' + time;
  }

  // ── Persistence ──
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        items = parsed.items || [];
      }
    } catch (e) {
      console.warn('Notes: failed to load data', e);
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: items }));
    } catch (e) {
      console.warn('Notes: failed to save data', e);
    }
  }

  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 300);
  }

  // ── Data Helpers ──
  function getItem(id) {
    return items.find(function (i) { return i.id === id; });
  }

  function getChildren(parentId) {
    return items.filter(function (i) { return i.parentId === parentId; });
  }

  function getSortedChildren(parentId) {
    const children = getChildren(parentId);
    // Folders first, then notes. Filter out deleted items.
    const folders = children.filter(function (i) { return i.type === 'folder' && !i.deleted; });
    const notes = children.filter(function (i) { return i.type === 'note' && !i.deleted; });
    folders.sort(function (a, b) { 
      return (a.name || '').localeCompare(b.name || ''); 
    });
    notes.sort(function (a, b) { 
      return getNoteTitle(a).localeCompare(getNoteTitle(b)); 
    });
    return folders.concat(notes);
  }

  function getAncestors(folderId) {
    const ancestors = [];
    let current = folderId;
    while (current) {
      const item = getItem(current);
      if (!item) break;
      ancestors.unshift(item);
      current = item.parentId;
    }
    return ancestors;
  }

  function deleteRecursive(id, permanent) {
    if (permanent) {
      const children = getChildren(id);
      children.forEach(function (child) {
        deleteRecursive(child.id, true);
      });
      items = items.filter(function (i) { return i.id !== id; });
    } else {
      const item = getItem(id);
      if (item) {
        item.deleted = true;
        item.deletedAt = now();
      }
    }
  }

  function getNoteTitle(item) {
    if (item.name && item.name.trim()) return item.name;
    if (item.content && item.content.trim()) return item.content.trim().split('\n')[0].trim();
    return 'Nota senza titolo';
  }

  function getNotePreview(content) {
    if (!content || !content.trim()) return '';
    const lines = content.trim().split('\n');
    if (lines.length <= 1) return '';
    // Return second line onwards as preview
    return lines.slice(1).join(' ').trim().substring(0, 100);
  }

  // ── SVG Icons ──
  const ICONS = {
    folder: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    note: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
    chevron: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    plus: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    folderPlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
    notePlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    rename: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    emptyFolder: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
  };

  // ── Render Breadcrumb ──
  function renderBreadcrumb() {
    breadcrumbEl.innerHTML = '';

    // Home
    const homeBtn = document.createElement('button');
    homeBtn.className = 'breadcrumb-item' + (currentFolderId === null ? ' active' : '');
    homeBtn.textContent = 'Notes';
    if (currentFolderId !== null) {
      homeBtn.addEventListener('click', function () {
        navigateToFolder(null);
      });
    }
    breadcrumbEl.appendChild(homeBtn);

    // Ancestors
    const ancestors = getAncestors(currentFolderId);
    ancestors.forEach(function (ancestor, index) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-separator';
      sep.textContent = '›';
      breadcrumbEl.appendChild(sep);

      const btn = document.createElement('button');
      const isLast = index === ancestors.length - 1;
      btn.className = 'breadcrumb-item' + (isLast ? ' active' : '');
      btn.textContent = ancestor.name;
      if (!isLast) {
        btn.addEventListener('click', function () {
          navigateToFolder(ancestor.id);
        });
      }
      breadcrumbEl.appendChild(btn);
    });

    // Scroll to end
    breadcrumbEl.scrollLeft = breadcrumbEl.scrollWidth;
  }

  // ── Render Item List ──
  function renderItems() {
    const sorted = getSortedChildren(currentFolderId);

    itemList.innerHTML = '';

    if (sorted.length === 0) {
      emptyState.style.display = 'flex';
      itemList.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      itemList.style.display = 'flex';

      sorted.forEach(function (item) {
        // Wrapper for swipe/drag
        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-wrapper';
        wrapper.dataset.id = item.id;

        // Background for swipe
        const swipeBg = document.createElement('div');
        swipeBg.className = 'swipe-bg';
        swipeBg.innerHTML = '<div class="icon-left">' + ICONS.trash + '</div><div class="icon-right">' + ICONS.trash + '</div>';
        
        // Main Card
        const card = document.createElement('div');
        card.className = 'item-card';

        // Icon
        const iconDiv = document.createElement('div');
        iconDiv.className = 'item-icon';
        iconDiv.innerHTML = item.type === 'folder' ? ICONS.folder : ICONS.note;

        // Info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = item.type === 'folder' ? item.name : getNoteTitle(item);
        infoDiv.appendChild(nameEl);

        if (item.type === 'note') {
          const preview = getNotePreview(item.content);
          if (preview) {
            const previewEl = document.createElement('div');
            previewEl.className = 'item-preview';
            previewEl.textContent = preview;
            infoDiv.appendChild(previewEl);
          }
        }

        if (item.type === 'folder') {
          const count = getChildren(item.id).length;
          if (count > 0) {
            const previewEl = document.createElement('div');
            previewEl.className = 'item-preview';
            previewEl.textContent = count + (count === 1 ? ' elemento' : ' elementi');
            infoDiv.appendChild(previewEl);
          }
        }

        const dateEl = document.createElement('div');
        dateEl.className = 'item-date';
        dateEl.textContent = formatDate(item.updatedAt);
        infoDiv.appendChild(dateEl);

        card.appendChild(iconDiv);
        card.appendChild(infoDiv);

        // Pencil & Chevron for folders
        if (item.type === 'folder') {
          const renameDiv = document.createElement('div');
          renameDiv.className = 'item-rename-icon';
          renameDiv.innerHTML = ICONS.rename;
          renameDiv.addEventListener('click', function (e) {
            e.stopPropagation();
            modalMode = 'rename';
            modalTargetId = item.id;
            modalTitle.textContent = 'Rinomina';
            modalInput.value = item.name;
            modalInput.placeholder = 'Nuovo nome';
            modalConfirm.textContent = 'Salva';
            modalConfirm.className = 'modal-btn modal-btn-confirm';
            showModal();
          });
          card.appendChild(renameDiv);
        }

        const chevronDiv = document.createElement('div');
        chevronDiv.className = 'item-chevron';
        if (item.type === 'folder') {
          chevronDiv.innerHTML = ICONS.chevron;
        }
        card.appendChild(chevronDiv);

        // Interactions (Click, Swipe, Drag)
        let longPressTimer = null;
        let longPressTriggered = false;
        let isDragging = false;
        let startX = 0, startY = 0;
        let isPointerDown = false;
        let isSwiping = false;
        let isScrolling = false;
        let hasCapturedPointer = false;
        let currentX = 0, currentY = 0;

        card.addEventListener('pointerdown', function (e) {
          if (e.target.closest('.item-rename-icon')) return;
          isPointerDown = true;
          isDragging = false;
          isSwiping = false;
          isScrolling = false;
          hasCapturedPointer = false;
          startX = e.clientX;
          startY = e.clientY;
          // Do NOT capture pointer here — allow native vertical scrolling

          longPressTriggered = false;
          longPressTimer = setTimeout(function () {
            longPressTriggered = true;
            if (navigator.vibrate) navigator.vibrate(25);
            openContextMenu(item.id);
          }, 500);
        });

        card.addEventListener('pointermove', function (e) {
          if (!isPointerDown || isScrolling) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          // Determine gesture direction on first significant movement
          if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
            clearTimeout(longPressTimer);

            if (Math.abs(dy) > Math.abs(dx)) {
              // Vertical movement → user wants to scroll, abort our handling
              isScrolling = true;
              isPointerDown = false;
              return;
            }

            // Horizontal movement → it's a swipe, capture pointer now
            isDragging = true;
            isSwiping = true;
            wrapper.classList.add('swiping');
            try {
              card.setPointerCapture(e.pointerId);
              hasCapturedPointer = true;
            } catch (err) {}
          }

          if (isSwiping) {
            currentX = dx;
            card.style.transform = 'translateX(' + currentX + 'px)';
            const iconLeft = swipeBg.querySelector('.icon-left');
            const iconRight = swipeBg.querySelector('.icon-right');
            if (currentX > 0) {
              var progress = Math.min(1, currentX / 100);
              var iconScale = 0.8 + progress * 0.5;
              iconLeft.style.opacity = Math.min(1, currentX / 40);
              iconLeft.style.transform = 'scale(' + iconScale + ')';
              iconRight.style.opacity = '0';
              iconRight.style.transform = 'scale(0.8)';
            } else {
              var progress = Math.min(1, Math.abs(currentX) / 100);
              var iconScale = 0.8 + progress * 0.5;
              iconRight.style.opacity = Math.min(1, Math.abs(currentX) / 40);
              iconRight.style.transform = 'scale(' + iconScale + ')';
              iconLeft.style.opacity = '0';
              iconLeft.style.transform = 'scale(0.8)';
            }
          }
        });

        function handleRelease(e) {
          if (!isPointerDown) return;
          isPointerDown = false;
          clearTimeout(longPressTimer);

          if (hasCapturedPointer) {
            try { card.releasePointerCapture(e.pointerId); } catch (err) {}
            hasCapturedPointer = false;
          }

          const trashZone = document.getElementById('drag-trash-zone');

          if (isSwiping) {
            if (Math.abs(currentX) > 80) {
              card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
              card.style.transform = 'translateX(' + (currentX > 0 ? 100 : -100) + '%)';
              wrapper.style.transition = 'height 0.3s ease, opacity 0.3s ease, margin 0.3s ease';
              setTimeout(function() {
                wrapper.style.height = '0px';
                wrapper.style.opacity = '0';
                wrapper.style.marginBottom = '0px';
              }, 150);
              setTimeout(function() {
                deleteRecursive(item.id, false);
                saveData();
                renderAll();
              }, 450);
            } else {
              wrapper.classList.remove('swiping');
              card.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
              card.style.transform = '';
              var il = swipeBg.querySelector('.icon-left');
              var ir = swipeBg.querySelector('.icon-right');
              if (il) { il.style.opacity = '0'; il.style.transform = 'scale(0.8)'; }
              if (ir) { ir.style.opacity = '0'; ir.style.transform = 'scale(0.8)'; }
              setTimeout(function() { card.style.transition = ''; }, 300);
            }
          } else if (!isDragging && !longPressTriggered && e.type !== 'pointercancel') {
             const dx = e.clientX !== undefined ? Math.abs(e.clientX - startX) : 0;
             const dy = e.clientY !== undefined ? Math.abs(e.clientY - startY) : 0;
             
             if (dx < 15 && dy < 15) {
               // Tap: open note/folder
               if (item.type === 'folder') {
                 navigateToFolder(item.id);
               } else {
                 openNoteEditor(item.id);
               }
             }
          }
          currentX = 0;
          currentY = 0;
          isSwiping = false;
          isDragging = false;
          isScrolling = false;
          wrapper.classList.remove('swiping');
        }

        card.addEventListener('pointerup', handleRelease);
        card.addEventListener('pointercancel', handleRelease);

        // Clear entry animation after it completes so JS transforms work for swiping
        card.addEventListener('animationend', function () {
          card.style.animation = 'none';
          card.style.opacity = '1';
        }, { once: true });

        wrapper.appendChild(swipeBg);
        wrapper.appendChild(card);
        itemList.appendChild(wrapper);
      });
    }
  }

  // ── Render Top Bar ──
  function renderTopBar() {
    if (currentFolderId === null) {
      topBarBack.classList.add('hidden');
      topBarTitle.textContent = 'Notes';
    } else {
      topBarBack.classList.remove('hidden');
      const folder = getItem(currentFolderId);
      topBarTitle.textContent = folder ? folder.name : 'Notes';
    }
  }

  // ── Full Render ──
  function renderAll() {
    renderTopBar();
    renderBreadcrumb();
    renderItems();
  }

  // ── Top Bar Back Button ──
  topBarBack.addEventListener('click', function () {
    if (currentFolderId !== null) {
      history.back();
    }
  });

  // ── Navigation ──
  function navigateToFolder(folderId) {
    currentFolderId = folderId;

    // Push history state
    if (folderId === null) {
      history.pushState({ view: 'folder', folderId: null }, '');
    } else {
      history.pushState({ view: 'folder', folderId: folderId }, '');
    }

    renderAll();
  }



  // ── Create Folder ──
  let modalMode = null; // 'newFolder' | 'rename'
  let modalTargetId = null;

  fabNewFolder.addEventListener('click', function () {
    modalMode = 'newFolder';
    modalTitle.textContent = 'Nuova Cartella';
    modalInput.value = '';
    modalInput.placeholder = 'Nome cartella';
    modalConfirm.textContent = 'Crea';
    modalConfirm.className = 'modal-btn modal-btn-confirm';
    showModal();
  });

  function showModal() {
    modalOverlay.classList.add('visible');
    history.pushState({ view: 'modal' }, '');
    setTimeout(function () { modalInput.focus(); }, 200);
  }

  function hideModal() {
    modalOverlay.classList.remove('visible');
    modalInput.blur();
  }

  modalCancel.addEventListener('click', function () {
    hideModal();
    history.back();
  });

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) {
      hideModal();
      history.back();
    }
  });

  modalConfirm.addEventListener('click', function () {
    const value = modalInput.value.trim();
    if (!value) return;

    if (modalMode === 'newFolder') {
      const newFolder = {
        id: generateId(),
        type: 'folder',
        name: value,
        parentId: currentFolderId,
        content: '',
        createdAt: now(),
        updatedAt: now()
      };
      items.push(newFolder);
      saveData();
      renderItems();
    } else if (modalMode === 'rename') {
      const item = getItem(modalTargetId);
      if (item) {
        item.name = value;
        item.updatedAt = now();
        saveData();
        renderAll();
      }
    }

    hideModal();
    history.back();
  });

  // Enter key in modal
  modalInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      modalConfirm.click();
    }
  });

  // ── Create Note ──
  fabNewNote.addEventListener('click', function () {
    const newNote = {
      id: generateId(),
      type: 'note',
      name: '',
      parentId: currentFolderId,
      content: '',
      createdAt: now(),
      updatedAt: now()
    };
    items.push(newNote);
    saveData();
    openNoteEditor(newNote.id, true);
  });

  // ── Note Editor ──
  function openNoteEditor(noteId, isNew = false) {
    const note = getItem(noteId);
    if (!note) return;

    currentEditingNoteId = noteId;
    editorTitleInput.value = note.name || '';
    editorTextarea.value = note.content || '';
    updateCharCount();
    editorView.classList.add('visible');
    document.body.classList.add('editor-open');
    history.pushState({ view: 'editor', noteId: noteId }, '');

    editorTextarea.style.height = 'auto';
    editorTextarea.style.height = editorTextarea.scrollHeight + 'px';
    const wrapper = document.querySelector('.editor-content-wrapper');
    if (wrapper) wrapper.scrollTop = 0;

    if (isNew) {
      setTimeout(function () {
        editorTitleInput.focus();
      }, 350);
    }
  }

  function closeNoteEditor() {
    if (currentEditingNoteId) {
      const note = getItem(currentEditingNoteId);
      if (note) {
        note.name = editorTitleInput.value;
        note.content = editorTextarea.value;
        note.updatedAt = now();
        saveData();
      }
      currentEditingNoteId = null;
    }
    editorView.classList.remove('visible');
    document.body.classList.remove('editor-open');
    editorTitleInput.blur();
    editorTextarea.blur();
    renderItems();
  }

  editorBackBtn.addEventListener('click', function () {
    closeNoteEditor();
    history.back();
  });

  editorTitleInput.addEventListener('input', function () {
    if (currentEditingNoteId) {
      const note = getItem(currentEditingNoteId);
      if (note) {
        note.name = editorTitleInput.value;
        note.updatedAt = now();
        debouncedSave();
      }
    }
  });

  editorTextarea.addEventListener('input', function () {
    if (currentEditingNoteId) {
      const note = getItem(currentEditingNoteId);
      if (note) {
        note.content = editorTextarea.value;
        note.updatedAt = now();
        debouncedSave();
      }
    }
    updateCharCount();
    
    // Auto-expand textarea height
    editorTextarea.style.height = 'auto';
    editorTextarea.style.height = editorTextarea.scrollHeight + 'px';
  });

  function updateCharCount() {
    const count = editorTextarea.value.length;
    editorCharCount.textContent = count + ' caratter' + (count === 1 ? 'e' : 'i');
  }

  // ── Context Menu ──
  function openContextMenu(itemId) {
    const item = getItem(itemId);
    if (!item) return;

    contextMenuItemId = itemId;
    contextTitle.textContent = item.type === 'folder' ? item.name : getNoteTitle(item);
    contextType.textContent = item.type === 'folder' ? 'Cartella' : 'Nota';

    // Show/hide rename option (only for folders)
    contextRename.style.display = item.type === 'folder' ? 'flex' : 'none';
    contextDownload.style.display = 'flex';

    contextOverlay.classList.add('visible');
    history.pushState({ view: 'context' }, '');
  }

  function closeContextMenu() {
    contextOverlay.classList.remove('visible');
    contextMenuItemId = null;
  }

  contextOverlay.addEventListener('click', function (e) {
    if (e.target === contextOverlay) {
      closeContextMenu();
      history.back();
    }
  });

  contextRename.addEventListener('click', function () {
    const item = getItem(contextMenuItemId);
    if (!item) return;

    closeContextMenu();
    history.back();

    setTimeout(function () {
      modalMode = 'rename';
      modalTargetId = item.id;
      modalTitle.textContent = 'Rinomina';
      modalInput.value = item.name;
      modalInput.placeholder = 'Nuovo nome';
      modalConfirm.textContent = 'Salva';
      modalConfirm.className = 'modal-btn modal-btn-confirm';
      showModal();
    }, 200);
  });

  contextDelete.addEventListener('click', function () {
    const item = getItem(contextMenuItemId);
    if (!item) return;

    const isFolder = item.type === 'folder';
    const childCount = isFolder ? getChildren(item.id).length : 0;
    let message = 'Eliminare questa nota?';
    if (isFolder) {
      message = 'Eliminare questa cartella' + (childCount > 0 ? ' e tutto il suo contenuto (' + childCount + ' elementi)' : '') + '?';
    }

    closeContextMenu();
    history.back();

    setTimeout(function () {
      if (confirm(message)) {
        deleteRecursive(item.id);
        saveData();
        renderItems();
      }
    }, 200);
  });

  // ── Download Handling ──
  function getNoteContentAsText(note) {
    let title = getNoteTitle(note);
    let text = '=== ' + title + ' ===\n\n';
    if (note.mode === 'list' && note.checklist && note.checklist.length > 0) {
      text += note.checklist.map(function(item) {
        return (item.checked ? '[x] ' : '[ ] ') + item.text;
      }).join('\n');
    } else {
      text += note.content || '';
    }
    return text;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadNoteText(note) {
    let title = getNoteTitle(note) || 'Nota';
    title = title.replace(/[\/\?<>\\:\*\|":]/g, '').trim() || 'Nota';
    const text = getNoteContentAsText(note);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, title + '.txt');
  }

  function addFolderToZip(zipFolder, folderId) {
    const children = getChildren(folderId);
    children.forEach(function(child) {
      if (child.deleted) return;
      if (child.type === 'note') {
        const text = getNoteContentAsText(child);
        let title = getNoteTitle(child) || 'Nota';
        title = title.replace(/[\/\?<>\\:\*\|":]/g, '').trim() || 'Nota';
        zipFolder.file(title + ' - ' + child.id.substring(0,4) + '.txt', text);
      } else if (child.type === 'folder') {
        let name = child.name || 'Cartella';
        name = name.replace(/[\/\?<>\\:\*\|":]/g, '').trim() || 'Cartella';
        const subFolder = zipFolder.folder(name + ' - ' + child.id.substring(0,4));
        addFolderToZip(subFolder, child.id);
      }
    });
  }

  function downloadFolderZip(folder) {
    if (!window.JSZip) {
      alert("La libreria di download non è ancora pronta. Riprova tra poco.");
      return;
    }
    const zip = new JSZip();
    let name = folder.name || 'Cartella';
    name = name.replace(/[\/\?<>\\:\*\|":]/g, '').trim() || 'Cartella';
    
    const baseFolder = zip.folder(name);
    addFolderToZip(baseFolder, folder.id);

    zip.generateAsync({type:"blob"}).then(function(content) {
        downloadBlob(content, name + '.zip');
    });
  }

  contextDownload.addEventListener('click', function () {
    const item = getItem(contextMenuItemId);
    if (!item) return;

    closeContextMenu();
    history.back();

    setTimeout(function () {
      if (item.type === 'note') {
        downloadNoteText(item);
      } else if (item.type === 'folder') {
        downloadFolderZip(item);
      }
    }, 200);
  });

  // ── Android Back Button / Browser History ──
  window.addEventListener('popstate', function (e) {
    const state = e.state;

    // Close any open overlays
    if (editorView.classList.contains('visible')) {
      closeNoteEditor();
    }
    if (trashView.classList.contains('visible')) {
      trashView.classList.remove('visible');
    }
    if (contextOverlay.classList.contains('visible')) {
      closeContextMenu();
    }
    if (modalOverlay.classList.contains('visible')) {
      hideModal();
    }
    if (settingsOverlay.classList.contains('visible')) {
      settingsOverlay.classList.remove('visible');
    }

    // Navigate to the folder indicated by the state
    if (state && state.view === 'folder') {
      currentFolderId = state.folderId;
      renderAll();
    }
  });

  // ── Settings & Theme ──
  const settingsBtn = document.getElementById('settings-btn');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsClose = document.getElementById('settings-close');
  const amoledToggle = document.getElementById('amoled-toggle');
  const themeDots = document.querySelectorAll('.theme-dot');

  let currentTheme = localStorage.getItem('notesAppTheme') || 'white';
  let isAmoled = localStorage.getItem('notesAppAmoled') !== 'false';

  function applyTheme() {
    document.body.className = 'theme-' + currentTheme;
    if (isAmoled) {
      document.body.classList.add('amoled');
      amoledToggle.checked = true;
    } else {
      document.body.classList.remove('amoled');
      amoledToggle.checked = false;
    }
    themeDots.forEach(function(dot) {
      dot.classList.toggle('active', dot.dataset.theme === currentTheme);
    });
  }

  themeDots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      currentTheme = this.dataset.theme;
      localStorage.setItem('notesAppTheme', currentTheme);
      applyTheme();
    });
  });

  amoledToggle.addEventListener('change', function() {
    isAmoled = this.checked;
    localStorage.setItem('notesAppAmoled', isAmoled);
    applyTheme();
  });

  settingsBtn.addEventListener('click', function() {
    settingsOverlay.classList.add('visible');
    history.pushState({ view: 'settings' }, '');
  });

  settingsClose.addEventListener('click', function() {
    settingsOverlay.classList.remove('visible');
    history.back();
  });

  settingsOverlay.addEventListener('click', function(e) {
    if (e.target === settingsOverlay) {
      settingsOverlay.classList.remove('visible');
      history.back();
    }
  });

  // ── Backup Data ──
  document.getElementById('export-btn').addEventListener('click', function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({items: items}));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "notes_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });

  document.getElementById('import-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported && Array.isArray(imported.items)) {
          items = imported.items;
          saveData();
          renderAll();
          alert('Dati importati con successo!');
          settingsOverlay.classList.remove('visible');
          history.back();
        }
      } catch (err) {
        alert('File non valido.');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('reset-btn').addEventListener('click', function() {
    if (confirm('Sei sicuro di voler cancellare tutti i dati? Questa azione è irreversibile.')) {
      items = [];
      saveData();
      renderAll();
      settingsOverlay.classList.remove('visible');
      history.back();
    }
  });

  // ── Trash View ──
  const trashView = document.getElementById('trash-view');
  const openTrashBtn = document.getElementById('open-trash-btn');
  const trashBackBtn = document.getElementById('trash-back-btn');
  const emptyTrashBtn = document.getElementById('empty-trash-btn');
  const trashList = document.getElementById('trash-list');
  const trashEmptyState = document.getElementById('trash-empty-state');

  function renderTrashList() {
    trashList.innerHTML = '';
    const deletedItems = items.filter(function(i) { return i.deleted; });
    if (deletedItems.length === 0) {
      trashEmptyState.style.display = 'flex';
      trashList.style.display = 'none';
      emptyTrashBtn.style.display = 'none';
    } else {
      trashEmptyState.style.display = 'none';
      trashList.style.display = 'flex';
      emptyTrashBtn.style.display = 'flex';

      deletedItems.forEach(function(item) {
        const card = document.createElement('div');
        card.className = 'item-card';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'item-icon';
        iconDiv.innerHTML = item.type === 'folder' ? ICONS.folder : ICONS.note;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = item.type === 'folder' ? item.name : getNoteTitle(item);
        infoDiv.appendChild(nameEl);

        const dateEl = document.createElement('div');
        dateEl.className = 'item-date';
        dateEl.textContent = 'Eliminato il ' + formatDate(item.deletedAt || item.updatedAt);
        infoDiv.appendChild(dateEl);

        card.appendChild(iconDiv);
        card.appendChild(infoDiv);

        // Restore button
        const restoreDiv = document.createElement('div');
        restoreDiv.className = 'item-rename-icon';
        restoreDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11V9a4 4 0 0 1 4-4h14M8 1l-5 4 5 4M21 13v2a4 4 0 0 1-4 4H3M16 23l5-4-5-4"/></svg>';
        restoreDiv.addEventListener('click', function(e) {
            e.stopPropagation();
            item.deleted = false;
            item.deletedAt = null;
            saveData();
            renderTrashList();
            renderAll();
        });

        // Permanent delete
        const permDeleteDiv = document.createElement('div');
        permDeleteDiv.className = 'item-rename-icon';
        permDeleteDiv.innerHTML = ICONS.trash;
        permDeleteDiv.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm("Eliminare definitivamente questo elemento?")) {
                deleteRecursive(item.id, true);
                saveData();
                renderTrashList();
                renderAll();
            }
        });

        card.appendChild(restoreDiv);
        card.appendChild(permDeleteDiv);
        trashList.appendChild(card);
      });
    }
  }

  openTrashBtn.addEventListener('click', function() {
    settingsOverlay.classList.remove('visible');
    history.back(); // Pop settings state
    setTimeout(function() {
      renderTrashList();
      trashView.classList.add('visible');
      history.pushState({ view: 'trash' }, '');
    }, 200);
  });

  trashBackBtn.addEventListener('click', function() {
    trashView.classList.remove('visible');
    history.back();
  });

  emptyTrashBtn.addEventListener('click', function() {
    if (confirm('Sei sicuro di voler svuotare il cestino? Tutti gli elementi al suo interno verranno eliminati permanentemente.')) {
      // Find all top-level deleted items and permanently delete them, so their children go too
      const deletedItems = items.filter(function(i) { return i.deleted; });
      deletedItems.forEach(function(i) { deleteRecursive(i.id, true); });
      saveData();
      renderTrashList();
      renderAll();
    }
  });

  // ══════════════════════════════════════════════════════════
  //  Checklist / List Mode
  // ══════════════════════════════════════════════════════════

  const editorToggleList = document.getElementById('editor-toggle-list');
  const iconChecklist = document.getElementById('icon-checklist');
  const iconPencil = document.getElementById('icon-pencil');
  const checklistContainer = document.getElementById('checklist-container');
  const checklistItemsEl = document.getElementById('checklist-items');
  const checklistCompletedSection = document.getElementById('checklist-completed-section');
  const checklistCompletedItemsEl = document.getElementById('checklist-completed-items');
  const checklistNewInput = document.getElementById('checklist-new-input');

  let isListMode = false;

  // Toggle button handler
  editorToggleList.addEventListener('click', function () {
    const note = getItem(currentEditingNoteId);
    if (!note) return;

    if (!isListMode) {
      // Switch to LIST mode
      switchToListMode(note);
    } else {
      // Switch back to NOTE mode
      switchToNoteMode(note);
    }
  });

  function switchToListMode(note) {
    isListMode = true;
    iconChecklist.style.display = 'none';
    iconPencil.style.display = '';

    // Always sync from textarea to checklist
    const currentText = editorTextarea.value || '';
    const lines = currentText.split('\n').filter(function (l) { return l.trim() !== ''; });
    
    // Preserve state of existing checklist items if their text matches exactly
    const existingChecklist = note.checklist || [];
    const usedIds = {};
    
    note.checklist = lines.map(function (line) {
      // Find a matching item that hasn't been used yet
      const match = existingChecklist.find(function(item) {
        return item.text === line && !usedIds[item.id];
      });
      
      if (match) {
        usedIds[match.id] = true;
        return { id: match.id, text: match.text, checked: match.checked };
      }
      return { id: generateId(), text: line, checked: false };
    });

    note.mode = 'list';
    saveData();

    editorTextarea.style.display = 'none';
    checklistContainer.style.display = '';
    renderChecklist(note);
  }

  function switchToNoteMode(note) {
    isListMode = false;
    iconChecklist.style.display = '';
    iconPencil.style.display = 'none';

    // Always sync from checklist to textarea
    const allItems = note.checklist || [];
    
    // Render order: Pending items first, then Completed items
    const pending = allItems.filter(function(i) { return !i.checked; });
    const completed = allItems.filter(function(i) { return i.checked; });
    const orderedItems = pending.concat(completed);
    
    // Save the ordered checklist so text mode matches the visual list order
    note.checklist = orderedItems;
    note.content = orderedItems.map(function (item) { return item.text; }).join('\n');
    
    note.mode = 'note';
    saveData();

    editorTextarea.style.display = '';
    editorTextarea.value = note.content;
    checklistContainer.style.display = 'none';
    updateCharCount();
  }

  // ── Render Checklist ──
  function renderChecklist(note) {
    if (!note || !note.checklist) return;

    checklistItemsEl.innerHTML = '';
    checklistCompletedItemsEl.innerHTML = '';

    var pending = note.checklist.filter(function (i) { return !i.checked; });
    var completed = note.checklist.filter(function (i) { return i.checked; });

    pending.forEach(function (item) {
      checklistItemsEl.appendChild(createChecklistRow(item, note, false));
    });

    if (completed.length > 0) {
      checklistCompletedSection.style.display = '';
      completed.forEach(function (item) {
        checklistCompletedItemsEl.appendChild(createChecklistRow(item, note, true));
      });
    } else {
      checklistCompletedSection.style.display = 'none';
    }
  }

  function createChecklistRow(item, note, isCompleted) {
    var row = document.createElement('div');
    row.className = 'checklist-row' + (isCompleted ? ' completed' : '');
    row.dataset.itemId = item.id;

    // Checkbox
    var cb = document.createElement('button');
    cb.className = 'checklist-checkbox' + (item.checked ? ' checked' : '');
    cb.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    cb.addEventListener('click', function (e) {
      e.stopPropagation();
      item.checked = !item.checked;
      note.updatedAt = now();
      saveData();
      renderChecklist(note);
    });

    // Text input
    var textEl = document.createElement('input');
    textEl.type = 'text';
    textEl.className = 'checklist-text';
    textEl.value = item.text;
    textEl.placeholder = 'Scrivi qui...';
    if (isCompleted) {
      textEl.readOnly = true;
    }
    textEl.addEventListener('input', function () {
      item.text = this.value;
      note.updatedAt = now();
      debouncedSave();
    });
    // When pressing enter in text field, create new item below
    textEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var newItem = { id: generateId(), text: '', checked: false };
        // Insert after current item
        var idx = note.checklist.indexOf(item);
        note.checklist.splice(idx + 1, 0, newItem);
        note.updatedAt = now();
        saveData();
        renderChecklist(note);
        // Focus new item
        setTimeout(function () {
          var newRow = checklistItemsEl.querySelector('[data-item-id="' + newItem.id + '"]');
          if (newRow) {
            var inp = newRow.querySelector('.checklist-text');
            if (inp) inp.focus();
          }
        }, 50);
      }
      // Backspace on empty field: delete this item and focus previous
      if (e.key === 'Backspace' && this.value === '') {
        e.preventDefault();
        var idx = note.checklist.indexOf(item);
        if (idx > 0 || note.checklist.length > 1) {
          note.checklist.splice(idx, 1);
          note.updatedAt = now();
          saveData();
          renderChecklist(note);
          // Focus previous item
          if (idx > 0) {
            var prevItems = checklistItemsEl.querySelectorAll('.checklist-row');
            var focusIdx = Math.min(idx - 1, prevItems.length - 1);
            if (prevItems[focusIdx]) {
              var inp = prevItems[focusIdx].querySelector('.checklist-text');
              if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
            }
          }
        }
      }
    });

    // Delete button
    var del = document.createElement('button');
    del.className = 'checklist-delete';
    del.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      var idx = note.checklist.indexOf(item);
      if (idx !== -1) {
        note.checklist.splice(idx, 1);
        note.updatedAt = now();
        saveData();
        renderChecklist(note);
      }
    });

    row.appendChild(cb);
    row.appendChild(textEl);
    row.appendChild(del);

    // ── Drag to Reorder (long press) ──
    if (!isCompleted) {
      setupDragReorder(row, item, note);
    }

    return row;
  }

  // ── Drag-to-Reorder Logic ──
  function setupDragReorder(row, item, note) {
    var longPressTimer = null;
    var isDragging = false;
    var startY = 0;
    var currentY = 0;
    var rowRect = null;
    var allRows = [];
    var originalIndex = -1;

    row.addEventListener('pointerdown', function (e) {
      // Don't interfere with checkbox or delete button
      if (e.target.closest('.checklist-checkbox') ||
          e.target.closest('.checklist-delete')) {
        return;
      }

      startY = e.clientY;
      var pointerId = e.pointerId;

      longPressTimer = setTimeout(function () {
        isDragging = true;
        if (navigator.vibrate) navigator.vibrate(25);

        row.classList.add('dragging');
        row.setPointerCapture(pointerId);
        rowRect = row.getBoundingClientRect();
        originalIndex = getPendingIndex(item, note);

        // Get all pending rows for reorder reference
        allRows = Array.prototype.slice.call(checklistItemsEl.querySelectorAll('.checklist-row'));
        
        // If the element focused was the input, blur it so the virtual keyboard doesn't mess with dragging
        const activeItem = document.activeElement;
        if (activeItem && activeItem.classList.contains('checklist-text')) {
          activeItem.blur();
        }
      }, 400);
    });

    row.addEventListener('pointermove', function (e) {
      if (!isDragging) {
        // If moved too much before long press, cancel
        if (longPressTimer && Math.abs(e.clientY - startY) > 15) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }

      var dy = e.clientY - startY;
      row.style.transform = 'translateY(' + dy + 'px)';

      // Determine which row we're hovering over
      var hoveredIndex = -1;
      allRows.forEach(function (r, i) {
        if (r === row) return;
        var rect = r.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e.clientY > midY - 10 && e.clientY < midY + 10) {
          hoveredIndex = i;
        }
      });

      // Visual hint: shift rows
      allRows.forEach(function (r, i) {
        if (r === row) return;
        var rect = r.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e.clientY < midY && i < originalIndex) {
          r.style.transform = 'translateY(' + (rowRect.height + 4) + 'px)';
        } else if (e.clientY > midY && i > originalIndex) {
          r.style.transform = 'translateY(-' + (rowRect.height + 4) + 'px)';
        } else {
          r.style.transform = '';
        }
      });
    });

    function handleDragEnd(e) {
      clearTimeout(longPressTimer);
      longPressTimer = null;

      if (!isDragging) return;
      isDragging = false;

      row.classList.remove('dragging');
      row.style.transform = '';
      allRows.forEach(function (r) { r.style.transform = ''; });

      // Calculate new index based on position
      var pendingItems = note.checklist.filter(function (i) { return !i.checked; });
      var oldIdx = pendingItems.indexOf(item);
      var newIdx = oldIdx;

      // Find where the row was dropped relative to other rows
      allRows.forEach(function (r, i) {
        if (r === row) return;
        var rect = r.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e.clientY < midY && i <= oldIdx) {
          newIdx = Math.min(newIdx, i);
        } else if (e.clientY > midY && i >= oldIdx) {
          newIdx = Math.max(newIdx, i);
        }
      });

      if (newIdx !== oldIdx) {
        // Remove from checklist and reinsert
        var fullIdx = note.checklist.indexOf(item);
        note.checklist.splice(fullIdx, 1);

        // Find position in the full array corresponding to the new pending index
        var pendingCount = 0;
        var insertAt = 0;
        for (var i = 0; i < note.checklist.length; i++) {
          if (!note.checklist[i].checked) {
            if (pendingCount === newIdx) {
              insertAt = i;
              break;
            }
            pendingCount++;
          }
          insertAt = i + 1;
        }
        note.checklist.splice(insertAt, 0, item);
        note.updatedAt = now();
        saveData();
      }

      renderChecklist(note);
    }

    row.addEventListener('pointerup', handleDragEnd);
    row.addEventListener('pointercancel', handleDragEnd);
  }

  function getPendingIndex(item, note) {
    var pending = note.checklist.filter(function (i) { return !i.checked; });
    return pending.indexOf(item);
  }

  // ── Add New Checklist Item ──
  checklistNewInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var text = this.value.trim();
      if (!text) return;
      var note = getItem(currentEditingNoteId);
      if (!note) return;
      if (!note.checklist) note.checklist = [];
      var newItem = { id: generateId(), text: text, checked: false };
      // Insert before completed items (at end of pending)
      var lastPendingIdx = -1;
      for (var i = note.checklist.length - 1; i >= 0; i--) {
        if (!note.checklist[i].checked) { lastPendingIdx = i; break; }
      }
      note.checklist.splice(lastPendingIdx + 1, 0, newItem);
      note.updatedAt = now();
      saveData();
      this.value = '';
      renderChecklist(note);
      // Focus the new item text
      setTimeout(function () {
        var newRow = checklistItemsEl.querySelector('[data-item-id="' + newItem.id + '"]');
        if (newRow) newRow.classList.add('animate-in');
      }, 10);
    }
  });

  // ── Update openNoteEditor to handle list mode + attachments ──
  var _originalOpenNoteEditor = openNoteEditor;

  const editorAttachBtn = document.getElementById('editor-attach-btn');
  const editorFileInput = document.getElementById('editor-file-input');
  const attachmentsSection = document.getElementById('attachments-section');
  const attachmentsList = document.getElementById('attachments-list');

  openNoteEditor = function (noteId, isNew) {
    var note = getItem(noteId);
    if (!note) return;

    currentEditingNoteId = noteId;
    editorTitleInput.value = note.name || '';

    // Determine mode
    if (note.mode === 'list') {
      isListMode = true;
      iconChecklist.style.display = 'none';
      iconPencil.style.display = '';
      editorTextarea.style.display = 'none';
      checklistContainer.style.display = '';
      editorTextarea.value = note.content || '';
      renderChecklist(note);
    } else {
      isListMode = false;
      iconChecklist.style.display = '';
      iconPencil.style.display = 'none';
      editorTextarea.style.display = '';
      checklistContainer.style.display = 'none';
      editorTextarea.value = note.content || '';
    }

    updateCharCount();
    renderAttachments(note);
    editorView.classList.add('visible');
    document.body.classList.add('editor-open');
    history.pushState({ view: 'editor', noteId: noteId }, '');

    // Adjust textarea height and scroll to top
    if (!isListMode) {
      editorTextarea.style.height = 'auto';
      editorTextarea.style.height = editorTextarea.scrollHeight + 'px';
    }
    const wrapper = document.querySelector('.editor-content-wrapper');
    if (wrapper) wrapper.scrollTop = 0;

    if (isNew) {
      setTimeout(function () {
        editorTitleInput.focus();
      }, 350);
    }
  };

  // ── Update closeNoteEditor to handle list mode + attachments ──
  var _originalCloseNoteEditor = closeNoteEditor;

  closeNoteEditor = function () {
    if (currentEditingNoteId) {
      var note = getItem(currentEditingNoteId);
      if (note) {
        note.name = editorTitleInput.value;
        if (isListMode) {
          if (note.checklist && note.checklist.length > 0) {
            note.content = note.checklist.map(function (i) { return i.text; }).join('\n');
          }
        } else {
          note.content = editorTextarea.value;
        }
        note.updatedAt = now();
        saveData();
      }
      currentEditingNoteId = null;
    }

    // Reset list mode state
    isListMode = false;
    iconChecklist.style.display = '';
    iconPencil.style.display = 'none';
    editorTextarea.style.display = '';
    checklistContainer.style.display = 'none';

    // Reset attachments
    attachmentsSection.style.display = 'none';
    attachmentsList.innerHTML = '';

    editorView.classList.remove('visible');
    document.body.classList.remove('editor-open');
    editorTitleInput.blur();
    editorTextarea.blur();
    renderItems();
  };

  // ══════════════════════════════════════════════════════════
  //  File Attachments
  // ══════════════════════════════════════════════════════════

  editorAttachBtn.addEventListener('click', function () {
    editorFileInput.click();
  });

  editorFileInput.addEventListener('change', function (e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    var note = getItem(currentEditingNoteId);
    if (!note) return;
    if (!note.attachments) note.attachments = [];

    var filesProcessed = 0;
    var totalFiles = files.length;

    for (var i = 0; i < totalFiles; i++) {
      (function (file) {
        var reader = new FileReader();
        reader.onload = function (ev) {
          note.attachments.push({
            id: generateId(),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            data: ev.target.result,
            addedAt: now()
          });
          filesProcessed++;
          if (filesProcessed === totalFiles) {
            note.updatedAt = now();
            saveData();
            renderAttachments(note);
          }
        };
        reader.readAsDataURL(file);
      })(files[i]);
    }

    // Reset input so the same file can be selected again
    editorFileInput.value = '';
  });

  function renderAttachments(note) {
    if (!note || !note.attachments || note.attachments.length === 0) {
      attachmentsSection.style.display = 'none';
      attachmentsList.innerHTML = '';
      return;
    }

    attachmentsSection.style.display = '';
    attachmentsList.innerHTML = '';

    note.attachments.forEach(function (att) {
      var item = document.createElement('div');
      item.className = 'attachment-item';

      var isImage = att.type && att.type.startsWith('image/');

      if (isImage) {
        // Image preview
        var imgWrapper = document.createElement('div');
        imgWrapper.className = 'attachment-image-wrapper';

        var img = document.createElement('img');
        img.className = 'attachment-image';
        img.src = att.data;
        img.alt = att.name;
        img.loading = 'lazy';
        imgWrapper.appendChild(img);

        var imgName = document.createElement('div');
        imgName.className = 'attachment-image-name';
        imgName.textContent = att.name;

        item.appendChild(imgWrapper);
        item.appendChild(imgName);
      } else {
        // File block
        var fileDiv = document.createElement('div');
        fileDiv.className = 'attachment-file';

        var iconDiv = document.createElement('div');
        iconDiv.className = 'attachment-file-icon';
        iconDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

        var infoDiv = document.createElement('div');
        infoDiv.className = 'attachment-file-info';

        var nameEl = document.createElement('div');
        nameEl.className = 'attachment-file-name';
        nameEl.textContent = att.name;

        var extEl = document.createElement('div');
        extEl.className = 'attachment-file-ext';
        var ext = att.name.split('.').pop();
        extEl.textContent = ext !== att.name ? '.' + ext + ' — ' + formatFileSize(att.size) : formatFileSize(att.size);

        infoDiv.appendChild(nameEl);
        infoDiv.appendChild(extEl);
        fileDiv.appendChild(iconDiv);
        fileDiv.appendChild(infoDiv);
        item.appendChild(fileDiv);
      }

      // Delete button
      var delBtn = document.createElement('button');
      delBtn.className = 'attachment-delete';
      delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = note.attachments.indexOf(att);
        if (idx !== -1) {
          note.attachments.splice(idx, 1);
          note.updatedAt = now();
          saveData();
          renderAttachments(note);
        }
      });
      item.appendChild(delBtn);

      attachmentsList.appendChild(item);
    });
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ══════════════════════════════════════════════════════════
  //  Google Auth & Drive Sync
  // ══════════════════════════════════════════════════════════

  // ⚠️ REPLACE THIS with your actual Google Cloud OAuth Client ID
  var GOOGLE_CLIENT_ID = '662885517517-vub0f92dpv1765ckf02nn3ubpgqtpa25.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var DRIVE_FILE_NAME = 'notes_app_data.json';

  // DOM refs
  var googleSignedOut = document.getElementById('google-signed-out');
  var googleSignedIn = document.getElementById('google-signed-in');
  var googleSigninBtn = document.getElementById('google-signin-btn');
  var googleSignoutBtn = document.getElementById('google-signout-btn');
  var profileAvatar = document.getElementById('profile-avatar');
  var profileName = document.getElementById('profile-name');
  var profileEmail = document.getElementById('profile-email');
  var syncNowBtn = document.getElementById('sync-now-btn');
  var syncStatusEl = document.getElementById('sync-status');
  var syncIndicator = document.getElementById('sync-status-btn');

  var googleAccessToken = null;
  var googleUser = null;
  var driveFileId = null;
  var isSyncing = false;
  var tokenClient = null;

  // ── Token Persistence Helpers ──
  function saveTokenToStorage(accessToken, expiresIn) {
    var expiryTime = Date.now() + (expiresIn * 1000) - 60000; // 1 min margin
    localStorage.setItem('notesGoogleToken', JSON.stringify({
      token: accessToken,
      expiry: expiryTime
    }));
  }

  function loadTokenFromStorage() {
    try {
      var saved = localStorage.getItem('notesGoogleToken');
      if (!saved) return null;
      var parsed = JSON.parse(saved);
      if (parsed.token && parsed.expiry && Date.now() < parsed.expiry) {
        return parsed.token;
      }
      // Token expired, clean up
      localStorage.removeItem('notesGoogleToken');
      return null;
    } catch (e) {
      localStorage.removeItem('notesGoogleToken');
      return null;
    }
  }

  function clearTokenFromStorage() {
    localStorage.removeItem('notesGoogleToken');
  }

  // ── Initialize Google Auth ──
  var isStartupTokenRequest = false;

  function initGoogleAuth() {
    // Check if GIS library is loaded
    if (typeof google === 'undefined' || !google.accounts) {
      // Retry after a short delay (script might still be loading)
      setTimeout(initGoogleAuth, 500);
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE + ' https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: handleTokenResponse,
      error_callback: function (err) {
        // Silent token request failed (popup blocked, user interaction needed, etc.)
        console.log('Token request error:', err);
        isStartupTokenRequest = false;
      }
    });

    // Check if we have a saved session
    var savedUser = localStorage.getItem('notesGoogleUser');
    if (savedUser) {
      try {
        googleUser = JSON.parse(savedUser);
        showSignedInUI();

        // Try to restore token from localStorage (no popup, no network call)
        var storedToken = loadTokenFromStorage();
        if (storedToken) {
          // Token is still valid — use it directly, completely silently
          googleAccessToken = storedToken;
          // Perform startup sync now that we have a valid token
          if (localStorage.getItem('notesLastSync')) {
            performStartupSync();
          } else {
            firstSyncCheck();
          }
        } else if (tokenClient) {
          // Token expired (e.g. app opened the next day) — request a fresh one.
          // Intercept the popup that Google OAuth opens and make it invisible:
          // 1x1 pixel, positioned off-screen. Google auto-selects the account
          // via login_hint, the popup redirects and self-closes in ~300ms.
          // The user sees absolutely nothing.
          var _origWindowOpen = window.open;
          var _openRestored = false;
          window.open = function(url, name, features) {
            var popup = _origWindowOpen.call(window, url, name,
              'width=1,height=1,top=-1000,left=-1000,menubar=no,toolbar=no,location=no,status=no,scrollbars=no');
            if (!_openRestored) {
              window.open = _origWindowOpen;
              _openRestored = true;
            }
            return popup;
          };
          isStartupTokenRequest = true;
          tokenClient.requestAccessToken({
            prompt: '',
            login_hint: googleUser.email || ''
          });
          // Safety: restore window.open after a short delay
          setTimeout(function() {
            if (!_openRestored) {
              window.open = _origWindowOpen;
              _openRestored = true;
            }
          }, 2000);
        }
      } catch (e) {
        localStorage.removeItem('notesGoogleUser');
        clearTokenFromStorage();
      }
    }
  }

  // ── Sign In ──
  googleSigninBtn.addEventListener('click', function () {
    if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
      alert('⚠️ Client ID non configurato.\n\nPer attivare il login Google, inserisci il tuo Client ID OAuth nella variabile GOOGLE_CLIENT_ID in app.js.');
      return;
    }
    if (!tokenClient) {
      alert('Le librerie Google non sono ancora caricate. Riprova tra un momento.');
      return;
    }
    tokenClient.requestAccessToken();
  });

  // ── Handle Token Response ──
  function handleTokenResponse(response) {
    var wasStartup = isStartupTokenRequest;
    isStartupTokenRequest = false;

    if (response.error) {
      console.error('Google auth error:', response);
      // At startup, don't show error — just leave status as-is
      if (!wasStartup) {
        updateSyncStatus('Errore di autenticazione', 'error');
      }
      return;
    }

    googleAccessToken = response.access_token;
    // Persist token for silent restore on next startup
    saveTokenToStorage(response.access_token, response.expires_in || 3600);

    // Fetch user profile
    fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': 'Bearer ' + googleAccessToken }
    })
    .then(function (res) { return res.json(); })
    .then(function (user) {
      googleUser = {
        name: user.name,
        email: user.email,
        picture: user.picture
      };
      localStorage.setItem('notesGoogleUser', JSON.stringify(googleUser));
      showSignedInUI();
      
      // If this was a startup token request (from expired stored token fallback),
      // perform startup sync. Otherwise, do first sync check for new connections.
      if (wasStartup && localStorage.getItem('notesLastSync')) {
        performStartupSync();
      } else if (!localStorage.getItem('notesLastSync')) {
        firstSyncCheck();
      } else {
        performStartupSync();
      }
    })
    .catch(function (err) {
      console.error('Failed to fetch user info:', err);
    });
  }

  // ── Sign Out ──
  googleSignoutBtn.addEventListener('click', function () {
    if (googleAccessToken) {
      google.accounts.oauth2.revoke(googleAccessToken, function () {
        console.log('Token revoked');
      });
    }
    googleAccessToken = null;
    googleUser = null;
    driveFileId = null;
    localStorage.removeItem('notesGoogleUser');
    clearTokenFromStorage();
    localStorage.removeItem('notesLastSync');
    showSignedOutUI();
  });

  // ── UI State ──
  function showSignedInUI() {
    googleSignedOut.style.display = 'none';
    googleSignedIn.style.display = '';
    if (googleUser) {
      profileName.textContent = googleUser.name || '';
      profileEmail.textContent = googleUser.email || '';
      profileAvatar.src = googleUser.picture || '';
      profileAvatar.style.display = googleUser.picture ? '' : 'none';
    }
  }

  function showSignedOutUI() {
    googleSignedOut.style.display = '';
    googleSignedIn.style.display = 'none';
    syncIndicator.style.display = 'none';
    updateSyncStatus('Non sincronizzato', '');
  }

  function updateSyncStatus(text, state) {
    syncStatusEl.textContent = text;
    syncStatusEl.className = 'sync-status' + (state ? ' ' + state : '');
  }

  // ── Ensure we have a valid token (never shows popup) ──
  function ensureToken() {
    return new Promise(function (resolve, reject) {
      if (googleAccessToken) {
        // Verify token is still valid via a lightweight API call
        fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + googleAccessToken)
        .then(function (res) {
          if (res.ok) {
            resolve(googleAccessToken);
          } else {
            // Token expired — clear it, do NOT request a new one (would show popup)
            googleAccessToken = null;
            clearTokenFromStorage();
            reject(new Error('Token expired. Please sync manually.'));
          }
        })
        .catch(function () {
          // Network error — token might still be valid, try using it anyway
          resolve(googleAccessToken);
        });
      } else {
        // No token available at all — can't sync silently
        reject(new Error('No token available. Please sync manually.'));
      }
    });
  }

  // ── Google Drive API Helpers ──
  function driveFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + googleAccessToken;
    return fetch(url, options);
  }

  // Find or create the sync file in appDataFolder
  function findDriveFile() {
    return driveFetch(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27' +
      DRIVE_FILE_NAME + '%27&fields=files(id,modifiedTime)'
    )
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.files && data.files.length > 0) {
        driveFileId = data.files[0].id;
        return { id: driveFileId, modifiedTime: data.files[0].modifiedTime };
      }
      return null;
    });
  }

  // Read file content from Drive
  function readDriveFile(fileId) {
    return driveFetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media'
    )
    .then(function (res) { return res.json(); });
  }

  // Create or update file on Drive
  function writeDriveFile(data) {
    var jsonStr = JSON.stringify(data);
    var boundary = '---notesapp' + Date.now();

    var metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: 'application/json'
    };

    if (!driveFileId) {
      metadata.parents = ['appDataFolder'];
    }

    var body =
      '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      jsonStr + '\r\n' +
      '--' + boundary + '--';

    var url = driveFileId
      ? 'https://www.googleapis.com/upload/drive/v3/files/' + driveFileId + '?uploadType=multipart'
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    return driveFetch(url, {
      method: driveFileId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: body
    })
    .then(function (res) { return res.json(); })
    .then(function (file) {
      driveFileId = file.id;
      return file;
    });
  }

  // ── First Sync Check (conflict detection) ──
  var syncConflictOverlay = document.getElementById('sync-conflict-overlay');
  var syncUseCloud = document.getElementById('sync-use-cloud');
  var syncUseLocal = document.getElementById('sync-use-local');
  var syncLocalCount = document.getElementById('sync-local-count');
  var syncCloudCount = document.getElementById('sync-cloud-count');
  var pendingDriveData = null;

  function firstSyncCheck() {
    ensureToken()
    .then(function () {
      return findDriveFile();
    })
    .then(function (fileInfo) {
      if (!fileInfo) {
        // No data on Drive → upload local data silently
        if (items.length > 0) {
          return writeDriveFile({ items: items }).then(function () {
            localStorage.setItem('notesLastSync', now());
            updateSyncStatus('Sincronizzato ✓', '');
          });
        }
        localStorage.setItem('notesLastSync', now());
        updateSyncStatus('Sincronizzato ✓', '');
        return;
      }

      // Drive has data → read it
      return readDriveFile(fileInfo.id).then(function (driveData) {
        var localCount = items.filter(function (i) { return !i.deleted; }).length;
        var cloudItems = driveData && driveData.items ? driveData.items : [];
        var cloudCount = cloudItems.filter(function (i) { return !i.deleted; }).length;

        if (localCount === 0 && cloudCount > 0) {
          // Local is empty, cloud has data → auto-download
          items = cloudItems;
          _originalSaveData();
          renderAll();
          localStorage.setItem('notesLastSync', now());
          updateSyncStatus('Sincronizzato ✓', '');
          return;
        }

        if (localCount > 0 && cloudCount === 0) {
          // Cloud is empty, local has data → auto-upload
          return writeDriveFile({ items: items }).then(function () {
            localStorage.setItem('notesLastSync', now());
            updateSyncStatus('Sincronizzato ✓', '');
          });
        }

        if (localCount > 0 && cloudCount > 0) {
          // Both have data → compare content deeply
          var sortById = function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; };
          var localSorted = items.slice().sort(sortById);
          var cloudSorted = cloudItems.slice().sort(sortById);
          var localJSON = JSON.stringify(localSorted);
          var cloudJSON = JSON.stringify(cloudSorted);

          if (localJSON === cloudJSON) {
            // Identical data → no conflict, mark as synced
            localStorage.setItem('notesLastSync', now());
            updateSyncStatus('Sincronizzato ✓', '');
            return;
          }

          // Data differs → show conflict dialog
          pendingDriveData = driveData;
          syncLocalCount.textContent = localCount + ' element' + (localCount === 1 ? 'o' : 'i');
          syncCloudCount.textContent = cloudCount + ' element' + (cloudCount === 1 ? 'o' : 'i');
          syncConflictOverlay.classList.add('visible');
          return;
        }

        // Both empty → do nothing
        localStorage.setItem('notesLastSync', now());
        updateSyncStatus('Sincronizzato ✓', '');
      });
    })
    .catch(function (err) {
      console.error('First sync check error:', err);
    });
  }

  // ── Conflict Dialog Handlers ──
  syncUseCloud.addEventListener('click', function () {
    if (pendingDriveData && pendingDriveData.items) {
      items = pendingDriveData.items;
      _originalSaveData();
      renderAll();
      localStorage.setItem('notesLastSync', now());
      updateSyncStatus('Sincronizzato ✓', '');
    }
    pendingDriveData = null;
    syncConflictOverlay.classList.remove('visible');
  });

  syncUseLocal.addEventListener('click', function () {
    syncConflictOverlay.classList.remove('visible');
    pendingDriveData = null;
    // Upload local data to Drive, overwriting cloud
    writeDriveFile({ items: items }).then(function () {
      localStorage.setItem('notesLastSync', now());
      updateSyncStatus('Sincronizzato ✓', '');
    }).catch(function (err) {
      console.error('Upload error:', err);
    });
  });

  // ── Startup Sync (silent but updates status) ──
  function performStartupSync() {
    if (isSyncing) return;
    if (!googleUser) return;

    isSyncing = true;

    ensureToken()
    .then(function () {
      return findDriveFile();
    })
    .then(function (fileInfo) {
      if (fileInfo) {
        return readDriveFile(fileInfo.id).then(function (driveData) {
          if (driveData && driveData.items) {
            var mergedMap = {};
            driveData.items.forEach(function (item) {
              mergedMap[item.id] = item;
            });
            items.forEach(function (item) {
              var driveItem = mergedMap[item.id];
              if (!driveItem || new Date(item.updatedAt) > new Date(driveItem.updatedAt)) {
                mergedMap[item.id] = item;
              }
            });
            items = Object.keys(mergedMap).map(function (key) { return mergedMap[key]; });
            _originalSaveData(); // Use original saveData to avoid re-triggering auto-sync
            renderAll();
          }
          return writeDriveFile({ items: items });
        });
      } else {
        return writeDriveFile({ items: items });
      }
    })
    .then(function () {
      localStorage.setItem('notesLastSync', now());
      hasPendingChanges = false;
      // Update status UI so settings shows "Sincronizzato" after startup
      updateSyncStatus('Sincronizzato ✓', '');
    })
    .catch(function (err) {
      console.error('Startup sync error:', err);
      // Don't show error for startup sync — user didn't trigger it
    })
    .finally(function () {
      isSyncing = false;
    });
  }

  // ── Main Sync Logic ──
  function syncWithDrive(silent) {
    if (isSyncing) return;
    if (!googleUser) return;

    isSyncing = true;
    if (!silent) updateSyncStatus('Sincronizzazione...', 'syncing');

    ensureToken()
    .then(function () {
      return findDriveFile();
    })
    .then(function (fileInfo) {
      if (fileInfo) {
        // File exists on Drive — read it
        return readDriveFile(fileInfo.id).then(function (driveData) {
          // Merge: Drive data wins for items not modified locally since last sync
          var lastSync = localStorage.getItem('notesLastSync');
          var localData = { items: items };

          if (driveData && driveData.items) {
            // Simple strategy: use whichever has more recent updatedAt for each item
            var mergedMap = {};

            // Add all drive items
            driveData.items.forEach(function (item) {
              mergedMap[item.id] = item;
            });

            // Override with local items that are newer
            items.forEach(function (item) {
              var driveItem = mergedMap[item.id];
              if (!driveItem || new Date(item.updatedAt) > new Date(driveItem.updatedAt)) {
                mergedMap[item.id] = item;
              }
            });

            items = Object.keys(mergedMap).map(function (key) { return mergedMap[key]; });
            _originalSaveData(); // Use original saveData to avoid re-triggering auto-sync
            renderAll();
          }

          // Upload merged data back to Drive
          return writeDriveFile({ items: items });
        });
      } else {
        // No file on Drive yet — upload local data
        return writeDriveFile({ items: items });
      }
    })
    .then(function () {
      localStorage.setItem('notesLastSync', now());
      hasPendingChanges = false;
      // Always update status — both silent and non-silent syncs should reflect current state
      updateSyncStatus('Sincronizzato ✓', '');
      if (!silent) {
        updateSyncStatus('Ultima sync: adesso', 'success');
        setTimeout(function () {
          if (!isSyncing) updateSyncStatus('Sincronizzato ✓', '');
        }, 3000);
      }
    })
    .catch(function (err) {
      console.error('Sync error:', err);
      if (!silent) updateSyncStatus('Errore di sync', 'error');
    })
    .finally(function () {
      isSyncing = false;
    });
  }

  // Sync Now button (manual = visible feedback)
  syncNowBtn.addEventListener('click', function () {
    if (!googleAccessToken && googleUser) {
      // No valid token — request one (this is user-initiated, so popup is acceptable)
      isStartupTokenRequest = false;
      tokenClient.requestAccessToken({
        prompt: '',
        login_hint: googleUser.email || ''
      });
      return;
    }
    syncWithDrive(false);
  });

  // Auto-sync after data changes (debounced, silent)
  var autoSyncTimer = null;
  var hasPendingChanges = false;
  var _originalSaveData = saveData;
  saveData = function () {
    _originalSaveData();
    hasPendingChanges = true;
    // Trigger silent auto-sync if connected and have a token
    if (googleUser && googleAccessToken) {
      clearTimeout(autoSyncTimer);
      autoSyncTimer = setTimeout(function () {
        syncWithDrive(true);
      }, 15000); // Sync 15 seconds after last change
    }
  };

  // Sync when app is closed/hidden — ONLY if there are pending changes AND we have a token
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && hasPendingChanges && googleUser && googleAccessToken) {
      syncWithDrive(true);
    }
  });
  window.addEventListener('beforeunload', function () {
    if (hasPendingChanges && googleUser && googleAccessToken) {
      syncWithDrive(true);
    }
  });

  // ── Init ──
  function init() {
    loadData();
    applyTheme();

    // Set initial history state
    history.replaceState({ view: 'folder', folderId: null }, '');

    renderAll();

    // Initialize Google Auth (with delay for script loading)
    setTimeout(initGoogleAuth, 300);
  }

  // ── Register Service Worker ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function (e) {
      console.warn('SW registration failed:', e);
    });
  }

  init();
})();
