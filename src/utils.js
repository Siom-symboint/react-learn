export function setProps(dom, oldProps, newProps) {
  for (const key in oldProps) {
    if (key !== "children") {
      if (!newProps.hasOwnProperty(key)) {
        setProp(dom, key, newProps[key])
      } else {
        dom.removeAttribute(key)
      }
    }
  }

  for (const key in newProps) {
    if (key !== "children") {
      setProp(dom, key, newProps[key])
    }
  }
}
export function setProp(dom, key, value) {
  if (/^on/.test(key)) {
    dom[key.toLowerCase()] = value
  } else if (key === "style") {
    if (value) {
      for (const styleName in value) {
        dom.style[styleName] = value[styleName]
      }
    }
  } else {
    dom.setAttribute(key, value)
  }
}
