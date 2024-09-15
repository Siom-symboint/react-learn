import { Action } from 'shared/ReactTypes';
import { Update } from './fiberFlags';
import { Dispatch } from 'react/src/currentDispatcher';
import { isSubsetOfLanes, Lane, NoLane } from './fiberLanes';

export interface Update<State> {
	lane: Lane;
	next: Update<State> | null;
	action: Action<State>;
}

export interface UpdateQueue<State> {
	dispatch: Dispatch<State> | null;
	shared: {
		// 指向的是最后一个Update
		pending: Update<State> | null;
	};
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	};
};

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}
	updateQueue.shared.pending = update;
};

/**
 *  baseState 为本次参与计算的初始state,memoizedState是上次更新计算的最终state
 * 	如果本次更新没有Update被跳过，则下次开始更新是baseState === memoizedState
 *  反之，memoizedState为<跳过不符合本次优先级计算的结果>，baseState为<最后一个没被跳过的update计算后的结果>baseState !== memoizedState
 *  反之，memoizedState为保证优先级， baseState保证连续性===>最终状态为baseState
 *  被跳过的update及后面的Update都回保存在baseQueue中，优先级降低为noLane（保证下一次一定进行计算）
 *  由于没有办法在一次计算中同时兼顾优先级和连续性， 所以baseState保存在current中，计算结果保存在wip中，由于是基于baseState计算的，所以能保障最终状态，但是不保证中间状态
 */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	};
	if (pendingUpdate !== null) {
		const firstUpdate = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;
		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;
		let newState = baseState;
		do {
			const updateLane = pending.lane;
			const action = pending.action;

			if (!isSubsetOfLanes(renderLane, updateLane)) {
				if (__DEV__) {
					console.warn('同步更新模式，优先级不够被跳过');
					const clone = createUpdate(pending.action, pending.lane);
					if (newBaseQueueFirst === null) {
						// 第一个被跳过Update
						newBaseQueueFirst = clone;
						newBaseQueueLast = clone;
						newBaseState = newState; // 固定下来因为当前update被跳过了
					} else {
						newBaseQueueLast!.next = clone;
						newBaseQueueLast = clone;
					}
				}
			} else {
				if (newBaseQueueLast !== null) {
					// 有被跳过了，剩余的update都要保存在baseQueue中
					const clone = createUpdate(pending.action, NoLane);
					newBaseQueueLast.next = clone;
					newBaseQueueLast = clone;
				}

				if (action instanceof Function) {
					newState = action(baseState);
				} else {
					newState = action;
				}
			}
			pending = pending?.next as Update<any>;
			/**updateDateQueue为一条环状列表，
			 * 执行到到指针指向第一个Update时 运行结束 */
		} while (pending !== firstUpdate);

		if (newBaseQueueLast === null) {
			newBaseState = newState;
		} else {
			newBaseQueueLast.next = newBaseQueueFirst; // 形成一条换装链表
		}
		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}

	return result;
};
