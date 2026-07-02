import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

const PICK_RADIUS = 0.055;

function estimateBoneBoxSize(bone) {
  const child = bone.children.find((c) => c.isBone);
  let halfLen = 0.028;
  if (child) {
    halfLen = Math.max(0.016, child.position.length() * 0.5);
  }
  const width = Math.max(0.018, halfLen * 0.55);
  return { halfLen, width };
}

function getBoneMidpoint(bone) {
  const child = bone.children.find((c) => c.isBone);
  if (child) return child.position.clone().multiplyScalar(0.5);
  return new THREE.Vector3();
}

function getBoneAxis(bone) {
  const child = bone.children.find((c) => c.isBone);
  if (child && child.position.lengthSq() > 1e-8) {
    return child.position.clone().normalize();
  }
  return new THREE.Vector3(0, 1, 0);
}

/** Blender 风格：线框盒 + 可点击面 + 旋转环 */
function createBoneWidget(bone, { selected = false } = {}) {
  const { halfLen, width } = estimateBoneBoxSize(bone);
  const group = new THREE.Group();
  group.userData.boneName = bone.name;
  group.userData.isBoneWidget = true;
  group.position.copy(getBoneMidpoint(bone));

  const boxW = width * 1.15;
  const boxH = halfLen * 2.25;
  const boxGeom = new THREE.BoxGeometry(boxW, boxH, boxW);

  const lineColor = selected ? 0xffb84d : 0x48d8d8;
  const edges = new THREE.EdgesGeometry(boxGeom);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: selected ? 0.98 : 0.72,
      depthTest: false,
    }),
  );
  lines.renderOrder = 998;

  const pickMat = new THREE.MeshBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: 0.12,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const pickBox = new THREE.Mesh(boxGeom, pickMat);
  pickBox.userData.boneName = bone.name;
  pickBox.userData.pickRole = 'box';

  const ringRadius = Math.max(boxW * 1.35, boxH * 0.42);
  const tube = Math.max(0.0025, ringRadius * 0.055);
  const ringGeom = new THREE.TorusGeometry(ringRadius, tube, 10, 40);
  const ringColor = selected ? 0xffcc66 : 0x5ee8e8;
  const ringMat = new THREE.MeshBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: selected ? 0.9 : 0.52,
    depthTest: false,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.userData.boneName = bone.name;
  ring.userData.pickRole = 'ring';

  const axis = getBoneAxis(bone);
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, axis);
  ring.quaternion.copy(quat);

  const ring2 = new THREE.Mesh(ringGeom, ringMat.clone());
  ring2.userData.boneName = bone.name;
  ring2.userData.pickRole = 'ring';
  ring2.quaternion.copy(quat);
  ring2.rotateZ(Math.PI / 2);

  group.add(lines);
  group.add(pickBox);
  group.add(ring);
  group.add(ring2);

  bone.add(group);

  return {
    group,
    lines,
    pickBox,
    rings: [ring, ring2],
    dispose: () => {
      edges.dispose();
      boxGeom.dispose();
      ringGeom.dispose();
      lines.material.dispose();
      pickMat.dispose();
      ringMat.dispose();
      group.parent?.remove(group);
    },
  };
}

/**
 * 3D 骨骼可视化 + Blender 风格控件 + TransformControls Gizmo
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
      transformTool: 'rotate',
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
    this._widgetMap = new Map();
    this._selectedWidget = null;

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
      this._skeletonHelper.material.color.set(0xff8844);
      this._skeletonHelper.material.transparent = true;
      this._skeletonHelper.material.opacity = 0.62;
      this._skeletonHelper.material.linewidth = 1;
      this.scene.add(this._skeletonHelper);
    }

    this._selectMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      }),
    );
    this._selectMarker.renderOrder = 1001;
    this.scene.add(this._selectMarker);
    this._selectMarker.visible = false;

    this._buildBoneWidgets();

    this._transformControls = new TransformControls(this.camera, this.canvas);
    this._transformControls.setSpace('local');
    this._transformControls.size = 1.05;
    this._transformControls.setMode(this._modeFromTool(this.settings.transformTool));
    this.scene.add(this._transformControls);

    this._transformControls.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value;
      if (this.mode === 'edit') {
        this._pickEnabled = !e.value;
      }
      if (!e.value && this.selectedBone) {
        this._syncBoneFromGizmo();
        this.onBoneRotate?.(this.selectedBone);
      }
    });

    this._transformControls.addEventListener('objectChange', () => {
      if (!this.selectedBone || this.mode !== 'edit') return;
      this._syncBoneFromGizmo();
      this.pose.finalize();
      this.onBoneRotate?.(this.selectedBone);
    });

    this._configureOrbitForEdit();
    this.applySettings(this.settings);
    this._applyModeState();
  }

  _modeFromTool(tool) {
    return tool === 'translate' ? 'translate' : 'rotate';
  }

  _configureOrbitForEdit() {
    this.orbitControls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.orbitControls.enablePan = true;
  }

  _buildBoneWidgets() {
    this._clearBoneWidgets();
    for (const bone of this.pose.listBones()) {
      const widget = createBoneWidget(bone);
      this._widgetMap.set(bone.name, widget);
    }
    this._refreshWidgetVisibility();
  }

  _clearBoneWidgets() {
    for (const widget of this._widgetMap.values()) {
      widget.dispose?.();
    }
    this._widgetMap.clear();
    if (this._selectedWidget) {
      this._selectedWidget.dispose?.();
      this._selectedWidget = null;
    }
  }

  _syncBoneFromGizmo() {
    if (!this.selectedBone) return;
    const mode = this._transformControls?.mode ?? 'rotate';
    if (mode === 'translate') {
      this.pose.syncPositionFromBone(this.selectedBone);
    } else {
      this.pose.syncEulerFromBone(this.selectedBone);
    }
  }

  setMode(mode) {
    this.mode = mode === 'preview' ? 'preview' : 'edit';
    this._applyModeState();
    this.onModeChange?.(this.mode);
  }

  _applyModeState() {
    const isPreview = this.mode === 'preview';
    this.orbitControls.enabled = true;
    this._pickEnabled = !isPreview;

    if (isPreview && this._transformControls) {
      this._transformControls.detach();
      this._transformControls.enabled = false;
    } else {
      this.setSelectedBone(this.selectedBone);
    }

    this._refreshWidgetVisibility();
  }

  getMode() {
    return this.mode;
  }

  setTransformTool(tool) {
    const mode = this._modeFromTool(tool);
    this.settings.transformTool = mode === 'translate' ? 'translate' : 'rotate';
    if (this._transformControls) {
      this._transformControls.setMode(mode);
    }
  }

  getTransformTool() {
    return this.settings.transformTool ?? 'rotate';
  }

  applySettings(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    if (this._transformControls) {
      this._transformControls.setMode(this._modeFromTool(this.settings.transformTool));
    }
    if (this._skeletonHelper) {
      this._skeletonHelper.visible = !!this.settings.showSkeleton;
    }
    this._refreshWidgetVisibility();
  }

  _refreshWidgetVisibility() {
    const showAll = !!this.settings.showBoneBoxes && this.mode === 'edit';
    for (const [name, widget] of this._widgetMap) {
      const isSelected = name === this.selectedBone;
      widget.group.visible = showAll && !isSelected;
    }
    if (this._selectedWidget) {
      this._selectedWidget.group.visible = !!this.selectedBone
        && (this.settings.showBoneBoxes || this.mode === 'preview');
    }
  }

  setSelectedBone(name) {
    this.selectedBone = name;
    const bone = name ? this.pose.getBone(name) : null;

    if (this._selectedWidget) {
      this._selectedWidget.dispose?.();
      this._selectedWidget = null;
    }

    if (this._selectMarker) {
      this._selectMarker.visible = !!bone;
      if (bone) {
        bone.getWorldPosition(this._selectMarker.position);
      }
    }

    if (bone) {
      this._selectedWidget = createBoneWidget(bone, { selected: true });
      this._selectedWidget.group.scale.set(1.08, 1.08, 1.08);
    }

    if (this._transformControls) {
      const canEdit = this.mode === 'edit' && bone && !this.pose.isLocked(name);
      if (canEdit) {
        this._transformControls.attach(bone);
        this._transformControls.setMode(this._modeFromTool(this.settings.transformTool));
        this._transformControls.enabled = true;
        this._transformControls.visible = true;
      } else {
        this._transformControls.detach();
        this._transformControls.enabled = false;
      }
    }

    this._refreshWidgetVisibility();
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

    const meshHit = this._pickBoneFromWidgets(this._raycaster);
    const hit = meshHit ?? this._pickBoneByJoint(this._raycaster);
    if (hit) {
      event.preventDefault();
      event.stopPropagation();
      this.onBoneSelect?.(hit);
    } else {
      this.setSelectedBone(null);
      this.onBoneSelect?.(null);
    }
  }

  _pickBoneFromWidgets(raycaster) {
    const pickables = [];
    for (const widget of this._widgetMap.values()) {
      if (widget.group.visible) pickables.push(widget.pickBox, ...widget.rings);
    }
    if (this._selectedWidget?.group.visible) {
      pickables.push(this._selectedWidget.pickBox, ...this._selectedWidget.rings);
    }
    if (!pickables.length) return null;

    const hits = raycaster.intersectObjects(pickables, false);
    if (!hits.length) return null;
    return hits[0].object.userData.boneName ?? null;
  }

  _pickBoneByJoint(raycaster) {
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
    this._clearBoneWidgets();
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
