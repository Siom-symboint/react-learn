export class Update {
  payload: any
  constructor(payload: any) {
    this.payload = payload
  }
}

export class UpdateQueue {
  firstUpdate: any
  lastUpdate: any
  constructor() {
    this.firstUpdate = null
    this.lastUpdate
  }

  enqueueUpdate(update: any) {
    if (this.lastUpdate === null) {
      this.firstUpdate = this.lastUpdate = update
    } else {
      this.lastUpdate.nextUpdate = update
      this.lastUpdate = update
    }
  }

  forceUpdate(state: any) {
    let currentUpdate = this.firstUpdate
    while (currentUpdate) {
      state = typeof currentUpdate.payload === "function" ? currentUpdate.payload(state) : currentUpdate.payload
      state = { ...state, ...currentUpdate.payload }
      
      currentUpdate = currentUpdate.nextUpdate
    }
    this.firstUpdate = this.lastUpdate = null
    return state
  }
}
