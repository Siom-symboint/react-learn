import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workloop';

const { currentDispatcher } = internals;

let currentlyRendingFiber: FiberNode | null = null;
let WorkinProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

interface Hook {
	memorizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}
export function renderWithHooks(wip: FiberNode) {
	//currentlyRendingFiber赋值
	currentlyRendingFiber = wip;
	wip.memorizedState = null;

	const current = wip.alternate;

	if (current !== null) {
		//update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;

	const props = wip.pendingProps;

	const children = Component(props);
	//currentlyRendingFiber重置
	currentlyRendingFiber = null;
	WorkinProgressHook = null;
	currentHook = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
};

function mountState<State>(
	initialState: () => State | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的Hook数据
	const hook = mountWorkInProgressHook();
	let memorizedState;
	if (initialState instanceof Function) {
		memorizedState = initialState();
	} else {
		memorizedState = initialState;
	}
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;

	//@ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRendingFiber, queue);
	queue.dispatch = dispatch;
	return [memorizedState, dispatch];
}
function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的Hook数据
	const hook = updateWorkInProgressHook();
	console.warn('commit阶段触发,当前hook', hook);

	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memorizedState, pending);
		hook.memorizedState = memoizedState;
	}

	return [hook.memorizedState, queue.dispatch!];
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memorizedState: null,
		updateQueue: null,
		next: null
	};

	if (WorkinProgressHook === null) {
		if (currentlyRendingFiber === null) {
			throw new Error('请在函数组件内执行hook');
		} else {
			WorkinProgressHook = hook;
			currentlyRendingFiber.memorizedState = WorkinProgressHook;
		}
	} else {
		WorkinProgressHook.next = hook;
		WorkinProgressHook = hook;
	}

	return WorkinProgressHook;
}

function updateWorkInProgressHook(): Hook {
	let nextCurrenthook: Hook | null = null;

	if (currentHook === null) {
		// 这个Fc update时的第一个Hook
		const current = currentlyRendingFiber?.alternate;

		if (current !== null) {
			nextCurrenthook = current?.memorizedState;
		} else {
			// 错误边界
			nextCurrenthook = null;
		}
	} else {
		// 后续的Hook
		nextCurrenthook = currentHook.next;
	}

	if (nextCurrenthook === null) {
		throw new Error('不要在条件语句中执行hook');
	}
	currentHook = nextCurrenthook;
	const newHook: Hook = {
		memorizedState: currentHook?.memorizedState,
		updateQueue: currentHook?.updateQueue,
		next: null
	};

	if (WorkinProgressHook === null) {
		if (currentlyRendingFiber === null) {
			throw new Error('请在函数组件内执行hook');
		} else {
			WorkinProgressHook = newHook;
			currentlyRendingFiber.memorizedState = WorkinProgressHook;
		}
	} else {
		WorkinProgressHook.next = newHook;
		WorkinProgressHook = newHook;
	}

	return WorkinProgressHook;
}
