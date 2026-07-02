import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

const PICK_RADIUS = 0.045;

function estimateBoneBoxSize(bone) {
  const child = bone.children.find((c) => c.isBone);
  let halfLen = 0.028;
  if (child) {
    halfLen = Math.max(0.016, child.position.length() * 0.5);
  }
  const width = Math.max(0.018, halfLen * 0.55);
  return { halfLen, width };
}

function createBoneBoxHelper(bone, { color = 0x5eb8ff, opacity = 0.42 } = {}) {
  const { halfLen, width } = estimateBoneBoxSize(bone);
  const geom = new THREE.BoxGeometry(width, halfLen * 2, width);
  const edges = new THREE.EdgesGeometry(geom);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
    }),
  );
  lines.renderOrder = 998;

  const child = bone.children.find((c) => c.isBone);
  if (child) {
    lines.position.copy(child.position).multiplyScalar(0.5);
  }

  const group = new THREE.Group();
  group.add(lines);
  group.userData.boneName = bone.name;
  bone.add(group);
  return group;
}

/**
 * 3D 骨骼可视化 + 模式切换 + 框选 + Gizmo
 */
export class BoneEditorOverlay {
  constructor(scene, camera, canvas, pose, orbitControls) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.pose = pose;
    this.orbitControls = orbitControls;

    this.mode = 'edit';
    this.selectedBone = null;
    this.settings = {
      showSkeleton: true,
      showBoneBoxes: true,
      transformTool: 'translate',
    };

    this.onBoneSelect = null;
    this.onBoneRotate = null;
    this.onModeChange = null;

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._pickEnabled = true;

    this._skeletonHelper = null;
    this._selectMarker = null;
    this._transformControls = null;
    this._boneBoxMap = new Map();
    this._selectedBoxGroup = null;

    this._onPointerDown = (e) => this._handlePointerDown(e);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
  }

  attachToModel(model) {
    this.disposeHelpers();

    let skinned = null;
    model.traverse((o) => {
      if (o.isSkinnedMesh && !skinned) skinned = o;
    });

    if (skinned) {
      this._skeletonHelper = new THREE.SkeletonHelper(skinned);
      this._skeletonHelper.material.color.set(0x5eb8ff);
      this._skeletonHelper.material.transparent = true;
      this._skeletonHelper.material.opacity = 0.55;
      this.scene.add(this._skeletonHelper);
    }

    this._selectMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 14, 14),
      new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    this._selectMarker.renderOrder = 999;
    this.scene.add(this._selectMarker);
    this._selectMarker.visible = false;

    this._buildBoneBoxes();

    this._transformControls = new TransformControls(this.camera, this.canvas);
    this._transformControls.setMode(this.settings.transformTool === 'rotate' ? 'rotate' : 'translate');
    this._transformControls.setSpace('local');
    this._transformControls.size = 0.72;
    this.scene.add(this._transformControls);

    this._transformControls.addEventListener('dragging-changed', (e) => {
      if (this.mode === 'edit') {
        this._pickEnabled = !e.value;
      }
    });

    this._transformControls.addEventListener('objectChange', () => {
      if (!this.selectedBone || this.mode !== 'edit') return;
      this.pose.finalize();
      this.onBoneRotate?.(this.selectedBone);
    });

    this.applySettings(this.settings);
    this._applyModeState();
  }

  _buildBoneBoxes() {
    this._clearBoneBoxes();
    for (const bone of this.pose.listBones()) {
      const group = createBoneBoxHelper(bone);
      this._boneBoxMap.set(bone.name, group);
    }
    this._refreshBoneBoxVisibility();
  }

  _clearBoneBoxes() {
    for (const group of this._boneBoxMap.values()) {
      group.parent?.remove(group);
      group.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    }
    this._boneBoxMap.clear();
    if (this._selectedBoxGroup) {
      this._selectedBoxGroup.parent?.remove(this._selectedBoxGroup);
      this._selectedBoxGroup.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      this._selectedBoxGroup = null;
    }
  }

  setMode(mode) {
    this.mode = mode === 'preview' ? 'preview' : 'edit';
    this._applyModeState();
    this.onModeChange?.(this.mode);
  }

  _applyModeState() {
    const isPreview = this.mode === 'preview';
    this.orbitControls.enabled = isPreview;
    this._pickEnabled = !isPreview;

    if (isPreview && this._transformControls) {
      this._transformControls.detach();
      this._transformControls.enabled = false;
    } else {
      this.setSelectedBone(this.selectedBone);
    }

    this._refreshBoneBoxVisibility();
  }

  getMode() {
    return this.mode;
  }

  setTransformTool(tool) {
    const mode = tool === 'rotate' ? 'rotate' : 'translate';
    this.settings.transformTool = mode;
    if (this._transformControls) {
      this._transformControls.setMode(mode);
    }
  }

  getTransformTool() {
    return this.settings.transformTool ?? 'translate';
  }

  applySettings(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    if (this._transformControls) {
      const mode = this.settings.transformTool === 'rotate' ? 'rotate' : 'translate';
      this._transformControls.setMode(mode);
    }
    if (this._skeletonHelper) {
      this._skeletonHelper.visible = !!this.settings.showSkeleton;
    }
    this._refreshBoneBoxVisibility();
  }

  _refreshBoneBoxVisibility() {
    const showAll = !!this.settings.showBoneBoxes && this.mode === 'edit';
    for (const [name, group] of this._boneBoxMap) {
      const isSelected = name === this.selectedBone;
      group.visible = showAll && !isSelected;
    }

    if (this._selectedBoxGroup) {
      this._selectedBoxGroup.visible = !!this.selectedBone
        && (this.settings.showBoneBoxes || this.mode === 'preview');
    }
  }

  setSelectedBone(name) {
    this.selectedBone = name;
    const bone = name ? this.pose.getBone(name) : null;

    if (this._selectMarker) {
      this._selectMarker.visible = !!bone;
      if (bone) {
        bone.getWorldPosition(this._selectMarker.position);
      }
    }

    if (this._selectedBoxGroup) {
      this._selectedBoxGroup.parent?.remove(this._selectedBoxGroup);
      this._selectedBoxGroup.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      this._selectedBoxGroup = null;
    }

    if (bone) {
      this._selectedBoxGroup = createBoneBoxHelper(bone, {
        color: 0xffcc44,
        opacity: 0.95,
      });
      this._selectedBoxGroup.scale.set(1.12, 1.12, 1.12);
    }

    if (this._transformControls) {
      const canEdit = this.mode === 'edit' && bone && !this.pose.isLocked(name);
      if (canEdit) {
        this._transformControls.attach(bone);
        this._transformControls.enabled = true;
      } else {
        this._transformControls.detach();
        this._transformControls.enabled = false;
      }
    }

    this._refreshBoneBoxVisibility();
  }

  getBoneWorldPosition(name) {
    const bone = this.pose.getBone(name);
    if (!bone) return null;
    const v = new THREE.Vector3();
    bone.getWorldPosition(v);
    return v;
  }

  update() {
    if (this._skeletonHelper) {
      this._skeletonHelper.updateMatrixWorld(true);
    }

    if (this.selectedBone && this._selectMarker?.visible) {
      const bone = this.pose.getBone(this.selectedBone);
      if (bone) {
        bone.getWorldPosition(this._selectMarker.position);
      }
    }
  }

  _handlePointerDown(event) {
    if (!this._pickEnabled || !this.pose.isReady || this.mode !== 'edit') return;
    if (event.button !== 0) return;
    if (this._transformControls?.dragging) return;

    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);

    if (this._transformControls?.visible) {
      const gizmoHits = this._raycaster.intersectObject(this._transformControls, true);
      if (gizmoHits.length) return;
    }

    const hit = this._pickBone(this._raycaster);
    if (hit) {
      event.preventDefault();
      event.stopPropagation();
      this.onBoneSelect?.(hit);
    } else {
      this.setSelectedBone(null);
      this.onBoneSelect?.(null);
    }
  }

  _pickBone(raycaster) {
    const bones = this.pose.listBones();
    if (!bones.length) return null;

    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;

    let bestName = null;
    let bestDist = Infinity;

    for (const bone of bones) {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      const toPoint = pos.clone().sub(origin);
      const t = toPoint.dot(dir);
      if (t < 0) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(t));
      const dist = closest.distanceTo(pos);
      if (dist < PICK_RADIUS && dist < bestDist) {
        bestDist = dist;
        bestName = bone.name;
      }
    }

    return bestName;
  }

  disposeHelpers() {
    this._clearBoneBoxes();
    if (this._skeletonHelper) {
      this.scene.remove(this._skeletonHelper);
      this._skeletonHelper = null;
    }
    if (this._selectMarker) {
      this.scene.remove(this._selectMarker);
      this._selectMarker.geometry.dispose();
      this._selectMarker.material.dispose();
      this._selectMarker = null;
    }
    if (this._transformControls) {
      this._transformControls.detach();
      this._transformControls.dispose();
      this.scene.remove(this._transformControls);
      this._transformControls = null;
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.disposeHelpers();
  }
}
