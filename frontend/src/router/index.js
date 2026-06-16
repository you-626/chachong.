import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../store/auth.js'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: to => {
          const auth = useAuthStore()
          return auth.isAdmin ? '/admin/dashboard' : '/employee/check'
        }
      },
      // Admin routes
      {
        path: 'admin/dashboard',
        name: 'AdminDashboard',
        component: () => import('../views/admin/Dashboard.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/employees',
        name: 'AdminEmployees',
        component: () => import('../views/admin/Employees.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/accounts',
        name: 'AdminAccounts',
        component: () => import('../views/admin/Accounts.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/import',
        name: 'AdminImport',
        component: () => import('../views/admin/Import.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
      },
      // Employee routes
      {
        path: 'employee/check',
        name: 'EmployeeCheck',
        component: () => import('../views/employee/Check.vue'),
        meta: { requiresAuth: true }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return next('/login')
  }
  if (to.meta.guest && auth.isLoggedIn) {
    return next(auth.isAdmin ? '/admin/dashboard' : '/employee/check')
  }
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return next('/employee/check')
  }
  next()
})

export default router
