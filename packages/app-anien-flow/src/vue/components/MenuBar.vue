<script setup lang="ts">
import { ref } from 'vue';
import { timelineViewService } from '#app/features/main/main-layout/timeline-view.service';

const viewService = timelineViewService;
const activeMenu = ref<'view' | 'workspace' | null>(null);
const aboutOpen = ref(false);

function toggleMenu(menu: 'view' | 'workspace'): void {
  activeMenu.value = activeMenu.value === menu ? null : menu;
}

function closeMenus(): void {
  activeMenu.value = null;
}

function toggleTimeline(toggle: () => void): void {
  toggle();
  closeMenus();
}
</script>

<template>
  <div class="aniens-menubar" @mouseleave="closeMenus">
    <button type="button" class="menu-bar-item" @click="aboutOpen = true">About</button>

    <div class="menu-holder">
      <button type="button" class="menu-bar-item" @click="toggleMenu('view')">view</button>
      <div v-if="activeMenu === 'view'" class="aniens-menu" role="menu">
        <button
          type="button"
          class="menu-item"
          role="menuitemcheckbox"
          :aria-checked="viewService.videoTimelineVisible()"
          @click="toggleTimeline(() => viewService.toggleVideoTimeline())"
        >
          <span class="check-icon">{{ viewService.videoTimelineVisible() ? '✓' : '' }}</span>
          <span class="label">video clip timeline</span>
        </button>
        <button
          type="button"
          class="menu-item"
          role="menuitemcheckbox"
          :aria-checked="viewService.audioTimelineVisible()"
          @click="toggleTimeline(() => viewService.toggleAudioTimeline())"
        >
          <span class="check-icon">{{ viewService.audioTimelineVisible() ? '✓' : '' }}</span>
          <span class="label">audio clip timeline</span>
        </button>
        <button
          type="button"
          class="menu-item"
          role="menuitemcheckbox"
          :aria-checked="viewService.scriptTimelineVisible()"
          @click="toggleTimeline(() => viewService.toggleScriptTimeline())"
        >
          <span class="check-icon">{{ viewService.scriptTimelineVisible() ? '✓' : '' }}</span>
          <span class="label">script(subtitle) timeline</span>
        </button>
        <button
          type="button"
          class="menu-item"
          role="menuitemcheckbox"
          :aria-checked="viewService.keyframeTimelineVisible()"
          @click="toggleTimeline(() => viewService.toggleKeyframeTimeline())"
        >
          <span class="check-icon">{{ viewService.keyframeTimelineVisible() ? '✓' : '' }}</span>
          <span class="label">keyframe timeline</span>
        </button>
      </div>
    </div>

    <div class="menu-holder">
      <button type="button" class="menu-bar-item" @click="toggleMenu('workspace')">workspace</button>
      <div v-if="activeMenu === 'workspace'" class="aniens-menu" role="menu">
        <button type="button" class="menu-item" role="menuitemcheckbox" aria-checked="true">
          <span class="check-icon">✓</span>
          <span class="label">timeline edit</span>
        </button>
      </div>
    </div>
  </div>

  <div v-if="aboutOpen" class="dialog-backdrop" @click.self="aboutOpen = false">
    <section class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <h2 id="about-title" class="title">About aniens</h2>
      <p class="description">aniens is a modern web-based animation engine/timeline editor.</p>

      <div class="info-section">
        <span class="info-label">GitHub Repository:</span>
        <a href="https://github.com/Hashory/aniens.git" target="_blank" class="link">
          Hashory/aniens
        </a>
      </div>

      <div class="actions">
        <button class="close-btn" type="button" @click="aboutOpen = false">Close</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.aniens-menubar {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 1000;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background-color: rgba(30, 30, 30, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.menu-holder {
  position: relative;
}

.menu-bar-item,
.menu-item,
.close-btn {
  border: 0;
  color: inherit;
  cursor: pointer;
}

.menu-bar-item {
  padding: 0.25rem 0.6rem;
  font-size: 0.875rem;
  border-radius: 4px;
  background: transparent;
  transition: background-color 0.2s;
}

.menu-bar-item:hover,
.menu-bar-item:focus-visible {
  background-color: rgba(255, 255, 255, 0.1);
  outline: 2px solid rgba(255, 255, 255, 0.3);
}

.aniens-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  border-radius: 8px;
  background-color: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  min-width: 200px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  border-radius: 4px;
  background: transparent;
  color: #dddddd;
  text-align: left;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.menu-item:hover,
.menu-item:focus-visible {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  outline: 2px solid rgba(255, 255, 255, 0.3);
}

.check-icon {
  width: 1rem;
  display: inline-flex;
  justify-content: center;
}

.label {
  flex: 1;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.38);
}

.about-dialog {
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  color: #ffffff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  max-width: 400px;
}

.title {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.description {
  font-size: 0.875rem;
  color: #cccccc;
  line-height: 1.5;
  margin: 0 0 1.5rem;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 2rem;
}

.info-label {
  font-size: 0.75rem;
  color: #888888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.link {
  color: #4da6ff;
  text-decoration: none;
  font-size: 0.9375rem;
}

.link:hover {
  color: #80c1ff;
  text-decoration: underline;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.close-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
