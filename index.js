// ============================================
//  LUMINA SEARCH — SillyTavern Extension
//  Context-aware AI search + prompt injection
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
    system_prompt: 'You are a creative writing assistant helping with roleplay. Answer concisely and in the language of the user query. Use the provided character and chat context to give specific, relevant, actionable ideas. Be vivid and imaginative. Never break character context.',
    inject_position: 'after',
    inject_depth: 1,
    max_tokens: 600,
    temperature: 0.85,
    context_messages: 15,
    include_card: true,
    history: [],
    fab_x: -1,
    fab_y: -1,
};

// ---- SVG ICONS ----

const ICONS = {
    lumina: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity="0.15"/>
        <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77"/>
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
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115.36-6.36L21 8"/>
        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15.36 6.36L3 16"/>
    </svg>`,
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

    // ---- Character card info ----
    if (s.include_card) {
        const charName = ctx.name2 || '';
        const userName = ctx.name1 || 'User';

        if (charName) {
            parts.push(`[CHARACTER: ${charName}]`);
        }

        // Description
        const description = ctx.characters?.[ctx.characterId]?.description
            || ctx.characterData?.description
            || '';
        if (description) {
            parts.push(`[DESCRIPTION]\n${description.trim()}`);
        }

        // Personality
        const personality = ctx.characters?.[ctx.characterId]?.personality
            || ctx.characterData?.personality
            || '';
        if (personality) {
            parts.push(`[PERSONALITY]\n${personality.trim()}`);
        }

        // Scenario
        const scenario = ctx.characters?.[ctx.characterId]?.scenario
            || ctx.characterData?.scenario
            || '';
        if (scenario) {
            parts.push(`[SCENARIO]\n${scenario.trim()}`);
        }

        // Mes_example (example messages) — can be useful for tone
        const mesExample = ctx.characters?.[ctx.characterId]?.mes_example
            || ctx.characterData?.mes_example
            || '';
        if (mesExample && mesExample.trim().length > 0) {
            // Trim to first 500 chars to not blow up context
            parts.push(`[EXAMPLE DIALOGUE]\n${mesExample.trim().slice(0, 500)}`);
        }

        if (userName) {
            parts.push(`[USER PERSONA: ${userName}]`);
        }

        // User persona description
        const personaDescription = ctx.persona?.description || '';
        if (personaDescription) {
            parts.push(`[USER DESCRIPTION]\n${personaDescription.trim()}`);
        }
    }

    // ---- Chat history (last N messages) ----
    const chat = ctx.chat || [];
    const msgCount = Math.min(Number(s.context_messages) || 15, chat.length);

    if (msgCount > 0) {
        const recent = chat.slice(-msgCount);
        const chatLines = [];

        for (const msg of recent) {
            if (msg.is_system) continue;
            const name = msg.is_user ? (ctx.name1 || 'User') : (ctx.name2 || 'Character');
            const text = (msg.mes || '').trim();
            if (text) {
                // Truncate individual messages to keep total context reasonable
                chatLines.push(`${name}: ${text.slice(0, 400)}`);
            }
        }

        if (chatLines.length > 0) {
            parts.push(`[RECENT CHAT]\n${chatLines.join('\n')}`);
        }
    }

    return parts.join('\n\n');
}

// ============================================================
//  FETCH MODELS
// ============================================================

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
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
//  BUILD HTML
// ============================================================

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
                <button class="lum-icon-btn" id="lum-gear-btn" title="Settings">${ICONS.settings}</button>
                <button class="lum-icon-btn" id="lum-close" title="Close">${ICONS.close}</button>
            </div>
        </div>

        <div class="lum-body">
            <!-- ===== SEARCH VIEW ===== -->
            <div id="lum-search-section">
                <div class="lum-search-wrap">
                    <textarea class="lum-search-textarea" id="lum-query"
                        placeholder="What interests you? Setting, plot twist, character arc..."
                        spellcheck="false"></textarea>
                    <div class="lum-search-controls">
                        <span class="lum-token-hint" id="lum-char-count">0 chars</span>
                        <button class="lum-search-btn" id="lum-search-btn">
                            ${ICONS.search} <span>Generate</span>
                        </button>
                    </div>
                </div>

                <!-- Context indicator -->
                <div class="lum-context-indicator" id="lum-ctx-indicator">
                    <div class="lum-ctx-dot"></div>
                    <span id="lum-ctx-label">No character loaded</span>
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

            <!-- ===== SETTINGS VIEW (toggled by gear) ===== -->
            <div class="lum-settings-panel" id="lum-settings-panel">
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

                    <div class="lum-inject-settings">
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">Context Messages</label>
                            <input class="lum-settings-input" id="lum-context-messages" type="number"
                                value="${s.context_messages}" min="0" max="50" style="width:100%" />
                        </div>
                        <div class="lum-settings-group">
                            <label class="lum-settings-label">Include Card</label>
                            <select class="lum-select" id="lum-include-card">
                                <option value="true" ${s.include_card ? 'selected' : ''}>Yes</option>
                                <option value="false" ${!s.include_card ? 'selected' : ''}>No</option>
                            </select>
                        </div>
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

// FAB is now injected as HTML string via jQuery in init
const FAB_HTML = `<div id="lumina-fab" title="Lumina Search">${ICONS.lumina}</div>`;

// ---- DRAG LOGIC (robust mobile + desktop) ----

function setupDrag($fab, onTap) {
    let isMiniDragging = false;
    let miniMoved = false;
    let miniClickAllowed = true;
    let miniOffset = { x: 0, y: 0 };

    function getCoords(e) {
        const ev = e.originalEvent || e;
        if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        return { x: ev.clientX, y: ev.clientY };
    }

    // Тап — открыть/закрыть панель
    $fab.on('click touchend', function(e) {
        if (!miniClickAllowed) return;
        e.preventDefault();
        e.stopPropagation();
        onTap();
    });

    // Начало перетаскивания
    $fab.on('mousedown touchstart', function(e) {
        isMiniDragging = true;
        miniMoved = false;
        miniClickAllowed = true;
        const pos = $fab.position();
        $fab.css({ top: pos.top + 'px', left: pos.left + 'px', right: 'auto', bottom: 'auto' });
        const coords = getCoords(e);
        miniOffset = { x: coords.x - pos.left, y: coords.y - pos.top };
        e.stopPropagation();
    });

    // Движение
    $(document).on('mousemove.lumfab touchmove.lumfab', function(e) {
        if (!isMiniDragging) return;
        miniMoved = true;
        miniClickAllowed = false;
        const coords = getCoords(e);
        const w = $fab.outerWidth(), h = $fab.outerHeight();
        const nx = Math.max(0, Math.min(coords.x - miniOffset.x, window.innerWidth - w));
        const ny = Math.max(0, Math.min(coords.y - miniOffset.y, window.innerHeight - h));
        $fab.css({ top: ny + 'px', left: nx + 'px' });
        e.preventDefault();
    });

    // Конец перетаскивания
    $(document).on('mouseup.lumfab touchend.lumfab', function() {
        if (!isMiniDragging) return;
        isMiniDragging = false;
        if (miniMoved) {
            const rect = $fab[0].getBoundingClientRect();
            saveSetting('fab_x', Math.round(rect.left));
            saveSetting('fab_y', Math.round(rect.top));
            setTimeout(() => { miniClickAllowed = true; }, 50);
        }
    });

    // Восстановление позиции
    const s = loadSettings();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (s.fab_x >= 0 && s.fab_y >= 0 && s.fab_x < vw - 10 && s.fab_y < vh - 10) {
        $fab.css({ left: s.fab_x + 'px', top: s.fab_y + 'px', right: 'auto', bottom: 'auto' });
    } else {
        $fab.css({ top: '120px', right: '15px', left: 'auto', bottom: 'auto' });
    }
}

// ============================================================
//  API CALL — now includes gathered context
// ============================================================

async function queryLuminaAPI(query) {
    const s = loadSettings();
    const url = s.api_url.replace(/\/+$/, '');

    // Gather context from ST
    const contextBlock = gatherContext();

    // Build the user message: context + query
    let userContent = '';
    if (contextBlock) {
        userContent += `=== CURRENT ROLEPLAY CONTEXT ===\n${contextBlock}\n=== END CONTEXT ===\n\n`;
    }
    userContent += `USER QUERY: ${query}`;

    const body = {
        messages: [
            { role: 'system', content: s.system_prompt },
            { role: 'user', content: userContent },
        ],
        max_tokens: Number(s.max_tokens) || 600,
        temperature: Number(s.temperature) || 0.85,
        stream: false,
    };
    if (s.model) body.model = s.model;

    const headers = { 'Content-Type': 'application/json' };
    if (s.api_key) headers['Authorization'] = `Bearer ${s.api_key}`;

    const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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

// ---- CONTEXT INDICATOR ----

function updateContextIndicator() {
    const label = document.getElementById('lum-ctx-label');
    const dot = document.querySelector('.lum-ctx-dot');
    if (!label || !dot) return;

    const ctx = getContext();
    const s = loadSettings();
    const charName = ctx.name2 || '';
    const chatLen = (ctx.chat || []).length;
    const msgCount = Math.min(Number(s.context_messages) || 15, chatLen);

    if (charName) {
        label.textContent = `${charName} + ${msgCount} msgs`;
        dot.classList.add('lum-ctx-active');
    } else {
        label.textContent = 'No character loaded';
        dot.classList.remove('lum-ctx-active');
    }
}

// ============================================================
//  INIT
// ============================================================

jQuery(async () => {
    loadSettings();

    // Inject panel + FAB via jQuery (critical for ST mobile compatibility)
    $('body').append(buildPanelHTML());
    $('body').append(FAB_HTML);

    const $fab = $('#lumina-fab');
    const fab = $fab[0];

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

    // ---- FAB: draggable + tap to toggle ----
    let panelOpen = false;

    function togglePanel() {
        panelOpen = !panelOpen;

        // Принудительно задаём позицию через JS — CSS медиа-запросы ненадёжны в ST
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isMobile) {
            panel.style.top = 'auto';
            panel.style.bottom = '0';
            panel.style.left = '0';
            panel.style.right = '0';
            panel.style.width = '100%';
            panel.style.height = 'auto';
            panel.style.maxHeight = '80vh';
            panel.style.borderRadius = '14px 14px 0 0';
        }

        panel.classList.toggle('lum-visible', panelOpen);
        $fab.toggleClass('lum-fab-active', panelOpen);
        if (panelOpen && !isMobile) queryInput?.focus();
        if (panelOpen) updateContextIndicator();
    }

    setupDrag($fab, togglePanel);

    // Close button
    $(closeBtn).on('click touchend', function(e) {
        e.preventDefault();
        if (panelOpen) togglePanel();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelOpen) togglePanel();
    });

    // ---- Gear: switch between search and settings views ----
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
            modelStatus.textContent = 'connection failed';
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

    // ---- Auto-save settings ----
    const settingsMap = {
        'lum-api-url': 'api_url',
        'lum-api-key': 'api_key',
        'lum-sys-prompt': 'system_prompt',
        'lum-inject-pos': 'inject_position',
        'lum-inject-depth': 'inject_depth',
        'lum-max-tokens': 'max_tokens',
        'lum-temperature': 'temperature',
        'lum-context-messages': 'context_messages',
    };

    for (const [elemId, settingKey] of Object.entries(settingsMap)) {
        const elem = document.getElementById(elemId);
        if (!elem) continue;
        const evt = elem.tagName === 'SELECT' ? 'change' : 'input';
        elem.addEventListener(evt, () => {
            let val = elem.value;
            if (['inject_depth', 'max_tokens', 'context_messages'].includes(settingKey)) {
                val = parseInt(val, 10) || 0;
            } else if (settingKey === 'temperature') {
                val = parseFloat(val) || 0;
            }
            saveSetting(settingKey, val);
        });
    }

    // Include Card toggle
    const includeCardElem = document.getElementById('lum-include-card');
    if (includeCardElem) {
        includeCardElem.addEventListener('change', () => {
            saveSetting('include_card', includeCardElem.value === 'true');
        });
    }

    renderHistory();
    updateContextIndicator();

    // Update context indicator when chat changes
    const eventSource = window?.eventSource || ctx?.eventSource;
    if (eventSource) {
        try {
            eventSource.on('chatLoaded', () => updateContextIndicator());
            eventSource.on('characterSelected', () => updateContextIndicator());
        } catch (e) { /* not critical */ }
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
            helpString: 'Run a context-aware Lumina search query.',
        }));
    } catch (e) {
        console.warn('[Lumina] Slash command:', e);
    }

    console.log('[Lumina Search] Extension loaded (context-aware)');
});
