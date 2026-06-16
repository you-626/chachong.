<template>
  <div class="page">
    <div class="page-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="search"
          placeholder="搜索员工用户名"
          :prefix-icon="Search"
          clearable
          style="width:220px"
          @input="handleSearch"
        />
        <span v-if="employees.length > 0" class="total-hint">共 {{ employees.length }} 名员工</span>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">创建员工账号</el-button>
    </div>

    <el-card class="table-wrap">
      <el-table
        v-loading="loading"
        :data="employees"
        style="width:100%"
        stripe
      >
        <el-table-column label="员工信息" min-width="200">
          <template #default="{ row }">
            <div class="emp-cell">
              <div class="emp-av" :style="{ background: avatarColor(row.username) }">
                {{ row.username.charAt(0).toUpperCase() }}
              </div>
              <div>
                <div class="emp-name">{{ row.username }}</div>
                <div class="emp-id">ID · {{ row.id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="账号状态" width="110" align="center">
          <template #default="{ row }">
            <span :class="row.status === 'active' ? 'tag-active' : 'tag-suspended'">
              <span class="dot" :class="row.status === 'active' ? 'dot-green' : 'dot-red'"></span>
              {{ row.status === 'active' ? '正常' : '已停用' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" prop="created_at" min-width="168">
          <template #default="{ row }">
            <span class="time-text">{{ row.created_at }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" align="right" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <el-tooltip
                :content="row.status === 'active' ? '停用账号，员工将无法登录' : '恢复账号使用'"
                placement="top"
              >
                <el-button
                  :type="row.status === 'active' ? 'warning' : 'success'"
                  size="small" text
                  :icon="row.status === 'active' ? VideoPause : VideoPlay"
                  @click="toggleStatus(row)"
                />
              </el-tooltip>
              <el-tooltip content="修改登录密码" placement="top">
                <el-button type="primary" size="small" text :icon="EditPen" @click="openEditPwd(row)" />
              </el-tooltip>
              <el-tooltip content="重置密码为 123456" placement="top">
                <el-button type="info" size="small" text :icon="Refresh" @click="resetPwd(row)" />
              </el-tooltip>
              <el-tooltip content="删除这个账号" placement="top">
                <el-button type="danger" size="small" text :icon="Delete" @click="deleteEmp(row)" />
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && employees.length === 0" class="empty-state">
        <el-icon style="font-size:48px;color:var(--text-tertiary)"><UserFilled /></el-icon>
        <p>还没有员工账号</p>
        <span class="empty-sub">创建账号后员工才能登录系统</span>
        <el-button type="primary" size="small" style="margin-top:4px" @click="openCreate">
          立即创建
        </el-button>
      </div>
    </el-card>

    <!-- 创建员工 -->
    <el-dialog v-model="createVis" title="创建员工账号" width="420px" destroy-on-close>
      <p class="dialog-desc">创建后员工可以用这个账号登录系统，录入采集到的账号数据。</p>
      <el-form ref="createRef" :model="createForm" :rules="createRules" label-width="85px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createForm.username" placeholder="至少 2 个字符" :prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createForm.password" type="password" placeholder="至少 6 位" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm">
          <el-input v-model="createForm.confirm" type="password" placeholder="再次输入密码" :prefix-icon="Lock" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVis = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="doCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码 -->
    <el-dialog v-model="editPwdVis" title="修改员工密码" width="400px" destroy-on-close>
      <p class="dialog-desc">修改后员工下次登录时需要使用新密码。</p>
      <el-form ref="editPwdRef" :model="editPwdForm" :rules="editPwdRules" label-width="90px">
        <el-form-item label="员工账号">
          <el-input :value="editPwdForm.username" disabled />
        </el-form-item>
        <el-form-item label="新密码" prop="password">
          <el-input v-model="editPwdForm.password" type="password" placeholder="至少 6 位" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm">
          <el-input v-model="editPwdForm.confirm" type="password" placeholder="再次输入" :prefix-icon="Lock" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editPwdVis = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="doEditPwd">保存修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Plus, User, Lock, Delete, EditPen,
  VideoPause, VideoPlay, Refresh, UserFilled
} from '@element-plus/icons-vue'
import api from '../../api/index.js'

const loading = ref(false)
const submitting = ref(false)
const employees = ref([])
const search = ref('')
const createVis = ref(false)
const editPwdVis = ref(false)
const createRef = ref(null)
const editPwdRef = ref(null)

const avatarColors = ['#1db954', '#6366f1', '#f59e0b', '#0d9488', '#ec4899', '#3b82f6']
const avatarColor = (name) => avatarColors[name.charCodeAt(0) % avatarColors.length]

const createForm = reactive({ username: '', password: '', confirm: '' })
const editPwdForm = reactive({ id: null, username: '', password: '', confirm: '' })

const createRules = {
  username: [
    { required: true, message: '用户名不能为空', trigger: 'blur' },
    { min: 2, message: '至少 2 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '密码不能为空', trigger: 'blur' },
    { min: 6, message: '至少 6 位', trigger: 'blur' }
  ],
  confirm: [{
    required: true,
    validator: (_, v, cb) => v !== createForm.password ? cb(new Error('两次密码不一致')) : cb(),
    trigger: 'blur'
  }]
}
const editPwdRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '至少 6 位', trigger: 'blur' }
  ],
  confirm: [{
    required: true,
    validator: (_, v, cb) => v !== editPwdForm.password ? cb(new Error('两次密码不一致')) : cb(),
    trigger: 'blur'
  }]
}

let searchTimer = null
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchEmp, 300)
}

onMounted(fetchEmp)

async function fetchEmp() {
  loading.value = true
  try {
    const res = await api.get('/users')
    const s = search.value.toLowerCase()
    employees.value = s
      ? res.data.filter(u => u.username.toLowerCase().includes(s))
      : res.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(createForm, { username: '', password: '', confirm: '' })
  createVis.value = true
}

async function doCreate() {
  await createRef.value?.validate()
  submitting.value = true
  try {
    await api.post('/users', { username: createForm.username, password: createForm.password })
    ElMessage.success('员工账号已创建')
    createVis.value = false
    fetchEmp()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

function openEditPwd(row) {
  Object.assign(editPwdForm, { id: row.id, username: row.username, password: '', confirm: '' })
  editPwdVis.value = true
}

async function doEditPwd() {
  await editPwdRef.value?.validate()
  submitting.value = true
  try {
    await api.put(`/users/${editPwdForm.id}/password`, { password: editPwdForm.password })
    ElMessage.success('密码已修改')
    editPwdVis.value = false
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '修改失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function resetPwd(row) {
  await ElMessageBox.confirm(
    `确认将「${row.username}」的密码重置为 "123456"？`,
    '重置密码',
    { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }
  )
  try {
    const res = await api.put(`/users/${row.id}/reset-password`)
    ElMessage.success(res.data.message)
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '重置失败')
  }
}

async function toggleStatus(row) {
  const next = row.status === 'active' ? 'suspended' : 'active'
  const action = next === 'suspended' ? '停用' : '恢复'
  const tip = next === 'suspended'
    ? `停用后「${row.username}」将无法登录，随时可以恢复。`
    : `恢复后「${row.username}」可以重新登录系统。`

  await ElMessageBox.confirm(tip, `${action}账号`, {
    type: 'warning',
    confirmButtonText: `确认${action}`,
    cancelButtonText: '取消'
  })
  try {
    const res = await api.put(`/users/${row.id}/status`, { status: next })
    ElMessage.success(res.data.message)
    fetchEmp()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function deleteEmp(row) {
  await ElMessageBox.confirm(
    `确认删除「${row.username}」的账号？删除后数据不可恢复。`,
    '删除账号',
    { type: 'error', confirmButtonText: '确认删除', cancelButtonText: '取消' }
  )
  try {
    await api.delete(`/users/${row.id}`)
    ElMessage.success('账号已删除')
    fetchEmp()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }

.page-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 12px;
}
.toolbar-left { display: flex; align-items: center; gap: 12px; }
.total-hint { font-size: 13px; color: var(--text-tertiary); }

.table-wrap { min-height: 280px; }

.emp-cell { display: flex; align-items: center; gap: 11px; }
.emp-av {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; font-size: 14px; flex-shrink: 0;
}
.emp-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.emp-id { font-size: 11px; color: var(--text-tertiary); margin-top: 1px; }

.time-text { font-size: 13px; color: var(--text-secondary); }

.actions { display: flex; align-items: center; gap: 2px; justify-content: flex-end; }
.actions .el-button { font-size: 16px !important; padding: 5px !important; }

.empty-state {
  text-align: center; padding: 60px 0 44px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.empty-state p { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.empty-sub { font-size: 13px; color: var(--text-tertiary); }

.dialog-desc {
  font-size: 13px; color: var(--text-secondary);
  margin-bottom: 20px; line-height: 1.6;
  padding: 10px 12px;
  background: var(--bg-base);
  border-radius: 8px;
  border-left: 3px solid var(--brand-1);
}
</style>
