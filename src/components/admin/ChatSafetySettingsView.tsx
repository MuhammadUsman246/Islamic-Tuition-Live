import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  PhoneCall,
  Mail,
  Link,
  MessageSquare,
  Lock,
  Eye,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  User,
  Sliders,
  Bell,
  Ban
} from 'lucide-react';
import {
  ChatSafetySettings,
  DEFAULT_CHAT_SAFETY_SETTINGS,
  BlockedAttemptLog,
  getCodeTitle
} from '../../utils/chatSafetyFilter';

export const ChatSafetySettingsView: React.FC = () => {
  const [settings, setSettings] = useState<ChatSafetySettings>(DEFAULT_CHAT_SAFETY_SETTINGS);
  const [logs, setLogs] = useState<BlockedAttemptLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [selectedFilterCode, setSelectedFilterCode] = useState<string>('all');

  // Load Settings & Blocked Logs
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Settings
      const settingsRes = await fetch('/api/chat/safety-settings');
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }

      // 2. Fetch Blocked Logs
      const logsRes = await fetch('/api/chat/blocked-logs');
      if (logsRes.ok) {
        const data = await logsRes.json();
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn('Could not load Chat Safety data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Settings to Server
  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/chat/safety-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.warn('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all blocked attempt logs?')) return;
    try {
      const res = await fetch('/api/chat/blocked-logs', { method: 'DELETE' });
      if (res.ok) {
        setLogs([]);
      }
    } catch (e) {}
  };

  const handleToggle = (key: keyof ChatSafetySettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredLogs = logs.filter(log => {
    if (selectedFilterCode === 'all') return true;
    return log.code === selectedFilterCode;
  });

  // Calculate Stat Counts
  const totalBlocked = logs.length;
  const phoneBlocked = logs.filter(l => l.code === 'CHAT-01').length;
  const emailBlocked = logs.filter(l => l.code === 'CHAT-02').length;
  const socialLinkBlocked = logs.filter(l => l.code === 'CHAT-03' || l.code === 'CHAT-04' || l.code === 'CHAT-05').length;
  const restrictedUsers = logs.filter(l => l.code === 'CHAT-08').length;

  return (
    <div className="space-y-6 select-none">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#2D8B5C]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-[#14231B]">Classroom Chat Safety</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                settings.enabled ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-neutral-100 text-neutral-600 border-neutral-200'
              }`}>
                {settings.enabled ? '🔒 Active Protection' : 'Protection Disabled'}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Automated contact-sharing detection, phone/email blocking, and privacy notice configuration.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
            title="Refresh settings and logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#2D8B5C]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Saved Successfully!</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Total Blocked</div>
          <div className="text-2xl font-black text-[#14231B] mt-1">{totalBlocked}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Logged attempts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Phone (CHAT-01)</span>
            <PhoneCall className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">{phoneBlocked}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Number detections</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Email (CHAT-02)</span>
            <Mail className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{emailBlocked}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Email detections</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Links & Handles</span>
            <Link className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-1">{socialLinkBlocked}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">WhatsApp / External links</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Feature Toggles */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-neutral-100 bg-neutral-50/60 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14231B] flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#2D8B5C]" />
                <span>Protection Rules & Detection Filters</span>
              </span>
            </div>

            <div className="p-5 space-y-4 divide-y divide-neutral-100">
              {/* Master Toggle */}
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5 pr-4">
                  <div className="text-sm font-bold text-[#14231B] flex items-center space-x-2">
                    <span>Privacy Protection Layer</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Recommended</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Master switch enabling automated contact-sharing detection and privacy enforcement across all classroom chats.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('enabled')}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.enabled ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Phone Detection */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-700 text-[10px] px-1 bg-emerald-50 rounded border border-emerald-200">CHAT-01</span>
                    <span>Phone Number Detection</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Detects local, international, spaced, bracketed, or hyphenated phone numbers (+1, +92, 0300, 0092...).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('detectPhone')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.detectPhone ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.detectPhone ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Email Detection */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-700 text-[10px] px-1 bg-emerald-50 rounded border border-emerald-200">CHAT-02</span>
                    <span>Email Address Detection</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Detects email addresses including variations like <code className="text-emerald-800 bg-neutral-100 px-1 rounded">name @ gmail . com</code> or <code className="text-emerald-800 bg-neutral-100 px-1 rounded">name [at] gmail [dot] com</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('detectEmail')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.detectEmail ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.detectEmail ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* External Links */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-700 text-[10px] px-1 bg-emerald-50 rounded border border-emerald-200">CHAT-03</span>
                    <span>External Contact Links</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Blocks external URL links, invite URLs (wa.me, t.me, discord, zoom, etc.) leading outside the academy.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('detectLinks')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.detectLinks ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.detectLinks ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Social Handles */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-700 text-[10px] px-1 bg-emerald-50 rounded border border-emerald-200">CHAT-04</span>
                    <span>Social Media & Contact Handles</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Detects mentions of WhatsApp, Telegram, Skype, Discord, Instagram, Snapchat, etc., with usernames or handles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('detectHandles')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.detectHandles ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.detectHandles ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Obfuscation Detection */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-700 text-[10px] px-1 bg-emerald-50 rounded border border-emerald-200">CHAT-06</span>
                    <span>Obfuscated Contact Info</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Detects numbers spelled out in words ("zero three hundred...") or split across punctuation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('detectObfuscation')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.detectObfuscation ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.detectObfuscation ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Spam / Rate Limiting */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-700 text-[10px] px-1 bg-emerald-50 rounded border border-emerald-200">CHAT-07</span>
                    <span>Spam & Rate Limiting</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Blocks rapid duplicate messages, excessive message frequency (&gt;5 msgs / 10s), or excessive message lengths.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('detectSpamRateLimit')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.detectSpamRateLimit ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.detectSpamRateLimit ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Temporary Restriction */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-700 text-[10px] px-1 bg-emerald-50 rounded border border-emerald-200">CHAT-08</span>
                    <span>Temporary User Chat Restriction</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Automatically applies a 5-minute temporary chat restriction if a user commits 3+ privacy violations in 10 minutes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('temporaryRestriction')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.temporaryRestriction ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.temporaryRestriction ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Logging */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Log Blocked Attempts</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Stores secure diagnostic records of blocked contact attempts for Admin audit review below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('logBlockedAttempts')}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    settings.logBlockedAttempts ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${settings.logBlockedAttempts ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Privacy Badge Config & Live Preview */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14231B] flex items-center space-x-1.5">
                <Lock className="w-4 h-4 text-[#2D8B5C]" />
                <span>Classroom Privacy Badge</span>
              </span>
              <button
                type="button"
                onClick={() => handleToggle('showPrivacyBadge')}
                className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                  settings.showPrivacyBadge ? 'bg-[#2D8B5C]' : 'bg-neutral-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.showPrivacyBadge ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Badge Title / Display Text
                </label>
                <input
                  type="text"
                  value={settings.badgeText}
                  onChange={e => setSettings(prev => ({ ...prev, badgeText: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-neutral-200 bg-neutral-50 text-neutral-900 focus:outline-none focus:border-[#2D8B5C]"
                  placeholder="🔒 Privacy Protected"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Help / Tooltip Text
                </label>
                <textarea
                  rows={3}
                  value={settings.badgeTooltip}
                  onChange={e => setSettings(prev => ({ ...prev, badgeTooltip: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-neutral-200 bg-neutral-50 text-neutral-900 focus:outline-none focus:border-[#2D8B5C] resize-none"
                  placeholder="Classroom chat includes automatic privacy and safety protection to help keep communication secure."
                />
              </div>
            </div>

            {/* Live Badge Preview Box */}
            <div className="pt-2">
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center space-x-1">
                <Eye className="w-3.5 h-3.5 text-neutral-400" />
                <span>Live Classroom Preview</span>
              </div>

              <div className="bg-[#050806] border border-[#223D2E] rounded-xl p-3 text-white space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-[#223D2E] pb-2">
                  <span className="font-bold text-emerald-400">Classroom Chat</span>
                  
                  {/* Badge Component */}
                  {settings.showPrivacyBadge && (
                    <div className="group relative cursor-pointer">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center space-x-1 shadow-2xs">
                        <span>{settings.badgeText}</span>
                        <HelpCircle className="w-2.5 h-2.5 opacity-75" />
                      </span>

                      {/* Tooltip on hover */}
                      <div className="absolute top-6 right-0 w-56 p-2 rounded-lg bg-[#0F1D15] border border-[#233F2E] text-slate-200 text-[10px] leading-snug shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        {settings.badgeTooltip}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-neutral-400 italic text-center py-2">
                  Example classroom message appears here...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blocked Attempt Logs Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#14231B]">
              Blocked Contact Attempts Log ({filteredLogs.length})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter by Code */}
            <select
              value={selectedFilterCode}
              onChange={e => setSelectedFilterCode(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-neutral-200 bg-white text-neutral-700 font-medium focus:outline-none"
            >
              <option value="all">All Error Codes</option>
              <option value="CHAT-01">CHAT-01 (Phone)</option>
              <option value="CHAT-02">CHAT-02 (Email)</option>
              <option value="CHAT-03">CHAT-03 (Links)</option>
              <option value="CHAT-04">CHAT-04 (Social)</option>
              <option value="CHAT-05">CHAT-05 (Instructions)</option>
              <option value="CHAT-06">CHAT-06 (Obfuscation)</option>
              <option value="CHAT-07">CHAT-07 (Spam)</option>
              <option value="CHAT-08">CHAT-08 (Restricted)</option>
            </select>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            )}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-neutral-400 space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
            <div className="text-xs font-semibold text-neutral-600">No Blocked Contact Attempts</div>
            <p className="text-[11px] text-neutral-400">
              When student or tutor chat messages trigger privacy protection, security logs appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="bg-neutral-50 text-[10px] uppercase font-bold text-neutral-500 border-b border-neutral-200/80">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Sender</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Message Snippet</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-sans">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${
                        log.code === 'CHAT-01' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                        log.code === 'CHAT-02' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        log.code === 'CHAT-03' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        log.code === 'CHAT-08' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                        'bg-neutral-100 text-neutral-800 border-neutral-200'
                      }`}>
                        {log.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-neutral-900 whitespace-nowrap">{log.senderName}</td>
                    <td className="px-4 py-3 uppercase font-bold text-[10px] text-neutral-500 whitespace-nowrap">{log.senderRole}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-neutral-600 whitespace-nowrap">{log.roomSlug}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-neutral-600 italic">
                      "{log.rawTextSnippet}"
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200 font-bold">
                        {log.actionTaken}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] font-mono text-neutral-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
