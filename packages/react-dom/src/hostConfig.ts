import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTag';
import { DomElement, updateFiberProps } from './SyntheticEvent';
import { Props } from 'shared/ReactTypes';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props): Instance => {
	// TODO  props
	const element = document.createElement(type) as unknown;
	updateFiberProps(element as DomElement, props);

	return element as DomElement;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const insertChildToContainer = (
	container: Instance | Container,
	before: Instance,
	child: Instance
) => {
	container.insertBefore(child, before);
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
	text.textContent = content;
}

export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	container.removeChild(child);
}
