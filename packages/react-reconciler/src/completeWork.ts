// 递归中的归阶段

import {
	appendInitialChild,
	Container,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';
import { NoFlags, Update } from './fiberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}

/**
 *
 * @param wip work in progress fiber
 * 从下至上 归
 * 收集整个stateNode, 针对相应的subtreeFlags(子树副作用集合)和flag(本身副作用)
 */
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			if (current != null && wip.stateNode) {
				// update
				updateFiberProps(wip.stateNode, newProps);
			} else {
				// mount  构建dom树，
				const instance = createInstance(wip.type, newProps);
				appendAllChildren(instance, wip);

				wip.stateNode = instance;
				// 将dom插入到dom书中
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				const oldText = current?.memorizeProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				const instance = createTextInstance(newProps.content);

				wip.stateNode = instance;
			}

			bubbleProperties(wip);

			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('completeWork 为实现的类型');
			}
			return null;
	}
};

function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;

	while (node !== null) {
		if (node.tag === HostComponent || node?.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;

		node = node.sibling;
	}
}

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;

	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;
		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags |= subtreeFlags;
}
