import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTag';
import { Props } from 'shared/ReactTypes';

export interface Container {
	rootId: number;
	children: (Instance | TextInstance)[];
}
export interface Instance {
	id: number;
	type: string;
	children: (Instance | TextInstance)[];
	parent: number;
	props: Props;
}
export interface TextInstance {
	text: string;
	id: number;
	parent: number;
}

let instanceCounter = 0;

export const createInstance = (type: string, props: Props): Instance => {
	const instance = {
		id: instanceCounter++,
		type,
		children: [],
		parent: -1,
		props
	};

	return instance;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	if (!child) return;
	const prevParnetId = child?.parent;
	const parentId = 'rootId' in parent ? parent.rootId : parent.id;
	if (prevParnetId !== -1 && prevParnetId !== (parent as Instance).id) {
		throw new Error('不能重复挂载child');
	}
	child.parent = parentId;
	parent.children.push(child);
};

export const createTextInstance = (content: string) => {
	const instance = {
		text: content,
		id: instanceCounter++,
		parent: -1
	};
	return instance;
};

export const appendChildToContainer = (parent: Container, child: Instance) => {
	const prevParnetId = child.parent;
	if (prevParnetId !== -1 && prevParnetId !== parent.rootId) {
		throw new Error('不能重复挂载child');
	}
	child.parent = parent.rootId;
	parent.children.push(child);
};

export const insertChildToContainer = (
	container: Instance | Container,
	before: Instance,
	child: Instance
) => {
	const index = container.children.indexOf(before);
	if (index === -1) {
		throw new Error('不存在这个befor');
	}
	const childIndex = container.children.indexOf(before);
	if (index !== -1) {
		// 已经插入过
		container.children.splice(childIndex, 1);
	}
	container.children.splice(index, 0, child);
};

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memorizeProps.content;
			return commitTextUpdate(fiber.stateNode, text);

		default:
			if (__DEV__) {
				console.warn('未实现的commitupdate', fiber);
			}
			break;
	}
}

export function commitTextUpdate(text: TextInstance, content: string) {
	text.text = content;
}

export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	const index = container.children.indexOf(child);
	if (index === -1) {
		throw new Error('不存在这个child');
	}
	container.children.splice(index, 1);
}

export const scheduleMicroTask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
			? (callback: (...arg: any) => void) =>
					Promise.resolve(null).then(callback)
			: setTimeout;
