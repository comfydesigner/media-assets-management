<script setup lang="ts">
// Date-range calendar — reka-ui's RangeCalendar primitive (the same one shadcn-vue
// wraps), restyled to the app's tokens. Two months side by side; click a start
// then an end day to pick a range. Emits the reka `DateRange` ({ start, end }).
import {
  type DateRange,
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHead,
  RangeCalendarGridRow,
  RangeCalendarHeadCell,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNext,
  RangeCalendarPrev,
  RangeCalendarRoot,
} from 'reka-ui'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

// Uncontrolled — reka drives the two-click start→end selection internally; we just
// react to updates and emit `complete` once BOTH ends are picked. (Uncontrolled
// avoids the fussy reka/@internationalized DateRange union typing on a v-model.)
const emit = defineEmits<{ complete: [range: DateRange] }>()
function onRangeUpdate(value: DateRange | undefined) {
  if (value?.start && value?.end) emit('complete', value)
}

const navBtn =
  'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground'
// Day cell: range fill via `data-selected` (secondary), solid azure ends, today ring.
const cellTrigger = [
  'relative flex size-8 items-center justify-center rounded-md text-sm tabular-nums text-base-foreground transition-colors',
  'hover:bg-secondary-background',
  'data-[outside-view]:text-muted-foreground/40',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  'data-[selected]:bg-secondary-background',
  'data-[highlighted]:bg-secondary-background',
  'data-[selection-start]:bg-azure-600 data-[selection-start]:text-white data-[selection-start]:hover:bg-azure-600',
  'data-[selection-end]:bg-azure-600 data-[selection-end]:text-white data-[selection-end]:hover:bg-azure-600',
  'data-[today]:font-semibold data-[today]:ring-1 data-[today]:ring-inset data-[today]:ring-border-default',
].join(' ')
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ weekDays, grid }"
    weekday-format="short"
    :number-of-months="2"
    fixed-weeks
    class="select-none p-1 text-base-foreground"
    @update:model-value="onRangeUpdate"
  >
    <RangeCalendarHeader class="relative mb-2 flex items-center justify-between">
      <RangeCalendarPrev :class="navBtn"><ChevronLeft class="size-4" :stroke-width="1.5" /></RangeCalendarPrev>
      <RangeCalendarNext :class="navBtn"><ChevronRight class="size-4" :stroke-width="1.5" /></RangeCalendarNext>
    </RangeCalendarHeader>

    <div class="flex gap-4">
      <RangeCalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
        class="border-collapse"
      >
        <RangeCalendarHeading class="mb-2 block text-center text-sm font-medium" :data-month="month.value.toString()">
          {{ month.value.toDate('UTC').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}
        </RangeCalendarHeading>
        <RangeCalendarGridHead>
          <RangeCalendarGridRow class="mb-1 flex">
            <RangeCalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="w-8 text-center text-xs font-normal text-muted-foreground"
            >
              {{ day.slice(0, 2) }}
            </RangeCalendarHeadCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridHead>
        <RangeCalendarGridBody>
          <RangeCalendarGridRow
            v-for="(weekDates, i) in month.rows"
            :key="`week-${i}`"
            class="flex"
          >
            <RangeCalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="p-0"
            >
              <RangeCalendarCellTrigger :day="weekDate" :month="month.value" :class="cellTrigger" />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
  </RangeCalendarRoot>
</template>
