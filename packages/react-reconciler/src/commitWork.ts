import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';

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

	if ((flags & Update) != NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}
	if ((flags & ChildDeletion) != NoFlags) {
		const deletions = finishedWork.deletions;

		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}
		finishedWork.flags &= ~Update;
	}
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行placement 操作', finishedWork);
	}

	const hostparent = getHostParent(finishedWork);

	//host sibling
	const sibling = getHostSibling(finishedWork);
	if (hostparent) {
		InsertOrAppendPlacementNodeIntoContainer(finishedWork, hostparent, sibling);
	}
};

/**
 * 两种情况不是直接的兄弟节点
 * 1，<A/></B> 需要找的是 兄弟fiber的子fiber的sibling
 * 2，<App/><div> A 没有兄弟节点, 则向上找APP的兄弟节点
 * 	function App(){
 * 		return <A/>
 * 	}
 */
function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		// 针对第二种情况
		while (node.sibling === null) {
			const parent = node.return;
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}

			node = parent;
		}
		node.sibling.return = node.return;
		node = node.sibling;
		// 遍历兄弟节点
		while (node.tag !== HostRoot && node.tag !== HostComponent) {
			//向下遍历
			if ((node.flags & Placement) !== NoFlags) {
				// 不能插入自己要被Placement的节点 不稳定
				continue;
			}
			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}

			if ((node.flags & Placement) === NoFlags) {
				return node.stateNode;
			}
		}
	}
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	/// 找第一个root host节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1];

	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
}

const commitDeletion = (childDeletion: FiberNode) => {
	/**所需卸载的fiber的挂载节点 */
	const rootChildrenToDelete: FiberNode[] = [];

	commitNestedComponent(childDeletion, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);

				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);

				return;
			case FunctionComponent:
				//TODO useEffect Unmount处理
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
				break;
		}
	});

	if (rootChildrenToDelete.length > 0) {
		const hostParent = getHostParent(childDeletion);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((child) => {
				removeChild(child.stateNode, hostParent);
			});
		}
	}
	childDeletion.return = null;
	childDeletion.child = null;
};

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;

	while (true) {
		onCommitUnmount(node);
		if (node.child !== null) {
			node.child.return = node;
			node = node.child;

			continue;
		}
		if (node === root) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
}

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
	if (__DEV__) {
		console.warn('未找到hsot parent');
	}

	return null;
}

function InsertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Element
) {
	// fiber host

	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(hostParent, before, finishedWork.stateNode);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}
		return;
	}

	const child = finishedWork.child;

	if (child !== null) {
		let sibling = child.sibling;
		InsertOrAppendPlacementNodeIntoContainer(child, hostParent);
		while (sibling !== null) {
			InsertOrAppendPlacementNodeIntoContainer(sibling, hostParent);

			sibling = sibling.sibling;
		}
	}
}
