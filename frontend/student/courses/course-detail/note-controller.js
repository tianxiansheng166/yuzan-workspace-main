'use strict';

(function () {
  var ICONS = {
    edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
  };

  function formatTimestamp(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function parseTimestamps(text) {
    var regex = /\[(\d{1,2}):(\d{2})\]/g;
    var results = [];
    var match;
    while ((match = regex.exec(text)) !== null) {
      var mins = parseInt(match[1], 10);
      var secs = parseInt(match[2], 10);
      results.push({
        seconds: mins * 60 + secs,
        original: match[0]
      });
    }
    return results;
  }

  function showToast(message) {
    var existing = document.querySelector('.cp-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'cp-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2500);
  }

  var NoteController = {
    _elements: {},
    _unsubscribe: null,
    _lastTimestampSecond: -1,

    init: function () {
      // Match IDs from index.html
      this._elements = {
        notesList: document.getElementById('cpNotesList'),
        noteTextarea: document.getElementById('cpNoteTextarea'),
        addTimestampBtn: document.getElementById('cpNoteTimestamp'),
        saveNoteBtn: document.getElementById('cpNoteSaveBtn'),
        cancelNoteBtn: document.getElementById('cpNoteCancelBtn'),
        currentTimestamp: document.getElementById('cpNoteTimestamp')
      };

      var self = this;

      this._unsubscribe = window.CoursePlayerState.subscribe(function (state, keys) {
        if (keys.indexOf('notes') !== -1 || keys.indexOf('currentActivity') !== -1) {
          self.renderNotes(state.notes || [], self._elements.notesList);
        }
        if (keys.indexOf('videoTimestamp') !== -1) {
          var ts = state.videoTimestamp || 0;
          var currentSecond = Math.floor(ts);
          if (currentSecond !== self._lastTimestampSecond) {
            self._lastTimestampSecond = currentSecond;
            if (self._elements.currentTimestamp) {
              self._elements.currentTimestamp.textContent = formatTimestamp(ts);
            }
          }
        }
      });

      this.setupNoteInput();

      var state = window.CoursePlayerState.getState();
      this.renderNotes(state.notes || [], this._elements.notesList);
    },

    renderNotes: function (notes, container) {
      if (!container) return;
      container.innerHTML = '';

      if (!notes || notes.length === 0) {
        container.innerHTML = '<div class="cp-notes-empty">暂无笔记，在上方添加第一条笔记吧。</div>';
        return;
      }

      var self = this;

      notes.forEach(function (note) {
        var item = document.createElement('div');
        item.className = 'cp-note-item';
        item.setAttribute('data-note-id', note.noteId || note.id);

        var tsBadge = document.createElement('span');
        tsBadge.className = 'cp-note-ts-badge';
        tsBadge.innerHTML = ICONS.clock + ' ' + formatTimestamp(note.videoTimestamp || 0);
        tsBadge.addEventListener('click', function () {
          if (window.MediaController && typeof window.MediaController.seekTo === 'function') {
            window.MediaController.seekTo(note.videoTimestamp || 0);
          }
        });

        var content = document.createElement('div');
        content.className = 'cp-note-content';
        content.textContent = note.content || '';

        var actions = document.createElement('div');
        actions.className = 'cp-note-actions';

        var editBtn = document.createElement('button');
        editBtn.className = 'cp-note-action-btn';
        editBtn.innerHTML = ICONS.edit;
        editBtn.title = '编辑';
        editBtn.addEventListener('click', function () {
          self._startEdit(item, note);
        });

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'cp-note-action-btn';
        deleteBtn.innerHTML = ICONS.trash;
        deleteBtn.title = '删除';
        deleteBtn.addEventListener('click', function () {
          self._confirmDelete(item, note);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(tsBadge);
        item.appendChild(content);
        item.appendChild(actions);
        container.appendChild(item);
      });
    },

    _startEdit: function (item, note) {
      var contentEl = item.querySelector('.cp-note-content');
      var actionsEl = item.querySelector('.cp-note-actions');
      if (!contentEl || !actionsEl) return;

      var originalText = note.content || '';

      var textarea = document.createElement('textarea');
      textarea.className = 'cp-note-edit-textarea';
      textarea.value = originalText;
      textarea.rows = 3;

      contentEl.innerHTML = '';
      contentEl.appendChild(textarea);

      actionsEl.innerHTML = '';

      var self = this;
      var noteId = note.noteId || note.id;
      var activityId = window.CoursePlayerState.getState().currentActivity
        ? window.CoursePlayerState.getState().currentActivity.activityId
        : '';

      var saveBtn = document.createElement('button');
      saveBtn.className = 'cp-note-action-btn';
      saveBtn.innerHTML = ICONS.save;
      saveBtn.title = '保存';
      saveBtn.addEventListener('click', function () {
        var newContent = textarea.value.trim();
        if (!newContent) return;
        var ts = window.CoursePlayerState.getState().videoTimestamp || 0;
        window.CourseApiAdapter.updateNote(activityId, noteId, newContent, ts, note.revision || 1)
          .then(function () {
            window.CoursePlayerState.updateNote(noteId, newContent, ts, (note.revision || 1) + 1);
            showToast('笔记已更新');
          })
          .catch(function () {
            showToast('更新笔记失败');
          });
      });

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'cp-note-action-btn';
      cancelBtn.textContent = '✕';
      cancelBtn.title = '取消';
      cancelBtn.addEventListener('click', function () {
        self.renderNotes(window.CoursePlayerState.getState().notes || [], self._elements.notesList);
      });

      actionsEl.appendChild(saveBtn);
      actionsEl.appendChild(cancelBtn);
    },

    _confirmDelete: function (item, note) {
      var actionsEl = item.querySelector('.cp-note-actions');
      if (!actionsEl) return;

      actionsEl.innerHTML = '';

      var self = this;
      var noteId = note.noteId || note.id;
      var activityId = window.CoursePlayerState.getState().currentActivity
        ? window.CoursePlayerState.getState().currentActivity.activityId
        : '';

      var confirmText = document.createElement('span');
      confirmText.className = 'cp-note-confirm-text';
      confirmText.textContent = '确认删除？';

      var yesBtn = document.createElement('button');
      yesBtn.className = 'cp-note-action-btn';
      yesBtn.textContent = '是';
      yesBtn.addEventListener('click', function () {
        window.CourseApiAdapter.deleteNote(activityId, noteId)
          .then(function () {
            window.CoursePlayerState.removeNote(noteId);
            showToast('笔记已删除');
          })
          .catch(function () {
            showToast('删除笔记失败');
            self.renderNotes(window.CoursePlayerState.getState().notes || [], self._elements.notesList);
          });
      });

      var noBtn = document.createElement('button');
      noBtn.className = 'cp-note-action-btn';
      noBtn.textContent = '否';
      noBtn.addEventListener('click', function () {
        self.renderNotes(window.CoursePlayerState.getState().notes || [], self._elements.notesList);
      });

      actionsEl.appendChild(confirmText);
      actionsEl.appendChild(yesBtn);
      actionsEl.appendChild(noBtn);
    },

    setupNoteInput: function () {
      var textarea = this._elements.noteTextarea;
      var saveBtn = this._elements.saveNoteBtn;
      var cancelBtn = this._elements.cancelNoteBtn;

      if (!textarea || !saveBtn) return;

      var self = this;

      saveBtn.addEventListener('click', function () {
        var content = textarea.value.trim();
        if (!content) return;

        var state = window.CoursePlayerState.getState();
        var activityId = state.currentActivity ? state.currentActivity.activityId : null;
        if (!activityId) {
          showToast('未选择活动');
          return;
        }

        var timestamps = parseTimestamps(content);
        var videoTimestamp = timestamps.length > 0 ? timestamps[0].seconds : (state.videoTimestamp || 0);

        window.CourseApiAdapter.createNote(activityId, content, videoTimestamp)
          .then(function (newNote) {
            window.CoursePlayerState.addNote(newNote);
            textarea.value = '';
            showToast('笔记已保存');
          })
          .catch(function () {
            showToast('保存笔记失败');
          });
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          textarea.value = '';
        });
      }
    }
  };

  window.NoteController = NoteController;
})();
