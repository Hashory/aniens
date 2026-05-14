<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import MenuBar from '#vue/components/MenuBar.vue';
import PreviewScreen from '#vue/components/PreviewScreen.vue';
import Sidebar from '#vue/components/Sidebar.vue';
import Timeline from '#vue/components/timeline/Timeline.vue';
import { layoutPersistenceService } from '#app/features/main/main-layout/layout-persistence.service';
import { timelineViewService } from '#app/features/main/main-layout/timeline-view.service';
import type { MainSidebarPanel } from '#vue/components/Sidebar.vue';

type SplitOrientation = 'vertical' | 'horizontal';

interface SplitDragState {
  orientation: SplitOrientation;
  startClient: number;
  startSizes: [number, number];
  containerSize: number;
}

const viewService = timelineViewService;
const layoutPersistence = layoutPersistenceService;
const savedState = layoutPersistence.loadState();
const activePanel = ref<MainSidebarPanel>(savedState?.activePanel ?? 'timeline');
const mainVerticalSizes = ref<[number, number]>(savedState?.mainVertical ?? [70, 50]);
const topHorizontalSizes = ref<[number, number]>(savedState?.topHorizontal ?? [60, 40]);
const contentShell = ref<HTMLElement | null>(null);
const topPane = ref<HTMLElement | null>(null);
const splitDrag = ref<SplitDragState | null>(null);

const mainGridStyle = computed(() => ({
  gridTemplateRows: `${mainVerticalSizes.value[0]}fr 6px ${mainVerticalSizes.value[1]}fr`,
}));

const topGridStyle = computed(() => ({
  gridTemplateColumns: `${topHorizontalSizes.value[0]}fr 6px ${topHorizontalSizes.value[1]}fr`,
}));

function onPanelSelected(panel: MainSidebarPanel): void {
  activePanel.value = panel;
  layoutPersistence.saveState({ activePanel: panel });
}

function startSplitDrag(event: PointerEvent, orientation: SplitOrientation): void {
  const container = orientation === 'vertical' ? contentShell.value : topPane.value;
  if (!container) {
    return;
  }

  event.preventDefault();
  const rect = container.getBoundingClientRect();
  splitDrag.value = {
    orientation,
    startClient: orientation === 'vertical' ? event.clientY : event.clientX,
    startSizes: orientation === 'vertical' ? [...mainVerticalSizes.value] : [...topHorizontalSizes.value],
    containerSize: orientation === 'vertical' ? rect.height : rect.width,
  };

  window.addEventListener('pointermove', onSplitPointerMove);
  window.addEventListener('pointerup', stopSplitDrag);
}

function onSplitPointerMove(event: PointerEvent): void {
  const drag = splitDrag.value;
  if (!drag || drag.containerSize <= 0) {
    return;
  }

  const currentClient = drag.orientation === 'vertical' ? event.clientY : event.clientX;
  const deltaPercent = ((currentClient - drag.startClient) / drag.containerSize) * 100;
  const total = drag.startSizes[0] + drag.startSizes[1];
  const nextFirst = Math.min(total - 10, Math.max(10, drag.startSizes[0] + deltaPercent));
  const nextSizes: [number, number] = [nextFirst, total - nextFirst];

  if (drag.orientation === 'vertical') {
    mainVerticalSizes.value = nextSizes;
  } else {
    topHorizontalSizes.value = nextSizes;
  }
}

function stopSplitDrag(): void {
  const drag = splitDrag.value;
  if (drag?.orientation === 'vertical') {
    layoutPersistence.saveState({ mainVertical: mainVerticalSizes.value });
  }
  if (drag?.orientation === 'horizontal') {
    layoutPersistence.saveState({ topHorizontal: topHorizontalSizes.value });
  }

  splitDrag.value = null;
  window.removeEventListener('pointermove', onSplitPointerMove);
  window.removeEventListener('pointerup', stopSplitDrag);
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onSplitPointerMove);
  window.removeEventListener('pointerup', stopSplitDrag);
});
</script>

<template>
  <MenuBar />
  <div class="layout-shell">
    <div class="sidebar-shell">
      <Sidebar :active-panel="activePanel" @panel-selected="onPanelSelected" />
    </div>

    <div ref="contentShell" class="content-shell">
      <div v-if="activePanel === 'timeline'" class="main-split" :style="mainGridStyle">
        <div ref="topPane" class="top-split" :style="topGridStyle">
          <PreviewScreen />
          <div
            class="gutter horizontal"
            role="separator"
            aria-orientation="vertical"
            @pointerdown="startSplitDrag($event, 'horizontal')"
          ></div>
          <div class="pane-content">Node Editor</div>
        </div>
        <div
          class="gutter vertical"
          role="separator"
          aria-orientation="horizontal"
          @pointerdown="startSplitDrag($event, 'vertical')"
        ></div>
        <div class="timeline-container">
          <div v-if="viewService.scriptTimelineVisible()" class="timeline-row script-row">
            <div class="timeline-row-label">Script (Subtitle) Timeline</div>
          </div>

          <div v-if="viewService.videoTimelineVisible()" class="timeline-row video-row">
            <Timeline />
          </div>

          <div v-if="viewService.audioTimelineVisible()" class="timeline-row audio-row">
            <div class="timeline-row-label">Audio Clip Timeline</div>
          </div>

          <div v-if="viewService.keyframeTimelineVisible()" class="timeline-row keyframe-row">
            <div class="timeline-row-label">Keyframe Timeline</div>
          </div>
        </div>
      </div>

      <section v-else class="task-view" aria-label="Task view">
        <h2 class="task-title">Task</h2>
        <p class="task-description">Task view is a temporary placeholder.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.layout-shell {
  display: flex;
  height: 100%;
}

.sidebar-shell {
  flex: 0 0 92px;
}

.content-shell {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.main-split,
.top-split {
  display: grid;
  height: 100%;
  min-height: 0;
}

.gutter {
  background-color: #1c2024;
  touch-action: none;
}

.gutter.horizontal {
  cursor: col-resize;
}

.gutter.vertical {
  cursor: row-resize;
}

.pane-content {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #101417;
  color: #ffffff;
  border-radius: 8px 0 8px 8px;
}

.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
}

.timeline-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: #101417;
  color: #ffffff;
  border-radius: 8px 8px 0 0;
  padding: 4px 12px;
  min-height: 48px;
}

.timeline-row.video-row {
  flex: 1;
  min-height: 180px;
  padding: 0;
  overflow: hidden;
}

.timeline-row-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.8;
}

.task-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: #101417;
  color: #ffffff;
}

.task-title {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.task-description {
  margin: 10px 0 0;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
}
</style>
