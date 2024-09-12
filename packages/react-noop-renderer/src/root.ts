import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { Container, Instance } from './hostConfig';
import { ReactElementType } from 'shared/ReactTypes';

import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';

let idCounter = 0;
export function createRoot() {
	const container: Container = {
		rootId: idCounter++,
		children: []
	};
	//@ts-ignore
	const root = createContainer(container);

	function getChildren(parent: Container | Instance) {
		if (parent) {
			return parent.children;
		}
		return null;
	}

	function getChildrenAsJsx(root: Container) {
		const children = childToJsx(getChildren(root));
		if (Array.isArray(children)) {
			return {
				$$typeof: REACT_ELEMENT_TYPE,
				type: REACT_FRAGMENT_TYPE,
				key: null,
				ref: null,
				props: { children }
			};
		}

		return children;
	}
	function childToJsx(child: any): any {
		if (typeof child === 'string' || typeof child === 'number') {
			return child;
		}

		if (Array.isArray(child)) {
			if (child.length === 0) {
				return null;
			}

			if (child.length === 1) {
				return childToJsx(child[0]);
			}

			const children = child.map(childToJsx);

			if (
				children.every(
					(child) => typeof child === 'string' || typeof child === 'number'
				)
			) {
				return children.join('');
			}

			return children;
		}

		if (Array.isArray(child.children)) {
			const instance: Instance = child;
			const children = childToJsx(instance.children);
			const props = instance.props;

			if (children !== null) {
				props.children = children;
			}

			return {
				$$typeof: REACT_ELEMENT_TYPE,
				type: instance.type,
				key: null,
				ref: null,
				props
			};
		}

		return child.text;
	}
	return {
		render(element: ReactElementType) {
			updateContainer(element, root);
		},
		getChildren() {
			return getChildren(container);
		},
		getChildrenAsJsx() {
			return getChildrenAsJsx(container);
		}
	};
}

export const version = '0.0.1';
