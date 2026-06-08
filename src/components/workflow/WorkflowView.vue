<script setup lang="ts">
import { ref } from 'vue'
import WorkflowRail from './WorkflowRail.vue'
import MediaDock from './MediaDock.vue'
import WorkflowCanvas from './WorkflowCanvas.vue'
import AssetDragGhost from './AssetDragGhost.vue'

defineEmits<{ openMedia: [] }>()

// Whether the Media Assets dock is shown. Toggled from the rail's media icon.
// `v-show` (not v-if) keeps the dock's drill/filter/scroll state across toggles.
const dockOpen = ref(true)
</script>

<template>
  <!-- Workflow chrome follows the app theme via semantic tokens (base-foreground /
       *-background), so the rail, nodes, and toolbars all adapt to light & dark.
       (Intentional fixed colors that stay put: the blue Run button, the canvas grid.) -->
  <div class="flex h-full min-h-0 w-full bg-canvas-background">
    <WorkflowRail :media-active="dockOpen" @toggle-media="dockOpen = !dockOpen" />
    <MediaDock v-show="dockOpen" @open-media="$emit('openMedia')" />
    <WorkflowCanvas />
    <AssetDragGhost />
  </div>
</template>
