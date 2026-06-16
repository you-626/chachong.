<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div
        v-for="stat in statsCards"
        :key="stat.key"
        class="stat-card"
        :style="{ '--accent': stat.color }"
      >
        <div class="stat-card-glow"></div>
        <div class="stat-icon-wrap">
          <el-icon><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-val">{{ stats[stat.key] ?? '—' }}</div>
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-trend" v-if="stat.key === 'todayAccounts'">今日</div>
      </div>
    </div>

    <!-- 功能区 -->
    <div class="dash-grid">
      <!-- 快速录入 -->
      <el-card class="quick-card">
        <template #header>
          <div class="card-hd">
            <div class="card-hd-icon" style="background:rgba(29,185,84,0.1);color:var(--brand-1)">
              <el-icon><Plus /></el-icon>
            </div>
            <div>
              <div class="card-hd-title">快速录入</div>
              <div class="card-hd-sub">粘贴账号后按回车，秒级完成查重</div>
            </div>
          </div>
        </template>

        <div class="quick-input-row">
          <el-input
            v-model="quickAccount"
            placeholder="在这里粘贴或输入采集账号"
            size="large"
            :prefix-icon="Key"
            clearable
            @keyup.enter="quickAdd"
          />
          <el-button type="primary" size="large" :loading="adding" @click="quickAdd">
            提交
          </el-button>
        </div>

        <transition name="result-slide">
          <div v-if="addResult" :class="['result-banner', addResult.type]">
            <el-icon>
              <CircleCheck v-if="addResult.type === 'ok'" />
              <Warning v-else />
            </el-icon>
            <span>{{ addResult.msg }}</span>
          </div>
        </transition>
      </el-card>

      <!-- 运行信息 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-hd">
            <div class="card-hd-icon" style="background:rgba(99,102,241,0.1);color:#6366f1">
              <el-icon><Monitor /></el-icon>
            </div>
            <div>
              <div class="card-hd-title">运行状态</div>
              <div class="card-hd-sub">服务正常，数据实时同步</div>
            </div>
          </div>
        </template>

        <div class="info-list">
          <div class="info-row">
            <span class="info-key">服务状态</span>
            <span class="tag-active">
              <span class="dot dot-green"></span>
              运行中
            </span>
          </div>
          <div class="info-row">
            <span class="info-key">当前登录</span>
            <span class="info-val bold">{{ auth.user?.username }}</span>
          </div>
          <div class="info-row">
            <span class="info-key">权限等级</span>
            <span class="info-val" style="color:var(--brand-1);font-weight:600">管理员</span>
          </div>
          <div class="info-row">
            <span class="info-key">今日新增</span>
            <span class="info-val bold">{{ stats.todayAccounts ?? 0 }} 条账号</span>
          </div>
          <div class="info-row">
            <span class="info-key">在职员工</span>
            <span class="info-val bold">{{ stats.activeEmployees ?? 0 }} 人</span>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Tickets, UserFilled, CircleCheck, Calendar,
  Plus, Monitor, Warning, Key
} from '@element-plus/icons-vue'
import api from '../../api/index.js'
import { useAuthStore } from '../../store/auth.js'

const auth = useAuthStore()
const stats = ref({})
const quickAccount = ref('')
const adding = ref(false)
const addResult = ref(null)

const statsCards = [
  { key: 'totalAccounts',   label: '累计采集账号', icon: 'Tickets',     color: '#1db954' },
  { key: 'totalEmployees',  label: '员工账号总数', icon: 'UserFilled',  color: '#6366f1' },
  { key: 'activeEmployees', label: '正常使用中',   icon: 'CircleCheck', color: '#0d9488' },
  { key: 'todayAccounts',   label: '今日录入量',   icon: 'Calendar',    color: '#f59e0b' },
]

onMounted(fetchStats)

async function fetchStats() {
  try {
    stats.value = (await api.get('/stats')).data
  } catch {}
}

async function quickAdd() {
  const val = quickAccount.value.trim()
  if (!val) { ElMessage.warning('请先输入采集账号'); return }

  adding.value = true
  addResult.value = null

  try {
    await api.post('/accounts', { account: val })
    addResult.value = { type: 'ok', msg: '录入成功，账号已写入数据库' }
    quickAccount.value = ''
    fetchStats()
  } catch (err) {
    addResult.value = {
      type: 'warn',
      msg: err.response?.data?.duplicate
        ? '这个账号已经存在，无需重复录入'
        : (err.response?.data?.message || '提交失败，请重试')
    }
  } finally {
    adding.value = false
    setTimeout(() => { addResult.value = null }, 4000)
  }
}
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 20px; }

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: 22px 20px 20px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
  transition: transform 0.2s var(--ease-smooth), box-shadow 0.2s var(--ease-smooth);
  cursor: default;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}
.stat-card-glow {
  position: absolute; top: 0; right: 0;
  width: 100px; height: 100px;
  background: radial-gradient(circle at top right, var(--accent), transparent 65%);
  opacity: 0.1;
  pointer-events: none;
}
.stat-icon-wrap {
  width: 40px; height: 40px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 19px;
  color: var(--accent);
  margin-bottom: 14px;
}
.stat-val {
  font-size: 30px; font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.03em; line-height: 1;
  margin-bottom: 5px;
}
.stat-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.stat-trend {
  position: absolute; top: 14px; right: 14px;
  font-size: 10px; font-weight: 700;
  color: var(--accent); opacity: 0.7;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  padding: 2px 6px; border-radius: 4px;
}

/* 功能网格 */
.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.card-hd { display: flex; align-items: center; gap: 12px; }
.card-hd-icon {
  width: 38px; height: 38px; flex-shrink: 0;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
}
.card-hd-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.card-hd-sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.quick-input-row { display: flex; gap: 10px; align-items: center; }
.quick-input-row .el-input { flex: 1; }

.result-banner {
  display: flex; align-items: center; gap: 8px;
  margin-top: 14px; padding: 10px 14px;
  border-radius: 10px; font-size: 13px; font-weight: 500;
}
.result-banner.ok  { background: rgba(29,185,84,0.08); color: #16a34a; border: 1px solid rgba(29,185,84,0.2); }
.result-banner.warn { background: rgba(245,158,11,0.08); color: #d97706; border: 1px solid rgba(245,158,11,0.2); }

.result-slide-enter-active, .result-slide-leave-active { transition: all 0.25s; }
.result-slide-enter-from, .result-slide-leave-to { opacity: 0; transform: translateY(-6px); }

/* 运行信息列表 */
.info-list { display: flex; flex-direction: column; }
.info-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 0;
  border-bottom: 1px solid var(--divider);
  font-size: 13px;
}
.info-row:last-child { border-bottom: none; padding-bottom: 0; }
.info-key { color: var(--text-secondary); }
.info-val { color: var(--text-primary); }
.info-val.bold { font-weight: 700; }

@media (max-width: 1100px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 680px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
  .dash-grid { grid-template-columns: 1fr; }
}
</style>
