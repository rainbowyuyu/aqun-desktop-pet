import gsap from 'gsap';

import { PetScene, loadMessageForProgress } from './PetScene.js';

import { PetAnimations } from './PetAnimations.js';

import { PetStateMachine } from './PetStateMachine.js';

import { BubbleUI } from './BubbleUI.js';

import { Interaction } from './Interaction.js';

import { InputOverlay } from './InputOverlay.js';

import { GlobalMouseLook } from './GlobalMouseLook.js';

import { resolveModelFile, normalizeModelId } from './modelRegistry.js';
import { getModelProfile } from '../scene/modelProfiles.js';

import { BirthdayFx } from './BirthdayFx.js';

import { BirthdaySecrets } from './BirthdaySecrets.js';

import { ModelReminderHud } from './ModelReminderHud.js';

import { ChatterFeed } from './ChatterFeed.js';
import { WeatherFeed } from './WeatherFeed.js';
import { ChatterComposer } from './ChatterComposer.js';
import { shouldAutoLocate, locateCitySafe, locationPayload } from './locationService.js';
import { DEFAULT_WEATHER_CITY, DEFAULT_WEATHER_LOCATION } from './locationDefaults.js';

import { resolveKeyId } from './keyboardLayout.js';

import { remindersForDate, getDayDetails, upcomingRemindersForDate } from './calendarUtils.js';
import { BubbleContextTracker } from './BubbleContext.js';
import { DEFAULT_ACTION_SHORTCUTS } from './actionShortcuts.js';
import { findUpcomingReminder } from './bubbleCopy.js';

import { FirstRunTutorial } from './FirstRunTutorial.js';

import { BirthdayIntro } from './BirthdayIntro.js';

import { shouldPlayBirthdayIntro } from './birthdayConfig.js';

import { clearLocalPetData } from './clearLocalPetData.js';



export class PetApp {

  constructor() {

    this.appRoot = document.getElementById('app');

    this.canvas = document.getElementById('canvas');

    this.loadingEl = document.getElementById('loading');

    this.loadingText = document.getElementById('loading-text');

    this.bubble = new BubbleUI(document.getElementById('bubble'));

    this.bubbleContext = new BubbleContextTracker();

    this.chatterFeed = new ChatterFeed();
    this.weatherFeed = new WeatherFeed();
    this.chatterComposer = new ChatterComposer({
      chatterFeed: this.chatterFeed,
      weatherFeed: this.weatherFeed,
      getSettings: () => this.settings,
      getBubbleContext: () => this._getBubbleContext(),
    });
    this.bubble.setChatterFeed(this.chatterComposer);
    this.bubble.setBubbleContext(() => this._getBubbleContext());

    this.inputOverlay = new InputOverlay(document.getElementById('key-viz'));

    this.reminderHud = new ModelReminderHud(document.getElementById('reminder-hud'));

    this.birthdayFx = new BirthdayFx({ appRoot: this.appRoot });

    this.birthdaySecrets = null;
    this._birthdayPreviewRunning = false;
    this._justPlayedBirthdayIntro = false;



    this.settings = {

      showKeyLabels: true,

      showBubble: true,

      idleChatter: true,

      lookSensitivity: 1,
      lookHeadSensitivity: 0.8,
      lookBodySensitivity: 0.48,
      lookHandSensitivity: 0.85,

      positionLocked: false,

      clickThrough: false,

      petScale: 1,

      petModelId: 'aqun_rig',

      fpsCap: 60,

      lowPowerMode: false,

      remindersEnabled: true,

      keyboardOpacity: 0.88,

      keyPressColor: '#e07898',

      networkChatter: true,

      aiEnabled: true,

      actionShortcutsEnabled: true,

      actionShortcuts: { ...DEFAULT_ACTION_SHORTCUTS },

      settingsOpen: false,

      tutorialSeen: false,

      birthdayIntroYear: null,

      welcomeExperiencePending: false,

      weatherCity: DEFAULT_WEATHER_CITY,

      weatherLat: DEFAULT_WEATHER_LOCATION.lat,

      weatherLon: DEFAULT_WEATHER_LOCATION.lon,

      weatherAutoLocate: true,

      weatherLocatedAt: null,

    };



    this.scene = new PetScene(this.canvas);

    this.fsm = null;

    this.interaction = null;

    this.globalLook = null;

    this._unsubKey = null;

    this._unsubSettings = null;

    this._raf = null;

    this._pressedKeys = new Set();

    this._useGlobalKeys = false;
    this._displayedModelId = null;
    this._modelSwitchGen = 0;
  }



  async _loadModelSafe(url, modelId) {

    await this.scene.loadModel(

      url,

      (ratio) => {

        this.loadingText.textContent = loadMessageForProgress(ratio);

      },

      modelId || this.settings.petModelId

    );

  }



  _startRenderLoop() {

    if (this._raf) return;

    this._animate();

  }



  async _showContextMenu(_clientX, _clientY, screenX, screenY) {

    await window.aqunPet?.openContextPopup?.(screenX, screenY);

  }



  _updateCursor() {

    const locked = this.settings.positionLocked;

    this.canvas.style.cursor = locked ? 'pointer' : 'grab';

  }



  async init() {

    const saved = await window.aqunPet?.getSettings?.().catch(() => null);

    if (saved) {
      const normalizedId = normalizeModelId(saved.petModelId);
      if (saved.petModelId && saved.petModelId !== normalizedId) {
        saved.petModelId = normalizedId;
        window.aqunPet?.updateSettings?.({ petModelId: normalizedId }).catch(() => {});
      }
      this._applySettings(saved, { persist: false });
    }

    const welcomePending = !!this.settings.welcomeExperiencePending;
    if (welcomePending) {
      clearLocalPetData();
      this.settings.welcomeExperiencePending = false;
      window.aqunPet?.updateSettings?.({ welcomeExperiencePending: false }).catch(() => {});
    }

    this.inputOverlay.setVisible(this.settings.showKeyLabels);

    this.inputOverlay.setOpacity(this.settings.keyboardOpacity ?? 0.88);

    this.inputOverlay.setKeyPressColor(this.settings.keyPressColor ?? '#e07898');

    this.chatterComposer.setEnabled(this.settings.networkChatter !== false);
    if (this.settings.networkChatter !== false) {
      this.chatterComposer.refresh();
    }

    this._autoLocateWeather().catch(() => {});

    this._updateCursor();



    const playBirthdayIntro = welcomePending || shouldPlayBirthdayIntro(
      new Date(),
      this.settings.birthdayIntroYear ?? null,
    );
    let birthdayIntro = null;

    if (playBirthdayIntro) {
      window.aqunPet?.setIgnoreMouseEvents?.(false);
      birthdayIntro = new BirthdayIntro({
        root: this.appRoot,
        canvas: this.canvas,
        fx: this.birthdayFx,
        modelGroup: this.scene.modelGroup,
      });
      birthdayIntro.mount();
      gsap.set(this.canvas, { opacity: 0 });
    }



    const modelUrl = await this._resolveModelUrl(this.settings.petModelId);



    try {

      await this._loadModelSafe(modelUrl, this.settings.petModelId);
      this._displayedModelId = this.settings.petModelId;

    } catch (err) {

      console.error(err);

      this.loadingText.textContent = '模型加载失败，正在重试…';

      try {

        await new Promise((r) => setTimeout(r, 800));

        await this._loadModelSafe(modelUrl, this.settings.petModelId);
      this._displayedModelId = this.settings.petModelId;

      } catch (err2) {

        console.error(err2);

        this.loadingText.textContent = '模型加载失败，请重启应用';

        this._startRenderLoop();

        return;

      }

    }



    if (playBirthdayIntro && birthdayIntro) {
      this.loadingEl.style.display = 'none';
      this._startRenderLoop();
      await birthdayIntro.play();
      const year = new Date().getFullYear();
      this.settings.birthdayIntroYear = year;
      window.aqunPet?.updateSettings?.({
        birthdayIntroYear: year,
        welcomeExperiencePending: false,
      }).catch(() => {});
      birthdayIntro.dispose();
      birthdayIntro = null;
      this.birthdayFx.flashRainbowRing();
      this._syncClickThrough();
      this._justPlayedBirthdayIntro = true;
    } else {
      gsap.to(this.loadingEl, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
          this.loadingEl.style.display = 'none';
        },
      });
    }



    this.animations = new PetAnimations(

      this.scene.modelGroup,

      this.scene.lookGroup,

      this.scene.modelLoader.bounds,

      {

        headTarget: this.scene.headBodyRig?.headTarget,

        headBodyRig: this.scene.headBodyRig,

        skeletalRig: this.scene.skeletalRig,

        modelLoader: this.scene.modelLoader,

      }

    );

    this.animations.setLookSensitivities({
      overall: this.settings.lookSensitivity,
      head: this.settings.lookHeadSensitivity ?? 0.8,
      body: this.settings.lookBodySensitivity ?? 0.48,
      hand: this.settings.lookHandSensitivity ?? 0.85,
    });



    this.fsm = new PetStateMachine({

      animations: this.animations,

      modelLoader: this.scene.modelLoader,

      onBubble: (cat) => {

        if (this.settings.showBubble) this.bubble.show(cat);

      },

      onHologram: (on) => this.scene.setHologramMode(on),

      onStateChange: () => {},

      onMoodChange: (mood) => {
        const effective = mood === 'typing' && this.scene.usesSkeleton ? 'idle' : mood;
        this.scene.setLightingMood(effective);
      },

      getIdleChatter: () => this.settings.idleChatter,

      onKonami: () => this.birthdaySecrets?.onKonami(),

      onPoke: () => this.birthdaySecrets?.onPoke(),

      onKeyEvent: (payload) => this.birthdaySecrets?.onKeyEvent(payload),

    });

    this.fsm.start();



    this.birthdaySecrets = new BirthdaySecrets({

      fsm: this.fsm,

      bubble: this.bubble,

      fx: this.birthdayFx,

      getSettingsPanelOpen: () => false,

      getShowBubble: () => this.settings.showBubble,

    });

    if (!playBirthdayIntro) {
      this.birthdaySecrets.maybeGreetToday();
    } else if (this.settings.showBubble) {
      this.bubble.showText('生日快乐，阿群！');
    }

    this.bubble.hideImmediate();



    this.interaction = new Interaction({

      canvas: this.canvas,

      appRoot: this.appRoot,

      fsm: this.fsm,

      getPositionLocked: () => this.settings.positionLocked,

      getScale: () => this.settings.petScale ?? 1,

      onScalePreview: (scale) => {

        if (this.interaction?.isDragging) return;

        const next = Math.max(0.6, Math.min(1.8, scale));
        this.settings.petScale = next;
        this._syncSceneSize({ petScale: next });

      },

      onContextMenu: (_x, _y, sx, sy) => this._showContextMenu(_x, _y, sx, sy),

      onDragStart: () => {

        this.animations?.resetLook();

        this.globalLook?.clearPending?.();

        this._syncSceneSize();

      },

      onDragEnd: () => {

        this.animations?.resetLook();

        this._syncClickThrough();

        this._syncSceneSize();

      },

      onResizeStart: () => {

        this.animations?.resetLook();

      },

      onResizeEnd: () => {

        this._syncClickThrough();

      },

    });



    this.globalLook = new GlobalMouseLook({

      fsm: this.fsm,

      getPaused: () =>

        this.interaction.isLeftPressed ||

        this.interaction.isDragging ||

        this.interaction.isResizing ||

        this.fsm.state === 'hologram' ||

        this.fsm.state === 'spin',

      onLook: ({ nx, ny, buttons }) => {

        this.bubbleContext?.touch();

        if (!this.settings.showKeyLabels) return;

        this.inputOverlay.updateMouse({ nx, ny, buttons });

      },

    });

    this.globalLook.start();



    await this._bindKeyboard();

    this._bindSettingsSync();
    this._bindWindowBoundsSync();
    this._bindInteractionReset();

    this._bindPreviewAnim();

    this._bindActionShortcuts();

    this._bindPoseLibrary();

    this._bindAiSuggestion();

    this._maybeStartTutorial();

    this._bindOpenSettingsPanel();

    this._bindReminders();

    this._bindRemindersChanged();

    await this._refreshTodayReminders();

    this._reminderPoll = setInterval(() => this._refreshTodayReminders(), 30000);

    this._animate();

  }



  async _refreshTodayReminders() {

    const reminders = (await window.aqunPet?.getReminders?.().catch(() => [])) || [];

    const today = new Date();

    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const items = upcomingRemindersForDate(reminders, todayKey, today, {
      gracePastMinutes: 3,
      leadMinutes: null,
    });
    const dayInfo = getDayDetails(todayKey);

    this.bubbleContext?.setTodayReminders(items, dayInfo);

    if (items.length) {

      this.reminderHud.showDayReminders(items, { dayKey: todayKey, dayInfo });

    } else {

      this.reminderHud.hideStack();

    }

  }



  _bindReminders() {

    if (!window.aqunPet?.onReminderFired) return;

    this._unsubReminder = window.aqunPet.onReminderFired((reminder) => {

      if (this.settings.showBubble) {

        const text = reminder.note ? `${reminder.title}：${reminder.note}` : reminder.title;
        this.bubble.showReminder(text);

      }

      this.reminderHud.pulseReminder(reminder);

      this.fsm?.wave();

    });

  }



  _bindRemindersChanged() {
    if (!window.aqunPet?.onRemindersChanged) return;
    this._unsubRemindersChanged = window.aqunPet.onRemindersChanged(() => {
      this._refreshTodayReminders();
    });
  }

  _bindOpenSettingsPanel() {

    if (!window.aqunPet?.onOpenSettingsPanel) return;

    this._unsubOpenSettings = window.aqunPet.onOpenSettingsPanel(() => {

      window.aqunPet?.openSettingsWindow?.();

    });

  }



  _syncClickThrough() {

    if (this.settings.clickThrough) {

      window.aqunPet?.setIgnoreMouseEvents?.(true, { forward: true });

    } else {

      window.aqunPet?.setIgnoreMouseEvents?.(false);

    }

  }



  async _autoLocateWeather() {
    if (!shouldAutoLocate(this.settings)) return;
    try {
      const loc = await locateCitySafe();
      this._applySettings(locationPayload(loc), { persist: true });
    } catch (err) {
      console.warn('[weather] auto locate:', err.message);
    }
  }

  _applySettings(partial, { persist = true } = {}) {

    Object.assign(this.settings, partial);



    if (partial.showKeyLabels != null) {

      this.inputOverlay?.setVisible(this.settings.showKeyLabels);

    }



    if (partial.keyboardOpacity != null) {

      this.inputOverlay?.setOpacity(this.settings.keyboardOpacity);

    }



    if (partial.keyPressColor != null) {

      this.inputOverlay?.setKeyPressColor(this.settings.keyPressColor);

    }



    if (partial.networkChatter != null) {

      this.chatterComposer?.setEnabled(this.settings.networkChatter);

    }

    if (partial.weatherCity != null || partial.weatherLat != null || partial.weatherLon != null) {
      if (partial.weatherCity != null) this.weatherFeed?.setCity(this.settings.weatherCity);
      if (partial.weatherLat != null || partial.weatherLon != null) {
        this.weatherFeed?.setCoords(this.settings.weatherLat, this.settings.weatherLon);
      }
      this.chatterComposer?.refresh();
    }



    if (
      partial.lookSensitivity != null
      || partial.lookHeadSensitivity != null
      || partial.lookBodySensitivity != null
      || partial.lookHandSensitivity != null
    ) {
      this.animations?.setLookSensitivities({
        overall: this.settings.lookSensitivity,
        head: this.settings.lookHeadSensitivity ?? 1.4,
        body: this.settings.lookBodySensitivity ?? 0.72,
        hand: this.settings.lookHandSensitivity ?? 0.85,
      });
    }

    if (partial.positionLocked != null) {

      this._updateCursor();

    }

    if (partial.clickThrough != null) {

      this._syncClickThrough();

    }

    if (partial.petScale != null) {
      this._syncSceneSize();
    }



    if (persist && window.aqunPet?.updateSettings) {

      window.aqunPet.updateSettings(partial);

    }

  }



  _bindSettingsSync() {

    if (!window.aqunPet?.onSettingsChanged) return;

    this._unsubSettings = window.aqunPet.onSettingsChanged(async (s) => {

      const prevModel = this.settings.petModelId;
      const prevScale = this.settings.petScale;

      this._applySettings(s, { persist: false });

      if (s.petScale != null && s.petScale !== prevScale) {
        this._syncSceneSize({ petScale: s.petScale });
      }

      if (s.petModelId && s.petModelId !== prevModel) {

        await this._switchModel(s.petModelId);

      }

      if (s.tutorialSeen === false) {
        this._restartTutorial();
      }

    });

  }

  _maybeStartTutorial() {
    if (this.settings.tutorialSeen) return;
    const delayMs = this._justPlayedBirthdayIntro ? 3500 : 4000;
    this._restartTutorial({ autoOpenDelayMs: delayMs });
  }

  _restartTutorial(options = {}) {
    this.firstRunTutorial?.dispose?.();
    this.firstRunTutorial = null;
    if (this.settings.tutorialSeen) return;
    this.firstRunTutorial = new FirstRunTutorial({
      root: this.appRoot,
      onOpenChange: (open) => this._onTutorialOpenChange(open),
      onComplete: () => {
        this.settings.tutorialSeen = true;
        window.aqunPet?.updateSettings?.({ tutorialSeen: true }).catch(() => {});
      },
    });
    this.firstRunTutorial.start(options);
  }

  _onTutorialOpenChange(open) {
    if (open) {
      this.interaction?.cancelAll();
      window.aqunPet?.setIgnoreMouseEvents?.(false);
      this.appRoot?.classList.add('tutorial-open');
      return;
    }
    this.appRoot?.classList.remove('tutorial-open');
    this._syncClickThrough();
  }

  _bindInteractionReset() {
    if (!window.aqunPet?.onInteractionReset) return;
    this._unsubInteractionReset = window.aqunPet.onInteractionReset(() => {
      this.interaction?.cancelAll();
      this._syncClickThrough();
    });
  }

  _bindPreviewAnim() {
    if (!window.aqunPet?.onPlayPreviewAnim) return;
    this._unsubPreviewAnim = window.aqunPet.onPlayPreviewAnim((type) => {
      if (type === 'tutorial') this._previewTutorialAnim();
      else if (type === 'birthday') this._previewBirthdayAnim();
    });
  }

  _bindActionShortcuts() {
    if (!window.aqunPet?.onPetActionShortcut) return;
    this._unsubActionShortcut = window.aqunPet.onPetActionShortcut((actionId) => {
      if (this.settings.actionShortcutsEnabled === false) return;
      this.interaction?.cancelAll?.();
      this.fsm?.shortcutAction?.(actionId);
    });
  }

  _bindPoseLibrary() {
    if (!window.aqunPet?.onPoseLibraryApplied) return;
    this._unsubPoseLibrary = window.aqunPet.onPoseLibraryApplied(({ modelId, library }) => {
      const active = this.settings.petModelId ?? 'aqun_rig';
      if (modelId && modelId !== active) return;
      this.scene.skeletalRig?.applyPoseLibrary?.(library);
      if (this.scene.skeletalRig?.hasPoseLibrary?.()) {
        const profile = getModelProfile(this.settings.petModelId);
        if (profile.useGltfIdle === false) {
          this.scene.modelLoader?.setIdleClipWeight?.(0);
        } else {
          this.scene.modelLoader?.setIdleClipWeight?.(profile.bindOnlyRest ? 1 : 0);
        }
      } else {
        this.scene.modelLoader?.setIdleClipWeight?.(1);
      }
    });
  }

  _bindAiSuggestion() {
    if (!window.aqunPet?.onAiSuggestion) return;
    this._unsubAi = window.aqunPet.onAiSuggestion((payload) => {
      if (!this.settings.aiEnabled) return;
      if (!this.settings.showBubble) return;

      if (payload?.error === 'invalid_key') return;

      const text = String(payload?.text || '').trim();
      if (!text) return;

      this.bubbleContext?.touch();
      const preview = String(payload?.inputPreview || '').trim();
      this.bubble.showText(text, { duration: preview.length >= 8 ? 7 : 6.5 });
      this.fsm?.shortcutAction?.('nod');
    });
  }

  _previewTutorialAnim() {
    this.firstRunTutorial?.dispose?.();
    this.firstRunTutorial = new FirstRunTutorial({
      root: this.appRoot,
      onOpenChange: (open) => this._onTutorialOpenChange(open),
      onComplete: () => {
        this.firstRunTutorial = null;
        this._onTutorialOpenChange(false);
      },
    });
    this.firstRunTutorial.preview();
  }

  async _previewBirthdayAnim() {
    if (this._birthdayPreviewRunning) return;
    this._birthdayPreviewRunning = true;
    this.interaction?.cancelAll();
    window.aqunPet?.setIgnoreMouseEvents?.(false);

    const intro = new BirthdayIntro({
      root: this.appRoot,
      canvas: this.canvas,
      fx: this.birthdayFx,
      modelGroup: this.scene.modelGroup,
    });
    intro.mount();
    gsap.set(this.canvas, { opacity: 0 });

    try {
      await intro.play();
      this.birthdayFx.flashRainbowRing();
      this.fsm?.wave();
      if (this.settings.showBubble) {
        this.bubble.showText('生日快乐，阿群！');
      }
    } finally {
      intro.dispose();
      this.appRoot?.querySelector('#birthday-intro')?.remove();
      gsap.set(this.canvas, { clearProps: 'opacity,transform,filter' });
      this.scene?.onResize();
      this.scene?.render();
      this._birthdayPreviewRunning = false;
      this._syncClickThrough();
    }
  }

  _bindWindowBoundsSync() {
    this.scene?.setResizeDelegate(() => this._syncSceneSize());

    if (!window.aqunPet?.onWindowBoundsChanged) return;
    this._unsubBounds = window.aqunPet.onWindowBoundsChanged((payload) => {
      if (this.interaction?.isDragging) return;
      if (payload?.petScale != null) {
        this.settings.petScale = payload.petScale;
      }
      this._syncSceneSize(payload);
    });
  }

  _syncSceneSize(payload = null) {
    const scale = payload?.petScale ?? this.settings.petScale ?? 1;
    const w = payload?.width ?? Math.round(320 * scale);
    const h = payload?.height ?? Math.round(480 * scale);
    const apply = () => {
      this.scene?.onResize(w, h);
      this.scene?.render();
    };
    apply();
    requestAnimationFrame(() => {
      apply();
      this.inputOverlay?.refit?.();
      requestAnimationFrame(apply);
    });
  }



  async _switchModel(modelId) {
    if (!modelId || modelId === this._displayedModelId) return;

    const gen = ++this._modelSwitchGen;
    this.settings.petModelId = modelId;
    this.animations?.resetLook?.();

    this.loadingEl.style.display = 'flex';
    gsap.set(this.loadingEl, { opacity: 1 });
    this.loadingText.textContent = '更换模型中…';

    try {
      const url = await this._resolveModelUrl(modelId);
      if (gen !== this._modelSwitchGen) return;

      const result = await this.scene.swapModel(
        url,
        (ratio) => {
          this.loadingText.textContent = loadMessageForProgress(ratio);
        },
        modelId
      );
      if (gen !== this._modelSwitchGen) return;

      this._displayedModelId = modelId;
      this.animations?.updateBounds(result.bounds);
      this.animations?.setRigRefs({
        headTarget: this.scene.headBodyRig?.headTarget ?? null,
        headBodyRig: this.scene.headBodyRig,
        skeletalRig: this.scene.skeletalRig,
        modelLoader: this.scene.modelLoader,
      });
      this.fsm.modelLoader = this.scene.modelLoader;
      this.animations?.resetLook?.();
      if (!this.scene.usesSkeleton) {
        this.animations?.startIdleBreath?.();
      }
      this.scene.setHologramMode(false);

      gsap.to(this.loadingEl, {
        opacity: 0,
        duration: 0.45,
        onComplete: () => {
          this.loadingEl.style.display = 'none';
        },
      });
    } catch (err) {
      console.error(err);
      if (gen === this._modelSwitchGen) {
        this.loadingText.textContent = '模型切换失败';
      }
    }
  }



  async _resolveModelUrl(modelId) {

    const id = normalizeModelId(modelId || this.settings.petModelId || 'aqun_rig');

    if (window.aqunPet?.getModelUrl) {

      return window.aqunPet.getModelUrl(id);

    }

    return `${import.meta.env.BASE_URL}models/${resolveModelFile(id)}`;

  }



  _getBubbleContext() {
    const snap = this.bubbleContext.snapshot();
    return {
      now: snap.now,
      sessionMinutes: snap.sessionMinutes,
      activeMinutes: snap.activeMinutes,
      dayType: snap.dayType,
      dayMarks: snap.dayMarks,
      upcomingReminder: findUpcomingReminder(snap.todayReminders, snap.now),
      todayReminderCount: snap.todayReminderCount,
      hasClassToday: snap.hasClassToday,
    };
  }



  _onKeyPayload(payload) {

    const id = resolveKeyId(payload.name || String(payload.code));

    if (!id) return;



    if (payload.type === 'down') {

      if (this._pressedKeys.has(id)) return;

      this._pressedKeys.add(id);

      this.bubbleContext?.touch();

      this.fsm?.handleKeyEvent(payload);

      if (this.settings.showKeyLabels) this.inputOverlay.keyDown(payload.name || id);

    } else if (payload.type === 'up') {

      if (!this._pressedKeys.has(id)) return;

      this._pressedKeys.delete(id);

      if (this.settings.showKeyLabels) this.inputOverlay.keyUp(payload.name || id);

    }

  }



  async _bindKeyboard() {

    const globalOk = await window.aqunPet?.isKeyboardAvailable?.().catch(() => false);



    if (globalOk && window.aqunPet?.onKeyEvent) {

      this._useGlobalKeys = true;

      this._unsubKey = window.aqunPet.onKeyEvent((payload) => this._onKeyPayload(payload));

    }



    this._onWindowKeyDown = (e) => {

      if (this._useGlobalKeys || e.repeat) return;

      this._onKeyPayload({ code: e.keyCode, name: e.code, type: 'down', timestamp: Date.now() });

    };

    this._onWindowKeyUp = (e) => {

      if (this._useGlobalKeys) return;

      this._onKeyPayload({ code: e.keyCode, name: e.code, type: 'up', timestamp: Date.now() });

    };

    window.addEventListener('keydown', this._onWindowKeyDown);

    window.addEventListener('keyup', this._onWindowKeyUp);

  }



  _animate() {

    this._raf = requestAnimationFrame(() => this._animate());

    const cap = this.settings.lowPowerMode ? 30 : (this.settings.fpsCap || 60);

    const now = performance.now();

    if (this._lastFrame && now - this._lastFrame < 1000 / cap) return;

    this._lastFrame = now;



    const delta = Math.min(this.scene.clock.getDelta(), 0.05);

    const dragging = this.interaction?.isDragging ?? false;

    this.animations?.setDragPaused(dragging);

    this.animations?.updateLook(delta);



    const look = this.animations?.getLookRotation?.();

    if (look && this.settings.showKeyLabels) {

      const sens = look.sensitivity ?? this.settings.lookSensitivity ?? 1;

      this.inputOverlay.setLookTilt(look.x, look.y, sens);

      this.reminderHud.setTilt(look.x, look.y);

    }



    if (!this.scene.shouldRender()) return;

    const pose = this.animations?.getHeadApplyPose?.() ?? null;
    const typingEnergy = this.animations?._typingEnergy ?? 0;
    const typing = typingEnergy > 0.05;
    if (this.animations?.hasSkeletonLook?.()) {
      this.scene.setSkeletalLookApply(pose);
      this.scene.setSkeletalAnimContext({ typing, typingEnergy });
    } else {
      this.scene.setHeadLookApply(pose);
    }

    this.scene.update(delta);

    this.scene.render();

  }



  dispose() {

    cancelAnimationFrame(this._raf);

    clearInterval(this._reminderPoll);

    this._unsubKey?.();

    this._unsubSettings?.();

    if (this._onWindowKeyDown) window.removeEventListener('keydown', this._onWindowKeyDown);

    if (this._onWindowKeyUp) window.removeEventListener('keyup', this._onWindowKeyUp);

    this.fsm?.dispose();

    this.globalLook?.dispose();

    this._unsubOpenSettings?.();

    this._unsubReminder?.();

    this._unsubPreviewAnim?.();

    this._unsubActionShortcut?.();

    this._unsubPoseLibrary?.();

    this._unsubAi?.();

    this._unsubInteractionReset?.();

    this.reminderHud?.dispose();

    this.interaction?.dispose();

    this.inputOverlay?.dispose?.();

    this.birthdayFx?.dispose();

    this.scene.dispose();

  }

}


