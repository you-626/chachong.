<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-top">
        <div class="sidebar-brand">
          <div class="sidebar-icon">
            <el-icon><Search /></el-icon>
          </div>
          <transition name="fade-text">
            <span v-if="!collapsed" class="sidebar-title">采集查重</span>
          </transition>
        </div>
        <button class="collapse-btn" @click="collapsed = !collapsed">
          <el-icon><ArrowLeft v-if="!collapsed" /><ArrowRight v-else /></el-icon>
        </button>
      </div>

      <div class="sidebar-user">
        <div class="user-ava">{{ auth.user?.username?.charAt(0)?.toUpperCase() }}</div>
        <transition name="fade-text">
          <div v-if="!collapsed" class="user-info">
            <span class="user-name">{{ auth.user?.username }}</span>
            <span class="user-role">{{ auth.isAdmin ? '管理员' : '员工' }}</span>
          </div>
        </transition>
      </div>

      <nav class="sidebar-nav">
        <div v-if="auth.isAdmin" class="nav-group">
          <transition name="fade-text">
            <div v-if="!collapsed" class="nav-label">管理</div>
          </transition>
          <router-link to="/admin/dashboard" class="nav-link" :class="{ active: $route.path === '/admin/dashboard' }">
            <el-icon><DataBoard /></el-icon>
            <transition name="fade-text"><span v-if="!collapsed">工作台</span></transition>
            <div v-if="collapsed" class="nav-tooltip">工作台</div>
          </router-link>
          <router-link to="/admin/employees" class="nav-link" :class="{ active: $route.path === '/admin/employees' }">
            <el-icon><UserFilled /></el-icon>
            <transition name="fade-text"><span v-if="!collapsed">员工管理</span></transition>
            <div v-if="collapsed" class="nav-tooltip">员工管理</div>
          </router-link>
          <router-link to="/admin/accounts" class="nav-link" :class="{ active: $route.path === '/admin/accounts' }">
            <el-icon><Tickets /></el-icon>
            <transition name="fade-text"><span v-if="!collapsed">采集记录</span></transition>
            <div v-if="collapsed" class="nav-tooltip">采集记录</div>
          </router-link>
          <router-link to="/admin/import" class="nav-link" :class="{ active: $route.path === '/admin/import' }">
            <el-icon><Upload /></el-icon>
            <transition name="fade-text"><span v-if="!collapsed">导入数据</span></transition>
            <div v-if="collapsed" class="nav-tooltip">导入数据</div>
          </router-link>
        </div>

        <div v-else class="nav-group">
          <transition name="fade-text">
            <div v-if="!collapsed" class="nav-label">工作台</div>
          </transition>
          <router-link to="/employee/check" class="nav-link" :class="{ active: $route.path === '/employee/check' }">
            <el-icon><CircleCheck /></el-icon>
            <transition name="fade-text"><span v-if="!collapsed">录入账号</span></transition>
            <div v-if="collapsed" class="nav-tooltip">录入账号</div>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-bottom">
        <button class="logout-link" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          <transition name="fade-text">
            <span v-if="!collapsed">退出登录</span>
          </transition>
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ currentPageTitle }}</h1>
          <div class="breadcrumb">
            <span>{{ auth.isAdmin ? '管理员端' : '员工端' }}</span>
            <el-icon style="font-size:10px;color:var(--text-tertiary)"><ArrowRight /></el-icon>
            <span>{{ currentPageTitle }}</span>
          </div>
        </div>
        <div class="topbar-right">
          <div class="time-chip">
            <el-icon><Clock /></el-icon>
            <span>{{ currentTime }}</span>
          </div>
        </div>
      </header>

      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, DataBoard, UserFilled, Tickets, CircleCheck,
  SwitchButton, ArrowLeft, ArrowRight, Clock, Upload
} from '@element-plus/icons-vue'
import { useAuthStore } from '../store/auth.js'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const collapsed = ref(false)
const currentTime = ref('')

const pageTitles = {
  '/admin/dashboard': '工作台',
  '/admin/employees': '员工管理',
  '/admin/accounts': '采集记录',
  '/admin/import': '导入数据',
  '/employee/check': '账号录入'
}
const currentPageTitle = computed(() => pageTitles[route.path] || '查重系统')

let timer = null
function updateTime() {
  currentTime.value = new Date().toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}
onMounted(() => { updateTime(); timer = setInterval(updateTime, 1000) })
onUnmounted(() => clearInterval(timer))

async function handleLogout() {
  await ElMessageBox.confirm('确认退出登录？', '提示', {
    confirmButtonText: '退出', cancelButtonText: '取消', type: 'warning'
  })
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-base);
}

/* ── Sidebar ── */
.sidebar {
  width: var(--sidebar-w);
  min-width: var(--sidebar-w);
  background: #111114;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  z-index: 200;
  border-right: 1px solid rgba(255,255,255,0.05);
  transition: width 0.3s var(--ease-smooth), min-width 0.3s var(--ease-smooth);
  overflow: hidden;
}

.app-shell.sidebar-collapsed .sidebar {
  width: 64px;
  min-width: 64px;
}
.app-shell.sidebar-collapsed .main-area {
  margin-left: 64px;
}

.sidebar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.sidebar-brand {
  display: flex; align-items: center; gap: 10px;
  overflow: hidden;
}
.sidebar-icon {
  width: 34px; height: 34px; flex-shrink: 0;
  background: var(--brand-grad);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 16px;
  box-shadow: 0 4px 12px rgba(29,185,84,0.35);
}
.sidebar-title {
  font-size: 15px; font-weight: 700;
  color: white; white-space: nowrap;
  letter-spacing: -0.01em;
}
.collapse-btn {
  width: 26px; height: 26px; flex-shrink: 0;
  background: rgba(255,255,255,0.06);
  border: none; border-radius: 7px;
  cursor: pointer; color: rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  transition: all 0.2s;
}
.collapse-btn:hover {
  background: rgba(255,255,255,0.12);
  color: white;
}

.sidebar-user {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  overflow: hidden;
}
.user-ava {
  width: 34px; height: 34px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--brand-1), var(--brand-2));
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; font-size: 14px;
}
.user-info {
  display: flex; flex-direction: column;
  overflow: hidden; white-space: nowrap;
}
.user-name { color: rgba(255,255,255,0.88); font-size: 13px; font-weight: 600; }
.user-role { color: rgba(255,255,255,0.38); font-size: 11px; margin-top: 1px; }

.sidebar-nav { flex: 1; padding: 12px 10px; overflow-y: auto; overflow-x: hidden; }
.nav-group { margin-bottom: 8px; }
.nav-label {
  font-size: 10px; font-weight: 700;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.1em; text-transform: uppercase;
  padding: 6px 8px 4px;
  white-space: nowrap;
}
.nav-link {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 10px;
  border-radius: 10px;
  color: rgba(255,255,255,0.5);
  text-decoration: none;
  font-size: 14px; font-weight: 500;
  transition: all 0.18s;
  white-space: nowrap;
  margin-bottom: 2px;
  position: relative;
}
.nav-link:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
.nav-link.active {
  background: rgba(29,185,84,0.15);
  color: #4ade80;
}
.nav-link.active .el-icon { color: var(--brand-1); }
.nav-link .el-icon { font-size: 17px; flex-shrink: 0; }

.nav-tooltip {
  position: absolute; left: calc(100% + 10px); top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.85); color: white;
  padding: 4px 10px; border-radius: 7px;
  font-size: 12px; white-space: nowrap;
  pointer-events: none; opacity: 0;
  transition: opacity 0.15s;
  z-index: 999;
}
.nav-link:hover .nav-tooltip { opacity: 1; }

.sidebar-bottom {
  padding: 10px 10px 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.logout-link {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 10px;
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.4);
  font-size: 14px; font-weight: 500;
  border-radius: 10px;
  transition: all 0.18s;
  white-space: nowrap;
  font-family: inherit;
}
.logout-link:hover { background: rgba(239,68,68,0.1); color: #f87171; }
.logout-link .el-icon { font-size: 17px; flex-shrink: 0; }

/* ── Main area ── */
.main-area {
  flex: 1;
  margin-left: var(--sidebar-w);
  display: flex; flex-direction: column;
  transition: margin-left 0.3s var(--ease-smooth);
}

.topbar {
  height: var(--header-h);
  background: rgba(245,245,247,0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  padding: 0 28px;
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 100;
}
.page-title {
  font-size: 18px; font-weight: 700;
  color: var(--text-primary); letter-spacing: -0.02em;
}
.breadcrumb {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-tertiary);
  margin-top: 1px;
}
.time-chip {
  display: flex; align-items: center; gap: 6px;
  background: white; border: 1px solid var(--border);
  padding: 6px 12px; border-radius: var(--radius-full);
  font-size: 12px; color: var(--text-secondary);
  box-shadow: var(--shadow-xs);
  font-variant-numeric: tabular-nums;
}

.content {
  flex: 1;
  padding: 24px 28px;
  max-width: 1400px;
  width: 100%;
}

/* Page transition */
.page-enter-active, .page-leave-active { transition: all 0.2s var(--ease-smooth); }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; transform: translateY(-4px); }

/* Text fade for collapse */
.fade-text-enter-active, .fade-text-leave-active { transition: all 0.15s; }
.fade-text-enter-from, .fade-text-leave-to { opacity: 0; transform: translateX(-6px); }

/* Responsive */
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .app-shell.sidebar-collapsed .sidebar { transform: translateX(0); width: 64px; min-width: 64px; }
  .main-area { margin-left: 0 !important; }
  .content { padding: 16px; }
}
</style>
