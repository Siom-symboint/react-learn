import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import path from 'path';
import { resolvePkgPath } from '../rollup/utils';
const pkgPath = resolvePkgPath('react-dom');
// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],

	resolve: {
		// 配置别名
		alias: [
			{
				find: 'react',
				replacement: resolvePkgPath('react')
			},
			{
				find: 'react-dom',
				replacement: resolvePkgPath('react-dom')
			},
			{
				find: 'react-noop-renderer',
				replacement: resolvePkgPath('react-noop-renderer')
			},
			{
				find: 'hostConfig',
				replacement: `${resolvePkgPath('react-dom')}/src/hostConfig.ts`
			}
		]
	},

	// // 配置环境变量，解决__DEV__ is not defined
	define: {
		__DEV__: true, // 设置为false跳过 if(__dev__)的开发逻辑 这样会报错 需要修改jsx_dev的引入
		__EXPERIMENTAL__: true,
		__PROFILE__: true
	}
});
