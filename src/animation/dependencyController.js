import { LoopOnce } from 'three';

// Keep dots: they delimit the dependency grammar, not just display names.
export function parseAnimationName(name) {
  const [motion, ...requirements] = name.toLowerCase().split('.requires.');
  const match = /^(?:out\.([a-z0-9_]+)|([a-z0-9_]+)\.open)$/.exec(motion);
  return {
    id: match ? match[1] || match[2] : null,
    requirements,
    invalid: requirements.length > 0 && (!match || requirements.some(id => !/^[a-z0-9_]+$/.test(id))),
  };
}

export function createDependencyController(mixer, actions, warn = console.warn) {
  const parts = new Map(Object.entries(actions).map(([name, action]) => [name, {
    name, action, ...parseAnimationName(name), parents: [], children: [],
    state: 'closed', pending: null, group: null,
  }]));
  const byId = new Map();
  for (const part of parts.values()) {
    if (!part.id) continue;
    const matches = byId.get(part.id) || [];
    matches.push(part);
    byId.set(part.id, matches);
  }
  for (const part of parts.values()) {
    if (part.id && byId.get(part.id).length !== 1) part.invalid = true;
    for (const id of part.requirements) {
      const matches = byId.get(id) || [];
      if (matches.length !== 1) part.invalid = true;
      for (const parent of matches) {
        part.parents.push(parent);
        parent.children.push(part);
      }
    }
  }
  const visited = new Set();
  const stack = new Set();
  const visit = part => {
    if (stack.has(part)) {
      part.invalid = true;
      return;
    }
    if (visited.has(part)) return;
    stack.add(part);
    part.parents.forEach(visit);
    stack.delete(part);
    visited.add(part);
  };
  parts.forEach(visit);
  const component = start => {
    const result = new Set();
    const collect = part => {
      if (result.has(part)) return;
      result.add(part);
      [...part.parents, ...part.children].forEach(collect);
    };
    collect(start);
    return [...result];
  };
  for (const part of parts.values()) {
    if (part.group) continue;
    const members = component(part);
    const group = { invalid: members.some(item => item.invalid), locked: false };
    members.forEach(item => {
      item.group = group;
    });
  }
  const invalid = [...parts.values()].filter(part => part.group.invalid);
  if (invalid.length) warn(`Animation dependencies are invalid; disabled clips: ${invalid.map(part => part.name).join(', ')}`);

  let disposed = false;
  const finished = ({ action }) => {
    for (const part of parts.values()) {
      if (part.action !== action || !part.pending) continue;
      part.state = part.state === 'opening' ? 'open' : 'closed';
      const resolve = part.pending;
      part.pending = null;
      resolve();
    }
  };
  mixer?.addEventListener('finished', finished);

  const move = (part, open) => {
    if (disposed || part.state === (open ? 'open' : 'closed')) return Promise.resolve();
    return new Promise(resolve => {
      const action = part.action;
      part.state = open ? 'opening' : 'closing';
      part.pending = resolve;
      action.reset();
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.time = open ? 0 : action.getClip().duration;
      action.setEffectiveTimeScale(open ? 1 : -1);
      action.play();
    });
  };
  // Memoization also handles shared prerequisites in a dependency DAG.
  const transition = (part, open, jobs) => {
    if (disposed) return Promise.resolve();
    if (!jobs.has(part)) {
      const prerequisites = open ? part.parents : part.children;
      jobs.set(part, Promise.all(prerequisites.map(item => transition(item, open, jobs)))
        .then(() => move(part, open)));
    }
    return jobs.get(part);
  };

  return {
    async toggle(name) {
      const part = parts.get(name);
      if (!part || part.group.invalid || part.group.locked || disposed) return false;
      const { group } = part;
      group.locked = true;
      try {
        await transition(part, part.state === 'closed', new Map());
        return !disposed;
      } finally {
        group.locked = false;
      }
    },
    dispose() {
      disposed = true;
      mixer?.removeEventListener('finished', finished);
      parts.forEach(part => {
        part.pending?.();
        part.pending = null;
      });
    },
  };
}
