import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import { Fragment, FunctionComponent, HostComponent, WorkTag } from './workTag';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';

export class FiberNode {
	tag: WorkTag;
	key: Key;
	pendingProps: Props;

	stateNode: any;
	type: any;
	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	ref: any;

	memorizeProps: Props;
	memorizedState: any;
	alternate: FiberNode | null;

	flags: Flags;
	subtreeFlags: Flags;
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key = null) {
		this.tag = tag;
		this.key = key || null;
		this.stateNode = null;
		this.type = null;

		// 作为树状结构
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;
		this.ref = null;

		// 作为工作单元

		this.pendingProps = pendingProps;
		this.updateQueue = null;
		this.memorizeProps = null;
		this.alternate = null;
		this.memorizedState = null;

		//副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}
export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;

	pendingLanes: Lanes;
	finishedLane: Lane;

	pendingPassiveEffects: PendingPassiveEffects;

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		/**
		 * root节点特殊处理，stateNode指向自己,获取root-dom节点通过stateNode.container
		 * 对于非root节点且有相应dom的节点来说 stateNode即为对应的dom节点
		 */
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;

		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
	}
}

/**创建当前调度的fiber节点  即work in progress fiber
 * 1,在首次渲染时候
 * 2,在update的时候 复用之前fiber进行创建
 */
export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;
	if (wip === null) {
		//mount首次渲染
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.type = current.type;
		wip.stateNode = current.stateNode;

		wip.alternate = current;
		current.alternate = wip;
	} else {
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memorizeProps = current.memorizeProps;
	wip.memorizedState = current.memorizedState;
	return wip;
};

export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props } = element;

	let fiberTag: WorkTag = FunctionComponent;
	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	return fiber;
}

export function createFiberFromFragment(element: any[], key: Key) {
	const fiber = new FiberNode(Fragment, element, key);
	return fiber;
}
