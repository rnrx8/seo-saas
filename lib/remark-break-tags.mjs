// Interpret only a standalone HTML break token; all other raw HTML stays inert.
export function remarkBreakTags() {
  return function transform(tree) {
    function walk(node) {
      if (!Array.isArray(node.children)) return
      node.children = node.children.map(child => {
        if (child.type === 'html' && /^<br\s*\/?\s*>$/i.test(child.value.trim())) {
          return { type: 'break' }
        }
        walk(child)
        return child
      })
    }
    walk(tree)
  }
}
