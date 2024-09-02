import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
	// plugins: [react()]
	// resolve: {
	//   // 配置别名
	//   alias: {
	//     react: path.posix.resolve("src/react/packages/react"),
	//     "react-dom": path.posix.resolve("src/react/packages/react-dom"),
	//     "react-dom-bindings": path.posix.resolve(
	//       "src/react/packages/react-dom-bindings"
	//     ),
	//     "react-reconciler": path.posix.resolve(
	//       "src/react/packages/react-reconciler"
	//     ),
	//     "react-client": path.posix.resolve("src/react/packages/react-client"),
	//     scheduler: path.posix.resolve("src/react/packages/scheduler"),
	//     shared: path.posix.resolve("src/react/packages/shared"),
	//   },
	// },
	// 配置环境变量，解决__DEV__ is not defined
	// define: {
	//   __DEV__: false, // 设置为false跳过 if(__dev__)的开发逻辑 这样会报错 需要修改jsx_dev的引入
	//   __EXPERIMENTAL__: true,
	//   __PROFILE__: true,
	// },
});
