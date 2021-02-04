import React from "./react"
import ReactDOM from "./react-dom"
const style = { border: "3px solid red", margin: "5px" }
const el = (
  <div id='A1' style={style}>
    A1
    <div id='B1' style={style}>
      B1
      <div id='C1' style={style}>
        C1
      </div>
      <div id='C2' style={style}>
        C2
        <div id='D1' style={style}>
          D1
        </div>
      </div>
    </div>
    <div id='B2'>B2</div>
  </div>
)

function Dice(props) {
  console.log(props.children)
  return (
    <div>
      {props.title}---dice--{props.children}
    </div>
  )
}

class Com extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      count: 0,
    }
  }

  add = () => {
    this.setState({
      count: this.state.count + 1,
    })
  }

  render() {
    return (
      <div>
        {this.state.count}
        {this.props.title}
        <button onClick={this.add}>add</button>
        {this.props.children}
      </div>
    )
  }
}

ReactDOM.render(
  <div>
    <Dice title='?'>
      <Com title='淦'>
        <div>222</div>
      </Com>
    </Dice>
  </div>,
  document.getElementById("root")
)

let render2 = document.getElementById("render2")

render2.addEventListener("click", () => {
  const ele = (
    <div id='A1' style={style}>
      A1{Math.random()}
      <div id='B1' style={style}>
        B1
      </div>
      <div id='B2'>B2</div>
    </div>
  )
  ReactDOM.render(ele, document.getElementById("root"))
})

let render3 = document.getElementById("render3")

render3.addEventListener("click", () => {
  const ele = (
    <div id='A1' style={style}>
      111{Math.random()}
    </div>
  )
  ReactDOM.render(ele, document.getElementById("root"))
})
