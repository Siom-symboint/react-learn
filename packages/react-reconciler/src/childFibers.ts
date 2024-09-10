import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress,
	FiberNode
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Fragment, HostText } from './workTag';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

/**
 *
 * @param shouldTrackEffects 是否追踪副作用
 *  child 协调
 * 1,mount阶段生成fibertruee
 * 2,在于给fiber染色=>标记flags,添加deletion
 */
function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return;
		}

		const deletions = returnFiber.deletions;

		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return;
		}
		let childToDelete = currentFirstChild;
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	function reconcileTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			if (currentFiber.tag === HostText) {
				//update
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			deleteChild(returnFiber, currentFiber);
		}
		const fiber = new FiberNode(HostText, { content }, null);

		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}
		return fiber;
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		work: while (currentFiber !== null) {
			if (currentFiber.key === key) {
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						if (element.type === REACT_FRAGMENT_TYPE) {
							element.props = element.props.children;
						}

						// type相同
						const existing = useFiber(currentFiber, element.props);
						existing.return = returnFiber;
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}
					// key相同 type不同
					deleteRemainingChildren(returnFiber, currentFiber);
					break work;
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break work;
					}
				}
			} else {
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
				break work;
			}
		}
		// 新建
		let fiber;

		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}
		fiber.return = returnFiber;
		return fiber;
	}

	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 最后一个可复用fiber在current中的index
		let lastPlacedIndex = 0;
		// 创建的最后一个fiber
		let lastNewFiber: FiberNode | null = null;
		// 创建的第一个fiber
		let firstNewFiber: FiberNode | null = null;
		const existingChildren: ExistingChildren = new Map();

		let current = currentFirstChild;
		//将当前的fiber node存在map中等待复用
		while (current != null) {
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		for (let index = 0; index < newChild.length; index++) {
			// 遍历newChild 寻找是否可复用
			const after = newChild[index];
			const newFiber = updateFromMap(
				returnFiber,
				existingChildren,
				index,
				after
			);

			if (newFiber === null) {
				continue;
			}

			// 标记移动还是插入
			newFiber.index = index;
			newFiber.return = returnFiber;
			if (lastNewFiber === null) {
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = lastNewFiber.sibling;
			}

			if (!shouldTrackEffects) {
				continue;
			}
			const current = newFiber.alternate;
			if (current !== null) {
				const oldIndex = current.index;
				/**
				 * 列表的优化策略 规定一个方向为“移动向”即向右
				 * 比上一个可移动节点更右的,视为插入（即移动）
				 * 否则不变: a->b->c ====>  b->c->a
				 * lastPlacedIndex 初始为0
				 *  b的Oldindex为1 > lastPlacedIndex 不移动  lastPlacedIndex = b.Oldindex = 1
				 * c的Oldindex为2  > lastPlacedIndex  c也不移动  lastPlacedIndex = c.Oldindex = 2
				 * a的Oldindex为0  <lastPlacedIndex 标记移动
				 */
				if (oldIndex < lastPlacedIndex) {
					// 移动
					console.log(newFiber, '移动');
					newFiber.flags |= Placement;
					continue;
				} else {
					//不移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				newFiber.flags |= Placement;
			}
		}

		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});
		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key === null ? index : element.key;
		const before = existingChildren.get(keyToUse);
		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				if (before.tag === HostText) {
					existingChildren.delete(keyToUse);
					return useFiber(before, { content: element + '' });
				}
			}

			return new FiberNode(HostText, { content: element + '' }, keyToUse);
		}
		if (Array.isArray(element)) {
			return updateFragment(
				returnFiber,
				before,
				element,
				keyToUse,
				existingChildren
			);
		}

		//ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						);
					}
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}

					return createFiberFromElement(element);

				default:
					break;
			}
		}

		return null;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		const isUnKeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;
		if (isUnKeyedTopLevelFragment) {
			newChild = newChild?.props.children;
		}
		if (typeof newChild === 'object' && newChild !== null) {
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
				case REACT_FRAGMENT_TYPE:
					break;
				default:
					if (__DEV__) {
						console.warn('为实现的reconcile类型', newChild);
					}
			}
		}

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileTextNode(returnFiber, currentFiber, newChild)
			);
		}
		if (currentFiber !== null) {
			deleteRemainingChildren(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn('为实现的reconcile类型', newChild);
		}
		return null;
	};
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);

function updateSlot(
	returnFiber: FiberNode,
	oldFiber: FiberNode,
	newChild: any,
	existingChildren: ExistingChildren
) {
	const key = oldFiber !== null ? oldFiber.key : null;
	if (
		(typeof newChild === 'string' && newChild !== '') ||
		typeof newChild === 'number'
	) {
		// Text nodes don't have keys. If the previous node is implicitly keyed
		// we can continue to replace it without aborting even if it is not a text
		// node.
		if (key !== null) {
			return null;
		}

		return useFiber(oldFiber, { content: newChild + '' });
	}

	if (typeof newChild === 'object' && newChild !== null) {
		switch (newChild.$$typeof) {
			case REACT_ELEMENT_TYPE: {
				if (newChild.key === key) {
					return useFiber(oldFiber, newChild);
				} else {
					return null;
				}
			}
		}

		if (Array.isArray(newChild)) {
			if (key !== null) {
				return null;
			}

			return updateFragment(
				returnFiber,
				oldFiber,
				newChild,
				key,
				existingChildren
			);
		}
	}

	return null;
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber;

	if (!current || current.tag !== Fragment) {
		fiber = createFiberFromFragment(elements, key);
	} else {
		existingChildren.delete(key);
		fiber = useFiber(current, elements);
	}
	fiber.return = returnFiber;
	return fiber;
}
