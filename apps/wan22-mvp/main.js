(function () {
  'use strict';

  var STATE_API = '/api/state';
  var LOCAL_STORAGE_KEY = 'wan22os.state';
  var VIEWS = ['contracts', 'documents', 'costs', 'projects', 'tasks', 'approvals', 'control-panel'];

  var isServerBacked = window.location.protocol === 'http:' || window.location.protocol === 'https:';

  function emptyState() {
    return {
      meta: { version: '0.1.0', updatedAt: null },
      contracts: [],
      costs: [],
      projects: [],
      tasks: [],
      approvals: []
    };
  }

  function loadFromLocalStorage() {
    try {
      var raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : emptyState();
    } catch (err) {
      return emptyState();
    }
  }

  function saveToLocalStorage(state) {
    state.meta = state.meta || {};
    state.meta.updatedAt = new Date().toISOString();
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }

  function fetchServerState() {
    return fetch(STATE_API)
      .then(function (res) {
        if (!res.ok) {
          throw new Error('State request failed: ' + res.status);
        }
        return res.json();
      });
  }

  function saveServerState(state) {
    return fetch(STATE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
  }

  function setSyncStatus(text) {
    var el = document.getElementById('sync-status');
    if (el) {
      el.textContent = text;
    }
  }

  function renderView(view, state) {
    var container = document.getElementById('app-view');
    if (!container) {
      return;
    }

    var counts = {
      contracts: (state.contracts || []).length,
      documents: 0,
      costs: (state.costs || []).length,
      projects: (state.projects || []).length,
      tasks: (state.tasks || []).length,
      approvals: (state.approvals || []).length,
      'control-panel': 0
    };

    container.innerHTML =
      '<h2>' + view.charAt(0).toUpperCase() + view.slice(1).replace('-', ' ') + '</h2>' +
      '<p>' + (counts[view] || 0) + ' item(s) in state.</p>';
  }

  function bindNav(state) {
    var buttons = document.querySelectorAll('.nav-item');
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        buttons.forEach(function (b) {
          b.classList.remove('active');
        });
        button.classList.add('active');
        renderView(button.getAttribute('data-view'), state);
      });
    });
  }

  function init() {
    bindNav(emptyState());

    if (isServerBacked) {
      setSyncStatus('Connecting to shared state...');
      fetchServerState()
        .then(function (state) {
          setSyncStatus('Synced with apps/wan22-mvp/data/state.json');
          bindNav(state);
          renderView(VIEWS[0], state);
        })
        .catch(function () {
          setSyncStatus('Unable to reach server state, using local fallback');
          var state = loadFromLocalStorage();
          bindNav(state);
          renderView(VIEWS[0], state);
        });
    } else {
      setSyncStatus('Standalone preview (localStorage only, not synced)');
      var state = loadFromLocalStorage();
      saveToLocalStorage(state);
      bindNav(state);
      renderView(VIEWS[0], state);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
