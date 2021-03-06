import { ELEMENT_TEXT } from "./constants"
import { scheduleRoot } from "./schedule-update-component"
import { Update } from "./updateQueue.ts"

/**
 * @param type
 *
 * @param config
 *
 * @param children
 */
function createElement(type, config, ...children) {
  return {
    type,
    props: {
      ...config,
      children: children
        .map((child) => {
          // 要想办法判断是正确的React.createElement出来的对象
          if (typeof child === "object") {
            if (child.type && child.props) {
              return child
            } else {
              return {
                type: ELEMENT_TEXT,
                props: { text: child, children: [] },
              }
            }
          } else {
            return {
              type: ELEMENT_TEXT,
              props: { text: child, children: [] },
            }
          }
        })
        .flat(Infinity),
    },
  }
}

class Component {
  constructor(props) {
    this.props = props
    // 放在components对应的fiber节点上 而不是组件本身
    // this?.internalFiber?.updateQueue = new UpdateQueue()
  }

  setState(payload) {
    let update = new Update(payload)
    this.internalFiber.updateQueue.enqueueUpdate(update)
    scheduleRoot()
  }
}

Component.prototype.isReactComponent = true

const React = {
  createElement,
  Component,
}
export default React
