// 递归中的递阶段

import { FiberNode } from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { HostComponent, HostRoot, HostText } from './workTag';

export const beginWork = (wip: FiberNode) => {
	switch (wip.tag) {
		case HostRoot:
			updateHostRoot(wip);
			return;
		case HostComponent:
		case HostText:

		default:
			if (___DEV___) {
				console.warn('beginwork 为实现的类型');
			}
			break;
	}
};

function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memorizeState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;

	const { memoizedState } = processUpdateQueue(baseState, pending);
	wip.memorizeState = memoizedState;
}
