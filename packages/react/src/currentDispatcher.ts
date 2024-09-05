import { jsxDEV } from './jsx';

export interface Dispatcher {
	useState: any;
}
const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('hook 只能在函数组建中执行');
	}

	return dispatcher;
};

export default {
	version: '0,0,1',
	createElement: jsxDEV
};
