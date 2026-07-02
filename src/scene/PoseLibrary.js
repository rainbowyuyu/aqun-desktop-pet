/** 骨骼姿势库格式与烘焙/混合逻辑（编辑器 + 运行时共用） */

export const POSE_LIBRARY_VERSION = 1;
export const EULER_ORDER = 'XYZ';

export function createEmptyLibrary(modelId = 'aqun_rig') {
  return {
    version: POSE_LIBRARY_VERSION,
    modelId,
    eulerOrder: EULER_ORDER,
    poses: {
      bind: { name: 'Bind 绑定', bones: {} },
    },
    assignments: {
      rest: 'bind',
      typing: 'bind',
    },
    transitions: [],
  };
}

export function validateLibrary(lib) {
  if (!lib || typeof lib !== 'object') return false;
  if (!lib.poses || typeof lib.poses !== 'object') return false;
  return true;
}

export function cloneLibrary(lib) {
  return JSON.parse(JSON.stringify(lib));
}

/** 从 PoseController 导出单姿势 */
export function exportPoseFromController(controller, id, name) {
  const bones = {};
  for (const bone of controller.listBones()) {
    const euler = controller.getBoneEuler(bone.name);
    if (!euler || !hasEulerOffset(euler)) continue;
    bones[bone.name] = {
      euler: [...euler],
      locked: controller.isLocked(bone.name),
    };
  }
  return { id, name, bones };
}

export function hasEulerOffset(euler, eps = 1e-4) {
  return Math.abs(euler[0]) > eps || Math.abs(euler[1]) > eps || Math.abs(euler[2]) > eps;
}

/** 将姿势数据烘焙为 boneName → quaternion */
export function bakePoseQuaternions(controller, poseBones) {
  const out = new Map();
  if (!poseBones) return out;
  for (const [name, entry] of Object.entries(poseBones)) {
    const q = controller.computeBoneQuaternion(name, entry?.euler ?? [0, 0, 0]);
    if (q) out.set(name, q);
  }
  return out;
}

/** 混合两个姿势（t: 0→A, 1→B），respectLocks 时锁定骨保持当前欧拉 */
export function blendPoseData(poseA, poseB, t, locks = {}) {
  const names = new Set([
    ...Object.keys(poseA?.bones ?? {}),
    ...Object.keys(poseB?.bones ?? {}),
  ]);
  const bones = {};
  for (const name of names) {
    const locked = locks[name] ?? poseA?.bones?.[name]?.locked ?? poseB?.bones?.[name]?.locked ?? false;
    const a = poseA?.bones?.[name]?.euler ?? [0, 0, 0];
    const b = poseB?.bones?.[name]?.euler ?? [0, 0, 0];
    bones[name] = {
      euler: locked
        ? [...(t < 0.5 ? a : b)]
        : [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t,
        ],
      locked,
    };
  }
  return { bones };
}

export function ease(name, t) {
  const x = Math.max(0, Math.min(1, t));
  switch (name) {
    case 'linear':
      return x;
    case 'sine.inOut':
      return -(Math.cos(Math.PI * x) - 1) / 2;
    case 'quad.out':
      return 1 - (1 - x) * (1 - x);
    case 'back.out':
      return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
    default:
      return -(Math.cos(Math.PI * x) - 1) / 2;
  }
}

export function findTransition(lib, fromId, toId) {
  return lib.transitions?.find((tr) => tr.from === fromId && tr.to === toId) ?? null;
}

export function upsertPose(lib, id, pose) {
  lib.poses[id] = { ...pose, id };
  return lib;
}

export function deletePose(lib, id) {
  if (id === 'bind') return lib;
  delete lib.poses[id];
  lib.transitions = (lib.transitions ?? []).filter((tr) => tr.from !== id && tr.to !== id);
  for (const key of Object.keys(lib.assignments ?? {})) {
    if (lib.assignments[key] === id) lib.assignments[key] = 'bind';
  }
  return lib;
}

/** 将 ARM 分段 preset 展开为全骨骼姿势（兼容旧 SkeletalRig 格式） */
export function expandArmPresetToPose(side, preset, skeleton) {
  const bones = {};
  const isLeft = side === 'left';
  const segMap = {
    shoulder: isLeft ? ['shoulder.l', 'shoulderl'] : ['shoulder.r', 'shoulderr'],
    upper: isLeft ? ['c_arm_stretch.l', 'c_arm_stretchl'] : ['c_arm_stretch.r', 'c_arm_stretchr'],
    forearm: isLeft ? ['c_forearm_stretch.l', 'c_forearm_stretchl'] : ['c_forearm_stretch.r', 'c_forearm_stretchr'],
    hand: isLeft ? ['hand.l', 'handl'] : ['hand.r', 'handr'],
  };
  const boneNames = new Set(skeleton.bones.map((b) => b.name));

  for (const [key, euler] of Object.entries(preset)) {
    if (key === 'fingerHang') {
      const hang = euler;
      for (const bone of skeleton.bones) {
        const n = bone.name.toLowerCase();
        const onSide = isLeft ? (n.endsWith('l') || n.includes('.l')) : (n.endsWith('r') || n.includes('.r'));
        if (onSide && /thumb|index|middle|ring|pinky/.test(n)) {
          bones[bone.name] = {
            euler: [hang[0], isLeft ? hang[1] : -hang[1], isLeft ? hang[2] : -hang[2]],
            locked: false,
          };
        }
      }
      continue;
    }
    const aliases = segMap[key];
    if (!aliases) continue;
    const hit = aliases.find((a) => boneNames.has(a));
    if (hit) {
      bones[hit] = {
        euler: [euler[0], isLeft ? euler[1] : -euler[1], isLeft ? euler[2] : -euler[2]],
        locked: false,
      };
    }
  }
  return bones;
}

export function mergeBoneMaps(...maps) {
  return Object.assign({}, ...maps);
}
