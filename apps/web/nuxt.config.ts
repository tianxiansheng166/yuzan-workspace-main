export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: true },
  css: ['@yuzan/ui/base.css', '~/assets/app.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api/v1',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '语赞心声',
      meta: [
        {
          name: 'description',
          content: '面向弱网与离线环境的国家通用语言文字教与学平台',
        },
        { name: 'theme-color', content: '#f7f2e8' },
      ],
    },
  },
  typescript: {
    typeCheck: true,
    strict: true,
  },
})
