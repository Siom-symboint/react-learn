import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestory,
	commitHookEffectListUnmount,
	commitMutationEffect
} from './commitWork';
import { completeWork } from './completeWork';
import {
	createWorkInProgress,
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
	getHighestPriorityLane,
	Lane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTag';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';
let workInProgress: FiberNode | null = null;
let workInProgressLane: Lane = NoLane;
let rootDoesHasPassiveEffects: boolean = false;
type RootExitStatus = number;
const RootInComplete = 1;
const rootCompleted = 2;
// 执行过程中报错
const rootError = 3;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProgress(root.current, {});
	workInProgressLane = lane;
}

// 开始调度更新  fiber为root节点时 调度更新入口
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const existingCallback = root.callBackNode;
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}
		root.callBackNode = null;
		root.callbackPriority = NoLane;
		return;
	}
	const curPriority = updateLane;
	const prePriority = root.callbackPriority;

	if (curPriority === prePriority) {
		return null;
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}
	let newCallbackNode = null;
	// performSyncWorkOnRoot(root, updateLane);
	if (updateLane === SyncLane) {
		// 同步优先级 微任务调度
		if (__DEV__) {
			console.warn('微任务中调度,优先级：', updateLane);
		}
		// 收集所有更新任务等待执行
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		// 异步执行 workLoopSync
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callBackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 从当前更新的节点一直往上找到root
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;

	while (parent != null) {
		node = parent;
		parent = node.return;
	}

	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

export function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	const currentCallback = root.callBackNode;
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);

	if (didFlushPassiveEffect) {
		if (root.callBackNode !== currentCallback) {
			// 当前调度更新了优先级
			return null;
		}
	}
	const lane = getHighestPriorityLane(root.pendingLanes);
	if (lane === NoLane) {
		// 非同步更新
		return null;
	}
	const currentCallbackNode = root.callBackNode;

	const needSync = lane === SyncLane || didTimeout;

	const existStatus = renderRoot(root, lane, !needSync);

	ensureRootIsScheduled(root);
	if (existStatus === RootInComplete) {
		if (root.callBackNode !== currentCallbackNode) {
			return null;
		}
		return performConcurrentWorkOnRoot.bind(null, root);
	}
	if (existStatus === rootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		// 本次更新消费的Lane
		root.finishedLane = lane;
		workInProgressLane = NoLane;

		commitRoot(root);
	} else {
		console.error('还未实现同步更新未结束状态');
	}
}

function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 非同步更新
		ensureRootIsScheduled(root);
		return;
	}
	// 初始化
	const existStatus = renderRoot(root, nextLane, false);

	if (existStatus === rootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		// 本次更新消费的Lane
		root.finishedLane = nextLane;
		workInProgressLane = NoLane;

		commitRoot(root);
	} else {
		console.error('还未实现同步更新未结束状态');
	}
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`);
	}

	// 初始化
	if (workInProgressLane !== lane) {
		prepareFreshStack(root, lane);
	}

	do {
		try {
			if (shouldTimeSlice) {
				workLoopSyncConcurrent();
			} else {
				workLoopSync();
			}
			break;
		} catch (e) {
			if (__DEV__) {
				console.log('workloop 发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}

	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error('不应该存在render解释workInprogress不为null的请跨国');
	}
	return rootCompleted;
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false;
	// 先触发组建卸载的effect
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	// 触发上次的destory
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;

		commitHookEffectListDestory(Passive | HookHasEffect, effect);
	});

	/**
	 * 触发更新create ！！！ 这里会执行effect.destory = create() 即这里才会收集destory,
	 * 供commitHookEffectListDestory 执行
	 * useEffect在udpate阶段执行的updateEffect,创建Effect是destory是从同胞节点处拿的
	 * 即commitHookEffectListDestory执行的始终是上一次的destory
	 */

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;

		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];

	// effect可能会触发再次更新 重新调用
	flushSyncCallbacks();

	return didFlushPassiveEffect;
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopSyncConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, workInProgressLane);
	fiber.memorizeProps = fiber.pendingProps;

	if (next == null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	do {
		const next = completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return next;
		}
		node = node.return;
		workInProgress = node;
	} while (node !== null);
}

/**
 *
 * @param root
 * @returns commit阶段 执行在completeWork之后
 */
function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit 阶段开始', finishedWork);
	}
	if (root.finishedLane === NoLane && __DEV__) {
		console.warn('commit阶段finsishedLane不应该是NoLane');
	}
	const lane = root.finishedLane;
	root.finishedWork = null;
	root.finishedLane = NoLane;
	markRootFinished(root, lane);

	if (
		(finishedWork.flags && PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在三个子阶段需要执行的操作
	const subtreeFlagsEffect =
		(finishedWork.subtreeFlags & MutationMask) != NoFlags;

	const rootHasEffect = (finishedWork.flags & MutationMask) != NoFlags;

	// “提交”副作用  到root节点上
	if (subtreeFlagsEffect || rootHasEffect) {
		commitMutationEffect(finishedWork, root);
		root.current = finishedWork;
		// layout
	} else {
		root.current = finishedWork;
	}
	rootDoesHasPassiveEffects = false;
	ensureRootIsScheduled(root);
}
