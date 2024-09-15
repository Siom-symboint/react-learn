import { jsx } from './src/jsx';
import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatcher';
import currentBatchConfig from './src/currentBatchconfig';

export { isValidElement, Fragment } from './src/jsx';
export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useTransition();
};

export const useContext: Dispatcher['useContext'] = (context) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useContext(context);
};

export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FILE = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.1';

export const createElement = jsx;

export default {
	version,
	createElement
};
