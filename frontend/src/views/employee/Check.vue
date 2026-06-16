<template>
  <div class="check-page">
    <div class="check-center">

      <!-- 主操作卡片 -->
      <div class="hero-card">
        <div class="hero-top">
          <div class="hero-icon">
            <el-icon><Search /></el-icon>
          </div>
          <div class="hero-text">
            <h1>账号录入</h1>
            <p>输入或粘贴采集到的账号，系统自动判断是否已存在</p>
          </div>
        </div>

        <div class="input-zone">
          <div class="input-wrap">
            <el-input
              ref="inputRef"
              v-model="account"
              placeholder="粘贴或输入采集账号，按回车提交"
              size="large"
              :prefix-icon="Key"
              clearable
              class="main-input"
              @keyup.enter="submit"
              @input="result = null"
            />
            <el-button
              type="primary"
              size="large"
              class="submit-btn"
              :loading="checking"
              :disabled="!account.trim()"
              @click="submit"
            >
              <el-icon v-if="!checking"><ArrowRight /></el-icon>
              {{ checking ? '检测中' : '提交' }}
            </el-button>
          </div>

          <!-- 结果反馈 -->
          <transition name="result-anim">
            <div v-if="result" :class="['result-card', result.type]">
              <div class="result-icon-wrap">
                <el-icon>
                  <CircleCheck v-if="result.type === 'ok'" />
                  <Warning v-else-if="result.type === 'dup'" />
                  <CircleClose v-else />
                </el-icon>
              </div>
              <div class="result-content">
                <div class="result-title">{{ result.title }}</div>
                <div class="result-desc">{{ result.desc }}</div>
              </div>
              <div v-if="result.type === 'ok'" class="result-badge">已录入</div>
              <div v-if="result.type === 'dup'" class="result-badge dup">已拦截</div>
            </div>
          </transition>
        </div>
      </div>

      <!-- 本次会话统计 -->
      <div class="session-stats" v-if="history.length > 0 || successCount > 0">
        <div class="stat-pill stat-pill--green">
          <el-icon><CircleCheck /></el-icon>
          <span>成功录入 <strong>{{ successCount }}</strong> 条</span>
        </div>
        <div class="stat-pill stat-pill--orange" v-if="dupCount > 0">
          <el-icon><Warning /></el-icon>
          <span>重复拦截 <strong>{{ dupCount }}</strong> 条</span>
        </div>
        <div class="stat-pill stat-pill--gray">
          <el-icon><List /></el-icon>
          <span>本次共提交 <strong>{{ history.length }}</strong> 次</span>
        </div>
      </div>

      <!-- 提交历史 -->
      <div v-if="history.length > 0" class="history-wrap">
        <div class="history-header">
          <div class="history-title">
            本次记录
            <span class="history-count">{{ history.length }}</span>
          </div>
          <el-button text size="small" style="color:var(--text-tertiary)" @click="history = []">
            清空
          </el-button>
        </div>
        <div class="history-list">
          <transition-group name="list-anim">
            <div
              v-for="(item, i) in history"
              :key="item.id"
              :class="['history-item', item.type]"
            >
              <span class="hi-seq">{{ history.length - i }}</span>
              <el-icon class="hi-icon">
                <CircleCheck v-if="item.type === 'ok'" />
                <Warning v-else />
              </el-icon>
              <span class="hi-account">{{ item.account }}</span>
              <span :class="['hi-tag', item.type]">
                {{ item.type === 'ok' ? '录入成功' : '已存在' }}
              </span>
              <span class="hi-time">{{ item.time }}</span>
            </div>
          </transition-group>
        </div>
      </div>

      <!-- 初始引导，未提交过时显示 -->
      <div v-if="history.length === 0" class="guide-card">
        <div class="guide-steps">
          <div class="guide-step">
            <div class="step-num">1</div>
            <div class="step-text">
              <strong>粘贴账号</strong>
              <span>将采集到的账号复制粘贴到输入框</span>
            </div>
          </div>
          <div class="guide-arrow"><el-icon><ArrowRight /></el-icon></div>
          <div class="guide-step">
            <div class="step-num">2</div>
            <div class="step-text">
              <strong>按回车提交</strong>
              <span>系统实时与数据库比对</span>
            </div>
          </div>
          <div class="guide-arrow"><el-icon><ArrowRight /></el-icon></div>
          <div class="guide-step">
            <div class="step-num">3</div>
            <div class="step-text">
              <strong>查看结果</strong>
              <span>新账号自动录入，重复的直接拦截</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search, Key, CircleCheck, Warning, CircleClose,
  ArrowRight, List
} from '@element-plus/icons-vue'
import api from '../../api/index.js'

const account = ref('')
const checking = ref(false)
const result = ref(null)
const history = ref([])
const inputRef = ref(null)
let idCounter = 0

const successCount = computed(() => history.value.filter(h => h.type === 'ok').length)
const dupCount = computed(() => history.value.filter(h => h.type === 'dup').length)

async function submit() {
  const val = account.value.trim()
  if (!val) {
    ElMessage.warning('请输入采集账号')
    return
  }

  checking.value = true
  result.value = null

  try {
    await api.post('/accounts', { account: val })
    result.value = {
      type: 'ok',
      title: '录入成功',
      desc: `「${val}」已写入数据库`
    }
    history.value.unshift({
      id: ++idCounter,
      type: 'ok',
      account: val,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    })
    account.value = ''
  } catch (err) {
    if (err.response?.data?.duplicate) {
      result.value = {
        type: 'dup',
        title: '该账号已存在',
        desc: `「${val}」在数据库中已有记录，无需重复录入`
      }
      history.value.unshift({
        id: ++idCounter,
        type: 'dup',
        account: val,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      })
    } else {
      result.value = {
        type: 'err',
        title: '提交失败',
        desc: err.response?.data?.message || '网络异常，请检查连接后重试'
      }
    }
  } finally {
    checking.value = false
  }
}
</script>

<style scoped>
.check-page {
  display: flex;
  justify-content: center;
}
.check-center {
  width: 100%;
  max-width: 700px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 主卡片 */
.hero-card {
  background: white;
  border-radius: 20px;
  padding: 30px 30px 26px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
}
.hero-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--brand-grad);
}

.hero-top {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 24px;
}
.hero-icon {
  width: 52px; height: 52px; flex-shrink: 0;
  background: var(--brand-grad);
  border-radius: 15px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: white;
  box-shadow: 0 6px 18px rgba(29,185,84,0.28);
}
.hero-text h1 {
  font-size: 19px; font-weight: 700;
  letter-spacing: -0.02em; color: var(--text-primary);
}
.hero-text p {
  font-size: 13px; color: var(--text-secondary);
  margin-top: 3px; line-height: 1.5;
}

.input-zone { display: flex; flex-direction: column; gap: 12px; }
.input-wrap { display: flex; gap: 10px; align-items: center; }
.main-input { flex: 1; }
.main-input :deep(.el-input__inner) { font-size: 14px !important; }

.submit-btn {
  height: 42px !important;
  padding: 0 20px !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
  display: flex; align-items: center; gap: 5px;
  white-space: nowrap;
}

/* 结果反馈 */
.result-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 12px;
  border: 1px solid;
}
.result-card.ok  { background: rgba(29,185,84,0.06);  border-color: rgba(29,185,84,0.2); }
.result-card.dup { background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.2); }
.result-card.err { background: rgba(239,68,68,0.06);  border-color: rgba(239,68,68,0.2); }

.result-icon-wrap {
  width: 34px; height: 34px; flex-shrink: 0;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
}
.result-card.ok  .result-icon-wrap { background: rgba(29,185,84,0.12);  color: #16a34a; }
.result-card.dup .result-icon-wrap { background: rgba(245,158,11,0.12); color: #d97706; }
.result-card.err .result-icon-wrap { background: rgba(239,68,68,0.12);  color: #dc2626; }

.result-content { flex: 1; }
.result-title { font-size: 14px; font-weight: 700; }
.result-card.ok  .result-title { color: #15803d; }
.result-card.dup .result-title { color: #92400e; }
.result-card.err .result-title { color: #991b1b; }
.result-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.result-badge {
  font-size: 11px; font-weight: 700;
  padding: 3px 9px; border-radius: 6px;
  background: rgba(29,185,84,0.12); color: #16a34a;
  white-space: nowrap;
}
.result-badge.dup { background: rgba(245,158,11,0.12); color: #d97706; }

/* 统计胶囊 */
.session-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 99px;
  font-size: 13px; border: 1px solid;
  background: white;
}
.stat-pill strong { font-weight: 700; }
.stat-pill--green { border-color: rgba(29,185,84,0.25); color: #15803d; }
.stat-pill--orange { border-color: rgba(245,158,11,0.25); color: #92400e; }
.stat-pill--gray { border-color: var(--border); color: var(--text-secondary); }

/* 历史记录 */
.history-wrap {
  background: white;
  border-radius: 16px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.history-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 13px 18px;
  border-bottom: 1px solid var(--divider);
}
.history-title {
  font-size: 14px; font-weight: 700;
  color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
}
.history-count {
  font-size: 11px; font-weight: 700;
  background: var(--bg-input); color: var(--text-secondary);
  padding: 1px 7px; border-radius: 99px;
}
.history-list { max-height: 300px; overflow-y: auto; }

.history-item {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--divider);
  font-size: 13px;
  transition: background 0.15s;
}
.history-item:last-child { border-bottom: none; }
.history-item:hover { background: var(--bg-base); }

.hi-seq {
  width: 18px; text-align: center;
  font-size: 11px; color: var(--text-tertiary);
  font-weight: 600; flex-shrink: 0;
}
.hi-icon { font-size: 15px; flex-shrink: 0; }
.history-item.ok  .hi-icon { color: var(--brand-1); }
.history-item.dup .hi-icon { color: #f59e0b; }

.hi-account {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hi-tag {
  font-size: 11px; font-weight: 600;
  padding: 2px 7px; border-radius: 5px;
  white-space: nowrap; flex-shrink: 0;
}
.hi-tag.ok  { background: rgba(29,185,84,0.1);  color: #16a34a; }
.hi-tag.dup { background: rgba(245,158,11,0.1); color: #d97706; }
.hi-time { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; flex-shrink: 0; }

/* 引导卡片 */
.guide-card {
  background: white;
  border-radius: 16px;
  border: 1px solid var(--border);
  padding: 24px 28px;
  box-shadow: var(--shadow-sm);
}
.guide-steps {
  display: flex; align-items: center; gap: 12px;
  flex-wrap: wrap;
}
.guide-step { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 140px; }
.step-num {
  width: 28px; height: 28px; flex-shrink: 0;
  border-radius: 8px;
  background: var(--brand-grad);
  color: white; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.step-text { display: flex; flex-direction: column; gap: 2px; }
.step-text strong { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.step-text span { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
.guide-arrow {
  color: var(--text-tertiary); font-size: 14px;
  flex-shrink: 0; padding-top: 6px;
}

/* 动画 */
.result-anim-enter-active { transition: all 0.28s var(--ease-spring); }
.result-anim-enter-from { opacity: 0; transform: translateY(-8px) scale(0.98); }
.result-anim-leave-active { transition: all 0.18s; }
.result-anim-leave-to { opacity: 0; }

.list-anim-enter-active { transition: all 0.22s var(--ease-spring); }
.list-anim-enter-from { opacity: 0; transform: translateX(-10px); }

/* 响应式 */
@media (max-width: 600px) {
  .hero-card { padding: 22px 18px; }
  .guide-steps { flex-direction: column; }
  .guide-arrow { transform: rotate(90deg); align-self: center; }
}
</style>
