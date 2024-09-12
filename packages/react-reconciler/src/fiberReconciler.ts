import { Container } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { HostRoot } from './workTag';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue';
import { Action, ReactElementType } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workloop';
import { requestUpdateLanes } from './fiberLanes';

export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	const root = new FiberRootNode(container, hostRootFiber);
	hostRootFiber.updateQueue = createUpdateQueue();
	return root;
}

// render 的最终执行函数
export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	const hostRootFiber = root.current;
	const lane = requestUpdateLanes();

	const update = createUpdate<ReactElementType | null>(element, lane);

	// 创建一个Update对象挂载到updateQueue上，类型为ReactElementType，
	// 对于function components来说 udpate为一条effectList
	// 从另一个角度说 effect 可以分为两种 一种是 ElementType effect  一种是Function Effect
	enqueueUpdate(
		hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
		update
	);
	scheduleUpdateOnFiber(hostRootFiber, lane);

	return element;
}
