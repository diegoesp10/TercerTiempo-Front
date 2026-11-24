<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue';
import type { AttendanceStatus } from '@/types/api';
import { attendanceStatusTone, myAttendanceIcons, myAttendanceLabels } from '@/utils/format';

/** La asistencia del jugador que mira, dicha a él: «Asistencia realizada» con su check, «Falta avisada»… */
defineProps<{ status: AttendanceStatus }>();
</script>

<template>
  <Badge :tone="attendanceStatusTone[status]"><Icon :icon="myAttendanceIcons[status]" class="mr-1 h-3 w-3" />{{ myAttendanceLabels[status] }}</Badge>
</template>
