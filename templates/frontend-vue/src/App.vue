<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, type Note } from "./api";
import { hasBackend, hasData } from "./config";

// 首页：显示当前用户，有数据时演示读写。换成你自己的页面即可。
const name = ref("");
const notes = ref<Note[]>([]);
const text = ref("");
const error = ref("");

onMounted(async () => {
  if (!hasBackend) return;
  try {
    name.value = (await api.me()).name;
    if (hasData) notes.value = await api.notes();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "读取失败";
  }
});

async function add() {
  error.value = "";
  try {
    notes.value = [await api.addNote(text.value), ...notes.value];
    text.value = "";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "保存失败";
  }
}
</script>

<template>
  <header class="topbar">
    <span class="title">__NAME__</span>
  </header>
  <main class="content stack">
    <section class="card stack">
      <h1>{{ name ? `你好，${name}` : "你好" }}</h1>
      <p class="muted">__DESCRIPTION__</p>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
    <section v-if="hasData" class="card stack">
      <h1>笔记</h1>
      <form class="actions" @submit.prevent="add">
        <input v-model="text" placeholder="写点什么" />
        <button type="submit" :disabled="!text.trim()">保存</button>
      </form>
      <ul class="list">
        <li v-for="n in notes" :key="n.id">
          {{ n.text }}<span class="muted"> · {{ n.author }}</span>
        </li>
      </ul>
    </section>
  </main>
</template>
