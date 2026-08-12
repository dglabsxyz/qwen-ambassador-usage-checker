import { addHistoryEntry, normalizeHistory } from './history.js';

const HISTORY_KEY = 'qwen-quota-history-v1';
const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const elements = {
  checkButton: document.querySelector('#check-button'),
  clearHistory: document.querySelector('#clear-history'),
  status: document.querySelector('#status'),
  limit: document.querySelector('#limit-value'),
  used: document.querySelector('#used-value'),
  remaining: document.querySelector('#remaining-value'),
  progress: document.querySelector('#usage-progress'),
  progressLabel: document.querySelector('#progress-label'),
  promptTokens: document.querySelector('#prompt-tokens'),
  completionTokens: document.querySelector('#completion-tokens'),
  totalTokens: document.querySelector('#total-tokens'),
  checkedAt: document.querySelector('#checked-at'),
  cacheState: document.querySelector('#cache-state'),
  historyBody: document.querySelector('#history-body'),
  historyEmpty: document.querySelector('#history-empty')
};

function readHistory() {
  try {
    return normalizeHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function formatDate(value) {
  return dateFormat.format(new Date(value));
}

function renderResult(result, fromHistory = false) {
  elements.limit.textContent = numberFormat.format(result.limit);
  elements.used.textContent = numberFormat.format(result.used);
  elements.remaining.textContent = numberFormat.format(result.remaining);
  elements.progress.value = result.usedPercent;
  elements.progress.textContent = `${result.usedPercent}%`;
  elements.progressLabel.textContent = `${result.usedPercent}% used`;
  elements.checkedAt.textContent = formatDate(result.checkedAt);
  elements.cacheState.textContent = fromHistory ? 'Last saved result' : result.cached ? 'Cached — no request consumed' : 'Live ModelScope result';

  if (result.probeTokens) {
    elements.promptTokens.textContent = numberFormat.format(result.probeTokens.prompt);
    elements.completionTokens.textContent = numberFormat.format(result.probeTokens.completion);
    elements.totalTokens.textContent = numberFormat.format(result.probeTokens.total);
  }
}

function renderHistory(history) {
  elements.historyBody.replaceChildren();
  elements.historyEmpty.hidden = history.length > 0;
  for (const item of history) {
    const row = document.createElement('tr');
    for (const value of [formatDate(item.checkedAt), numberFormat.format(item.used), numberFormat.format(item.remaining), `${item.usedPercent}%`]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    elements.historyBody.append(row);
  }
}

let history = readHistory();
renderHistory(history);
if (history[0]) renderResult(history[0], true);

elements.checkButton.addEventListener('click', async () => {
  elements.checkButton.disabled = true;
  elements.checkButton.textContent = 'Checking…';
  elements.status.classList.remove('error');
  elements.status.textContent = 'Checking ModelScope. This may take a few seconds after the app wakes.';
  document.body.setAttribute('aria-busy', 'true');

  try {
    const response = await fetch('/api/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'The quota check failed.');

    renderResult(body);
    history = addHistoryEntry(history, body);
    saveHistory(history);
    renderHistory(history);
    elements.status.textContent = body.cached
      ? 'Showing the result cached within the last 60 seconds. No additional ModelScope request was consumed.'
      : 'Usage updated successfully from ModelScope.';
  } catch (error) {
    elements.status.classList.add('error');
    elements.status.textContent = error instanceof Error ? error.message : 'The quota check failed.';
  } finally {
    elements.checkButton.disabled = false;
    elements.checkButton.textContent = 'Check Usage';
    document.body.removeAttribute('aria-busy');
  }
});

elements.clearHistory.addEventListener('click', () => {
  if (!window.confirm('Clear quota history stored in this browser?')) return;
  localStorage.removeItem(HISTORY_KEY);
  history = [];
  renderHistory(history);
  elements.status.classList.remove('error');
  elements.status.textContent = 'Local browser history was cleared. The displayed live result is unchanged.';
});
