<template>
  <div class="page">
    <!-- Toolbar -->
    <div class="page-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="search"
          placeholder="搜索账号或采集人"
          :prefix-icon="Search"
          clearable
          style="width:240px"
          @input="handleSearch"
        />
        <span v-if="total > 0" class="total-hint">共 {{ total }} 条记录</span>
      </div>
      <div class="toolbar-right">
        <el-dropdown @command="handleExport" :loading="exporting">
          <el-button :loading="exporting">
            <el-icon><Download /></el-icon>
            导出数据
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="csv">
                <el-icon><Document /></el-icon>
                导出为 Excel（CSV）
              </el-dropdown-item>
              <el-dropdown-item command="json">
                <el-icon><Tickets /></el-icon>
                导出为 JSON
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" :icon="Plus" @click="openAdd">添加账号</el-button>
      </div>
    </div>

    <!-- Table -->
    <el-card class="table-wrap">
      <el-table v-loading="loading" :data="accounts" style="width:100%" stripe>
        <el-table-column label="序号" width="64" align="center">
          <template #default="{ $index }">
            <span class="row-idx">{{ (currentPage - 1) * pageSize + $index + 1 }}</span>
          </template>
        </el-table-column>

        <el-table-column label="采集账号" min-width="220">
          <template #default="{ row }">
            <div class="acc-cell">
              <div class="acc-badge"><el-icon><Key /></el-icon></div>
              <span class="acc-text">{{ row.account }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="采集人" width="150">
          <template #default="{ row }">
            <div class="collector-cell">
              <div class="emp-av" :style="{ background: avatarColor(row.collected_by) }">
                {{ row.collected_by.charAt(0).toUpperCase() }}
              </div>
              <span>{{ row.collected_by }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="采集时间" prop="collected_at" min-width="175">
          <template #default="{ row }">
            <span class="time-text">{{ row.collected_at }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="删除这条记录" placement="top">
              <el-button type="danger" size="small" text :icon="Delete" @click="deleteAcc(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && accounts.length === 0" class="empty-state">
        <el-icon style="font-size:48px;color:var(--text-tertiary)"><Tickets /></el-icon>
        <p>还没有采集记录</p>
        <span class="empty-sub">员工提交账号后会在这里显示</span>
      </div>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
        @change="fetchAccs"
      />
    </el-card>

    <!-- Add dialog -->
    <el-dialog v-model="addVis" title="添加采集账号" width="420px" destroy-on-close>
      <p class="dialog-desc">手动录入一条采集账号，系统会自动检测是否已存在。</p>
      <el-form ref="addRef" :model="addForm" :rules="addRules" label-width="0">
        <el-form-item prop="account">
          <el-input
            v-model="addForm.account"
            placeholder="输入采集账号"
            :prefix-icon="Key"
            size="large"
            @keyup.enter="doAdd"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVis = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="doAdd">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Delete, Key, Tickets, Download, ArrowDown, Document } from '@element-plus/icons-vue'
import api from '../../api/index.js'

const loading = ref(false)
const submitting = ref(false)
const exporting = ref(false)
const accounts = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const search = ref('')
const addVis = ref(false)
const addRef = ref(null)
const addForm = reactive({ account: '' })
const addRules = {
  account: [{ required: true, message: '账号不能为空', trigger: 'blur' }]
}

const avatarColors = ['#1db954', '#6366f1', '#f59e0b', '#0d9488', '#ec4899', '#3b82f6']
const avatarColor = (name) => avatarColors[name.charCodeAt(0) % avatarColors.length]

let searchTimer = null
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { currentPage.value = 1; fetchAccs() }, 300)
}

onMounted(fetchAccs)

async function fetchAccs() {
  loading.value = true
  try {
    const { data } = await api.get('/accounts', {
      params: { page: currentPage.value, pageSize: pageSize.value, search: search.value }
    })
    accounts.value = data.accounts
    total.value = data.total
  } finally {
    loading.value = false
  }
}

// ── 导出 ──────────────────────────────────────────────────────────────────────
async function handleExport(format) {
  exporting.value = true
  try {
    // 直接通过 a 标签触发下载，带上 token
    const token = localStorage.getItem('token')
    const params = new URLSearchParams({ format, search: search.value })
    const url = `/api/export?${params.toString()}`

    // 用 fetch 下载，带鉴权头
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!resp.ok) { ElMessage.error('导出失败，请重试'); return }

    const blob = await resp.blob()
    const fileName = format === 'csv'
      ? `采集账号_${formatDate()}.csv`
      : `采集账号_${formatDate()}.json`

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    const label = format === 'csv' ? 'Excel（CSV）' : 'JSON'
    ElMessage.success(`已导出为 ${label} 格式，共 ${total.value} 条`)
  } catch {
    ElMessage.error('导出时遇到问题，请检查网络后重试')
  } finally {
    exporting.value = false
  }
}

function formatDate() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
}

function openAdd() {
  addForm.account = ''
  addVis.value = true
}

async function doAdd() {
  await addRef.value?.validate()
  submitting.value = true
  try {
    await api.post('/accounts', { account: addForm.account.trim() })
    ElMessage.success('添加成功')
    addVis.value = false
    fetchAccs()
  } catch (e) {
    if (e.response?.data?.duplicate) {
      ElMessage.warning('这个账号已经在库里了，不用重复添加')
    } else {
      ElMessage.error(e.response?.data?.message || '添加失败，请重试')
    }
  } finally {
    submitting.value = false
  }
}

async function deleteAcc(row) {
  await ElMessageBox.confirm(
    `确认删除「${row.account}」这条记录？删除后不可恢复。`,
    '删除确认',
    { type: 'error', confirmButtonText: '确认删除', cancelButtonText: '取消' }
  )
  try {
    await api.delete(`/accounts/${row.id}`)
    ElMessage.success('已删除')
    fetchAccs()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }

.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.toolbar-left { display: flex; align-items: center; gap: 12px; }
.toolbar-right { display: flex; align-items: center; gap: 10px; }

.total-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.table-wrap { min-height: 300px; }
.row-idx { font-size: 12px; color: var(--text-tertiary); font-weight: 500; }

.acc-cell { display: flex; align-items: center; gap: 10px; }
.acc-badge {
  width: 28px; height: 28px; flex-shrink: 0;
  background: rgba(29,185,84,0.1);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: var(--brand-1); font-size: 13px;
}
.acc-text {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.collector-cell { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-primary); }
.emp-av {
  width: 26px; height: 26px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; font-size: 11px; flex-shrink: 0;
}

.time-text { font-size: 13px; color: var(--text-secondary); }

.empty-state {
  text-align: center; padding: 64px 0 48px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.empty-state p { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.empty-sub { font-size: 13px; color: var(--text-tertiary); }

.dialog-desc {
  font-size: 13px; color: var(--text-secondary);
  margin-bottom: 18px; line-height: 1.6;
}
</style>
