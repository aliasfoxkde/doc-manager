import { useState, useEffect } from 'react';
import { useThemeStore } from '../stores/themeStore';
import { useDocumentStore } from '../stores/documentStore';
import { AppSettings } from '../types';
import { AppSettingsContract, SyncConfigContract } from '../core/dataContracts';
import { createProductionSafety } from '../core/productionSafety';
import { getObservability } from '../core/observability';

const safety = createProductionSafety({
  environment: process.env.NODE_ENV || 'development',
  enableStrictValidation: true,
  blockPlaceholders: true,
  requireDataContracts: true,
  enableObservability: true,
});
safety.registerContract('appSettings', AppSettingsContract);
safety.registerContract('syncConfig', SyncConfigContract);

const obs = getObservability();

const defaultSettings: AppSettings = {
  theme: 'system',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  autoSave: true,
  autoSaveInterval: 30,
  sync: {
    enabled: false,
    provider: null,
    interval: 15
  }
};

// Local storage key for settings
const SETTINGS_KEY = 'doc-manager-settings';

export default function Settings() {
  const { theme, setTheme } = useThemeStore();
  const { syncDocuments, syncStatus } = useDocumentStore();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [syncToken, setSyncToken] = useState('');
  const [syncRepo, setSyncRepo] = useState('');

  // Load settings from localStorage on mount
  useEffect(() => {
    const span = obs.startSpan('Settings.loadSettings');
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate against schema
        const validation = safety.validate('appSettings', parsed);
        if (validation.isValid) {
          setSettings(parsed);
          if (parsed.sync.token) setSyncToken(parsed.sync.token);
          if (parsed.sync.repo) setSyncRepo(parsed.sync.repo);
        } else {
          obs.warn('Settings validation failed, using defaults', { errors: validation.errors });
        }
      }
      obs.endSpan(span);
    } catch (error) {
      obs.error('Failed to load settings', error as Error);
      obs.endSpan(span, error as Error);
    }
  }, []);

  const handleSyncNow = async () => {
    await syncDocuments();
  };

  const handleSaveSettings = () => {
    const span = obs.startSpan('Settings.saveSettings');
    try {
      const updatedSettings: AppSettings = {
        ...settings,
        sync: {
          ...settings.sync,
          enabled: !!syncToken && !!syncRepo,
          token: syncToken || undefined,
          repo: syncRepo || undefined,
        }
      };

      // Validate settings before saving
      const validation = safety.validate('appSettings', updatedSettings);
      if (!validation.isValid) {
        obs.error('Settings validation failed', undefined, { errors: validation.errors });
        alert(`Invalid settings: ${validation.errors.map(e => e.message).join(', ')}`);
        obs.endSpan(span);
        return;
      }

      // Validate sync config specifically
      if (updatedSettings.sync.enabled) {
        const syncValidation = safety.validate('syncConfig', updatedSettings.sync);
        if (!syncValidation.isValid) {
          obs.error('Sync configuration validation failed', undefined, { errors: syncValidation.errors });
          alert(`Invalid sync configuration: ${syncValidation.errors.map(e => e.message).join(', ')}`);
          obs.endSpan(span);
          return;
        }
      }

      // Persist to localStorage
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
      setSettings(updatedSettings);

      obs.recordMetric('settings.saved', 1);
      obs.info('Settings saved successfully');
      obs.endSpan(span);
    } catch (error) {
      obs.error('Failed to save settings', error as Error);
      obs.endSpan(span, error as Error);
    }
  };

  return (
    <div className="settings-container">
      <h2>Settings</h2>

      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="setting-row">
          <label>Theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>Editor</h3>
        <div className="setting-row">
          <label>Font Size</label>
          <input
            type="number"
            value={settings.fontSize}
            onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
            min={10}
            max={24}
          />
        </div>
        <div className="setting-row">
          <label>Tab Size</label>
          <input
            type="number"
            value={settings.tabSize}
            onChange={(e) => setSettings({ ...settings, tabSize: parseInt(e.target.value) })}
            min={2}
            max={8}
          />
        </div>
        <div className="setting-row">
          <label>Word Wrap</label>
          <input
            type="checkbox"
            checked={settings.wordWrap}
            onChange={(e) => setSettings({ ...settings, wordWrap: e.target.checked })}
          />
        </div>
        <div className="setting-row">
          <label>Auto Save</label>
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
          />
        </div>
      </section>

      <section className="settings-section">
        <h3>Sync Configuration</h3>
        <div className="setting-row">
          <label>Sync Status</label>
          <div className="sync-status">
            <span className={`status-indicator ${syncStatus.connected ? 'connected' : 'disconnected'}`}>
              {syncStatus.connected ? '●' : '○'}
            </span>
            <span>{syncStatus.connected ? 'Connected' : 'Disconnected'}</span>
            {syncStatus.lastSync && (
              <span className="last-sync">
                Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="setting-row">
          <label>Provider</label>
          <select
            value={settings.sync.provider || ''}
            onChange={(e) => setSettings({
              ...settings,
              sync: { ...settings.sync, provider: e.target.value as any || null }
            })}
          >
            <option value="">None</option>
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="cloudflare">Cloudflare</option>
            <option value="local">Local NAS</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Repository</label>
          <input
            type="text"
            placeholder="owner/repo"
            value={syncRepo}
            onChange={(e) => setSyncRepo(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <label>Access Token</label>
          <input
            type="password"
            placeholder="ghp_xxx or personal access token"
            value={syncToken}
            onChange={(e) => setSyncToken(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <label>Sync Interval (minutes)</label>
          <input
            type="number"
            value={settings.sync.interval}
            onChange={(e) => setSettings({
              ...settings,
              sync: { ...settings.sync, interval: parseInt(e.target.value) }
            })}
            min={1}
            max={1440}
          />
        </div>
        <div className="setting-actions">
          <button onClick={handleSyncNow} className="btn-secondary">
            Sync Now
          </button>
          <button onClick={handleSaveSettings} className="btn-primary">
            Save Settings
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h3>Data Management</h3>
        <div className="setting-actions">
          <button className="btn-danger" onClick={() => {
            if (confirm('Clear all local data? This cannot be undone.')) {
              localStorage.clear();
              indexedDB.deleteDatabase('doc-manager');
              window.location.reload();
            }
          }}>
            Clear All Data
          </button>
        </div>
      </section>
    </div>
  );
}
