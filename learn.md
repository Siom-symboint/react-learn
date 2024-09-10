# 1，react从架构上分为几个模块

schedule模块 负责任务调度 实现可中断更新的模块
Reconciler 协调器 负责生成fiber update 挂载dom
render 负责将真实的dom渲染出来 交给浏览器

# 2，Reconciler 分为哪几个步骤

Reconciler 主要还是一个遍历fiber tree的过程，fiber通过sibling child return 等属性 连接 兄弟节点 子节点 付节点 让一棵树的深度有限遍历变成可打断的行为成为了可能
总体上分为 render阶段 和commit阶段

## render阶段主要是是两个函数开启 beginWork 和 completeWork

### beginWork 向下“递”

在mounted阶段时 生成fiber tree 本质上还是一颗树的结构 和 dom一样 不过和dom树不完全相同， 只有HostComponent类型的fiber才有对应的真实dom节点
在update阶段 给fiber染色 给相应的effect的fiber节点打上effectTag，

### completeWork 向上“归”

在mounted阶段
给相应的HostComponent生成dom节点 ，收集effect 并向上传递，为了避免收集所有的effectList还要在做一次遍历 最终遍历到root节点时，会形成一条effectList（这条effectList上对应的fiber节点都会有这么一条）单向列表，第一个fiber节点在firstEffect 最后一个fiber节点在LastEffect

在update阶段， 主要作用是 diff props 通过（updateHostComponents），处理完的props会以数组形式保存在workInprogress.updateQueue中

## 在commit阶段 三个阶段对应三个方法

### before mutation commitBeforeMutationEffects 函数 此时还没有产生dom变化

blur和focus的操作
getSnapShotBefroeUpdate 在最近一次渲染输出提交到Dom节点之前调用
如果root节点也有effectTag,那么在挂载在effectList的最末尾（由dom的结构可知，children的更新完成才能代表父节点的更新完成）
！！！调度flushPassiveEffect=>注册useEffect的回调函数 ！！！

### mutation commitMutationEffects 函数

遍历整条effectList
更新文本节点（优化）
Ref的更新
对应不同的EffectTag（Placement,ReplaceMentAndUpdate(通常来源于合并Effect，存在于父节点)，Update，Deletion），执行不同的操作,根据情况插入到不同的dom中去（有兄弟节点则调用InsertBefore，没有则执行appendChild）

#### Placement=> commitPlacement插入,

#### update=>commitWork => commitHookEffectListUnmount 中会调用useLayoutEffect的销毁函数

### Deletion => commitUnmount删除节点， 找到父节点，整个fiber子树都进行删除,删除过程中，对于FunctionComponent类型的节点,需要执行对应的Effect的销毁函数，HostCompoent执行ref解绑，ClassCompoent执行umMount生命钩子

对于HostComponent而言 执行commitUpdate方法,接受当前fiber节点的updateQueue属性[key1,value1,key2,value2]的格式

# ！这一步执行完 实际上workInProgress树上已经渲染了一个完整的dom 在rootFiber上

### layout commitLayoutEffects函数

#### 更改current指针 此时完成了workInprogress树和current 树的切换，因为mutation阶段执行了umount生命钩子和effectList的销毁函数 所以在这一步执行 这就是所谓的 完成了渲染

执行commitLayoutEffectOnFiber
首先执行layOutEffect

执行enqueuePendingPassiveHookEffectUnMount
把对应的Effect 推进队列中，给下一次 commit的起点，before mutation的时候去进行执行注册他们的销毁函数
而后执行componentDidMount和componentDidUpdate生命钩子

## commit阶段完成后 执行调度flushPassiveEffect 内部执行注册的回调

3，Diff算法
显而易见 mount阶段不存在diff
为了减少算法的复杂度

## 1， 只对同级元素进行diff

## 2, 两个不同类型的元素会产生不同的树,这时候直接进行销毁，不在进行下一步的diff，同样的元素进行复用

## 3， 通过key 和prop来按时安歇自元素在不同的渲染下能能够保持稳定 ==>针对一个list的渲染和sibling的渲染

Update的数据结构

```js
    const update = {
        eventTime,18已经废弃
        lane:任务优先级
        suspenseconfig:
        tag:更新的类型 包括UpdateState ReplaceState ForceUpdate CaptureUpdate
        payLoad：更新需要挂载的数据，对于setState而言 是他的第一个传参（state），对于ReactDom.Render而言 是他的第一个传参（jsx）
        callback: 更新的回调函数，也就是setState第二个参数，更新成功后的回调函数，对于ReactDom.Render而言，也是他更新成功后的回调函数
        next: 于其他update形成链表
    }

```

## Update链表保存在fiber的updateQueue中，

### 1，其中HostComponent的updateQueue是一个[key1,value1,key2,value2]的格式

### 2,对于hostRoot和ClassComponents而言，他的数据结构为

```js
const queue: UpdateQueue<State> = {
    baseState: 本次更新前该Fiber节点的state，Update基于该state计算更新后的state
    firstBaseUpdate: firstBaseUpdate与lastBaseUpdate：本次更新前该Fiber节点已保存的Update。以链表形式存在，链表头为firstBaseUpdate，链表尾为lastBaseUpdate。之所以在更新产生前该Fiber节点内就存在Update，是由于某些Update优先级较低所以在上次render阶段由Update计算state时被跳过。,
    lastBaseUpdate: null,
    shared: {
      pending: 触发更新时，产生的Update会保存在shared.pending中形成单向环状链表。当由Update计算state时这个环会被剪开并连接在lastBaseUpdate后面。,
    },
    effects: null,
  };
```

4，correnct模式中，既然低优先级可能会被高优先级打断 那如何保证Update不都是
每个Udpate对象的share.pending 是一个单项换装链表，在进行计算之前，环状列表会被剪开，拼接在lasetBaseUpdate下，再基于这个链表进行更新

## 打断后如何更新？ react虽然复杂 但是没有“黑魔法”

两个关键
baseState
baseUpdate
baseState 即为当前的state
baseUpdate为上一次因为优先级不够而还没有执行完的state 仍旧是一个链表

### 如果是render阶段被中断后重新开始 会给予currentUpdateQueue 克隆除workInProgress的updateQueue 由于current updateQueue保存了上一次的Update 所以不会丢失

baseState 会在最终计算完成的时候 再重新被赋值

5，Hook的数据结构？

```js
type Hook = {
  memoizedState: any,
  baseState: any,
  baseQueue: Update<any, any> | null,
  queue: any,
  next: Hook | null,
};

```

hook的数据结构和ClassComponents的updateQueue类似 有一个mermoizedState（历史状态），queue.pending=>当前需要执行的Hook

6, 优先级的概念？
区分三个优先级
schedule优先级=>小顶堆 每次都执行优先级最高的任务

lane优先级， react优先级，实现可插队机制 update还是交给schedule来实现的，所有一个schedule to lane 优先级的流程

事件优先级 分三种， 离散事件（点击，输入）>一般优先级（页面滚动等出发渲染）>一般优先级
