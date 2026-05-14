<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import {
  timelineStateService,
  type FolderVM,
  type ScheduleStripBrand,
  type StripVM,
  type TimelineItemVM,
} from '#app/features/main/main-layout/timeline/services/timeline-state.service';
import { timelineUploadService } from '#app/features/main/main-layout/timeline/services/timeline-upload.service';

type ResizeSide = 'left' | 'right' | 'top' | 'bottom';
type DragKind = 'move' | ResizeSide;

interface DragState {
  kind: DragKind;
  item: TimelineItemVM;
  startX: number;
  startY: number;
  initialStartTick: number;
  initialStartRow: number;
  initialDurationTicks: number;
  initialRowSpan: number;
}

const TRACK_HEIGHT = 34;
const SCHEDULE_BADGE_LABELS: Record<ScheduleStripBrand, string> = {
  ae: 'Ae',
  photoshop: 'Ps',
  maya: 'Ma',
  clipstudio: 'Cs',
};

const stateService = timelineStateService;
const uploadService = timelineUploadService;
const mainWrapper = ref<HTMLElement | null>(null);
const rulerWrapper = ref<HTMLElement | null>(null);
const debugPanelVisible = ref(false);
const snapshotCopyLabel = ref('Copy Snapshot');
const dragState = ref<DragState | null>(null);

const timelineItems = computed(() => stateService.timelineItems());
const timelineRows = computed(() => stateService.timelineRows());
const timelineExtentTicks = computed(() => stateService.timelineExtentTicks());
const selectedItemIds = computed(() => stateService.selectedItemIds());
const hasSelection = computed(() => selectedItemIds.value.size > 0);
const canUndo = computed(() => stateService.canUndo());
const currentTick = computed(() => stateService.currentTick());
const tickSizePx = computed(() => stateService.tickSizePx());
const tickSizeCss = computed(() => `${tickSizePx.value}px`);
const debugStats = computed(() => stateService.debugStats());
const debugSnapshotJson = computed(() => stateService.debugSnapshotJson());
const isTimelineLoading = computed(() => false);
const rulerTicks = computed(() =>
  Array.from({ length: Math.floor(timelineExtentTicks.value / 30) + 1 }, (_, index) => index * 30),
);
const timelineWidthStyle = computed(() => `calc(var(--timeline-tick-size) * ${timelineExtentTicks.value})`);
const timelineHeightStyle = computed(() => `calc(var(--timeline-track-height) * ${timelineRows.value})`);
const timelineStyle = computed(() => ({
  '--timeline-tick-size': tickSizeCss.value,
}));

function itemStyle(item: TimelineItemVM): Record<string, string> {
  return {
    width: `calc(var(--timeline-tick-size) * ${item.durationTicks})`,
    height:
      item.type === 'strip'
        ? `calc(var(--timeline-track-height) * ${item.rowSpan} - 8px)`
        : `calc(var(--timeline-track-height) * ${item.rowSpan})`,
    top:
      item.type === 'strip'
        ? `calc(${item.absoluteStartRow} * var(--timeline-track-height) + var(--timeline-strip-offset))`
        : `calc(${item.absoluteStartRow} * var(--timeline-track-height) + var(--timeline-folder-offset))`,
    left: `calc(var(--timeline-tick-size) * ${item.absoluteStartTick})`,
  };
}

function folderBodyStyle(item: FolderVM): Record<string, string> {
  return {
    display: item.isExpanded ? 'block' : 'none',
    height: `calc(${item.bodyTrackCount} * var(--timeline-track-height))`,
  };
}

function scheduleBadgeLabel(brand: ScheduleStripBrand | null): string {
  return SCHEDULE_BADGE_LABELS[brand ?? 'ae'];
}

function addTrack(): void {
  stateService.addTrack();
}

function resetDemoTimeline(): void {
  stateService.resetToDemoTimeline();
}

function createStrip(): void {
  stateService.createStrip();
}

function createFolder(): void {
  stateService.createFolder();
}

function createShedulePresetFolder(): void {
  stateService.createShedulePresetFolder();
}

function shiftSelection(delta: number): void {
  stateService.shiftSelectedByTicks(delta);
}

function shiftSelectionRows(delta: number): void {
  stateService.shiftSelectedByRows(delta);
}

function adjustSelectionDuration(delta: number): void {
  stateService.adjustSelectedDuration(delta);
}

function deleteSelected(): void {
  stateService.deleteSelectedItem();
}

function undo(): void {
  stateService.undo();
}

function toggleDebugPanel(): void {
  debugPanelVisible.value = !debugPanelVisible.value;
}

async function copyDebugSnapshot(): Promise<void> {
  const snapshot = debugSnapshotJson.value;
  if (!snapshot || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(snapshot);
  snapshotCopyLabel.value = 'Copied';
  window.setTimeout(() => {
    snapshotCopyLabel.value = 'Copy Snapshot';
  }, 1200);
}

function onMainScroll(event: Event): void {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement) || !rulerWrapper.value) {
    return;
  }
  rulerWrapper.value.scrollLeft = target.scrollLeft;
}

function onRulerPointerDown(event: PointerEvent): void {
  const tick = resolveTickFromPointer(event.clientX);
  if (tick === null) {
    return;
  }
  stateService.setCurrentTick(tick);
}

function onHostWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }

  event.preventDefault();
  const ratio = Math.exp(-event.deltaY * stateService.WHEEL_ZOOM_SENSITIVITY);
  const anchor = resolveZoomAnchor(event.clientX);
  const previousTickSize = tickSizePx.value;
  stateService.adjustZoomByRatio(ratio);

  if (anchor && mainWrapper.value && previousTickSize > 0) {
    mainWrapper.value.scrollLeft = Math.max(0, anchor.anchorTick * tickSizePx.value - anchor.viewportX);
  }
}

function onBackgroundClick(event: MouseEvent): void {
  if (event.target !== event.currentTarget) {
    return;
  }
  stateService.clearSelection();
}

function onItemPointerDown(event: PointerEvent, item: TimelineItemVM, kind: DragKind = 'move'): void {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  stateService.selectItem(item.id, event.shiftKey || event.ctrlKey || event.metaKey);

  dragState.value = {
    kind,
    item,
    startX: event.clientX,
    startY: event.clientY,
    initialStartTick: item.startTick,
    initialStartRow: item.startRow,
    initialDurationTicks: item.durationTicks,
    initialRowSpan: item.rowSpan,
  };

  window.addEventListener('pointermove', onWindowPointerMove);
  window.addEventListener('pointerup', stopItemDrag);
}

function onWindowPointerMove(event: PointerEvent): void {
  const drag = dragState.value;
  if (!drag || tickSizePx.value <= 0) {
    return;
  }

  const deltaTicks = Math.round((event.clientX - drag.startX) / tickSizePx.value);
  const deltaRows = Math.round((event.clientY - drag.startY) / TRACK_HEIGHT);
  const item = drag.item;

  if (drag.kind === 'move') {
    updateItem(item, {
      startTick: Math.max(0, drag.initialStartTick + deltaTicks),
      startRow: Math.max(0, drag.initialStartRow + deltaRows),
    });
    return;
  }

  if (drag.kind === 'left') {
    const nextStartTick = Math.max(0, drag.initialStartTick + deltaTicks);
    const consumedDelta = nextStartTick - drag.initialStartTick;
    updateItem(item, {
      startTick: nextStartTick,
      durationTicks: Math.max(1, drag.initialDurationTicks - consumedDelta),
    });
    return;
  }

  if (drag.kind === 'right') {
    updateItem(item, {
      durationTicks: Math.max(1, drag.initialDurationTicks + deltaTicks),
    });
    return;
  }

  if (drag.kind === 'top') {
    const nextStartRow = Math.max(0, drag.initialStartRow + deltaRows);
    const consumedDelta = nextStartRow - drag.initialStartRow;
    updateItem(item, {
      startRow: nextStartRow,
      laneSpan: item.type === 'strip' ? Math.max(1, drag.initialRowSpan - consumedDelta) : undefined,
      bodyTrackCount:
        item.type === 'folder' ? Math.max(1, drag.initialRowSpan - consumedDelta - 1) : undefined,
    });
    return;
  }

  updateItem(item, {
    laneSpan: item.type === 'strip' ? Math.max(1, drag.initialRowSpan + deltaRows) : undefined,
    bodyTrackCount: item.type === 'folder' ? Math.max(1, drag.initialRowSpan + deltaRows - 1) : undefined,
  });
}

function stopItemDrag(): void {
  dragState.value = null;
  window.removeEventListener('pointermove', onWindowPointerMove);
  window.removeEventListener('pointerup', stopItemDrag);
}

function onItemKeydown(event: KeyboardEvent, itemId: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  stateService.selectItem(itemId, event.shiftKey || event.ctrlKey || event.metaKey);
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) {
    return;
  }

  if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSelected();
  }
}

function onTimelineDragOver(event: DragEvent): void {
  event.preventDefault();
}

async function onTimelineDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  const input = resolveExternalDropStripInput(event.dataTransfer);
  const point = resolveTimelinePoint(event.clientX, event.clientY);
  if (!input || !point) {
    return;
  }

  const uploadedFile = input.file ? await uploadService.uploadFile(input.file) : null;
  stateService.addStrip(
    {
      trackIndex: point.row,
      position: undefined,
    },
    {
      sourceName: uploadedFile?.fileName ?? input.sourceName,
      kind: input.kind,
      startTick: point.tick,
      durationTicks: input.durationTicks,
      metadata: uploadedFile
        ? {
            mimeType: uploadedFile.mimeType,
            uploadedFilePath: uploadedFile.filePath,
            uploadedFileUrl: uploadedFile.fileUrl,
            size: uploadedFile.size,
          }
        : undefined,
    },
  );
}

async function onStripDrop(event: DragEvent, item: StripVM): Promise<void> {
  if (item.sourceKind !== 'solid') {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const input = resolveExternalDropStripInput(event.dataTransfer);
  if (!input?.file) {
    return;
  }

  const folderId = stateService.convertSheduleStripToFolder(item.id);
  const createdFolder = timelineItems.value.find(
    (candidate): candidate is FolderVM => candidate.type === 'folder' && candidate.id === folderId,
  );
  if (!createdFolder) {
    return;
  }

  const uploadedFile = await uploadService.uploadFile(input.file);
  stateService.addStrip(
    {
      parentFolderId: createdFolder.sourceId,
      trackIndex: 0,
    },
    {
      sourceName: uploadedFile.fileName,
      kind: 'media',
      startTick: 0,
      durationTicks: Math.min(item.durationTicks, 300),
      laneSpan: 1,
      metadata: {
        mimeType: uploadedFile.mimeType,
        uploadedFilePath: uploadedFile.filePath,
        uploadedFileUrl: uploadedFile.fileUrl,
        size: uploadedFile.size,
      },
    },
  );
}

function updateItem(
  item: TimelineItemVM,
  updates: {
    startTick?: number;
    startRow?: number;
    durationTicks?: number;
    laneSpan?: number;
    bodyTrackCount?: number;
  },
): void {
  if (item.type === 'strip') {
    stateService.updateStrip(item.id, {
      startTick: updates.startTick,
      startRow: updates.startRow,
      durationTicks: updates.durationTicks,
      laneSpan: updates.laneSpan,
    });
    return;
  }

  stateService.updateFolder(item.id, {
    startTick: updates.startTick,
    startRow: updates.startRow,
    durationTicks: updates.durationTicks,
    bodyTrackCount: updates.bodyTrackCount,
  });
}

function resolveTickFromPointer(clientX: number): number | null {
  const wrapper = rulerWrapper.value;
  if (!wrapper || tickSizePx.value <= 0) {
    return null;
  }

  const rect = wrapper.getBoundingClientRect();
  return Math.max(0, Math.round((wrapper.scrollLeft + clientX - rect.left) / tickSizePx.value));
}

function resolveZoomAnchor(clientX: number): { anchorTick: number; viewportX: number } | null {
  const wrapper = mainWrapper.value;
  if (!wrapper || tickSizePx.value <= 0) {
    return null;
  }

  const rect = wrapper.getBoundingClientRect();
  const viewportX = Math.min(Math.max(0, clientX - rect.left), rect.width);
  return {
    anchorTick: (wrapper.scrollLeft + viewportX) / tickSizePx.value,
    viewportX,
  };
}

function resolveTimelinePoint(clientX: number, clientY: number): { tick: number; row: number } | null {
  const wrapper = mainWrapper.value;
  if (!wrapper || tickSizePx.value <= 0) {
    return null;
  }

  const rect = wrapper.getBoundingClientRect();
  const viewportX = Math.min(Math.max(0, clientX - rect.left), rect.width);
  const viewportY = Math.min(Math.max(0, clientY - rect.top), rect.height);
  return {
    tick: Math.max(0, Math.round((wrapper.scrollLeft + viewportX) / tickSizePx.value)),
    row: Math.max(0, Math.floor((wrapper.scrollTop + viewportY) / TRACK_HEIGHT)),
  };
}

function resolveExternalDropStripInput(dataTransfer: DataTransfer | null): {
  sourceName: string;
  kind: 'media' | 'generated';
  durationTicks: number;
  file?: File;
} | null {
  if (!dataTransfer) {
    return null;
  }

  const file = Array.from(dataTransfer.files ?? [])[0];
  if (file) {
    return {
      sourceName: file.name || 'Dropped File',
      kind: 'media',
      durationTicks: 300,
      file,
    };
  }

  const droppedText = dataTransfer.getData('text/plain').trim();
  if (droppedText.length > 0) {
    return {
      sourceName: 'Dropped Text',
      kind: 'generated',
      durationTicks: 120,
    };
  }

  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches('input, textarea, [contenteditable="true"], [contenteditable=""]');
}

onBeforeUnmount(() => {
  stopItemDrag();
});

window.addEventListener('keydown', onWindowKeydown);
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
});
</script>

<template>
  <div class="timeline-root" :style="timelineStyle" @wheel="onHostWheel">
    <div class="timeline-header">
      <button class="add-track-btn" type="button" @click="addTrack">+</button>
      <div ref="rulerWrapper" class="ruler-wrapper" @pointerdown="onRulerPointerDown">
        <div class="ruler-track" :style="{ width: timelineWidthStyle }">
          <div
            v-for="tick in rulerTicks"
            :key="tick"
            class="ruler-label"
            :style="{ left: `calc(var(--timeline-tick-size) * ${tick})` }"
          >
            {{ tick }}
          </div>
          <div
            class="playhead-handle"
            :style="{ left: `calc(var(--timeline-tick-size) * ${currentTick})` }"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="isTimelineLoading" class="timeline-loading-state" role="status" aria-live="polite">
      Loading Data...
    </div>
    <template v-else>
      <div class="timeline-sidebar" tabindex="0" @click="onBackgroundClick"></div>

      <div ref="mainWrapper" class="timeline-main-wrapper" @scroll="onMainScroll">
        <div
          class="timeline-main"
          :style="{ width: timelineWidthStyle, height: timelineHeightStyle }"
          tabindex="0"
          @dragover="onTimelineDragOver"
          @drop="onTimelineDrop"
          @click="onBackgroundClick"
        >
          <div
            class="playhead-line"
            :style="{ left: `calc(var(--timeline-tick-size) * ${currentTick})` }"
          ></div>

          <template v-for="item in timelineItems" :key="item.id">
            <div
              v-if="item.type === 'strip'"
              class="strip"
              tabindex="0"
              :style="itemStyle(item)"
              :class="[
                `lane-span-${item.laneSpan}`,
                {
                  'shedule-strip': item.sourceKind === 'solid',
                  'brand-ae': item.sourceKind === 'solid' && item.scheduleBrand === 'ae',
                  'brand-photoshop':
                    item.sourceKind === 'solid' && item.scheduleBrand === 'photoshop',
                  'brand-maya': item.sourceKind === 'solid' && item.scheduleBrand === 'maya',
                  'brand-clipstudio':
                    item.sourceKind === 'solid' && item.scheduleBrand === 'clipstudio',
                  selected: item.isSelected,
                },
              ]"
              @pointerdown="onItemPointerDown($event, item)"
              @keydown="onItemKeydown($event, item.id)"
              @dragover.prevent
              @drop="onStripDrop($event, item)"
            >
              <div class="resize-handle top" @pointerdown="onItemPointerDown($event, item, 'top')"></div>
              <div class="resize-handle left" @pointerdown="onItemPointerDown($event, item, 'left')"></div>
              <template v-if="item.sourceKind === 'solid'">
                <div class="shedule-strip-content">
                  <div
                    class="shedule-icon"
                    :class="{
                      'clipstudio-mark': item.scheduleBrand === 'clipstudio',
                      'maya-mark': item.scheduleBrand === 'maya',
                    }"
                  >
                    <span v-if="item.scheduleBrand !== 'clipstudio' && item.scheduleBrand !== 'maya'">
                      {{ scheduleBadgeLabel(item.scheduleBrand) }}
                    </span>
                  </div>
                  <div class="shedule-text">
                    <div class="shedule-title">{{ item.sourceName }}</div>
                    <div class="shedule-meta">
                      <span class="worker">作業者:○○さん</span>
                      <span class="deadline">~10/3</span>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <span>{{ item.sourceName }}</span>
                <span v-if="item.laneSpan === 2" class="lane2-preview">Preview</span>
              </template>
              <div class="resize-handle right" @pointerdown="onItemPointerDown($event, item, 'right')"></div>
              <div class="resize-handle bottom" @pointerdown="onItemPointerDown($event, item, 'bottom')"></div>
            </div>

            <div
              v-else
              class="folder"
              tabindex="0"
              :style="itemStyle(item)"
              :class="[
                {
                  'brand-ae': item.scheduleBrand === 'ae',
                  'brand-photoshop': item.scheduleBrand === 'photoshop',
                  'brand-maya': item.scheduleBrand === 'maya',
                  'brand-clipstudio': item.scheduleBrand === 'clipstudio',
                  selected: item.isSelected,
                },
              ]"
              @pointerdown="onItemPointerDown($event, item)"
              @keydown="onItemKeydown($event, item.id)"
            >
              <div class="resize-handle top" @pointerdown="onItemPointerDown($event, item, 'top')"></div>
              <div class="resize-handle left" @pointerdown="onItemPointerDown($event, item, 'left')"></div>
              <div class="folder-header" :class="{ expanded: item.isExpanded }">
                <div class="folder-mark">[]</div>
                <div>{{ item.name }}</div>
                <button type="button" aria-label="Toggle folder">></button>
              </div>
              <div class="folder-content-holder" :style="folderBodyStyle(item)"></div>
              <div class="resize-handle right" @pointerdown="onItemPointerDown($event, item, 'right')"></div>
              <div class="resize-handle bottom" @pointerdown="onItemPointerDown($event, item, 'bottom')"></div>
            </div>
          </template>

          <div v-if="timelineItems.length === 0" class="empty-state">No timeline items yet.</div>
        </div>
      </div>
    </template>

    <div class="timeline-actions">
      <div class="actions-label">Initialize</div>
      <div class="actions-group">
        <button type="button" class="secondary-action" @click="resetDemoTimeline">
          Reset Demo Timeline
        </button>
      </div>
      <div class="actions-label">Create</div>
      <div class="actions-group">
        <button type="button" @click="createStrip">Add Strip</button>
        <button type="button" @click="createFolder">Add Folder</button>
        <button type="button" @click="createShedulePresetFolder">Add Shedule Folder</button>
      </div>
      <div class="actions-label">Selection Actions</div>
      <div class="actions-group">
        <button type="button" :disabled="!hasSelection" @click="shiftSelection(-1)">Move -1 tick</button>
        <button type="button" :disabled="!hasSelection" @click="shiftSelection(1)">Move +1 tick</button>
        <button type="button" :disabled="!hasSelection" @click="shiftSelection(-10)">Move -10 ticks</button>
        <button type="button" :disabled="!hasSelection" @click="shiftSelection(10)">Move +10 ticks</button>
        <button type="button" :disabled="!hasSelection" @click="shiftSelectionRows(-1)">Move -1 row</button>
        <button type="button" :disabled="!hasSelection" @click="shiftSelectionRows(1)">Move +1 row</button>
        <button type="button" :disabled="!hasSelection" @click="adjustSelectionDuration(-1)">Shorten -1 tick</button>
        <button type="button" :disabled="!hasSelection" @click="adjustSelectionDuration(1)">Extend +1 tick</button>
        <button type="button" :disabled="!hasSelection" @click="deleteSelected">Delete Selected</button>
        <button type="button" class="secondary-action" :disabled="!canUndo" @click="undo">Undo</button>
      </div>
      <div class="actions-label">Debug</div>
      <div class="actions-group">
        <button type="button" class="secondary-action" @click="toggleDebugPanel">
          {{ debugPanelVisible ? 'Hide' : 'Show' }} Snapshot
        </button>
        <button
          type="button"
          class="secondary-action"
          :disabled="!debugSnapshotJson"
          @click="copyDebugSnapshot"
        >
          {{ snapshotCopyLabel }}
        </button>
      </div>
    </div>

    <aside v-if="debugPanelVisible" class="timeline-debug-panel" aria-label="Timeline debug snapshot">
      <div class="debug-panel-header">
        <div>
          <div class="debug-panel-title">Timeline Snapshot</div>
          <div v-if="debugStats" class="debug-panel-meta">
            Schema {{ debugStats.schemaVersion }} / Normalize {{ debugStats.normalizeVersion }} /
            Scale {{ debugStats.timeScale }}
          </div>
        </div>
        <button type="button" class="secondary-action" @click="toggleDebugPanel">Close</button>
      </div>

      <dl v-if="debugStats" class="debug-stats-grid">
        <div>
          <dt>Root</dt>
          <dd>{{ debugStats.rootFolderSourceId }}</dd>
        </div>
        <div>
          <dt>Strip Sources</dt>
          <dd>{{ debugStats.stripSourceCount }}</dd>
        </div>
        <div>
          <dt>Folder Sources</dt>
          <dd>{{ debugStats.folderSourceCount }}</dd>
        </div>
        <div>
          <dt>Placements</dt>
          <dd>{{ debugStats.placementCount }}</dd>
        </div>
      </dl>

      <pre>{{ debugSnapshotJson }}</pre>
    </aside>
  </div>
</template>

<style scoped>
.timeline-root {
  --timeline-tick-size: 2px;
  --timeline-track-height: 34px;
  --timeline-sidebar-width: 33px;
  --timeline-grid-gap: 3px;
  --timeline-strip-padding-x: 9px;
  --timeline-strip-offset: 2px;
  --timeline-background-stripe-height: 30px;
  --timeline-folder-offset: 4px;
  --timeline-folder-content-stripe-height: 4px;

  display: grid;
  width: 100%;
  height: 100%;
  background: #101417;
  border-radius: 8px 8px 0 0;
  grid-template-rows: 25px auto;
  grid-template-columns: var(--timeline-sidebar-width) auto;
  column-gap: var(--timeline-grid-gap);
  position: relative;
}

.timeline-header {
  grid-column: 1 / span 2;
  grid-row: 1 / 2;
  display: grid;
  grid-template-columns: var(--timeline-sidebar-width) auto;
  background-color: #1e2226;
  border-bottom: 1px solid #101417;
}

.timeline-header .add-track-btn {
  background: transparent;
  border: none;
  color: #9aa3b5;
  cursor: pointer;
}

.timeline-header .add-track-btn:hover {
  color: #ffffff;
}

.ruler-wrapper {
  overflow: hidden;
  position: relative;
  cursor: text;
}

.ruler-track {
  height: 100%;
  position: relative;
  background-image:
    repeating-linear-gradient(
      to right,
      transparent,
      transparent calc(var(--timeline-tick-size) * 30 - 1px),
      #666666 calc(var(--timeline-tick-size) * 30 - 1px),
      #666666 calc(var(--timeline-tick-size) * 30)
    ),
    repeating-linear-gradient(
      to right,
      transparent,
      transparent calc(var(--timeline-tick-size) * 10 - 1px),
      #444444 calc(var(--timeline-tick-size) * 10 - 1px),
      #444444 calc(var(--timeline-tick-size) * 10)
    );
  background-size:
    100% 12px,
    100% 6px;
  background-position:
    bottom left,
    bottom left;
  background-repeat: repeat-x, repeat-x;
}

.ruler-label {
  position: absolute;
  bottom: 12px;
  font-size: 10px;
  color: #888888;
  transform: translateX(-50%);
  pointer-events: none;
}

.playhead-handle {
  position: absolute;
  bottom: 0;
  width: 11px;
  height: 11px;
  background-color: #ff3333;
  transform: translateX(-2px);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  z-index: 30001;
  pointer-events: none;
}

.timeline-main .playhead-line {
  position: absolute;
  inset: 0 auto 0 0;
  width: 1px;
  background-color: #ff3333;
  z-index: 30000;
  pointer-events: none;
}

.timeline-sidebar {
  grid-column: 1 / 2;
  grid-row: 2 / span 1;
}

.timeline-loading-state {
  grid-column: 1 / span 2;
  grid-row: 2 / span 1;
  display: grid;
  place-items: center;
  color: #cdd5e3;
  font-size: 14px;
  letter-spacing: 0.03em;
  background: linear-gradient(180deg, rgba(15, 20, 24, 0.65) 0%, rgba(11, 15, 18, 0.9) 100%);
}

.timeline-main-wrapper {
  grid-column: 2 / span 1;
  grid-row: 2 / span 1;
  overflow: auto;
  scrollbar-width: none;
}

.timeline-main {
  position: relative;
  background-color: #0b0f12;
  background-image: repeating-linear-gradient(
    to bottom,
    #262a2e,
    #262a2e var(--timeline-background-stripe-height),
    #0b0f12 var(--timeline-background-stripe-height),
    #0b0f12 var(--timeline-track-height)
  );
}

.timeline-main .empty-state {
  color: #ffffff;
  height: 100%;
  display: grid;
  justify-content: center;
  align-items: center;
}

.strip {
  z-index: 20000;
  background-color: #024b71;
  color: #cbe6ff;
  align-content: center;
  padding: 0 var(--timeline-strip-padding-x);
  border-radius: 5px;
  position: absolute;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strip.lane-span-2 {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-block: 2px;
}

.lane2-preview {
  flex: 1;
  background-color: #1570a1;
  border-radius: 2px;
  width: 100%;
}

.shedule-strip {
  border: 2px dashed;
  opacity: 0.7;
}

.shedule-strip.brand-ae {
  background-color: #2b347d;
  color: #e8ebff;
  border-color: #939af6;
}

.shedule-strip.brand-photoshop {
  background-color: #032b52;
  color: #d4efff;
  border-color: #4dc1ff;
}

.shedule-strip.brand-maya {
  background-color: #1c4744;
  color: #d6f8f0;
  border-color: #64d8c2;
}

.shedule-strip.brand-clipstudio {
  background: #cccccd;
  color: #2f2f31;
}

.shedule-strip-content {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  width: 100%;
}

.shedule-icon {
  background-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.4em;
  flex-shrink: 0;
}

.shedule-strip.brand-ae .shedule-icon {
  background-color: #120f34;
  color: #c4bcff;
}

.shedule-strip.brand-photoshop .shedule-icon {
  background-color: #001e36;
  color: #41cbff;
}

.shedule-strip.brand-maya .shedule-icon {
  background-color: #0e2f2b;
  color: #8df0db;
}

.shedule-strip.brand-clipstudio .shedule-icon {
  background: linear-gradient(180deg, #fdfdfd 0%, #e9e9eb 100%);
  color: #343436;
  border: 1px solid rgba(77, 77, 82, 0.1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 1px 1px rgba(0, 0, 0, 0.06);
}

.shedule-strip.brand-clipstudio .clipstudio-mark {
  background: url("https://upload.wikimedia.org/wikipedia/commons/1/14/Clipstudiopaint_app_logo.png")
    center center / contain no-repeat;
}

.shedule-strip.brand-maya .maya-mark {
  background: url("https://images.seeklogo.com/logo-png/48/1/autodesk-maya-logo-png_seeklogo-482401.png")
    center center / contain no-repeat;
}

.shedule-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.shedule-title {
  font-weight: 700;
  font-size: 1.1em;
  line-height: 1.2;
}

.shedule-meta {
  display: flex;
  gap: 12px;
  font-size: 0.9em;
  font-weight: 600;
}

.shedule-meta span {
  text-decoration: underline;
}

.strip.selected {
  box-shadow: 0 0 0 3px rgb(26, 159, 231) inset;
}

.folder {
  z-index: 10000;
  position: absolute;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.folder .folder-header {
  min-height: calc(var(--timeline-track-height) - 8px);
  background-color: #437836;
  color: #e0e3e8;
  align-content: center;
  padding: 0 var(--timeline-strip-padding-x);
  border-radius: 10px 10px var(--timeline-folder-offset) var(--timeline-folder-offset);
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 40px;
  gap: 3px;
}

.folder .folder-header div:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder .folder-header.expanded {
  border-radius: 10px 10px 0 0;
}

.folder .folder-header button {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: inherit;
}

.folder .folder-content-holder {
  background-color: #2e6b2e;
  background-image: repeating-linear-gradient(
    to bottom,
    #32562a,
    #32562a var(--timeline-folder-content-stripe-height),
    #264c14 var(--timeline-folder-content-stripe-height),
    #264c14 var(--timeline-track-height)
  );
  color: #ffffff;
  border-radius: 0 0 var(--timeline-folder-offset) var(--timeline-folder-offset);
}

.folder.brand-ae .folder-header {
  background-color: #2b347d;
  color: #e8ebff;
}

.folder.brand-ae .folder-content-holder {
  background-color: #1f255d;
  background-image: repeating-linear-gradient(
    to bottom,
    #252d70,
    #252d70 var(--timeline-folder-content-stripe-height),
    #1b2050 var(--timeline-folder-content-stripe-height),
    #1b2050 var(--timeline-track-height)
  );
}

.folder.brand-photoshop .folder-header {
  background-color: #032b52;
  color: #d4efff;
}

.folder.brand-photoshop .folder-content-holder {
  background-color: #042645;
  background-image: repeating-linear-gradient(
    to bottom,
    #063663,
    #063663 var(--timeline-folder-content-stripe-height),
    #04233f var(--timeline-folder-content-stripe-height),
    #04233f var(--timeline-track-height)
  );
}

.folder.brand-maya .folder-header {
  background-color: #1c4744;
  color: #d6f8f0;
}

.folder.brand-maya .folder-content-holder {
  background-color: #1a3d3a;
  background-image: repeating-linear-gradient(
    to bottom,
    #24514d,
    #24514d var(--timeline-folder-content-stripe-height),
    #173531 var(--timeline-folder-content-stripe-height),
    #173531 var(--timeline-track-height)
  );
}

.folder.brand-clipstudio .folder-header {
  background-color: #bfc0c4;
  color: #2f2f31;
}

.folder.brand-clipstudio .folder-content-holder {
  background-color: #a8aab2;
  background-image: repeating-linear-gradient(
    to bottom,
    #b5b7be,
    #b5b7be var(--timeline-folder-content-stripe-height),
    #9da0a9 var(--timeline-folder-content-stripe-height),
    #9da0a9 var(--timeline-track-height)
  );
  color: #232326;
}

.folder.selected .folder-header {
  box-shadow: 0 0 0 2px #8dd7ff inset;
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: col-resize;
  z-index: 20001;
}

.resize-handle.left {
  left: 0;
}

.resize-handle.right {
  right: 0;
}

.resize-handle.top,
.resize-handle.bottom {
  left: 0;
  right: 0;
  width: auto;
  height: 10px;
  cursor: row-resize;
}

.resize-handle.top {
  top: 0;
  bottom: auto;
}

.resize-handle.bottom {
  top: auto;
  bottom: 0;
}

.timeline-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  z-index: 40000;
}

.timeline-actions button,
.timeline-debug-panel button {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  background-color: #2f6fed;
  color: #ffffff;
  cursor: pointer;
  min-width: 138px;
}

.timeline-actions button.secondary-action,
.timeline-debug-panel button.secondary-action {
  background-color: #38404d;
}

.timeline-actions button:disabled {
  background-color: #3a3f49;
  cursor: not-allowed;
  color: #888d9a;
}

.timeline-actions .actions-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #9aa3b5;
}

.timeline-actions .actions-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.timeline-debug-panel {
  position: absolute;
  right: 172px;
  bottom: 12px;
  width: min(520px, calc(100% - 196px));
  max-height: min(50vh, 420px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: rgba(13, 17, 22, 0.96);
  color: #dce5f2;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  z-index: 40000;
}

.timeline-debug-panel .debug-panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.timeline-debug-panel .debug-panel-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.timeline-debug-panel .debug-panel-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.timeline-debug-panel .debug-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
}

.timeline-debug-panel .debug-stats-grid div {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(56, 64, 77, 0.35);
}

.timeline-debug-panel dt {
  font-size: 11px;
  text-transform: uppercase;
  color: #94a3b8;
}

.timeline-debug-panel dd {
  margin: 4px 0 0;
  font-size: 12px;
  word-break: break-all;
}

.timeline-debug-panel pre {
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: #090c10;
  color: #cbe6ff;
  overflow: auto;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
