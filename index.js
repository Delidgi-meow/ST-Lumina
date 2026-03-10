import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';

const EXT_NAME = 'lumina-search';
const DEFAULT_SETTINGS = {
    api_url: 'http://127.0.0.1:5001/v1',
    api_key: '',
    model: '',
    system_prompt: 'You are a creative writing assistant. Answer concisely and in the language of the user query. Provide specific, actionable ideas for roleplay scenarios, character development, plot progression, world-building, and settings. Be vivid and imaginative.',
    inject_position: 'after',  // 'before' | 'after'
    inject_depth: 1,
    max_tokens: 600,
    temperature: 0.85,
    history: [],
};

// ---- SVG ICONS ----

const ICONS = {
    lumina: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3m0 14v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M2 12h3m14 0h3M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12"/>
        <circle cx="12" cy="12" r="8" opacity="0.2" stroke-dasharray="2 3"/>
    </svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>`,
    inject: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14"/>
    </svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>`,
    clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18l6-6-6-6"/>
    </svg>`,
};

// ---- SETTINGS MANAGEMENT ----

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

// ---- BUILD HTML ----

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
                <button class="lum-icon-btn" id="lum-settings-toggle" title="Settings">${ICONS.settings}</button>
                <button class="lum-icon-btn" id="lum-close" title="Close">${ICONS.close}</button>
            </div>
        </div>

        <div class="lum-body">
            <!-- Search -->
            <div class="lum-search-wrap">
                <textarea
                    class="lum-search-textarea"
                    id="lum-query"
                    placeholder="What interests you? Setting, plot twist, character arc, mood..."
                    spellcheck="false"
                ></textarea>
                <div class="lum-search-controls">
                    <span class="lum-token-hint" id="lum-char-count">0 chars</span>
                    <button class="lum-search-btn" id="lum-search-btn">
                        ${ICONS.search}
                        <span>Generate</span>
                    </button>
                </div>
            </div>

            <!-- History chips -->
            <div class="lum-history" id="lum-history"></div>

            <!-- Loading -->
            <div class="lum-loading" id="lum-loading">
                <div class="lum-pulse-ring"></div>
                <span>Generating...</span>
            </div>

            <!-- Result -->
            <div class="lum-result-wrap" id="lum-result-wrap">
                <div class="lum-result-label">
                    <div class="lum-result-dot"></div>
                    <span>Result</span>
                </div>
                <div class="lum-result-content" id="lum-result-text"></div>
                <div class="lum-actions">
                    <button class="lum-action-btn lum-btn-inject" id="lum-inject-btn">
                        ${ICONS.inject}
                        <span>Inject</span>
                    </button>
                    <button class="lum-action-btn lum-btn-copy" id="lum-copy-btn">
                        ${ICONS.copy}
                        <span>Copy</span>
                    </button>
                    <button class="lum-action-btn lum-btn-clear" id="lum-clear-btn" title="Clear">
                        ${ICONS.clear}
                    </button>
                </div>
            </div>

            <div class="lum-divider"></div>

            <!-- Settings section -->
            <div>
                <button class="lum-section-toggle" id="lum-settings-section-toggle">
                    ${ICONS.chevron}
                    <span>Settings</span>
                </button>
                <div class="lum-section-content" id="lum-settings-section">
                    <div class="lum-settings">
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">API URL</label>
                            <input class="lum-settings-input" id="lum-api-url" type="text"
                                value="${escapeAttr(s.api_url)}"
                                placeholder="http://127.0.0.1:5001/v1" />
                        </div>
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">API Key</label>
                            <input class="lum-settings-input" id="lum-api-key" type="password"
                                value="${escapeAttr(s.api_key)}"
                                placeholder="sk-... (optional)" />
                        </div>
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">Model</label>
                            <input class="lum-settings-input" id="lum-model" type="text"
                                value="${escapeAttr(s.model)}"
                                placeholder="Model name (auto if empty)" />
                        </div>
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">System Prompt</label>
                            <textarea class="lum-settings-textarea" id="lum-sys-prompt" rows="3"
                                placeholder="Instructions for the search AI..."
                            >${escapeHtml(s.system_prompt)}</textarea>
                        </div>
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
                                    value="${s.inject_depth}" min="0" max="999"
                                    style="width:100%" />
                            </div>
                        </div>
                        <div class="lum-inject-settings">
                            <div class="lum-settings-group">
                                <label class="lum-settings-label">Max Tokens</label>
                                <input class="lum-settings-input" id="lum-max-tokens" type="number"
                                    value="${s.max_tokens}" min="50" max="4096"
                                    style="width:100%" />
                            </div>
                            <div class="lum-settings-group">
                                <label class="lum-settings-label">Temperature</label>
                                <input class="lum-settings-input" id="lum-temperature" type="number"
                                    value="${s.temperature}" min="0" max="2" step="0.05"
                                    style="width:100%" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeAttr(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- TOGGLE BUTTON FOR ST HEADER ----

function buildToggleButton() {
    const btn = document.createElement('div');
    btn.id = 'lumina-toggle';
    btn.title = 'Lumina Search';
    btn.innerHTML = ICONS.lumina;
    btn.classList.add('fa-solid'); // for ST to pick up as icon-sized
    return btn;
}

// ---- API CALL ----

async function queryLuminaAPI(query) {
    const s = loadSettings();
    const url = s.api_url.replace(/\/+$/, '');
    const endpoint = `${url}/chat/completions`;

    const body = {
        messages: [
            { role: 'system', content: s.system_prompt },
            { role: 'user', content: query },
        ],
        max_tokens: Number(s.max_tokens) || 600,
        temperature: Number(s.temperature) || 0.85,
        stream: false,
    };

    if (s.model) {
        body.model = s.model;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (s.api_key) {
        headers['Authorization'] = `Bearer ${s.api_key}`;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();

    // OpenAI-compatible format
    if (data.choices && data.choices[0]) {
        return data.choices[0].message?.content || data.choices[0].text || '';
    }

    // Fallback: try common formats
    if (data.content) return data.content;
    if (data.response) return data.response;
    if (data.result) return data.result;

    throw new Error('Unknown API response format');
}

// ---- INJECT INTO PROMPT ----

function injectResult(text) {
    const s = loadSettings();
    const context = getContext();
    const depth = Number(s.inject_depth) || 1;

    // Use SillyTavern's setExtensionPrompt for clean injection
    const position = s.inject_position === 'before' ? 0 : 1; // RELATIVE positioning
    context.setExtensionPrompt(
        EXT_NAME,
        `[Lumina Search result — use this information creatively in your response]\n${text}`,
        position,
        depth,
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

    requestAnimationFrame(() => {
        toast.classList.add('lum-toast-visible');
    });

    setTimeout(() => {
        toast.classList.remove('lum-toast-visible');
    }, 2200);
}

// ---- HISTORY ----

function addToHistory(query) {
    const s = loadSettings();
    const trimmed = query.trim().slice(0, 100);
    if (!trimmed) return;

    // Remove duplicate
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

    if (!s.history || s.history.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = s.history.map(h =>
        `<div class="lum-chip" data-query="${escapeAttr(h)}">${escapeHtml(h)}</div>`
    ).join('');

    container.querySelectorAll('.lum-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.dataset.query;
            const textarea = document.getElementById('lum-query');
            if (textarea) {
                textarea.value = q;
                textarea.dispatchEvent(new Event('input'));
            }
        });
    });
}

// ---- MAIN INIT ----

jQuery(async () => {
    const settings = loadSettings();

    // Inject panel HTML
    const panelWrapper = document.createElement('div');
    panelWrapper.innerHTML = buildPanelHTML();
    document.body.appendChild(panelWrapper.firstElementChild);

    // Inject toggle button into ST header
    const toggleBtn = buildToggleButton();
    const extensionsMenu = document.getElementById('extensionsMenu');
    const topBar = document.getElementById('top-bar');

    // Try to place near other extension buttons
    if (extensionsMenu) {
        extensionsMenu.parentElement.insertBefore(toggleBtn, extensionsMenu);
    } else if (topBar) {
        topBar.appendChild(toggleBtn);
    } else {
        // Fallback: place in top settings
        const topSettings = document.getElementById('top-settings-holder');
        if (topSettings) topSettings.appendChild(toggleBtn);
    }

    // ---- Elements ----
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
    const settingsToggle = document.getElementById('lum-settings-section-toggle');
    const settingsSection = document.getElementById('lum-settings-section');

    // ---- Toggle Panel ----
    function togglePanel() {
        const isVisible = panel.classList.contains('lum-visible');
        if (isVisible) {
            panel.classList.remove('lum-visible');
            toggleBtn.classList.remove('active');
        } else {
            panel.classList.add('lum-visible');
            toggleBtn.classList.add('active');
            queryInput?.focus();
        }
    }

    toggleBtn.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', togglePanel);

    // ---- Char count ----
    queryInput.addEventListener('input', () => {
        charCount.textContent = `${queryInput.value.length} chars`;
    });

    // ---- Search ----
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
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            doSearch();
        }
    });

    // ---- Action buttons ----
    injectBtn.addEventListener('click', () => {
        const text = resultText.textContent;
        if (text) injectResult(text);
    });

    copyBtn.addEventListener('click', async () => {
        const text = resultText.textContent;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied', 'success');
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            showToast('Copied', 'success');
        }
    });

    clearBtn.addEventListener('click', () => {
        resultWrap.classList.remove('active');
        resultText.textContent = '';
        // Clear injection
        const context = getContext();
        context.setExtensionPrompt(EXT_NAME, '', 0, 0);
    });

    // ---- Settings toggle ----
    settingsToggle.addEventListener('click', () => {
        settingsToggle.classList.toggle('open');
        settingsSection.classList.toggle('open');
    });

    // ---- Settings save ----
    const settingsMap = {
        'lum-api-url': 'api_url',
        'lum-api-key': 'api_key',
        'lum-model': 'model',
        'lum-sys-prompt': 'system_prompt',
        'lum-inject-pos': 'inject_position',
        'lum-inject-depth': 'inject_depth',
        'lum-max-tokens': 'max_tokens',
        'lum-temperature': 'temperature',
    };

    for (const [elemId, settingKey] of Object.entries(settingsMap)) {
        const elem = document.getElementById(elemId);
        if (!elem) continue;

        const eventType = elem.tagName === 'SELECT' ? 'change' : 'input';
        elem.addEventListener(eventType, () => {
            let val = elem.value;
            // Convert numeric fields
            if (['inject_depth', 'max_tokens'].includes(settingKey)) {
                val = parseInt(val, 10) || 0;
            } else if (settingKey === 'temperature') {
                val = parseFloat(val) || 0;
            }
            saveSetting(settingKey, val);
        });
    }

    // ---- Render history ----
    renderHistory();

    // ---- Slash command ----
    try {
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'lumina',
            callback: async (_args, query) => {
                if (!query) return 'Provide a search query';
                try {
                    const result = await queryLuminaAPI(query);
                    return result;
                } catch (err) {
                    return `Error: ${err.message}`;
                }
            },
            helpString: 'Run a Lumina search query and return the result.',
        }));
    } catch (e) {
        console.warn('[Lumina] Could not register slash command:', e);
    }

    console.log('[Lumina Search] Extension loaded');
});
