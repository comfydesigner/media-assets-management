<script setup lang="ts">
import WorkflowRail from './WorkflowRail.vue'
import MediaDock from './MediaDock.vue'
import WorkflowCanvas from './WorkflowCanvas.vue'
import AssetDragGhost from './AssetDragGhost.vue'

defineEmits<{ openMedia: [] }>()
</script>

<template>
  <!-- Workflow chrome follows the app theme via semantic tokens (base-foreground /
       *-background), so the rail, nodes, and toolbars all adapt to light & dark.
       (Intentional fixed colors that stay put: the blue Run button, the canvas grid.) -->
  <div class="flex h-full min-h-0 w-full bg-canvas-background">
    <WorkflowRail />
    <MediaDock @open-media="$emit('openMedia')" />
    <WorkflowCanvas />
    <AssetDragGhost />
  </div>
</template>
