<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const { toasts, dismissToast } = useToast()
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.tone}`" role="status">
      <span class="toast__text">{{ t.message }}</span>
      <button type="button" class="toast__close" aria-label="Fermer" @click="dismissToast(t.id)">
        <X :size="14" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: min(calc(100% - 24px), 440px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-lime);
  box-shadow: 0 10px 30px rgba(18, 21, 18, 0.14);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.toast--success {
  border-left-color: var(--color-lime);
}

.toast--warning {
  border-left-color: #E5484D;
}

.toast__text {
  flex: 1;
  min-width: 0;
}

.toast__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
</style>
