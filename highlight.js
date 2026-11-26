import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-markup';

export function markup(source) {
  return Prism.highlight(source, Prism.languages.markup, 'markup');
}
