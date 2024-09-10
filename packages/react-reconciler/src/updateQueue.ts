import { Action } from 'shared/ReactTypes';
import { Update } from './fiberFlags';
import { Dispatch } from 'react/src/currentDispatcher';
import { Lane } from './fiberLanes';

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

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};

	if (pendingUpdate !== null) {
		const firstUpdate = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;
		do {
			const updateLane = pending.lane;
			const action = pending.action;

			if (updateLane === renderLane) {
				if (action instanceof Function) {
					// console.log(
					// 	action(baseState),
					// 	action,
					// 	baseState,
					// 	' action(baseState)'
					// );

					baseState = action(baseState);
				} else {
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.warn('同步更新模式');
				}
			}
			pending = pending?.next as Update<any>;
			/**updateDateQueue为一条环状列表，
			 * 执行到到指针指向第一个Update时 运行结束 */
		} while (pending !== firstUpdate);
	}
	result.memoizedState = baseState;
	return result;
};
