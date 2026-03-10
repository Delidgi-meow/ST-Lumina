// ============================================
//  LUMINA SEARCH — SillyTavern Extension
//  Creative AI search + prompt injection
//  WITH full chat/character context awareness
// ============================================

import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';

const EXT_NAME = 'lumina-search';
const DEFAULT_SETTINGS = {
    api_url: 'http://127.0.0.1:5001/v1',
    api_key: '',
    model: '',
    system_prompt: 'You are a creative writing assistant embedded in a roleplay environment. You have access to the current character card, scenario, and recent chat history. Answer concisely and in the language of the user query. Provide specific, actionable ideas for this particular roleplay — not generic advice. Reference character names, established dynamics, and ongoing plot threads.',
    inject_position: 'after',
    inject_depth: 1,
    max_tokens: 600,
    temperature: 0.85,
    context_messages: 20,
    include_char: true,
    include_scenario: true,
    include_chat: true,
    history: [],
};

// ---- SVG ICONS ----

const ICONS = {
    lumina: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3m0 14v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M2 12h3m14 0h3M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12"/>
        <circle cx="12" cy="12" r="8" opacity="0.2" stroke-dasharray="2 3"/>
    </svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
    inject: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115.36-6.36L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15.36 6.36L3 16"/></svg>`,
};

// ---- SETTINGS ----

function loadSettings() {
    extension_settings[EXT_NAME] = extension_settings[EXT_NAME] || {};
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
        if (extension_settings[EXT_NAME][key] === undefined) {
            extension_settings[EXT_NAME][key] = val;
        }
    }
    return extension_settings[EXT_NAME];
}

function saveSetting(key, value) {
    extension_settings[EXT_NAME][key] = value;
    saveSettingsDebounced();
}

// ============================================================
//  CONTEXT GATHERING — reads character card + chat history
// ============================================================

function gatherContext() {
    const ctx = getContext();
    const s = loadSettings();
    const parts = [];

    // ---- Character card data ----
    if (s.include_char && ctx.characters && ctx.characterId !== undefined) {
        const char = ctx.characters[ctx.characterId];
        if (char) {
            const charParts = [];
            if (char.name) charParts.push(`Name: ${char.name}`);
            if (char.description) charParts.push(`Description: ${char.description}`);
            if (char.personality) charParts.push(`Personality: ${char.personality}`);
            if (char.mes_example) charParts.push(`Example dialogue:\n${char.mes_example}`);
            if (charParts.length) {
                parts.push(`=== CHARACTER CARD ===\n${charParts.join('\n')}`);
            }
        }
    }

    // ---- Scenario / first message ----
    if (s.include_scenario && ctx.characters && ctx.characterId !== undefined) {
        const char = ctx.characters[ctx.characterId];
        if (char) {
            const scenParts = [];
            if (char.scenario) scenParts.push(`Scenario: ${char.scenario}`);
            if (char.first_mes) scenParts.push(`First message: ${char.first_mes}`);
            if (scenParts.length) {
                parts.push(`=== SCENARIO ===\n${scenParts.join('\n')}`);
            }
        }
    }

    // ---- Chat history (last N messages) ----
    if (s.include_chat && ctx.chat && ctx.chat.length > 0) {
        const limit = Number(s.context_messages) || 20;
        const recent = ctx.chat.slice(-limit);
        const formatted = recent.map(msg => {
            const name = msg.is_user ? (ctx.name1 || 'User') : (msg.name || ctx.name2 || 'Character');
            const text = (msg.mes || '').slice(0, 500); // cap per message
            return `${name}: ${text}`;
        }).join('\n');

        if (formatted) {
            parts.push(`=== RECENT CHAT (last ${recent.length} messages) ===\n${formatted}`);
        }
    }

    // ---- User persona ----
    if (ctx.name1) {
        parts.push(`=== USER PERSONA ===\nName: ${ctx.name1}`);
    }

    return parts.join('\n\n');
}

// ---- CONTEXT STATS (shown in UI) ----

function getContextStats() {
    const ctx = getContext();
    const stats = [];

    if (ctx.characters && ctx.characterId !== undefined) {
        const char = ctx.characters[ctx.characterId];
        if (char?.name) stats.push(char.name);
    }

    if (ctx.chat) {
        stats.push(`${ctx.chat.length} msgs`);
    }

    return stats.length ? stats.join(' / ') : 'no context';
}

// ---- FETCH MODELS ----

async function fetchModels() {
    const s = loadSettings();
    const url = s.api_url.replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (s.api_key) headers['Authorization'] = `Bearer ${s.api_key}`;

    const response = await fetch(`${url}/models`, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Models: ${response.status}`);

    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
        return data.data.map(m => m.id || m.name || m).filter(Boolean);
    }
    if (Array.isArray(data)) {
        return data.map(m => (typeof m === 'string') ? m : (m.id || m.name)).filter(Boolean);
    }
    return [];
}

function populateModelSelect(models) {
    const select = document.getElementById('lum-model-select');
    if (!select) return;
    const cur = loadSettings().model || '';

    select.innerHTML = '<option value="">Auto (first available)</option>';
    for (const model of models) {
        const opt = document.createElement('option');
        opt.value = model;
        opt.textContent = model;
        if (model === cur) opt.selected = true;
        select.appendChild(opt);
    }
    if (cur && !models.includes(cur)) {
        const opt = document.createElement('option');
        opt.value = cur;
        opt.textContent = `${cur} (saved)`;
        opt.selected = true;
        select.appendChild(opt);
    }
}

// ---- HELPERS ----

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- BUILD PANEL HTML ----

function buildPanelHTML() {
    const s = loadSettings();
    return `
    <div id="lumina-panel">
        <div class="lum-mobile-handle"></div>
        <div class="lum-header">
            <div class="lum-logo">
                <div class="lum-logo-icon">${ICONS.lumina}</div>
                <div class="lum-logo-text"><span>Lumina</span> Search</div>
            </div>
            <div class="lum-header-actions">
                <button class="lum-icon-btn" id="lum-gear-btn" title="Toggle Settings">${ICONS.settings}</button>
                <button class="lum-icon-btn" id="lum-close" title="Close">${ICONS.close}</button>
            </div>
        </div>

        <div class="lum-body">

            <!-- ===== SEARCH VIEW ===== -->
            <div id="lum-search-section">

                <!-- Context indicator -->
                <div class="lum-context-bar" id="lum-context-bar">
                    <div class="lum-context-dot"></div>
                    <span id="lum-context-info">no context</span>
                </div>

                <div class="lum-search-wrap">
                    <textarea class="lum-search-textarea" id="lum-query"
                        placeholder="What interests you? Setting, plot twist, character arc, mood..."
                        spellcheck="false"></textarea>
                    <div class="lum-search-controls">
                        <span class="lum-token-hint" id="lum-char-count">0 chars</span>
                        <button class="lum-search-btn" id="lum-search-btn">
                            ${ICONS.search} <span>Generate</span>
                        </button>
                    </div>
                </div>

                <div class="lum-history" id="lum-history"></div>

                <div class="lum-loading" id="lum-loading">
                    <div class="lum-pulse-ring"></div>
                    <span>Generating...</span>
                </div>

                <div class="lum-result-wrap" id="lum-result-wrap">
                    <div class="lum-result-label">
                        <div class="lum-result-dot"></div>
                        <span>Result</span>
                    </div>
                    <div class="lum-result-content" id="lum-result-text"></div>
                    <div class="lum-actions">
                        <button class="lum-action-btn lum-btn-inject" id="lum-inject-btn">
                            ${ICONS.inject} <span>Inject</span>
                        </button>
                        <button class="lum-action-btn lum-btn-copy" id="lum-copy-btn">
                            ${ICONS.copy} <span>Copy</span>
                        </button>
                        <button class="lum-action-btn lum-btn-clear" id="lum-clear-btn" title="Clear">
                            ${ICONS.clear}
                        </button>
                    </div>
                </div>
            </div>

            <!-- ===== SETTINGS VIEW (hidden, gear toggles) ===== -->
            <div class="lum-settings-panel" id="lum-settings-panel">
                <div class="lum-settings">

                    <div class="lum-settings-group">
                        <label class="lum-settings-label">API URL</label>
                        <input class="lum-settings-input" id="lum-api-url" type="text"
                            value="${escapeAttr(s.api_url)}" placeholder="http://127.0.0.1:5001/v1" />
                    </div>

                    <div class="lum-settings-group">
                        <label class="lum-settings-label">API Key</label>
                        <input class="lum-settings-input" id="lum-api-key" type="password"
                            value="${escapeAttr(s.api_key)}" placeholder="sk-... (optional)" />
                    </div>

                    <div class="lum-settings-group">
                        <div class="lum-model-row">
                            <label class="lum-settings-label">Model</label>
                            <button class="lum-refresh-btn" id="lum-refresh-models" title="Fetch models from API">
                                ${ICONS.refresh}
                            </button>
                        </div>
                        <select class="lum-select" id="lum-model-select">
                            <option value="">Auto (first available)</option>
                            ${s.model ? `<option value="${escapeAttr(s.model)}" selected>${escapeHtml(s.model)}</option>` : ''}
                        </select>
                        <span class="lum-model-status" id="lum-model-status"></span>
                    </div>

                    <div class="lum-settings-group">
                        <label class="lum-settings-label">System Prompt</label>
                        <textarea class="lum-settings-textarea" id="lum-sys-prompt" rows="3"
                            placeholder="Instructions for the search AI..."
                        >${escapeHtml(s.system_prompt)}</textarea>
                    </div>

                    <div class="lum-divider"></div>
                    <label class="lum-settings-label" style="margin-bottom:2px">Context Sources</label>

                    <div class="lum-toggles-row">
                        <label class="lum-toggle-label">
                            <input type="checkbox" id="lum-inc-char" ${s.include_char ? 'checked' : ''} />
                            <span>Character card</span>
                        </label>
                        <label class="lum-toggle-label">
                            <input type="checkbox" id="lum-inc-scenario" ${s.include_scenario ? 'checked' : ''} />
                            <span>Scenario</span>
                        </label>
                        <label class="lum-toggle-label">
                            <input type="checkbox" id="lum-inc-chat" ${s.include_chat ? 'checked' : ''} />
                            <span>Chat history</span>
                        </label>
                    </div>

                    <div class="lum-settings-group">
                        <label class="lum-settings-label">Chat messages to include</label>
                        <input class="lum-settings-input" id="lum-context-msgs" type="number"
                            value="${s.context_messages}" min="1" max="100" style="width:100%" />
                    </div>

                    <div class="lum-divider"></div>

                    <div class="lum-inject-settings">
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">Inject Position</label>
                            <select class="lum-select" id="lum-inject-pos">
                                <option value="after" ${s.inject_position === 'after' ? 'selected' : ''}>After messages</option>
                                <option value="before" ${s.inject_position === 'before' ? 'selected' : ''}>Before messages</option>
                            </select>
                        </div>
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">Depth</label>
                            <input class="lum-settings-input" id="lum-inject-depth" type="number"
                                value="${s.inject_depth}" min="0" max="999" style="width:100%" />
                        </div>
                    </div>

                    <div class="lum-inject-settings">
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">Max Tokens</label>
                            <input class="lum-settings-input" id="lum-max-tokens" type="number"
                                value="${s.max_tokens}" min="50" max="4096" style="width:100%" />
                        </div>
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">Temperature</label>
                            <input class="lum-settings-input" id="lum-temperature" type="number"
                                value="${s.temperature}" min="0" max="2" step="0.05" style="width:100%" />
                        </div>
                    </div>

                </div>
            </div>

        </div>
    </div>
    `;
}

// ---- FAB ----

function buildFAB() {
    const fab = document.createElement('div');
    fab.id = 'lumina-fab';
    fab.title = 'Lumina Search';
    fab.innerHTML = ICONS.lumina;
    return fab;
}

// ============================================================
//  API CALL — now includes gathered context
// ============================================================

async function queryLuminaAPI(query) {
    const s = loadSettings();
    const url = s.api_url.replace(/\/+$/, '');

    // Gather context from SillyTavern
    const context = gatherContext();

    // Build messages: system (with context) + user query
    const messages = [];

    // System prompt
    let systemContent = s.system_prompt;
    if (context) {
        systemContent += `\n\n--- CURRENT ROLEPLAY CONTEXT ---\n${context}\n--- END CONTEXT ---`;
    }
    messages.push({ role: 'system', content: systemContent });

    // User query
    messages.push({ role: 'user', content: query });

    const body = {
        messages,
        max_tokens: Number(s.max_tokens) || 600,
        temperature: Number(s.temperature) || 0.85,
        stream: false,
    };
    if (s.model) body.model = s.model;

    const headers = { 'Content-Type': 'application/json' };
    if (s.api_key) headers['Authorization'] = `Bearer ${s.api_key}`;

    const response = await fetch(`${url}/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.choices?.[0]) return data.choices[0].message?.content || data.choices[0].text || '';
    if (data.content) return data.content;
    if (data.response) return data.response;
    throw new Error('Unknown response format');
}

// ---- INJECT ----

function injectResult(text) {
    const s = loadSettings();
    const context = getContext();
    const depth = Number(s.inject_depth) || 1;
    const position = s.inject_position === 'before' ? 0 : 1;
    context.setExtensionPrompt(
        EXT_NAME,
        `[Lumina Search — use creatively in your response]\n${text}`,
        position, depth,
    );
    showToast('Injected into prompt', 'success');
}

// ---- TOAST ----

function showToast(message, type = 'success') {
    let toast = document.getElementById('lum-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'lum-toast';
        document.body.appendChild(toast);
    }
    toast.className = `lum-toast lum-toast-${type}`;
    toast.textContent = message;
    requestAnimationFrame(() => toast.classList.add('lum-toast-visible'));
    setTimeout(() => toast.classList.remove('lum-toast-visible'), 2200);
}

// ---- HISTORY ----

function addToHistory(query) {
    const s = loadSettings();
    const trimmed = query.trim().slice(0, 100);
    if (!trimmed) return;
    s.history = s.history.filter(h => h !== trimmed);
    s.history.unshift(trimmed);
    s.history = s.history.slice(0, 8);
    saveSetting('history', s.history);
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('lum-history');
    if (!container) return;
    const s = loadSettings();
    if (!s.history?.length) { container.innerHTML = ''; return; }

    container.innerHTML = s.history.map(h =>
        `<div class="lum-chip" data-query="${escapeAttr(h)}">${escapeHtml(h)}</div>`
    ).join('');

    container.querySelectorAll('.lum-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const textarea = document.getElementById('lum-query');
            if (textarea) {
                textarea.value = chip.dataset.query;
                textarea.dispatchEvent(new Event('input'));
            }
        });
    });
}

// ---- UPDATE CONTEXT BAR ----

function updateContextBar() {
    const info = document.getElementById('lum-context-info');
    if (info) info.textContent = getContextStats();
}

// ============================================================
//  INIT
// ============================================================

jQuery(async () => {
    loadSettings();

    // Inject panel
    const wrap = document.createElement('div');
    wrap.innerHTML = buildPanelHTML();
    document.body.appendChild(wrap.firstElementChild);

    // Inject FAB
    const fab = buildFAB();
    document.body.appendChild(fab);

    // Elements
    const panel = document.getElementById('lumina-panel');
    const queryInput = document.getElementById('lum-query');
    const searchBtn = document.getElementById('lum-search-btn');
    const loading = document.getElementById('lum-loading');
    const resultWrap = document.getElementById('lum-result-wrap');
    const resultText = document.getElementById('lum-result-text');
    const injectBtn = document.getElementById('lum-inject-btn');
    const copyBtn = document.getElementById('lum-copy-btn');
    const clearBtn = document.getElementById('lum-clear-btn');
    const closeBtn = document.getElementById('lum-close');
    const charCount = document.getElementById('lum-char-count');
    const gearBtn = document.getElementById('lum-gear-btn');
    const settingsPanel = document.getElementById('lum-settings-panel');
    const searchSection = document.getElementById('lum-search-section');
    const refreshModelsBtn = document.getElementById('lum-refresh-models');
    const modelSelect = document.getElementById('lum-model-select');
    const modelStatus = document.getElementById('lum-model-status');

    // ---- FAB toggle ----
    let panelOpen = false;

    function togglePanel() {
        panelOpen = !panelOpen;
        panel.classList.toggle('lum-visible', panelOpen);
        fab.classList.toggle('lum-fab-active', panelOpen);
        if (panelOpen) {
            updateContextBar();
            queryInput?.focus();
        }
    }

    fab.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });
    closeBtn.addEventListener('click', togglePanel);

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!panelOpen) return;
        if (panel.contains(e.target) || fab.contains(e.target)) return;
        togglePanel();
    });

    // ---- Gear: toggles search <-> settings view ----
    let settingsVisible = false;

    gearBtn.addEventListener('click', () => {
        settingsVisible = !settingsVisible;
        gearBtn.classList.toggle('lum-gear-active', settingsVisible);

        if (settingsVisible) {
            searchSection.style.display = 'none';
            settingsPanel.classList.add('lum-settings-open');
        } else {
            searchSection.style.display = '';
            settingsPanel.classList.remove('lum-settings-open');
        }
    });

    // ---- Refresh models ----
    refreshModelsBtn.addEventListener('click', async () => {
        refreshModelsBtn.classList.add('lum-spinning');
        modelStatus.textContent = 'loading...';
        modelStatus.className = 'lum-model-status';

        try {
            const models = await fetchModels();
            populateModelSelect(models);
            modelStatus.textContent = `${models.length} model${models.length !== 1 ? 's' : ''}`;
            modelStatus.classList.add('lum-status-ok');
            showToast(`${models.length} models loaded`, 'success');
        } catch (err) {
            console.error('[Lumina]', err);
            modelStatus.textContent = 'failed';
            modelStatus.classList.add('lum-status-err');
            showToast(err.message, 'error');
        } finally {
            refreshModelsBtn.classList.remove('lum-spinning');
        }
    });

    modelSelect.addEventListener('change', () => saveSetting('model', modelSelect.value));

    // ---- Char count ----
    queryInput.addEventListener('input', () => {
        charCount.textContent = `${queryInput.value.length} chars`;
    });

    // ---- Search (with context!) ----
    let isGenerating = false;

    async function doSearch() {
        const query = queryInput.value.trim();
        if (!query || isGenerating) return;

        isGenerating = true;
        searchBtn.disabled = true;
        loading.classList.add('active');
        resultWrap.classList.remove('active');

        try {
            const result = await queryLuminaAPI(query);
            resultText.textContent = result;
            resultWrap.classList.add('active');
            addToHistory(query);
        } catch (err) {
            console.error('[Lumina]', err);
            showToast(err.message || 'Generation failed', 'error');
        } finally {
            isGenerating = false;
            searchBtn.disabled = false;
            loading.classList.remove('active');
        }
    }

    searchBtn.addEventListener('click', doSearch);
    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doSearch(); }
    });

    // ---- Actions ----
    injectBtn.addEventListener('click', () => {
        const text = resultText.textContent;
        if (text) injectResult(text);
    });

    copyBtn.addEventListener('click', async () => {
        const text = resultText.textContent;
        if (!text) return;
        try { await navigator.clipboard.writeText(text); showToast('Copied', 'success'); }
        catch {
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); ta.remove(); showToast('Copied', 'success');
        }
    });

    clearBtn.addEventListener('click', () => {
        resultWrap.classList.remove('active');
        resultText.textContent = '';
        getContext().setExtensionPrompt(EXT_NAME, '', 0, 0);
    });

    // ---- Settings auto-save ----
    const settingsMap = {
        'lum-api-url': 'api_url',
        'lum-api-key': 'api_key',
        'lum-sys-prompt': 'system_prompt',
        'lum-inject-pos': 'inject_position',
        'lum-inject-depth': 'inject_depth',
        'lum-max-tokens': 'max_tokens',
        'lum-temperature': 'temperature',
        'lum-context-msgs': 'context_messages',
    };

    for (const [elemId, settingKey] of Object.entries(settingsMap)) {
        const elem = document.getElementById(elemId);
        if (!elem) continue;
        const evt = elem.tagName === 'SELECT' ? 'change' : 'input';
        elem.addEventListener(evt, () => {
            let val = elem.value;
            if (['inject_depth', 'max_tokens', 'context_messages'].includes(settingKey)) val = parseInt(val, 10) || 0;
            else if (settingKey === 'temperature') val = parseFloat(val) || 0;
            saveSetting(settingKey, val);
        });
    }

    // Checkbox toggles for context sources
    const checkboxMap = {
        'lum-inc-char': 'include_char',
        'lum-inc-scenario': 'include_scenario',
        'lum-inc-chat': 'include_chat',
    };

    for (const [elemId, settingKey] of Object.entries(checkboxMap)) {
        const elem = document.getElementById(elemId);
        if (!elem) continue;
        elem.addEventListener('change', () => {
            saveSetting(settingKey, elem.checked);
        });
    }

    // ---- Render history + context bar ----
    renderHistory();
    updateContextBar();

    // Update context bar when chat changes
    const eventSource = window.eventSource || (await import('../../../../script.js')).eventSource;
    if (eventSource) {
        const refreshCtx = () => updateContextBar();
        try {
            eventSource.on('chatLoaded', refreshCtx);
            eventSource.on('characterSelected', refreshCtx);
            eventSource.on('messageReceived', refreshCtx);
            eventSource.on('messageSent', refreshCtx);
        } catch (e) {
            console.warn('[Lumina] Event binding partial:', e);
        }
    }

    // ---- Slash command ----
    try {
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'lumina',
            callback: async (_args, query) => {
                if (!query) return 'Provide a search query';
                try { return await queryLuminaAPI(query); }
                catch (err) { return `Error: ${err.message}`; }
            },
            helpString: 'Run a Lumina search query with current chat context.',
        }));
    } catch (e) {
        console.warn('[Lumina] Slash command not registered:', e);
    }

    console.log('[Lumina Search] Extension loaded (context-aware)');
});
