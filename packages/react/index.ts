import { jsx } from './src/jsx';
import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatcher';

export { isValidElement, Fragment } from './src/jsx';
export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useEffect(create, deps);
};

export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FILE = {
	currentDispatcher
};

export const version = '0.0.1';

export const createElement = jsx;

export default {
	version,
	createElement
};
