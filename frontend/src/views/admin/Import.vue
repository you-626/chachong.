<template>
  <div class="import-page">

    <!-- ── 步骤条 ── -->
    <div class="steps-bar">
      <div v-for="(s, i) in steps" :key="i"
        :class="['step-item', { active: step === i, done: step > i }]">
        <div class="step-circle">
          <el-icon v-if="step > i"><Check /></el-icon>
          <span v-else>{{ i + 1 }}</span>
        </div>
        <span class="step-label">{{ s }}</span>
        <div v-if="i < steps.length - 1" class="step-line"></div>
      </div>
    </div>

    <!-- ══ 步骤 0：上传文件 ══ -->
    <transition name="fade-step" mode="out-in">
    <div v-if="step === 0" key="s0" class="step-card">
      <div class="step-card-header">
        <div class="step-icon" style="background:rgba(99,102,241,0.1);color:#6366f1">
          <el-icon><Upload /></el-icon>
        </div>
        <div>
          <div class="step-title">上传 Excel 文件</div>
          <div class="step-sub">支持 .xlsx / .xls / .csv，文件大小上限 50MB，支持 10 万行以上数据</div>
        </div>
      </div>

      <div
        class="drop-zone"
        :class="{ dragover: isDragging, 'has-file': !!uploadFile }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="onDrop"
        @click="triggerPick"
      >
        <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="onFilePick" />

        <template v-if="!uploadFile">
          <div class="drop-icon"><el-icon><FolderOpened /></el-icon></div>
          <div class="drop-title">点击选择文件，或将文件拖拽到这里</div>
          <div class="drop-sub">Excel (.xlsx .xls) 或 CSV 格式均可</div>
        </template>

        <template v-else>
          <div class="file-preview">
            <div class="file-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="file-info">
              <div class="file-name">{{ uploadFile.name }}</div>
              <div class="file-size">{{ formatSize(uploadFile.size) }}</div>
            </div>
            <el-button text type="danger" :icon="Close" @click.stop="clearFile" />
          </div>
        </template>
      </div>

      <div class="step-footer">
        <div></div>
        <el-button type="primary" size="large" :loading="previewing" :disabled="!uploadFile" @click="doPreview">
          解析文件，下一步
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- ══ 步骤 1：字段映射 ══ -->
    <div v-else-if="step === 1" key="s1" class="step-card">
      <div class="step-card-header">
        <div class="step-icon" style="background:rgba(29,185,84,0.1);color:var(--brand-1)">
          <el-icon><Setting /></el-icon>
        </div>
        <div>
          <div class="step-title">字段映射</div>
          <div class="step-sub">
            识别到 <strong>{{ previewData.totalRows }}</strong> 条数据，
            {{ previewData.headers.length }} 列字段——指定哪一列是「账号」，其余字段可选择性保留
          </div>
        </div>
      </div>

      <!-- 映射区 -->
      <div class="mapping-section">
        <div class="mapping-row required">
          <div class="mapping-label">
            <span class="required-dot"></span>
            账号字段 <span class="mapping-tag">必填</span>
          </div>
          <el-select v-model="mapping.accountField" placeholder="选择对应「账号」的列" style="width:260px">
            <el-option v-for="h in previewData.headers" :key="h" :label="h" :value="h" />
          </el-select>
          <div class="mapping-tip">该列的值将作为去重依据</div>
        </div>

        <div class="mapping-divider">
          <span>附加字段（可选）</span>
        </div>

        <div class="extra-fields-grid">
          <div
            v-for="h in extraCandidates"
            :key="h"
            :class="['extra-field-chip', { selected: mapping.extraFields.includes(h) }]"
            @click="toggleExtra(h)"
          >
            <el-icon v-if="mapping.extraFields.includes(h)"><Check /></el-icon>
            <el-icon v-else><Plus /></el-icon>
            {{ h }}
          </div>
        </div>
        <div class="extra-tip">勾选的字段会随账号一起保存，导出时也会包含这些列</div>
      </div>

      <!-- 数据预览 -->
      <div class="preview-section">
        <div class="preview-title">数据预览（前 {{ previewData.preview.length }} 行）</div>
        <div class="preview-table-wrap">
          <table class="preview-table">
            <thead>
              <tr>
                <th v-for="h in previewData.headers" :key="h"
                  :class="{
                    'col-account': h === mapping.accountField,
                    'col-extra': mapping.extraFields.includes(h),
                    'col-ignored': h !== mapping.accountField && !mapping.extraFields.includes(h)
                  }">
                  <div class="th-inner">
                    <span>{{ h }}</span>
                    <span v-if="h === mapping.accountField" class="col-badge account">账号</span>
                    <span v-else-if="mapping.extraFields.includes(h)" class="col-badge extra">附加</span>
                    <span v-else class="col-badge ignored">忽略</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in previewData.preview" :key="ri">
                <td v-for="h in previewData.headers" :key="h"
                  :class="{
                    'col-account': h === mapping.accountField,
                    'col-extra': mapping.extraFields.includes(h),
                    'col-ignored': h !== mapping.accountField && !mapping.extraFields.includes(h)
                  }">
                  {{ row[h] ?? '' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 方案保存 -->
      <div class="schema-save">
        <el-checkbox v-model="saveSchema">保存此次字段映射为方案，下次直接复用</el-checkbox>
        <el-input v-if="saveSchema" v-model="schemaName" placeholder="方案名称，例如：微信号导入" style="width:240px;margin-left:12px" />
      </div>

      <div class="step-footer">
        <el-button @click="step = 0">上一步</el-button>
        <el-button type="primary" size="large" :disabled="!mapping.accountField" @click="step = 2">
          确认映射，开始导入
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- ══ 步骤 2：执行导入 ══ -->
    <div v-else-if="step === 2" key="s2" class="step-card">
      <div class="step-card-header">
        <div class="step-icon" :style="importDone ? 'background:rgba(29,185,84,0.1);color:#16a34a' : 'background:rgba(99,102,241,0.1);color:#6366f1'">
          <el-icon><Loading v-if="importing" /><CircleCheck v-else-if="importDone" /><Upload v-else /></el-icon>
        </div>
        <div>
          <div class="step-title">{{ importing ? '正在导入中...' : importDone ? '导入完成' : '准备导入' }}</div>
          <div class="step-sub">
            <template v-if="!importing && !importDone">
              共 <strong>{{ previewData.totalRows }}</strong> 条数据，账号字段：<strong>{{ mapping.accountField }}</strong>
              <span v-if="mapping.extraFields.length">，附加字段：{{ mapping.extraFields.join('、') }}</span>
            </template>
            <template v-else-if="importing">
              正在写入数据库，请勿关闭页面
            </template>
            <template v-else>
              文件「{{ uploadFile?.name }}」已处理完毕
            </template>
          </div>
        </div>
      </div>

      <!-- 进度区 -->
      <div class="progress-area">
        <!-- 主进度条 -->
        <div class="progress-bar-wrap">
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              :class="{ pulse: importing }"
              :style="{ width: progress.percent + '%' }"
            ></div>
          </div>
          <div class="progress-percent">{{ progress.percent }}%</div>
        </div>

        <!-- 阶段标签 -->
        <div class="progress-phases">
          <div v-for="phase in phases" :key="phase.key"
            :class="['phase-tag', phase.status]">
            <el-icon>
              <Loading v-if="phase.status === 'running'" />
              <Check v-else-if="phase.status === 'done'" />
              <component :is="phase.icon" v-else />
            </el-icon>
            {{ phase.label }}
          </div>
        </div>

        <!-- 实时数字 -->
        <div class="progress-stats">
          <div class="pstat">
            <div class="pstat-val">{{ progress.total.toLocaleString() }}</div>
            <div class="pstat-key">总行数</div>
          </div>
          <div class="pstat pstat--green">
            <div class="pstat-val">{{ progress.inserted.toLocaleString() }}</div>
            <div class="pstat-key">成功写入</div>
          </div>
          <div class="pstat pstat--orange">
            <div class="pstat-val">{{ progress.skipped.toLocaleString() }}</div>
            <div class="pstat-key">重复跳过</div>
          </div>
          <div class="pstat pstat--gray">
            <div class="pstat-val">{{ progress.current.toLocaleString() }}</div>
            <div class="pstat-key">已处理</div>
          </div>
          <div class="pstat pstat--blue">
            <div class="pstat-val">{{ progress.elapsed }}s</div>
            <div class="pstat-key">已用时</div>
          </div>
          <div class="pstat pstat--purple" v-if="importing && progress.speed > 0">
            <div class="pstat-val">{{ progress.speed.toLocaleString() }}</div>
            <div class="pstat-key">条/秒</div>
          </div>
        </div>

        <!-- 完成结果卡 -->
        <transition name="result-anim">
          <div v-if="importDone" class="result-summary">
            <div class="result-row result-row--green">
              <el-icon><CircleCheck /></el-icon>
              <span>成功写入 <strong>{{ importResult.inserted.toLocaleString() }}</strong> 条新账号</span>
            </div>
            <div class="result-row result-row--orange" v-if="importResult.skipped > 0">
              <el-icon><Warning /></el-icon>
              <span>跳过 <strong>{{ importResult.skipped.toLocaleString() }}</strong> 条（重复或空值）</span>
            </div>
            <div class="result-row result-row--gray">
              <el-icon><Clock /></el-icon>
              <span>总耗时 <strong>{{ progress.elapsed }}</strong> 秒，平均 <strong>{{ Math.round(importResult.total / Math.max(progress.elapsed, 1)).toLocaleString() }}</strong> 条/秒</span>
            </div>
            <div v-if="importResult.errors && importResult.errors.length > 0" class="result-errors">
              <div class="errors-title">部分批次出现异常（不影响其他数据）：</div>
              <div v-for="(e, i) in importResult.errors" :key="i" class="error-item">{{ e }}</div>
            </div>
          </div>
        </transition>
      </div>

      <div class="step-footer">
        <el-button v-if="!importing && !importDone" @click="step = 1">返回调整</el-button>
        <el-button v-if="!importing && !importDone" type="primary" size="large" @click="doImport">
          <el-icon><Upload /></el-icon>
          开始导入 {{ previewData.totalRows.toLocaleString() }} 条数据
        </el-button>
        <template v-if="importDone">
          <el-button @click="resetAll">重新导入</el-button>
          <el-button type="primary" @click="$router.push('/admin/accounts')">查看采集记录</el-button>
        </template>
      </div>
    </div>
    </transition>

    <!-- ── 历史记录 & 保存的方案 ── -->
    <div class="bottom-grid">
      <!-- 导入历史 -->
      <el-card class="history-card">
        <template #header>
          <div class="card-hd">
            <div class="card-hd-icon" style="background:rgba(245,158,11,0.1);color:#d97706">
              <el-icon><Clock /></el-icon>
            </div>
            <div>
              <div class="card-hd-title">最近导入记录</div>
              <div class="card-hd-sub">最近 20 次导入</div>
            </div>
          </div>
        </template>
        <div v-if="importLogs.length === 0" class="mini-empty">暂无记录</div>
        <div v-else class="log-list">
          <div v-for="log in importLogs" :key="log.id" class="log-item">
            <div class="log-main">
              <span class="log-file">{{ log.filename || '未知文件' }}</span>
              <span class="log-schema">{{ log.schema_name }}</span>
            </div>
            <div class="log-meta">
              <span class="log-tag green">+{{ log.inserted }}</span>
              <span class="log-tag orange" v-if="log.skipped > 0">跳{{ log.skipped }}</span>
              <span class="log-time">{{ log.created_at }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 保存的方案 -->
      <el-card class="schema-card">
        <template #header>
          <div class="card-hd">
            <div class="card-hd-icon" style="background:rgba(99,102,241,0.1);color:#6366f1">
              <el-icon><Files /></el-icon>
            </div>
            <div>
              <div class="card-hd-title">字段映射方案</div>
              <div class="card-hd-sub">点击方案可快速填充映射配置</div>
            </div>
          </div>
        </template>
        <div v-if="schemas.length === 0" class="mini-empty">还没有保存任何方案</div>
        <div v-else class="schema-list">
          <div v-for="schema in schemas" :key="schema.id" class="schema-item" @click="applySchema(schema)">
            <div class="schema-info">
              <div class="schema-name">{{ schema.name }}</div>
              <div class="schema-detail">账号字段：{{ schema.account_field }}
                <span v-if="schema.extra_fields.length">｜附加：{{ schema.extra_fields.join('、') }}</span>
              </div>
            </div>
            <el-button text type="danger" size="small" :icon="Delete"
              @click.stop="deleteSchema(schema.id)" />
          </div>
        </div>
      </el-card>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload, ArrowRight, Check, Setting, FolderOpened,
  Document, Close, Plus, Loading, CircleCheck, Warning,
  Clock, Files, Delete
} from '@element-plus/icons-vue'

const token = () => localStorage.getItem('token')

// ── 状态 ──────────────────────────────────────────────────────────────────────
const step = ref(0)
const steps = ['上传文件', '字段映射', '执行导入']

const fileInput = ref(null)
const uploadFile = ref(null)
const isDragging = ref(false)
const previewing = ref(false)
const importing = ref(false)
const importDone = ref(false)

const previewData = reactive({
  headers: [], preview: [], totalRows: 0, filename: ''
})

const mapping = reactive({ accountField: '', extraFields: [] })
const saveSchema = ref(false)
const schemaName = ref('')

const progress = reactive({
  percent: 0, current: 0, total: 0,
  inserted: 0, skipped: 0,
  elapsed: 0, speed: 0
})

const importResult = ref({})
const importLogs = ref([])
const schemas = ref([])

// 进度阶段
const phases = reactive([
  { key: 'parse',  label: '解析文件',  icon: 'Document', status: 'pending' },
  { key: 'write',  label: '写入数据库', icon: 'Upload',   status: 'pending' },
  { key: 'dedup',  label: '去重处理',  icon: 'Check',    status: 'pending' },
  { key: 'done',   label: '完成',      icon: 'CircleCheck', status: 'pending' },
])

const extraCandidates = computed(() =>
  previewData.headers.filter(h => h !== mapping.accountField)
)

// ── 文件处理 ──────────────────────────────────────────────────────────────────
function triggerPick() { fileInput.value?.click() }
function onFilePick(e) { const f = e.target.files[0]; if (f) uploadFile.value = f }
function onDrop(e) {
  isDragging.value = false
  const f = e.dataTransfer.files[0]
  if (f) uploadFile.value = f
}
function clearFile(e) {
  e?.stopPropagation()
  uploadFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ── 步骤0：预览解析 ───────────────────────────────────────────────────────────
async function doPreview() {
  if (!uploadFile.value) return
  previewing.value = true
  try {
    const fd = new FormData()
    fd.append('file', uploadFile.value)
    const resp = await fetch('/api/import/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body: fd
    })
    const data = await resp.json()
    if (!resp.ok) { ElMessage.error(data.message || '解析失败'); return }

    previewData.headers = data.headers
    previewData.preview = data.preview
    previewData.totalRows = data.totalRows
    previewData.filename = data.filename

    // 智能猜测账号字段
    const accountKeywords = ['账号', 'account', 'username', 'user', 'phone', '手机', '微信', 'wx']
    const guessed = data.headers.find(h =>
      accountKeywords.some(k => h.toLowerCase().includes(k))
    )
    mapping.accountField = guessed || data.headers[0] || ''
    mapping.extraFields = []

    step.value = 1
  } catch (err) {
    ElMessage.error('文件解析失败，请检查文件格式')
  } finally {
    previewing.value = false
  }
}

// ── 字段映射操作 ──────────────────────────────────────────────────────────────
function toggleExtra(field) {
  const idx = mapping.extraFields.indexOf(field)
  if (idx >= 0) mapping.extraFields.splice(idx, 1)
  else mapping.extraFields.push(field)
}

function applySchema(schema) {
  mapping.accountField = schema.account_field
  mapping.extraFields = [...(schema.extra_fields || [])]
  ElMessage.success(`已应用方案「${schema.name}」`)
}

// ── 步骤2：执行导入（前端模拟进度 + 后端实际处理）────────────────────────────
async function doImport() {
  if (!uploadFile.value || !mapping.accountField) return
  importing.value = true
  importDone.value = false

  // 重置进度
  Object.assign(progress, { percent: 0, current: 0, total: previewData.totalRows, inserted: 0, skipped: 0, elapsed: 0, speed: 0 })
  phases.forEach(p => p.status = 'pending')

  // 进度模拟器：在等待服务端响应期间给用户反馈
  const startTime = Date.now()
  phases[0].status = 'running'

  // 模拟阶段动画
  const simulateProgress = () => {
    const elapsed = (Date.now() - startTime) / 1000
    progress.elapsed = Math.round(elapsed)

    // 文件解析阶段（0~15%）
    if (progress.percent < 15) {
      progress.percent = Math.min(15, progress.percent + 2)
      if (progress.percent >= 10) { phases[0].status = 'done'; phases[1].status = 'running' }
    }
    // 写入阶段（15~85%，模拟线性增长）
    else if (progress.percent < 85) {
      const speed = Math.max(200, 5000 / Math.max(elapsed, 1))
      const increment = (speed / previewData.totalRows) * 100 * 0.5
      progress.percent = Math.min(85, progress.percent + increment)
      progress.current = Math.round((progress.percent / 85) * previewData.totalRows * 0.85)
      progress.speed = Math.round(progress.current / Math.max(elapsed, 0.1))
      if (progress.percent >= 50) phases[2].status = 'running'
    }
  }

  const timer = setInterval(simulateProgress, 200)

  try {
    // 可选：保存字段方案
    if (saveSchema.value && schemaName.value.trim()) {
      await fetch('/api/schemas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schemaName.value.trim(),
          account_field: mapping.accountField,
          extra_fields: mapping.extraFields
        })
      })
    }

    // 发送实际导入请求
    const fd = new FormData()
    fd.append('file', uploadFile.value)
    fd.append('account_field', mapping.accountField)
    fd.append('extra_fields', JSON.stringify(mapping.extraFields))
    fd.append('schema_name', schemaName.value || '手动导入')

    const resp = await fetch('/api/import/execute', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body: fd
    })
    const result = await resp.json()

    clearInterval(timer)

    if (!resp.ok) {
      ElMessage.error(result.message || '导入失败')
      importing.value = false
      return
    }

    // 完成动画
    progress.percent = 100
    progress.current = result.total
    progress.inserted = result.inserted
    progress.skipped = result.skipped
    progress.total = result.total
    progress.elapsed = Math.round((Date.now() - startTime) / 1000)
    progress.speed = Math.round(result.total / Math.max(progress.elapsed, 1))

    phases[1].status = 'done'
    phases[2].status = 'done'
    phases[3].status = 'done'

    importResult.value = result
    importDone.value = true
    importing.value = false

    ElMessage.success(`导入完成：成功 ${result.inserted} 条，跳过 ${result.skipped} 条`)
    fetchLogs()
    fetchSchemas()

  } catch (err) {
    clearInterval(timer)
    importing.value = false
    ElMessage.error('导入请求失败，请检查网络后重试')
  }
}

function resetAll() {
  step.value = 0
  uploadFile.value = null
  importing.value = false
  importDone.value = false
  Object.assign(previewData, { headers: [], preview: [], totalRows: 0 })
  Object.assign(mapping, { accountField: '', extraFields: [] })
  Object.assign(progress, { percent: 0, current: 0, total: 0, inserted: 0, skipped: 0, elapsed: 0, speed: 0 })
  phases.forEach(p => p.status = 'pending')
  importResult.value = {}
  saveSchema.value = false
  schemaName.value = ''
}

async function fetchLogs() {
  try {
    const resp = await fetch('/api/import/logs', {
      headers: { Authorization: `Bearer ${token()}` }
    })
    importLogs.value = await resp.json()
  } catch {}
}

async function fetchSchemas() {
  try {
    const resp = await fetch('/api/schemas', {
      headers: { Authorization: `Bearer ${token()}` }
    })
    schemas.value = await resp.json()
  } catch {}
}

async function deleteSchema(id) {
  await ElMessageBox.confirm('确认删除这个字段方案？', '删除方案', {
    type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消'
  })
  try {
    await fetch(`/api/schemas/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    })
    ElMessage.success('方案已删除')
    fetchSchemas()
  } catch {
    ElMessage.error('删除失败')
  }
}

onMounted(() => { fetchLogs(); fetchSchemas() })
</script>

<style scoped>
.import-page {
  display: flex; flex-direction: column; gap: 20px;
  max-width: 960px;
}

/* ── 步骤条 ── */
.steps-bar {
  display: flex; align-items: center;
  background: white;
  border-radius: var(--radius-xl);
  padding: 18px 28px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.step-item {
  display: flex; align-items: center; gap: 10px;
  flex: 1; position: relative;
}
.step-circle {
  width: 32px; height: 32px; flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: var(--text-tertiary);
  transition: all 0.3s;
}
.step-item.active .step-circle {
  border-color: var(--brand-1);
  background: var(--brand-1);
  color: white;
  box-shadow: 0 0 0 4px rgba(29,185,84,0.15);
}
.step-item.done .step-circle {
  border-color: var(--brand-1);
  background: var(--brand-1);
  color: white;
}
.step-label {
  font-size: 13px; font-weight: 600;
  color: var(--text-tertiary);
  white-space: nowrap;
  transition: color 0.3s;
}
.step-item.active .step-label, .step-item.done .step-label {
  color: var(--text-primary);
}
.step-line {
  flex: 1; height: 2px;
  background: var(--border);
  margin: 0 12px;
  border-radius: 1px;
  transition: background 0.3s;
}
.step-item.done .step-line { background: var(--brand-1); }

/* ── 步骤卡片 ── */
.step-card {
  background: white;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.step-card-header {
  display: flex; align-items: center; gap: 16px;
  padding: 22px 28px;
  border-bottom: 1px solid var(--divider);
  background: linear-gradient(180deg, #fafafa 0%, white 100%);
}
.step-icon {
  width: 44px; height: 44px; flex-shrink: 0;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.step-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.step-sub { font-size: 13px; color: var(--text-secondary); margin-top: 3px; line-height: 1.5; }
.step-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 28px;
  border-top: 1px solid var(--divider);
  background: #fafafa;
}

/* ── 拖拽上传区 ── */
.drop-zone {
  margin: 24px 28px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 52px 28px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-base);
}
.drop-zone:hover, .drop-zone.dragover {
  border-color: var(--brand-1);
  background: rgba(29,185,84,0.04);
}
.drop-zone.has-file {
  padding: 20px 28px;
  border-style: solid;
  border-color: var(--brand-1);
  background: rgba(29,185,84,0.04);
}
.drop-icon { font-size: 48px; color: var(--text-tertiary); margin-bottom: 12px; }
.drop-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.drop-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 6px; }

.file-preview {
  display: flex; align-items: center; gap: 14px; justify-content: center;
}
.file-icon {
  width: 44px; height: 44px;
  background: rgba(29,185,84,0.1);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; color: var(--brand-1);
}
.file-info { text-align: left; }
.file-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.file-size { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

/* ── 字段映射 ── */
.mapping-section { padding: 20px 28px; }
.mapping-row {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid var(--border);
  flex-wrap: wrap;
}
.mapping-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  width: 140px; flex-shrink: 0;
}
.required-dot { width: 6px; height: 6px; background: #ef4444; border-radius: 50%; }
.mapping-tag {
  font-size: 10px; font-weight: 700; color: #ef4444;
  background: rgba(239,68,68,0.1); padding: 1px 6px;
  border-radius: 4px;
}
.mapping-tip { font-size: 12px; color: var(--text-tertiary); }

.mapping-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 18px 0 14px;
  font-size: 12px; font-weight: 600; color: var(--text-tertiary);
  letter-spacing: 0.05em;
}
.mapping-divider::before, .mapping-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--divider);
}

.extra-fields-grid {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.extra-field-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 8px;
  font-size: 13px; font-weight: 500;
  border: 1.5px solid var(--border);
  background: white; color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s;
  user-select: none;
}
.extra-field-chip:hover { border-color: var(--brand-1); color: var(--brand-1); }
.extra-field-chip.selected {
  border-color: var(--brand-1);
  background: rgba(29,185,84,0.08);
  color: #16a34a;
  font-weight: 600;
}
.extra-tip { font-size: 12px; color: var(--text-tertiary); margin-top: 10px; }

/* ── 数据预览表格 ── */
.preview-section { padding: 0 28px 20px; }
.preview-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; }
.preview-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
.preview-table {
  width: 100%; border-collapse: collapse;
  font-size: 12px;
}
.preview-table th {
  padding: 8px 12px;
  font-weight: 700; font-size: 11px; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--divider);
  white-space: nowrap;
}
.preview-table td {
  padding: 7px 12px; border-bottom: 1px solid var(--divider);
  white-space: nowrap; max-width: 160px;
  overflow: hidden; text-overflow: ellipsis;
}
.preview-table tr:last-child td { border-bottom: none; }

.col-account { background: rgba(29,185,84,0.06) !important; }
.col-extra   { background: rgba(99,102,241,0.04) !important; }
.col-ignored { opacity: 0.45; }

.th-inner { display: flex; align-items: center; gap: 6px; }
.col-badge {
  font-size: 10px; font-weight: 700; padding: 1px 5px;
  border-radius: 4px; white-space: nowrap;
}
.col-badge.account { background: rgba(29,185,84,0.15); color: #15803d; }
.col-badge.extra   { background: rgba(99,102,241,0.12); color: #4338ca; }
.col-badge.ignored { background: rgba(0,0,0,0.06); color: var(--text-tertiary); }

/* ── 方案保存 ── */
.schema-save {
  display: flex; align-items: center; gap: 0;
  padding: 14px 28px;
  border-top: 1px solid var(--divider);
  background: #fafafa;
  flex-wrap: wrap; gap: 8px;
}

/* ── 进度区 ── */
.progress-area {
  padding: 24px 28px 8px;
  display: flex; flex-direction: column; gap: 20px;
}

.progress-bar-wrap {
  display: flex; align-items: center; gap: 14px;
}
.progress-bar-track {
  flex: 1; height: 10px;
  background: var(--bg-input);
  border-radius: 99px; overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--brand-grad);
  border-radius: 99px;
  transition: width 0.4s var(--ease-smooth);
}
.progress-bar-fill.pulse {
  animation: pulse-glow 1.5s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(29,185,84,0.4); }
  50% { box-shadow: 0 0 8px 2px rgba(29,185,84,0.3); }
}
.progress-percent {
  font-size: 16px; font-weight: 800;
  color: var(--brand-1); width: 44px; text-align: right;
  font-variant-numeric: tabular-nums;
}

.progress-phases { display: flex; gap: 8px; flex-wrap: wrap; }
.phase-tag {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 99px;
  font-size: 12px; font-weight: 600;
  border: 1.5px solid var(--border);
  color: var(--text-tertiary); background: white;
  transition: all 0.3s;
}
.phase-tag.running {
  border-color: var(--brand-1);
  color: var(--brand-1);
  background: rgba(29,185,84,0.06);
  animation: phase-pulse 1s ease-in-out infinite;
}
.phase-tag.done {
  border-color: rgba(29,185,84,0.3);
  color: #16a34a;
  background: rgba(29,185,84,0.06);
}
@keyframes phase-pulse {
  0%, 100% { opacity: 1; } 50% { opacity: 0.6; }
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}
.pstat {
  background: var(--bg-base);
  border-radius: 10px; padding: 12px 10px;
  text-align: center;
  border: 1px solid var(--border);
}
.pstat-val {
  font-size: 20px; font-weight: 800;
  color: var(--text-primary); line-height: 1;
  font-variant-numeric: tabular-nums;
}
.pstat-key { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }
.pstat--green .pstat-val { color: #16a34a; }
.pstat--orange .pstat-val { color: #d97706; }
.pstat--gray .pstat-val { color: var(--text-secondary); }
.pstat--blue .pstat-val { color: #2563eb; }
.pstat--purple .pstat-val { color: #7c3aed; }

.result-summary {
  background: #f0fdf4;
  border: 1px solid rgba(29,185,84,0.2);
  border-radius: 12px; padding: 18px 20px;
  display: flex; flex-direction: column; gap: 10px;
}
.result-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 500;
}
.result-row--green { color: #15803d; }
.result-row--orange { color: #92400e; }
.result-row--gray { color: var(--text-secondary); }
.result-errors { margin-top: 4px; }
.errors-title { font-size: 12px; font-weight: 600; color: #dc2626; margin-bottom: 6px; }
.error-item {
  font-size: 12px; color: #dc2626;
  background: rgba(239,68,68,0.06);
  padding: 4px 8px; border-radius: 5px; margin-bottom: 3px;
}

/* ── 底部两栏 ── */
.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.card-hd { display: flex; align-items: center; gap: 12px; }
.card-hd-icon {
  width: 36px; height: 36px; flex-shrink: 0;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.card-hd-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.card-hd-sub { font-size: 12px; color: var(--text-secondary); margin-top: 1px; }

.mini-empty {
  text-align: center; padding: 24px;
  font-size: 13px; color: var(--text-tertiary);
}

.log-list { display: flex; flex-direction: column; gap: 2px; }
.log-item {
  display: flex; flex-direction: column; gap: 4px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--divider);
  font-size: 12px;
}
.log-item:last-child { border-bottom: none; }
.log-main { display: flex; align-items: center; gap: 8px; }
.log-file { font-weight: 600; color: var(--text-primary); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-schema {
  font-size: 11px; background: rgba(99,102,241,0.1); color: #4338ca;
  padding: 1px 6px; border-radius: 4px;
}
.log-meta { display: flex; align-items: center; gap: 6px; }
.log-tag {
  font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px;
}
.log-tag.green { background: rgba(29,185,84,0.1); color: #16a34a; }
.log-tag.orange { background: rgba(245,158,11,0.1); color: #d97706; }
.log-time { font-size: 11px; color: var(--text-tertiary); margin-left: auto; }

.schema-list { display: flex; flex-direction: column; gap: 4px; }
.schema-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--border);
  cursor: pointer; transition: all 0.15s;
}
.schema-item:hover {
  border-color: var(--brand-1);
  background: rgba(29,185,84,0.04);
}
.schema-info { flex: 1; min-width: 0; }
.schema-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.schema-detail {
  font-size: 11px; color: var(--text-tertiary); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── 动画 ── */
.fade-step-enter-active, .fade-step-leave-active { transition: all 0.22s; }
.fade-step-enter-from { opacity: 0; transform: translateX(16px); }
.fade-step-leave-to   { opacity: 0; transform: translateX(-16px); }

.result-anim-enter-active { transition: all 0.4s var(--ease-spring); }
.result-anim-enter-from { opacity: 0; transform: translateY(12px) scale(0.97); }

/* 响应式 */
@media (max-width: 760px) {
  .progress-stats { grid-template-columns: repeat(3, 1fr); }
  .bottom-grid { grid-template-columns: 1fr; }
  .step-card-header, .mapping-section, .preview-section,
  .schema-save, .progress-area, .step-footer { padding-left: 18px; padding-right: 18px; }
  .drop-zone { margin: 16px 18px; }
}
</style>
