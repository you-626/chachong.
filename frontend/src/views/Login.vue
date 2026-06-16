<template>
  <div class="login-root">
    <!-- Animated background -->
    <div class="login-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="noise"></div>
    </div>

    <div class="login-wrap">
      <!-- Left branding panel -->
      <div class="login-left">
        <h1 class="brand-name">账号采集查重平台</h1>
      </div>

      <!-- Right login form -->
      <div class="login-right">
        <div class="login-card">
          <div class="login-card-header">
            <h2>登录账号</h2>
            <p>请输入你的用户名和密码</p>
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            class="login-form"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="username">
              <div class="field-label">用户名</div>
              <el-input
                v-model="form.username"
                placeholder="请输入用户名"
                size="large"
                :prefix-icon="User"
              />
            </el-form-item>
            <el-form-item prop="password">
              <div class="field-label">密码</div>
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                :prefix-icon="Lock"
                show-password
              />
            </el-form-item>

            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              @click="handleLogin"
            >
              {{ loading ? "登录中..." : "登录" }}
            </el-button>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  User,
  Lock,
  Search,
  CircleCheck,
  UserFilled,
  Connection,
} from "@element-plus/icons-vue";
import { useAuthStore } from "../store/auth.js";

const router = useRouter();
const auth = useAuthStore();
const formRef = ref(null);
const loading = ref(false);
const form = reactive({ username: "", password: "" });
const rules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function handleLogin() {
  await formRef.value?.validate();
  loading.value = true;
  try {
    const data = await auth.login(form.username, form.password);
    ElMessage.success({
      message: `欢迎回来，${data.user.username}`,
      duration: 2000,
    });
    router.push(
      data.user.role === "admin" ? "/admin/dashboard" : "/employee/check",
    );
  } catch (err) {
    ElMessage.error(err.response?.data?.message || "登录失败，请重试");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
  position: relative;
  overflow: hidden;
}

/* Animated orbs */
.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 8s ease-in-out infinite;
}
.orb-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #1db954 0%, transparent 70%);
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}
.orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #0d9488 0%, transparent 70%);
  bottom: -80px;
  right: -80px;
  animation-delay: -3s;
}
.orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #6366f1 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -6s;
  opacity: 0.2;
}
.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: 0.4;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-30px) scale(1.05);
  }
}

.login-wrap {
  display: flex;
  width: min(900px, 95vw);
  min-height: 560px;
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.06);
  position: relative;
  z-index: 1;
}

/* Left panel */
.login-left {
  flex: 1;
  background: linear-gradient(
    145deg,
    rgba(29, 185, 84, 0.2) 0%,
    rgba(13, 148, 136, 0.15) 50%,
    rgba(99, 102, 241, 0.1) 100%
  );
  backdrop-filter: blur(40px);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 52px 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.brand-logo {
  width: 56px;
  height: 56px;
  background: var(--brand-grad);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: white;
  box-shadow: 0 8px 24px rgba(29, 185, 84, 0.4);
  margin-bottom: 28px;
}
.brand-name {
  font-size: 36px;
  font-weight: 700;
  color: white;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
}
.brand-desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.7;
  margin-bottom: 40px;
}
.brand-features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 500;
}
.feature-item .el-icon {
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--brand-1);
  flex-shrink: 0;
}

/* Right panel */
.login-right {
  width: 420px;
  background: rgba(18, 18, 22, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 44px;
}
.login-card {
  width: 100%;
}
.login-card-header {
  margin-bottom: 32px;
}
.login-card-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}
.login-card-header p {
  color: rgba(255, 255, 255, 0.45);
  font-size: 14px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.login-form :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.07) !important;
  border: 1.5px solid rgba(255, 255, 255, 0.1) !important;
}
.login-form :deep(.el-input__wrapper:hover) {
  border-color: rgba(29, 185, 84, 0.5) !important;
}
.login-form :deep(.el-input__wrapper.is-focus) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: var(--brand-1) !important;
  box-shadow: 0 0 0 3px rgba(29, 185, 84, 0.15) !important;
}
.login-form :deep(.el-input__inner) {
  color: white !important;
  font-size: 15px !important;
}
.login-form :deep(.el-input__prefix-icon) {
  color: rgba(255, 255, 255, 0.4) !important;
}
.login-form :deep(.el-form-item) {
  margin-bottom: 16px !important;
}
.login-form :deep(.el-form-item__error) {
  color: #f87171 !important;
}

.login-btn {
  width: 100%;
  height: 48px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  border-radius: 14px !important;
  margin-top: 8px;
  letter-spacing: 0.03em;
}

/* Responsive */
@media (max-width: 680px) {
  .login-left {
    display: none;
  }
  .login-right {
    width: 100%;
    padding: 36px 28px;
  }
  .login-wrap {
    min-height: auto;
  }
}
</style>
