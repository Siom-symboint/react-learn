import { TAG_ROOT } from "./constants"
import { scheduleRoot } from "./schedule-update-component"

/**
 * render是要把一个元素渲染到容器内部
 */
function render(element, container) {
  let rootFiber = {
    tag: TAG_ROOT, //每个fiber会有一个TAG,表示元素类型
    stateNode: container, //一般情况下如果这个元素是一个原生节点的话，stateNode指向真实DOM元素
    props: {
      children: [element], // 虚拟DOM
    },
  }
  scheduleRoot(rootFiber)
}

export default {
  render,
}
