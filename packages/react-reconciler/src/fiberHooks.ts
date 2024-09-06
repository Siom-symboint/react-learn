import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workloop';

const { currentDispatcher } = internals;

let currentlyRendingFiber: FiberNode | null = null;
let WorkinProgressHook: Hook | null = null;

interface Hook {
	memorizeState: any;
	updateQueue: unknown;
	next: Hook | null;
}
export function renderWithHooks(wip: FiberNode) {
	//currentlyRendingFiber赋值
	currentlyRendingFiber = wip;
	wip.memorizeState = null;

	const current = wip.alternate;

	if (current !== null) {
		//update
	} else {
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;

	const props = wip.pendingProps;

	const children = Component(props);
	//currentlyRendingFiber重置
	currentlyRendingFiber = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
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
		memorizeState: null,
		updateQueue: null,
		next: null
	};

	if (WorkinProgressHook === null) {
		if (currentlyRendingFiber === null) {
			throw new Error('请在函数组件内执行hook');
		} else {
			WorkinProgressHook = hook;
			currentlyRendingFiber.memorizeState = WorkinProgressHook;
		}
	} else {
		WorkinProgressHook.next = hook;
		WorkinProgressHook = hook;
	}

	return WorkinProgressHook;
}
