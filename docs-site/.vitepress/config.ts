import { defineConfig } from 'vitepress';

const base = process.env.DOCS_BASE_URL ?? '/';

export default defineConfig({
  title: 'Flowspace',
  description: 'Spatial video lounge for informal online and hybrid events',
  base,
  ignoreDeadLinks: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'API', link: '/api/README' },
      { text: 'GitHub', link: 'https://github.com/eventyay/flowspace' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Deployment', link: '/guide/deployment' },
          { text: 'Eventyay integration', link: '/guide/eventyay-integration' },
          { text: 'Testing', link: '/guide/testing' },
          { text: 'Publishing docs', link: '/guide/publishing-docs' },
          { text: 'Implementation status', link: '/guide/status' },
          { text: 'Contributing', link: '/guide/contributing' },
        ],
      },
      { text: 'Architecture', link: '/architecture' },
      { text: 'API reference', link: '/api/README' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/eventyay/flowspace' }],
  },
});
