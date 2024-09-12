import { Container } from 'hostConfig';
import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_runWithPriority,
	unstable_UserBlockingPriority
} from 'scheduler';
import { Props } from 'shared/ReactTypes';

type EventCallback = (e: Event) => void;
interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}
interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

export const elementPropsKey = '__props';

export interface DomElement extends Element {
	[elementPropsKey]: Props;
}

export function updateFiberProps(node: DomElement, props: Props) {
	node[elementPropsKey] = props;
}

const validEventTypeList = ['click'];

export function initEvent(container: Container, eventType: string) {
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件');
		return;
	}

	if (__DEV__) {
		console.log('初始化事件', eventType);
	}
	container.addEventListener(eventType, (e: any) => {
		dispatchEvent(container, eventType, e);
	});
}

function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent;

	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};

	return syntheticEvent;
}

export function dispatchEvent(
	container: Container,
	eventType: string,
	e: Event
) {
	const targetElement = e.target;

	if (targetElement === null) {
		console.warn('事件不存在target', e);
	}
	// 收集沿途事件
	const { capture, bubble } = collectPaths(
		targetElement as DomElement,
		container,
		eventType
	);
	//构造合成事件
	const se = createSyntheticEvent(e);
	//遍历capture
	triggerEventFlow(capture, se);
	if (!se.__stopPropagation) {
		// 便利bubble
		triggerEventFlow(bubble, se);
	}
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let index = 0; index < paths.length; index++) {
		const callback = paths[index];
		unstable_runWithPriority(eventTypeToSchedulerPriority(se.type), () => {
			callback.call(null, se);
		});

		if (se.__stopPropagation) {
			break;
		}
	}
}

function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		click: ['onClickCapture', 'onClick']
	}[eventType];
}

function collectPaths(
	targetElement: DomElement,
	container: Container,
	eventType: string
) {
	const paths: Paths = {
		bubble: [],
		capture: []
	};

	while (targetElement && targetElement !== container) {
		const elementProps = targetElement[elementPropsKey];
		if (elementProps) {
			const callbackNameList = getEventCallbackNameFromEventType(eventType);
			callbackNameList?.forEach((callbackname, i) => {
				const eventCallback = elementProps[callbackname];
				if (eventCallback) {
					if (i === 0) {
						paths.capture.unshift(eventCallback);
					} else {
						paths.bubble.push(eventCallback);
					}
				}
			});
		}
		targetElement = targetElement.parentNode as DomElement;
	}

	return paths;
}

function eventTypeToSchedulerPriority(eventType: string) {
	switch (eventType) {
		case 'click':
		case 'keydown':
		case 'keup':
			return unstable_ImmediatePriority;
		case 'scroll':
			return unstable_UserBlockingPriority;

		default:
			return unstable_IdlePriority;
	}
}
