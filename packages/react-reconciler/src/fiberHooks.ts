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
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

const { currentDispatcher } = internals;

let currentlyRendingFiber: FiberNode | null = null;
let WorkinProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;
interface Hook {
	memorizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destory: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}

export interface FCUpdateQUeue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	//currentlyRendingFiber赋值
	currentlyRendingFiber = wip;
	// 重置hook链表
	wip.memorizedState = null;
	// 重置effect链表
	wip.updateQueue = null;
	renderLane = lane;
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
	renderLane = NoLane;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps) {
	// 找到当前第一个hook
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	currentlyRendingFiber!.flags |= PassiveEffect;
	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps) {
	// 找到当前第一个hook
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destory: EffectCallback | void;
	if (currentHook !== null) {
		const prevEffect = currentHook.memorizedState as Effect;
		destory = prevEffect.destory;

		if (nextDeps !== null) {
			// 浅比较
			const preDeps = prevEffect.deps;

			if (areHookInputEqual(preDeps, nextDeps)) {
				hook.memorizedState = pushEffect(Passive, create, destory, nextDeps);
				return;
			}

			// 不想等
			currentlyRendingFiber!.flags |= PassiveEffect;
			hook.memorizedState = pushEffect(
				Passive | HookHasEffect,
				create,
				destory,
				nextDeps
			);
		}
	}
}
function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destory: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		deps,
		destory,
		next: null
	};
	const fiber = currentlyRendingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQUeue<any>;
	if (updateQueue === null) {
		const newUpdateQueue = createFunctionComponentUpdateQueue();
		fiber.updateQueue = newUpdateQueue;
		effect.next = effect;
		newUpdateQueue.lastEffect = effect;
	} else {
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFunctionComponentUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQUeue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

function mountState<State>(
	initialState: () => State | State
): [State, Dispatch<State>] {
	let memorizedState;
	if (initialState instanceof Function) {
		memorizedState = initialState();
	} else {
		memorizedState = initialState;
	}
	// 找到当前useState对应的Hook数据
	const hook = mountWorkInProgressHook();

	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memorizedState = memorizedState;
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
	queue.shared.pending = null;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(
			hook.memorizedState,
			pending,
			renderLane
		);
		hook.memorizedState = memoizedState;
	}

	return [hook.memorizedState, queue.dispatch!];
}

/**
 * dispatchSetState 在update阶段的更新流程(即useState的第二个参数)
 * 实现功能:
 * 1，创建update对象 挂载到updateQueue上：updateQueue保存在哪儿? 保存在当前fiber节点的memorizedState上
 * 此时的memorizedState 数据结构为{memorizedState:当前值,next:下一个hook,updateQueue:{dispatch:dispatchSetState本身,action:执行的变化}}
 * 调用流程
 * dispatchSetState=>scheduleUpdateOnFiber=>ensureRootIsScheduled=>performSyncWorkOnRoot
 *
 */
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLanes();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
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

function areHookInputEqual(nextDeps: EffectDeps, preDeps: EffectDeps) {
	if (preDeps === null || nextDeps === null) {
		return false;
	}

	for (let i = 0; i < preDeps.length && i < nextDeps.length; i++) {
		if (Object.is(preDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}
