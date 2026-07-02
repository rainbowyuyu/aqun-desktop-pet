/** LaTeX 简易转换（常见公式 → Unicode / MathML / Word 可粘贴 HTML） */
const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
  varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const SYMBOLS = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', leq: '≤', geq: '≥',
  neq: '≠', approx: '≈', equiv: '≡', infty: '∞', partial: '∂', nabla: '∇',
  sum: '∑', prod: '∏', int: '∫', oint: '∮', sqrt: '√', ldots: '…', cdots: '⋯',
  forall: '∀', exists: '∃', in: '∈', notin: '∉', subset: '⊂', supset: '⊃',
  cup: '∪', cap: '∩', emptyset: '∅', rightarrow: '→', leftarrow: '←',
  Rightarrow: '⇒', Leftarrow: '⇐', iff: '⇔', degree: '°', circ: '°',
  textdegree: '°', prime: '′',
};

function stripDelimiters(src) {
  let s = String(src || '').trim();
  s = s.replace(/^\$\$([\s\S]*)\$\$$/, '$1').replace(/^\$([\s\S]*)\$$/, '$1');
  s = s.replace(/^\\\[([\s\S]*)\\\]$/, '$1').replace(/^\\\(([\s\S]*)\\\)$/, '$1');
  return s.trim();
}

function replaceMacros(text) {
  let s = text;
  s = s.replace(/\\([a-zA-Z]+)/g, (_, name) => GREEK[name] || SYMBOLS[name] || `\\${name}`);
  s = s.replace(/\^\{([^}]*)\}/g, (_, c) => toSup(c));
  s = s.replace(/\^([a-zA-Z0-9])/g, (_, c) => toSup(c));
  s = s.replace(/_\{([^}]*)\}/g, (_, c) => toSub(c));
  s = s.replace(/_([a-zA-Z0-9])/g, (_, c) => toSub(c));
  s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)');
  s = s.replace(/\\sqrt\{([^}]*)\}/g, '√($1)');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/\\,/g, ' ').replace(/\\;/g, ' ').replace(/\\!/g, '');
  s = s.replace(/\\quad|\\qquad/g, '  ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ';
const SUB = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎';

function toSup(str) {
  return String(str)
    .split('')
    .map((c) => {
      const i = '0123456789+-=()'.indexOf(c);
      if (i >= 0) return SUP[i] || c;
      if (c === 'n') return 'ⁿ';
      return c;
    })
    .join('');
}

function toSub(str) {
  return String(str)
    .split('')
    .map((c) => {
      const i = '0123456789+-=()'.indexOf(c);
      if (i >= 0) return SUB[i] || c;
      return c;
    })
    .join('');
}

export function latexToUnicode(src) {
  const core = stripDelimiters(src);
  return replaceMacros(core);
}

/** 简易 LaTeX → MathML（常见结构） */
export function latexToMathML(src) {
  const core = stripDelimiters(src);
  let m = escXml(core);
  m = m.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (_, a, b) =>
    `<mfrac><mrow>${toMathML(a)}</mrow><mrow>${toMathML(b)}</mrow></mfrac>`);
  m = m.replace(/\\sqrt\{([^}]*)\}/g, (_, a) =>
    `<msqrt><mrow>${toMathML(a)}</mrow></msqrt>`);
  m = m.replace(/\^\{([^}]*)\}/g, (_, a) => `<msup><mrow></mrow><mrow>${toMathML(a)}</mrow></msup>`);
  m = m.replace(/_\{([^}]*)\}/g, (_, a) => `<msub><mrow></mrow><mrow>${toMathML(a)}</mrow></msub>`);
  Object.entries(GREEK).forEach(([k, v]) => {
    m = m.replace(new RegExp(`\\\\${k}\\b`, 'g'), `<mi>${v}</mi>`);
  });
  m = m.replace(/\\([a-zA-Z]+)/g, (_, name) => {
    if (SYMBOLS[name]) return `<mo>${SYMBOLS[name]}</mo>`;
    return `<mi>${name}</mi>`;
  });
  return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${m}</mrow></math>`;
}

function toMathML(part) {
  return escXml(stripDelimiters(part)).replace(/([a-zA-Z0-9]+)/g, '<mi>$1</mi>');
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Word 可识别的 HTML（含 MathML） */
export function latexToWordHtml(src) {
  const mathml = latexToMathML(src);
  return `<!DOCTYPE html><html><body><!--[if gte msie 9]><xml><mso:OfficeDocumentSettings/></xml><![endif]--><p>${mathml}</p></body></html>`;
}

export const LATEX_SNIPPETS = [
  { name: '分数', latex: '\\frac{a}{b}' },
  { name: '根号', latex: '\\sqrt{x}' },
  { name: '求和', latex: '\\sum_{i=1}^{n} x_i' },
  { name: '积分', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { name: '矩阵 2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { name: '希腊 α', latex: '\\alpha + \\beta = \\gamma' },
  { name: '极限', latex: '\\lim_{x \\to 0} \\frac{\\sin x}{x}' },
  { name: '偏导', latex: '\\frac{\\partial f}{\\partial x}' },
  { name: '范数', latex: '\\|x\\|_2' },
  { name: '内积', latex: '\\langle a, b \\rangle' },
];
