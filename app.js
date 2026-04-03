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
        let currentX = 0, currentY = 0;

        card.addEventListener('pointerdown', function (e) {
          if (e.target.closest('.item-rename-icon')) return;
          isPointerDown = true;
          isDragging = false;
          isSwiping = false;
          startX = e.clientX;
          startY = e.clientY;
          card.setPointerCapture(e.pointerId);

          longPressTriggered = false;
          longPressTimer = setTimeout(function () {
            longPressTriggered = true;
            if (navigator.vibrate) navigator.vibrate(25);
            openContextMenu(item.id);
          }, 500);
        });

        card.addEventListener('pointermove', function (e) {
          if (!isPointerDown) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          if (!isDragging && (Math.abs(dx) > 25 || Math.abs(dy) > 25)) {
            isDragging = true;
            clearTimeout(longPressTimer);
            if (Math.abs(dx) > Math.abs(dy)) {
              isSwiping = true;
            } else if (dy < -10) {
              const dtz = document.getElementById('drag-trash-zone');
              if (dtz) dtz.classList.add('visible');
            }
          }

          if (isSwiping) {
            currentX = dx;
            card.style.transform = 'translateX(' + currentX + 'px)';
            const iconLeft = swipeBg.querySelector('.icon-left');
            const iconRight = swipeBg.querySelector('.icon-right');
            if (currentX > 0) {
              iconLeft.style.opacity = Math.min(1, currentX / 50);
              iconLeft.style.transform = 'scale(' + (currentX > 80 ? 1.2 : 1) + ')';
              iconRight.style.opacity = '0';
            } else {
              iconRight.style.opacity = Math.min(1, Math.abs(currentX) / 50);
              iconRight.style.transform = 'scale(' + (currentX < -80 ? 1.2 : 1) + ')';
              iconLeft.style.opacity = '0';
            }
          } else if (isDragging && dy < -10) {
            currentY = dy;
            currentX = dx;
            card.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + (dx*0.05) + 'deg)';
            card.style.zIndex = '50';
            const trashZone = document.getElementById('drag-trash-zone');
            if (trashZone) {
              if (e.clientY < 100) {
                 trashZone.classList.add('drag-over');
              } else {
                 trashZone.classList.remove('drag-over');
              }
            }
          }
        });

        function handleRelease(e) {
          if (!isPointerDown) return;
          isPointerDown = false;
          clearTimeout(longPressTimer);
          card.releasePointerCapture(e.pointerId);

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
              card.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
              card.style.transform = '';
              setTimeout(function() { card.style.transition = ''; }, 300);
            }
          } else if (isDragging && currentY < -10) {
             if (trashZone) {
               trashZone.classList.remove('visible');
               trashZone.classList.remove('drag-over');
             }
             
             if (e.clientY < 100) {
                deleteRecursive(item.id, false);
                saveData();
                renderAll();
             } else {
                card.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.transform = '';
                card.style.zIndex = '1';
                setTimeout(function() { card.style.transition = ''; card.style.zIndex = '1'; }, 300);
             }
          } else if (!isDragging && !longPressTriggered) {
             // Treat as normal tap/click
             if (item.type === 'folder') {
               navigateToFolder(item.id);
             } else {
               openNoteEditor(item.id);
             }
          }
          currentX = 0;
          currentY = 0;
          isSwiping = false;
          isDragging = false;
        }

        card.addEventListener('pointerup', handleRelease);
        card.addEventListener('pointercancel', handleRelease);

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
      const currentFolder = getItem(currentFolderId);
      const parentId = currentFolder ? currentFolder.parentId : null;
      navigateToFolder(parentId);
    }
  });

  // ── Navigation ──
  function navigateToFolder(folderId) {
    currentFolderId = folderId;

    // Transition animation
    contentArea.classList.remove('entering');
    contentArea.classList.add('transitioning');

    // Push history state
    if (folderId === null) {
      history.pushState({ view: 'folder', folderId: null }, '');
    } else {
      history.pushState({ view: 'folder', folderId: folderId }, '');
    }

    setTimeout(function () {
      renderAll();
      contentArea.classList.remove('transitioning');
      contentArea.classList.add('entering');
    }, 80);
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

  // ── Android Back Button / Browser History ──
  window.addEventListener('popstate', function (e) {
    const state = e.state;

    // Close editor
    if (editorView.classList.contains('visible')) {
      closeNoteEditor();
      return;
    }

    // Close context menu
    if (contextOverlay.classList.contains('visible')) {
      closeContextMenu();
      return;
    }

    // Close modal
    if (modalOverlay.classList.contains('visible')) {
      hideModal();
      return;
    }



    // Close settings
    if (settingsOverlay.classList.contains('visible')) {
      settingsOverlay.classList.remove('visible');
      return;
    }

    // Close trash
    if (trashView.classList.contains('visible')) {
      trashView.classList.remove('visible');
      return;
    }

    // Navigate back in folder hierarchy
    if (state && state.view === 'folder') {
      currentFolderId = state.folderId;
      renderAll();
      return;
    }

    // Default: go to parent folder
    if (currentFolderId !== null) {
      const currentFolder = getItem(currentFolderId);
      if (currentFolder) {
        currentFolderId = currentFolder.parentId;
      } else {
        currentFolderId = null;
      }
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

  // ── Update openNoteEditor to handle list mode ──
  var _originalOpenNoteEditor = openNoteEditor;

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
    editorView.classList.add('visible');
    document.body.classList.add('editor-open');
    history.pushState({ view: 'editor', noteId: noteId }, '');

    if (isNew) {
      setTimeout(function () {
        editorTitleInput.focus();
      }, 350);
    }
  };

  // ── Update closeNoteEditor to handle list mode ──
  var _originalCloseNoteEditor = closeNoteEditor;

  closeNoteEditor = function () {
    if (currentEditingNoteId) {
      var note = getItem(currentEditingNoteId);
      if (note) {
        note.name = editorTitleInput.value;
        if (isListMode) {
          // Sync content from checklist for preview purposes
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

    editorView.classList.remove('visible');
    document.body.classList.remove('editor-open');
    editorTitleInput.blur();
    editorTextarea.blur();
    renderItems();
  };

  // ── Init ──
  function init() {
    loadData();
    applyTheme();

    // Set initial history state
    history.replaceState({ view: 'folder', folderId: null }, '');

    renderAll();
  }

  // ── Register Service Worker ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function (e) {
      console.warn('SW registration failed:', e);
    });
  }

  init();
})();
