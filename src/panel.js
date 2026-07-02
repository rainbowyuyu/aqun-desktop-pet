import { SettingsPanel } from './pet/SettingsPanel.js';
import { ModelPicker } from './pet/ModelPicker.js';
import { ToolsPanel } from './pet/ToolsPanel.js';
import { CalendarPanel } from './pet/CalendarPanel.js';
import { DEFAULT_WEATHER_CITY } from './pet/locationDefaults.js';
import { SitesPanel } from './pet/SitesPanel.js';
import { resolveModelFile } from './pet/modelRegistry.js';

class PanelApp {
  constructor() {
    this.settings = { petModelId: 'aqun_rig' };

    this.modelPicker = new ModelPicker({
      container: document.getElementById('model-picker'),
      getActiveId: () => this.settings.petModelId ?? 'aqun_rig',
      getModelUrl: (id) => this._resolveModelUrl(id),
      onSelect: (id) => window.aqunPet?.updateSettings?.({ petModelId: id }),
    });

    this.toolsPanel = new ToolsPanel({
      root: document.getElementById('tools-hub'),
    });

    this.sitesPanel = new SitesPanel({
      root: document.getElementById('sites-hub'),
    });

    this.calendarPanel = new CalendarPanel({
      root: document.getElementById('calendar-hub'),
      getWeatherCity: () => this.settings.weatherCity || DEFAULT_WEATHER_CITY,
      getWeatherCoords: () => ({
        lat: this.settings.weatherLat ?? null,
        lon: this.settings.weatherLon ?? null,
      }),
      getLocateState: () => ({
        weatherAutoLocate: this.settings.weatherAutoLocate !== false,
        weatherLat: this.settings.weatherLat,
        weatherLon: this.settings.weatherLon,
        weatherLocatedAt: this.settings.weatherLocatedAt,
      }),
      onWeatherCityChange: (city) => {
        window.aqunPet?.updateSettings?.(
          typeof city === 'string' ? { weatherCity: city } : city,
        );
      },
      onWeatherLocated: (partial) => {
        Object.assign(this.settings, partial);
        this.calendarPanel.setWeatherCoords?.(partial.weatherLat, partial.weatherLon);
        window.aqunPet?.updateSettings?.(partial);
      },
    });

    this.settingsPanel = new SettingsPanel({
      panel: document.getElementById('settings-panel'),
      closeBtn: document.getElementById('settings-close'),
      onLiveChange: (partial) => {
        if ('petScale' in partial && Object.keys(partial).length === 1) {
          window.aqunPet?.previewPetScale?.(partial.petScale);
          return;
        }
        window.aqunPet?.previewSettings?.(partial);
      },
      onChange: (partial) => window.aqunPet?.updateSettings?.(partial),
      modelPicker: this.modelPicker,
      toolsPanel: this.toolsPanel,
      sitesPanel: this.sitesPanel,
      calendarPanel: this.calendarPanel,
      standalone: true,
      onReset: async (scope) => {
        if (scope === 'reminders' || scope === 'all') {
          await this.calendarPanel.refresh();
        }
      },
    });

    this._unsubSettings = null;
    this._unsubReminders = null;
  }

  async init() {
    this.modelPicker.mount();

    const saved = await window.aqunPet?.getSettings?.().catch(() => null);
    if (saved) {
      Object.assign(this.settings, saved);
      this.settingsPanel.applySettings(saved);
      this.calendarPanel.applySettings?.(saved);
      if (saved.weatherLat != null) {
        this.calendarPanel.setWeatherCoords?.(saved.weatherLat, saved.weatherLon);
      }
    }

    this.settingsPanel.setOpen(true, { persist: false });

    this._unsubSettings = window.aqunPet?.onSettingsChanged?.((s) => {
      Object.assign(this.settings, s);
      this.settingsPanel.applySettings(s);
      this.calendarPanel.applySettings?.(s);
      if (s.weatherLat != null) {
        this.calendarPanel.setWeatherCoords?.(s.weatherLat, s.weatherLon);
      }
    });

    this._unsubReminders = window.aqunPet?.onRemindersChanged?.(() => {
      this.calendarPanel.refresh();
    });

    await this.calendarPanel.refresh();
    this.calendarPanel.autoLocateWeather?.({ silent: true });

    document.querySelector('[data-open-pose-editor]')?.addEventListener('click', () => {
      window.aqunPet?.openPoseEditor?.();
    });
  }

  async _resolveModelUrl(modelId) {
    if (window.aqunPet?.getModelUrl) {
      return window.aqunPet.getModelUrl(modelId);
    }
    return `${import.meta.env.BASE_URL}models/${resolveModelFile(modelId)}`;
  }

  dispose() {
    this._unsubSettings?.();
    this._unsubReminders?.();
    this.modelPicker?.dispose();
    this.toolsPanel?.dispose();
    this.sitesPanel?.dispose();
    this.calendarPanel?.dispose?.();
  }
}

const app = new PanelApp();
app.init();
window.addEventListener('beforeunload', () => app.dispose());
