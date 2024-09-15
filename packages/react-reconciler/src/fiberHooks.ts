import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import currentBatchConfig from 'react/src/currentBatchconfig';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	Update,
	UpdateQueue
} from './updateQueue';
import { Action, ReactContext } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workloop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
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
	baseState: any;
	baseQueue: Update<any> | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
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
	useEffect: mountEffect,
	useTransition: mountTransition,
	useContext: readContext
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useTransition: updateTransition,
	useContext: readContext
};

function readContext<T>(context: ReactContext<T>): T {
	const consumer = currentlyRendingFiber;
	if (consumer === null) {
		throw new Error('只能在函数组件中运行');
	}
	return context._currentValue;
}

function createFunctionComponentUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

function mountState<State>(
	initialState: (() => State) | State
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
	hook.baseState = memorizedState;
	//@ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRendingFiber, queue);
	queue.dispatch = dispatch;
	return [memorizedState, dispatch];
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps) {
	// 找到当前第一个hook
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	currentlyRendingFiber!.flags |= PassiveEffect;
	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		// mount阶段没有distory
		undefined,
		nextDeps
	);
}

function mountTransition(): [boolean, (callback: () => void) => void] {
	const [isPending, setPedning] = mountState<boolean>(false);
	const hook = mountWorkInProgressHook();

	const start = startTransition.bind(null, setPedning);
	hook.memorizedState = start;

	return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
	const [isPending] = updateState();
	const hook = updateWorkInProgressHook();

	const start = hook.memorizedState;

	return [isPending as boolean, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
	setPending(true);
	const preTransition = currentBatchConfig.transition;
	currentBatchConfig.transition = 1;
	callback();
	setPending(false);
	currentBatchConfig.transition = preTransition;
}
function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的Hook数据
	const hook = updateWorkInProgressHook();
	console.warn('commit阶段触发,当前hook', hook);

	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	const baseState = hook.baseState;
	//
	const current = currentHook as Hook;
	let baseQueue = current.baseQueue;
	if (pending !== null) {
		if (baseQueue !== null) {
			const baseFirst = baseQueue.next;
			const pendingFirst = pending.next;
			baseQueue.next = pendingFirst;
			pending.next = baseFirst; // 与当前正在调度的pendingState形成一条完整的环状链表,pending.last=>basequeue.first=>**=>pending.last
		}
		//保存啊在current中
		baseQueue = pending;
		current.baseQueue = pending;
		queue.shared.pending = null;
	}
	if (baseQueue !== null) {
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLane);
		hook.memorizedState = memoizedState;
		hook.baseState = newBaseState;
		hook.baseQueue = newBaseQueue;
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
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		// 在state中为state的值, 在effect中为一条effect的环状链表，在transition中为start函数
		memorizedState: null,
		updateQueue: null,
		next: null,
		baseQueue: null,
		baseState: null
	};

	if (WorkinProgressHook === null) {
		if (currentlyRendingFiber === null) {
			throw new Error('请在函数组件内执行hook');
		} else {
			WorkinProgressHook = hook;
			// 这里挂在当前的fiber中 即==>fiber.memorizedState
			currentlyRendingFiber.memorizedState = WorkinProgressHook;
		}
	} else {
		WorkinProgressHook.next = hook;
		WorkinProgressHook = hook;
	}

	return WorkinProgressHook;
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps) {
	// 找到当前第一个hook
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;
	if (currentHook !== null) {
		// update阶段 通过拿同胞节点的effect去那拿上一次更新的preEffect去拿destory
		const prevEffect = currentHook.memorizedState as Effect;
		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			// 浅比较
			const preDeps = prevEffect.deps;

			if (areHookInputEqual(preDeps, nextDeps)) {
				hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}

			// 不想等
			currentlyRendingFiber!.flags |= PassiveEffect;
			//这里保存的destory  是上一次更新的destory
			hook.memorizedState = pushEffect(
				Passive | HookHasEffect,
				create,
				destroy,
				nextDeps
			);
		}
	}
}
function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		deps,
		destroy,
		next: null
	};
	const fiber = currentlyRendingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
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
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
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
