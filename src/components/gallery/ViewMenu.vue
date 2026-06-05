<script setup lang="ts">
import { Settings2 } from 'lucide-vue-next'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import Menu from '@/components/ui/Menu.vue'
import MenuItem from '@/components/ui/MenuItem.vue'
import type { ViewOptions } from './types'

const props = defineProps<{ modelValue: ViewOptions; browse?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: ViewOptions] }>()

function toggle<K extends keyof ViewOptions>(key: K) {
  emit('update:modelValue', { ...props.modelValue, [key]: !props.modelValue[key] })
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        type="button"
        class="flex size-10 items-center justify-center rounded-lg border border-border-default hover:bg-secondary-background focus:outline-none"
        aria-label="View settings"
      >
        <Settings2 class="size-4" :stroke-width="1.5" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="end"
        :side-offset="4"
        class="z-50 w-64 outline-none"
      >
        <Menu>
          <!-- Grouping is a management concern — hidden in Browse mode. -->
          <MenuItem
            v-if="!browse"
            :checked="modelValue.groupByJob"
            :reserve-trailing="true"
            @select="toggle('groupByJob')"
          >
            Group assets by job
          </MenuItem>
          <MenuItem
            :checked="modelValue.showPreviews"
            :reserve-trailing="true"
            @select="toggle('showPreviews')"
          >
            Show preview assets
          </MenuItem>
        </Menu>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
