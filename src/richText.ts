const safePasteTags = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'span', 'h1', 'h2', 'h3', 'h4',
  'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'hr',
])

const removedPasteTags = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template',
  'form', 'input', 'button', 'textarea', 'select', 'meta', 'link',
])

const readingSurfaces: [number, number, number][] = [
  [17, 25, 40], // Midnight Navy reading page
  [33, 22, 45], // Amethyst Dusk reading page
  [40, 37, 34], // Charcoal Hearth reading page
]

function parseCssColor(value: string): [number, number, number] | null {
  if (!value.trim() || typeof document === 'undefined') return null
  const probe = document.createElement('span')
  probe.style.color = ''
  probe.style.color = value
  if (!probe.style.color) return null
  probe.style.position = 'fixed'
  probe.style.visibility = 'hidden'
  document.body.append(probe)
  const normalized = getComputedStyle(probe).color
  probe.remove()
  const channels = normalized.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/iu)
  if (!channels) return null
  return [Number(channels[1]), Number(channels[2]), Number(channels[3])]
}

function luminance([red, green, blue]: [number, number, number]) {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(first: [number, number, number], second: [number, number, number]) {
  const light = Math.max(luminance(first), luminance(second))
  const dark = Math.min(luminance(first), luminance(second))
  return (light + 0.05) / (dark + 0.05)
}

export function readablePastedColor(value: string) {
  const color = parseCssColor(value)
  if (!color || luminance(color) < 0.035) return null
  if (!readingSurfaces.every((surface) => contrast(color, surface) >= 4.5)) return null
  return `rgb(${color.map((channel) => Math.round(channel)).join(', ')})`
}

/**
 * Keeps the structural formatting the editor supports while dropping unsafe markup and
 * foreground colors that would disappear on any of the app's reading surfaces.
 */
export function sanitizePastedHtml(html: string) {
  const source = new DOMParser().parseFromString(html, 'text/html')
  const output = document.createElement('div')

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '')
    if (!(node instanceof Element)) return null

    const sourceTag = node.tagName.toLowerCase()
    if (removedPasteTags.has(sourceTag)) return null
    const targetTag = sourceTag === 'font' ? 'span' : sourceTag
    const children = document.createDocumentFragment()
    for (const child of node.childNodes) {
      const cleaned = cleanNode(child)
      if (cleaned) children.append(cleaned)
    }

    if (!safePasteTags.has(targetTag)) return children
    const target = document.createElement(targetTag)
    target.append(children)

    if (targetTag === 'p') {
      const indent = node.getAttribute('data-indent')
      if (indent && /^[1-4]$/u.test(indent)) target.setAttribute('data-indent', indent)
      if (node.getAttribute('data-first-line-indent') === 'true') target.setAttribute('data-first-line-indent', 'true')
    }

    const explicitColor = node.getAttribute('color') || (node as HTMLElement).style?.color
    const safeColor = explicitColor ? readablePastedColor(explicitColor) : null
    if (safeColor) {
      if (targetTag === 'span') target.style.color = safeColor
      else {
        const colorSpan = document.createElement('span')
        colorSpan.style.color = safeColor
        colorSpan.append(...Array.from(target.childNodes))
        target.append(colorSpan)
      }
    }
    return target
  }

  for (const child of source.body.childNodes) {
    const cleaned = cleanNode(child)
    if (cleaned) output.append(cleaned)
  }
  return output.innerHTML
}
