/**
 *
 * @param root 从根节点开始渲染和调度
 * 两个阶段
 * diff阶段 对比新旧的虚拟doom 进行增量 更新或创建  对任务进行拆分/分片  拆分维度：fiber->单个虚拟dom,此阶段在渲染帧空闲时执行，可暂停
 *
 * render阶段成果是effect list 即对dom的变动
 * 有两个任务：1，根据虚拟dom生成fiber树 2，收集effectlist
 *
 * commit阶段， 进行真是dom更新创建，此阶段补课终端
 *
 */

import { DElETE, ELEMENT_TEXT, PLACEMENT, TAG_CLASS, TAG_HOST, TAG_ROOT, TAG_TEXT, UPDATE } from "./constants"
import { UpdateQueue } from "./updateQueue.ts"
import { setProps } from "./utils"

let nextUnitOfWork = null

let workInProgressRoot = null //RootFiber 根节点

let currentRoot = null // 渲染完成之后的根节点
let deletions = [] //删除的节点
export function scheduleRoot(rootFiber) {
  // 已经重新渲染过一遍的情况下,复用第一颗树(第二次之后的更新)
  if (currentRoot && currentRoot.alternate) {
    // 把第一次fiber出来的fiber tree直接拿来用，这一步是为了性能优化
    workInProgressRoot = currentRoot.alternate // 第一次渲染出来的fiber tree
    workInProgressRoot.alternate = currentRoot // 让这个树的alternate指向当前的currentRoot
    if (rootFiber) {
      workInProgressRoot.props = rootFiber.props // 让他的props更新成新的props
    }
  } else if (currentRoot /**第二次更新*/) {
    if (rootFiber) {
      rootFiber.alternate = currentRoot
      workInProgressRoot = rootFiber
    } else {
      workInProgressRoot = {
        ...currentRoot,
        alternate: currentRoot,
      }
    }
  } /**第一次渲染*/ else {
    workInProgressRoot = rootFiber
  }
  nextUnitOfWork = workInProgressRoot

  workInProgressRoot.firstEffect = workInProgressRoot.lastEffect = workInProgressRoot.nextEffect = null
  window.requestIdleCallback(workLoop, { timeout: 500 })
}

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }
  if (!nextUnitOfWork) {
    console.log("render 结束")
    commitRoot()
  } else {
    // 如果时间片到期没有完成，就需要请求浏览器再次调度
    window?.requestIdleCallback(workLoop, { timeout: 500 })
  }
}

function commitRoot() {
  // 删除节点
  deletions.forEach(commitWork)
  let currentFiber = workInProgressRoot.firstEffect
  while (currentFiber) {
    commitWork(currentFiber)
    currentFiber = currentFiber.nextEffect
  }
  deletions.length = 0 // 清空
  currentRoot = workInProgressRoot
  workInProgressRoot = null
}
function commitWork(currentFiber) {
  if (!currentFiber) return
  let returnFiber = currentFiber.return
  while (returnFiber.tag !== TAG_ROOT && returnFiber.tag !== TAG_HOST && returnFiber.tag !== TAG_TEXT) {
    returnFiber = returnFiber.return
  }
  let returnDOM = returnFiber.stateNode

  if (currentFiber.effectTag === PLACEMENT) {
    let nextFiber = currentFiber
    // 如果不是原生节点 则说明是class、function components 去找他的firstChild（即dom）,循环是可以解决组件嵌套问题
    while (nextFiber.tag !== TAG_ROOT && nextFiber.tag !== TAG_HOST && nextFiber.tag !== TAG_TEXT) {
      nextFiber = currentFiber.firstChild
    }
    returnDOM.appendChild(nextFiber.stateNode)
  } else if (currentFiber.effectTag === DElETE) {
    // returnDOM.removeChild(currentFiber.stateNode)
    return commitDeletion(currentFiber, returnDOM)
  } else if (currentFiber.effectTag === UPDATE) {
    if (currentFiber.type === ELEMENT_TEXT) {
      // 判断老节点和新节点  每个新节点的alternate 都指向老节点
      if (currentFiber.alternate.props.text !== currentFiber.props.text) {
        currentFiber.stateNode.textContent = currentFiber.props.text
      }
    } else {
      if (currentFiber.type === TAG_CLASS) {
        return (currentFiber.effectTag = null)
      }
      updateDom(currentFiber.stateNode, currentFiber.alternate.props, currentFiber.props)
    }
  }
  currentFiber.effectTag = null
}

function commitDeletion(currentFiber, returnDOM) {
  if (currentFiber.tag === TAG_HOST || currentFiber.tag === TAG_TEXT) {
    returnDOM.removeChild(currentFiber.stateNode)
  } else {
    commitDeletion(currentFiber.firstChild, returnDOM)
  }
}

function performUnitOfWork(currentFiber) {
  beginWork(currentFiber)
  // 优先深度遍历
  if (currentFiber.firstChild) {
    // child指向第一个子节点
    return currentFiber.firstChild
  }
  debugger
  // 找到最下层的子节点
  while (currentFiber) {
    completeUnitOfWork(currentFiber)
    // 从左至右遍历
    if (currentFiber.sibling) {
      return currentFiber.sibling
    }
    // 返回上一级接着遍历
    currentFiber = currentFiber.return
  }
}
// 每个fiber分别有 firstEffect 和lastEffect, 分别指向第一个副作用和最后一个副作用（从左至右，深度优先）
// 总的来说 是需要rootFiber拿到整个Effect链
function completeUnitOfWork(currentFiber) {
  // 当前节点的上一个节点
  let returnFiber = currentFiber.return
  // 非根节点
  if (returnFiber) {
    // 先让上一个节点(父节点 returnFiber)的effct链的第一个指向当前节点(子节点 currentFiber)的effcect链的第一个
    if (!returnFiber.firstEffect) {
      returnFiber.firstEffect = currentFiber.firstEffect //B1.first = C1 ,B1.last = C2 => A1.first = B1.first
    }
    if (currentFiber.lastEffect) {
      if (returnFiber.lastEffect) {
        // 父节点的lastEffect(上一个子节点)的nextEffect指向当前节点的firstEffect
        /**
         * 子节点和父节点都有lastEffect,两个都为叶子节点，且A1已经被赋值过,说明当前节点不是第一个叶子节点
         * 则需要上一个叶子节点（returnFiber.lastEffect）的nextEffect指向当前节点的firstEffect
         *  A1.first = C1, A2.last = B1  B2.first = D1  B2.last = D2  =====> B1.next = D1
         */
        returnFiber.lastEffect.nextEffect = currentFiber.firstEffect
      }
      /**  如果子节点有lastEffect而父节点没有， 则把子节点的last同步到父节点,说明此节点是第一个父节点的叶子节点；
       * 如果有，则是把子节点的effect链挂到父节点上
       */
      returnFiber.lastEffect = currentFiber.lastEffect //B1.first = C1 ,B1.last = C2 => A1.last = B1.last
    }

    if (currentFiber.lastEffect) {
      if (returnFiber.lastEffect) {
        returnFiber.lastEffect.nextEffect = currentFiber //B1.first = b1 ,B1.last = b1 ,A1.last === B1.last === C2     ===>     A1.last  === B1
        // returnFiber.nextEffect = currentFiber.firstEffect
        //↑↑↑↑↑↑这一步之后  A1获得Effect链  C1.next-> C2.next-> B1
      } else {
        returnFiber.lastEffect = currentFiber.lastEffect
      }
    }

    //把当前节点的effect挂到父节点

    // 自己有副作用
    const effectTag = currentFiber.effectTag
    if (effectTag) {
      // 如果父节点存在lastEffect, 则说明当前节点不是子节点的第一个,改变上一个子节点的指向
      if (returnFiber.lastEffect) {
        // 让上一个子节点的nextEffect 指向自己(作为上一个兄弟节点的下一个)
        returnFiber.lastEffect.nextEffect = currentFiber
      } else {
        /**
         *
         *当前节点是第一个子节点，切父节点无lastEffect，则初始化
         * fatherFiber.firstEffect = currentFiber
         * fatherFiber.lastEffect = currentFiber
         */
        returnFiber.firstEffect = currentFiber
      }
      // returnFiber.firstEffect = currentFiber

      // 重新改变父节点lastEffect的指向(当前自己子节点，作为子节点list的下一个)
      returnFiber.lastEffect = currentFiber
    }
  }
}

function beginWork(fiber) {
  // 如果是根节点
  if (fiber === workInProgressRoot) {
    //根节点
    // if (fiber.tag === TAG_ROOT) {
    updateHostRoot(fiber)
  } else if (fiber.tag === TAG_TEXT) {
    // 文本节点
    updateHostText(fiber)
  } else if (fiber.tag === TAG_HOST) {
    // 原生节点
    updateHost(fiber)
  } else if (fiber.tag === TAG_CLASS) {
    updateClassComponents(fiber)
  }
}

/**
 *
 *
 *
 *
 *
 *
 * dom 操作 */
function createDom(fiber) {
  if (fiber.tag === TAG_TEXT) {
    return document.createTextNode(fiber.props.text)
  } else if (fiber.tag === TAG_HOST) {
    let stateNode = document.createElement(fiber.type)
    updateDom(stateNode, {}, fiber.props)
    return stateNode
  }
}

function updateDom(stateNode, oldProps, newProps) {
  if (stateNode.setAttribute) setProps(stateNode, oldProps, newProps)
}

/**
 *
 *
 *
 *
 *
 *
 * 更新fiber */
function updateHostText(currentFiber) {
  if (!currentFiber.stateNode) {
    currentFiber.stateNode = createDom(currentFiber)
  }
}

function updateHostRoot(currentFiber) {
  let newChildren = currentFiber.props.children // [element]
  reconcileChildren(currentFiber, newChildren)
}

function updateHost(currentFiber) {
  if (!currentFiber.stateNode) {
    currentFiber.stateNode = createDom(currentFiber)
  }
  let newChildren = currentFiber.props.children // [element]
  reconcileChildren(currentFiber, newChildren)
}

// 这里其实是把class components 作为了一个新型的Fiber节点， 他的render(): Dom即是他的firstChild
function updateClassComponents(currentFiber) {
  if (!currentFiber.stateNode) {
    currentFiber.stateNode = new currentFiber.type(currentFiber.props)
    currentFiber.stateNode.internalFiber = currentFiber
    currentFiber.updateQueue = new UpdateQueue()
  }
  currentFiber.stateNode.state = currentFiber.updateQueue.forceUpdate(currentFiber.stateNode.state)

  let newElement = currentFiber.stateNode.render()
  const newChildren = [newElement]

  reconcileChildren(currentFiber, newChildren)
}
/**
 *
 *
 *
 *
 *
 *
 * 形成fiber类似联表的结构，生成子fiber,十个八个出个报告fiber链
 */
function reconcileChildren(currentFiber, newChildren) {
  let newChildIndex = 0 // 新子节点的索引
  let preSibling //上一个新的子fiber

  /**
   * 当currentFiber为父节点时，当下要生成的新fiber的老节点就是current.alertnate.firstChild，在scheduleRoot里进行的赋值
   * 后面会随着newChildIndex增加，改变oldFiber的指针
   */

  let oldFiber = currentFiber.alternate && currentFiber.alternate.firstChild
  oldFiber && (oldFiber.firstEffect = oldFiber.lastEffect = oldFiber.nextEffect = null)
  while (newChildIndex < newChildren.length || oldFiber) {
    let newChild = newChildren[newChildIndex]
    let newFiber
    // diff
    const sampleType = oldFiber && newChild && oldFiber.type == newChild.type
    let tag
    // 因为做了newChildIndex 和 OldFiberIndex的联合判断，所以可能newChild不存在，即现在的节点数比之前少

    if (newChild?.type === ELEMENT_TEXT) {
      //文本节点
      tag = TAG_TEXT
      // 因为做了newChildIndex 和 OldFiberIndex的联合判断，所以可能newChild不存在，即现在的节点数比之前少
    } else if (typeof newChild?.type === "string") {
      // 原生节点
      tag = TAG_HOST
    } else if (newChild && typeof newChild.type === "function" && newChild.type.prototype.isReactComponent) {
      tag = TAG_CLASS
    }
    //老的dom节点和新的dom类型一样，则说明可以复用
    if (sampleType) {
      if (oldFiber.alternate) {
        //这里和line24一样 也是为了性能优化
        // 说明至少更新过一次了
        newFiber = oldFiber.alternate
        newFiber.props = newChild.props
        newFiber.alternate = oldFiber
        newFiber.effectTag = UPDATE
        newFiber.nextEffect = null

        newFiber.updateQueue = oldFiber.updateQueue || new UpdateQueue()
      } else {
        newFiber = {
          tag: oldFiber.tag,
          type: oldFiber.type,
          props: newChild.props,
          stateNode: oldFiber.stateNode,
          return: currentFiber,
          alternate: oldFiber,
          effectTag: UPDATE,
          nextEffect: null,
          updateQueue: oldFiber.updateQueue || new UpdateQueue(),
        }
      }
    } else {
      if (newChild) {
        newFiber = {
          tag,
          type: newChild.type,
          props: newChild.props,
          stateNode: null,
          return: currentFiber,
          effectTag: PLACEMENT,
          updateQueue: new UpdateQueue(),
          nextEffect: null,
        }
      }

      if (oldFiber) {
        // 存在新老节点但是dom类型不一样
        oldFiber.effectTag = DElETE
        deletions.push(oldFiber)
      }
    }
    if (newFiber) {
      if (newChildIndex == 0) {
        // 第一个子元素情况下，把第一个子节点挂到父节点的child下
        currentFiber.firstChild = newFiber
      } else {
        preSibling.sibling = newFiber
      }

      preSibling = newFiber
    }

    // 同级的情况下，oldFiber和sibling同时后移
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }
    newChildIndex++
  }
}
/**
 * A1.first = a1
 * A1.last = a1
 *
 *
 * B1.first = b1
 * B1.last = b1
 *
 *
 *
 *
 *
 */
