<script setup lang="ts">
import LeftSidePanel from './components/panel/LeftSidePanel.vue'
import Gallery from './components/gallery/Gallery.vue'
import WorkflowView from './components/workflow/WorkflowView.vue'
import TabBar from './components/layout/TabBar.vue'
import BlankPage from './components/layout/BlankPage.vue'
import TooltipProvider from './components/ui/TooltipProvider.vue'
import { onBeforeUnmount, onMounted } from 'vue'
import { useGalleryFilters } from './composables/useGalleryFilters'
import { useTabs } from './composables/useTabs'

const filters = useGalleryFilters()
const tabs = useTabs()

// App-shell guard: Cmd/Ctrl+A must never trigger the browser's native
// "select all text on the page" (which highlights the whole UI — tabs, canvas
// labels, etc.). We swallow the default everywhere EXCEPT inside real text
// fields, where select-all-the-field's-text is the expected behavior. The asset
// grid's own Cmd+A (select all loaded assets) is handled separately in
// useAssetSelection and is unaffected — preventDefault doesn't stop other
// listeners, only the native text-selection default.
function onWindowKeydown(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || (e.key !== 'a' && e.key !== 'A')) return
  const ae = document.activeElement as HTMLElement | null
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown))
</script>

<template>
  <!-- 200ms tooltip delay shared app-wide (header/dock "Views" etc.). -->
  <TooltipProvider :delay-duration="200">
  <div class="flex h-full flex-col bg-base-background">
    <TabBar
      :tabs="tabs.tabs.value"
      :active-id="tabs.activeId.value"
      :show-shuffle="tabs.activeTab.value.kind === 'media'"
      @navigate="tabs.navigate"
      @close="tabs.closeTab"
      @add="tabs.addTab"
      @shuffle="filters.randomizeNames"
    />

    <div class="flex min-h-0 flex-1">
      <template v-if="tabs.activeTab.value.kind === 'media'">
        <LeftSidePanel
          :active-category="filters.activeCategory.value"
          :selected-tags="filters.selectedTags"
          :tags="filters.displayedTags.value"
          :tag-counts="filters.tagCounts"
          :sort-mode="filters.tagSort.value"
          :match-mode="filters.tagMatch.value"
          @select-category="filters.selectCategory"
          @select-tag="filters.selectTag"
          @add-tag="filters.addTag"
          @rename-tag="filters.renameTag"
          @delete-tag="filters.deleteTag"
          @delete-selected-tags="filters.deleteSelectedTags"
          @move-tag="filters.moveTag"
          @set-sort="filters.setTagSort"
          @set-match="filters.setTagMatch"
        />
        <Gallery :filters="filters" />
      </template>
      <!-- Keyed by tab id so each workflow tab is its own canvas/dock instance
           (the two workflow tabs are independent workspaces). -->
      <WorkflowView
        v-else-if="tabs.activeTab.value.kind === 'workflow'"
        :key="tabs.activeId.value"
        @open-media="tabs.openMedia"
      />
      <BlankPage v-else :label="tabs.activeTab.value.label" />
    </div>
  </div>
  </TooltipProvider>
</template>
