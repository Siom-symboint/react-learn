import { appendChildToContainer, Container } from 'hostConfig';
import { FiberNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTag';

let nextEffect: FiberNode | null = null;
export const commitMutationEffect = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;

		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			up: while (nextEffect != null) {
				commitMutationEffectsOnFiber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	if ((flags & Placement) != NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	// else {
	// }
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (___DEV___) {
		console.warn('执行placement 操作', finishedWork);
	}
	const hostparent = getHostParent(finishedWork);
	if (hostparent) {
		appendPlacementNodeIntoContainer(finishedWork, hostparent);
	}
};

function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;

		// 对应有stateNode的组件 文本节点fiber和dom节点fiber
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		} else if (parentTag === HostRoot) {
			// 特殊处理  root节点
			return parent.stateNode.container;
		}

		parent = parent.return;
	}
	if (___DEV___) {
		console.warn('未找到hsot parent');
	}

	return null;
}

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	// fiber host

	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}

	const child = finishedWork.child;

	if (child !== null) {
		let sibling = child.sibling;
		appendPlacementNodeIntoContainer(child, hostParent);
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling.stateNode, hostParent);

			sibling = sibling.sibling;
		}
	}
}
