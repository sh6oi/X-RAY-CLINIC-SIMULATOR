import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import type {
  BodyRegion,
  CassetteState,
  ExamProtocol,
  GraphicsQuality,
  Language,
  PatientCase,
  PatientPosture,
  TechLocation,
  UpgradeId,
} from '../types/radiology';
import {CLINIC_ROOM_IMAGE} from '../data/radiologyData';
import {REGION_LABELS_I18N} from '../i18n/translations';

export type SceneTargetAction =
  | {type: 'REGION'; region: BodyRegion}
  | {type: 'CASSETTE_RACK'}
  | {type: 'TABLE_BUCKY'}
  | {type: 'WALL_BUCKY'}
  | {type: 'CR_READER'}
  | {type: 'DOOR'}
  | {type: 'WAITING_DOOR'}
  | {type: 'CT_DOOR'}
  | {type: 'MRI_DOOR'}
  | {type: 'CONSOLE'}
  | {type: 'PC'};

interface RadiologyRoom3DProps {
  patient: PatientCase | null;
  waitingPatients?: PatientCase[];
  requestedExam: ExamProtocol;
  selectedRegion: BodyRegion;
  selectedPosture: PatientPosture;
  techLocation: TechLocation;
  doorClosed: boolean;
  ctDoorOpen: boolean;
  mriDoorOpen: boolean;
  cassetteState: CassetteState;
  crExposedPending: boolean;
  isDeveloping: boolean;
  hasDR: boolean;
  shieldUsed: boolean;
  patientPrepped: boolean;
  isExposing: boolean;
  patientSpeech: string | null;
  language: Language;
  graphicsQuality?: GraphicsQuality;
  paused?: boolean;
  ownedUpgrades: UpgradeId[];
  joystickRef: React.MutableRefObject<{x: number; y: number}>;
  onTechZoneChange?: (loc: TechLocation) => void;
  onSceneInteract: (action: SceneTargetAction) => void;
  onAutoDowngradeQuality?: () => void;
}

interface HotspotLocalMeta {
  id: BodyRegion;
  label: string;
  spineY: number;
  lateralX: number;
  radius: number;
  erectWorldY: number;
  tableWorldX: number;
  tableWorldZ: number;
}

const ANATOMY_SPOTS: HotspotLocalMeta[] = [
  {
    id: 'head',
    label: 'الرأس',
    spineY: 0.78,
    lateralX: 0,
    radius: 0.22,
    erectWorldY: 1.72,
    tableWorldX: -0.78,
    tableWorldZ: 0,
  },
  {
    id: 'cervical',
    label: 'الرقبة',
    spineY: 0.56,
    lateralX: 0,
    radius: 0.17,
    erectWorldY: 1.52,
    tableWorldX: -0.56,
    tableWorldZ: 0,
  },
  {
    id: 'chest',
    label: 'الصدر',
    spineY: 0.3,
    lateralX: 0,
    radius: 0.28,
    erectWorldY: 1.28,
    tableWorldX: -0.3,
    tableWorldZ: 0,
  },
  {
    id: 'lumbar',
    label: 'القطنية',
    spineY: 0.04,
    lateralX: 0,
    radius: 0.23,
    erectWorldY: 1.02,
    tableWorldX: -0.04,
    tableWorldZ: 0,
  },
  {
    id: 'pelvis',
    label: 'الحوض',
    spineY: -0.18,
    lateralX: 0,
    radius: 0.26,
    erectWorldY: 0.84,
    tableWorldX: 0.18,
    tableWorldZ: 0,
  },
  {
    id: 'hand',
    label: 'اليد',
    spineY: -0.16,
    lateralX: 0.34,
    radius: 0.19,
    erectWorldY: 0.92,
    tableWorldX: 0.16,
    tableWorldZ: 0.34,
  },
  {
    id: 'knee',
    label: 'الركبة',
    spineY: -0.58,
    lateralX: 0.12,
    radius: 0.22,
    erectWorldY: 0.5,
    tableWorldX: 0.58,
    tableWorldZ: 0.12,
  },
];

const ERECT_STAND_X = 2.65;
const ERECT_PATIENT_X = 2.18;
const ERECT_Z = -0.35;

// Reusable math helpers outside animation loop (zero GC)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _headWorldPos = new THREE.Vector3();
const _headProj = new THREE.Vector3();

function hashPatientSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function canStandAt(
  x: number,
  z: number,
  doorClosed: boolean,
  canEnterCt: boolean,
  canEnterMri: boolean,
  canEnterWaiting: boolean
): boolean {
  // Patient Waiting Room (north of waiting glass wall, z < -5.0)
  if (z < -5.0) {
    if (!canEnterWaiting) return false;
    if (x < -4.95 || x > 0.9 || z < -8.42) return false;
    // Avoid waiting room bench & reception desk
    if (z <= -6.82 && x >= -4.05 && x <= -0.15) return false;
    if (x < -4.15 && z < -5.85) return false;
    return true;
  }

  // North Waiting Room door threshold (z = -5.0 .. -4.60)
  if (z >= -5.0 && z < -4.6) {
    if (x >= -2.72 && x <= -1.52) {
      return canEnterWaiting;
    }
    return false;
  }

  // Enlarged Main X-Ray Exam Room interior (-4.60 <= z <= 1.86, -5.05 <= x <= 7.05)
  if (z <= 1.86) {
    if (x < -5.05 || x > 7.05 || z < -4.6) return false;
    // Avoid walking inside solid X-ray table core
    if (Math.abs(x) < 1.48 && Math.abs(z) < 0.56) return false;
    // Avoid cassette storage rack at (-3.20, -1.55)
    if (x >= -3.72 && x <= -2.68 && z >= -1.94 && z <= -1.16) return false;
    return true;
  }

  // South Partition threshold (z = 1.86..2.24): Booth Door | CT Suite Door | MRI Suite Door
  if (z > 1.86 && z < 2.24) {
    if (x >= -1.46 && x <= -0.56) {
      return !doorClosed;
    }
    if (x >= -0.14 && x <= 0.94) {
      return canEnterCt;
    }
    if (x >= 3.62 && x <= 4.7) {
      return canEnterMri;
    }
    return false;
  }

  // South wing rooms (z >= 2.24)
  if (z >= 2.24) {
    // 1. Expanded Control Booth (x: -5.05 .. -0.64, z: 2.24 .. 4.02)
    if (x <= -0.64) {
      if (x < -5.05 || z > 4.02) return false;
      // Desk core
      if (x >= -5.1 && x <= -1.62 && z < 3.12) return false;
      return true;
    }

    // 2. Monumental CT Scanner Suite (x: -0.34 .. 3.24, z: 2.24 .. 7.42)
    if (x >= -0.34 && x <= 3.24) {
      if (!canEnterCt || z > 7.42) return false;
      // Avoid walking into colossal CT gantry & patient couch core
      if (x >= 0.14 && x <= 2.82 && z >= 3.3 && z <= 6.15) return false;
      return true;
    }

    // 3. Monumental MRI Suite (x: 3.64 .. 7.12, z: 2.24 .. 7.42)
    if (x >= 3.64 && x <= 7.12) {
      if (!canEnterMri || z > 7.42) return false;
      // Avoid walking into colossal MRI cryogenic bore & couch core
      if (x >= 4.08 && x <= 6.74 && z >= 3.2 && z <= 6.45) return false;
      return true;
    }
  }

  return false;
}

function isErectPosture(posture: PatientPosture): boolean {
  return posture.startsWith('ERECT_');
}

function getTargetBodyYaw(posture: PatientPosture): number {
  switch (posture) {
    case 'SUPINE':
    case 'ERECT_PA':
      return Math.PI / 2;
    case 'PRONE':
    case 'ERECT_AP':
      return -Math.PI / 2;
    case 'TABLE_RIGHT_LAT':
    case 'ERECT_LEFT_LAT':
      return 0;
    case 'TABLE_LEFT_LAT':
    case 'ERECT_RIGHT_LAT':
      return Math.PI;
  }
}

function dampAngle(
  current: number,
  target: number,
  lambda: number,
  delta: number
): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * delta));
}

function createTileFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  // Luxury clinical slate-terrazzo porcelain base
  ctx.fillStyle = '#182436';
  ctx.fillRect(0, 0, 1024, 1024);

  const tiles = 4;
  const step = 1024 / tiles;
  for (let gx = 0; gx < tiles; gx++) {
    for (let gy = 0; gy < tiles; gy++) {
      const tx = gx * step;
      const ty = gy * step;
      const toneShift = (gx + gy) % 2 === 0;
      const tileGrad = ctx.createLinearGradient(tx, ty, tx + step, ty + step);
      tileGrad.addColorStop(
        0,
        toneShift ? 'rgba(42, 62, 90, 0.48)' : 'rgba(26, 40, 60, 0.44)'
      );
      tileGrad.addColorStop(
        1,
        toneShift ? 'rgba(30, 46, 68, 0.36)' : 'rgba(20, 32, 49, 0.36)'
      );
      ctx.fillStyle = tileGrad;
      ctx.fillRect(tx + 4, ty + 4, step - 8, step - 8);

      // Subtle architectural bevel highlight on tile edge
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
      ctx.lineWidth = 2;
      ctx.strokeRect(tx + 5, ty + 5, step - 10, step - 10);
    }
  }

  // Delicate clinical marble veining across porcelain slabs
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.055)';
  ctx.lineWidth = 2;
  for (let v = 0; v < 26; v++) {
    const startX = (v * 173) % 1024;
    const startY = (v * 251) % 1024;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(
      startX + 48,
      startY + 24,
      startX + 95,
      startY - 18,
      startX + 145,
      startY + 36
    );
    ctx.stroke();
  }

  // Crisp grout seams
  ctx.strokeStyle = '#111B29';
  ctx.lineWidth = 6;
  for (let i = 0; i <= 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Fine mineral terrazzo flecks
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle =
      i % 5 === 0
        ? 'rgba(103, 232, 249, 0.08)'
        : i % 2 === 0
          ? 'rgba(226, 232, 240, 0.075)'
          : 'rgba(148, 163, 184, 0.055)';
    ctx.fillRect((i * 137) % 1024, (i * 293) % 1024, 2.5, 2.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTileFloorPbrMaps(): {
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 512;
  rCanvas.height = 512;
  const rCtx = rCanvas.getContext('2d')!;
  // Smooth polished porcelain (~0.24 roughness)
  rCtx.fillStyle = '#3d3d3d';
  rCtx.fillRect(0, 0, 512, 512);

  // Subtle tile-to-tile gloss variation
  const step = 128;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      rCtx.fillStyle = (gx + gy) % 2 === 0 ? '#363636' : '#454545';
      rCtx.fillRect(gx * step + 3, gy * step + 3, step - 6, step - 6);
    }
  }
  // Matte grout lines (~0.88 roughness)
  rCtx.strokeStyle = '#e0e0e0';
  rCtx.lineWidth = 4;
  for (let i = 0; i <= 512; i += step) {
    rCtx.beginPath();
    rCtx.moveTo(i, 0);
    rCtx.lineTo(i, 512);
    rCtx.stroke();
    rCtx.beginPath();
    rCtx.moveTo(0, i);
    rCtx.lineTo(512, i);
    rCtx.stroke();
  }

  const bCanvas = document.createElement('canvas');
  bCanvas.width = 512;
  bCanvas.height = 512;
  const bCtx = bCanvas.getContext('2d')!;
  bCtx.fillStyle = '#c8c8c8';
  bCtx.fillRect(0, 0, 512, 512);
  bCtx.strokeStyle = '#383838';
  bCtx.lineWidth = 5;
  for (let i = 0; i <= 512; i += step) {
    bCtx.beginPath();
    bCtx.moveTo(i, 0);
    bCtx.lineTo(i, 512);
    bCtx.stroke();
    bCtx.beginPath();
    bCtx.moveTo(0, i);
    bCtx.lineTo(512, i);
    bCtx.stroke();
  }

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(9, 9);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(9, 9);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return {roughnessMap, bumpMap};
}

function createWallPlasterBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const shade = 112 + ((i * 37) % 32);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect((i * 53) % 256, (i * 97) % 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function createWallChartTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0D1B2E';
  ctx.fillRect(0, 0, 512, 384);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 488, 360);
  ctx.fillStyle = '#132742';
  ctx.fillRect(24, 24, 464, 52);
  ctx.fillStyle = '#E0F2FE';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('CLINICAL RADIOGRAPHY GUIDE', 42, 58);

  // Stylized spine & thorax schematic on chart
  ctx.strokeStyle = '#67E8F9';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 96, 190, 248);
  ctx.beginPath();
  ctx.ellipse(131, 168, 54, 42, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let v = 0; v < 7; v++) {
    ctx.strokeRect(119, 218 + v * 16, 24, 10);
  }

  // Right protocol readout blocks
  const cards = [
    ['CHEST PA', '110-125 kVp · ERECT'],
    ['C-SPINE LAT', '70-80 kVp · ERECT'],
    ['LUMBAR AP', '78-88 kVp · SUPINE'],
  ];
  cards.forEach(([title, sub], idx) => {
    const y = 96 + idx * 86;
    ctx.fillStyle = '#142B47';
    ctx.fillRect(246, y, 232, 72);
    ctx.strokeStyle = '#0EA5E9';
    ctx.lineWidth = 2;
    ctx.strokeRect(246, y, 232, 72);
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 19px monospace';
    ctx.fillText(title, 264, y + 30);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '15px monospace';
    ctx.fillText(sub, 264, y + 55);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSuiteHeaderTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0B1728';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#22D3EE';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = '#67E8F9';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RADIOLOGY SUITE 01 · X-RAY', 256, 46);
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('DIGITAL IMAGING & SHIELDED CONTROL', 256, 74);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(3, 7, 14, 0.72)');
  grad.addColorStop(0.58, 'rgba(3, 7, 14, 0.28)');
  grad.addColorStop(1, 'rgba(3, 7, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLightboxTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#071422';
  ctx.fillRect(0, 0, 512, 256);
  [28, 184, 340].forEach((fx, idx) => {
    const grad = ctx.createRadialGradient(fx + 72, 128, 10, fx + 72, 128, 82);
    grad.addColorStop(0, 'rgba(186, 230, 253, 0.92)');
    grad.addColorStop(1, 'rgba(14, 116, 144, 0.32)');
    ctx.fillStyle = grad;
    ctx.fillRect(fx, 28, 144, 200);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, 28, 144, 200);
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.88)';
    ctx.lineWidth = 3;
    if (idx === 0) {
      ctx.beginPath();
      ctx.moveTo(fx + 72, 52);
      ctx.lineTo(fx + 72, 195);
      ctx.stroke();
      for (let r = 0; r < 5; r++) {
        ctx.beginPath();
        ctx.ellipse(fx + 72, 72 + r * 20, 42 - r * 2, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (idx === 1) {
      for (let v = 0; v < 7; v++) {
        ctx.strokeRect(fx + 60, 55 + v * 21, 24, 14);
      }
    } else {
      for (let f = -2; f <= 2; f++) {
        ctx.beginPath();
        ctx.moveTo(fx + 72 + f * 6, 165);
        ctx.lineTo(fx + 72 + f * 12, 70 + Math.abs(f) * 10);
        ctx.stroke();
      }
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDetectorPanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0F1A2A';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 20);
  ctx.lineTo(128, 236);
  ctx.moveTo(20, 128);
  ctx.lineTo(236, 128);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
  ctx.strokeRect(64, 58, 42, 52);
  ctx.strokeRect(150, 58, 42, 52);
  ctx.strokeRect(107, 136, 42, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPcScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#060E1A';
  ctx.fillRect(0, 0, 1024, 640);

  // Top PACS Toolbar
  ctx.fillStyle = '#0E1F36';
  ctx.fillRect(0, 0, 1024, 64);
  ctx.fillStyle = '#22D3EE';
  ctx.fillRect(0, 62, 1024, 3);
  ctx.fillStyle = '#E0F2FE';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('CLINIC PACS · 5MP DIAGNOSTIC WORKSTATION', 26, 42);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(830, 16, 170, 32);
  ctx.fillStyle = '#052E16';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('DICOM ONLINE', 848, 38);

  // Left Thumbnail Column
  ctx.fillStyle = '#0A1628';
  ctx.fillRect(20, 82, 150, 536);
  ctx.strokeStyle = '#1E3A5F';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 82, 150, 536);
  [0, 1, 2].forEach((i) => {
    const ty = 98 + i * 168;
    ctx.fillStyle = i === 0 ? '#112A46' : '#0D1E34';
    ctx.fillRect(34, ty, 122, 146);
    ctx.strokeStyle = i === 0 ? '#38BDF8' : '#334155';
    ctx.strokeRect(34, ty, 122, 146);
    ctx.strokeStyle = 'rgba(226,232,240,0.75)';
    ctx.beginPath();
    ctx.ellipse(95, ty + 68, 36 - i * 4, 48 - i * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Center Active High-Contrast Radiograph Viewport
  ctx.fillStyle = '#030811';
  ctx.fillRect(190, 82, 470, 536);
  ctx.strokeStyle = '#0EA5E9';
  ctx.lineWidth = 3;
  ctx.strokeRect(190, 82, 470, 536);

  const chestGrad = ctx.createRadialGradient(425, 330, 30, 425, 330, 210);
  chestGrad.addColorStop(0, 'rgba(226, 232, 240, 0.32)');
  chestGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.14)');
  chestGrad.addColorStop(1, 'rgba(3, 8, 17, 0.0)');
  ctx.fillStyle = chestGrad;
  ctx.fillRect(210, 100, 430, 490);

  ctx.strokeStyle = 'rgba(241, 245, 249, 0.88)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(425, 130);
  ctx.lineTo(425, 550);
  ctx.stroke();
  for (let r = 0; r < 7; r++) {
    ctx.beginPath();
    ctx.ellipse(425, 195 + r * 44, 135 - r * 7, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('W:1600  L:-500  PA ERECT', 210, 112);
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('SID 180cm · 120 kVp · 4.0 mAs', 210, 598);

  // Right Action Modules
  const cards = [
    {title: 'IMAGE VIEW & MASK', sub: 'Window/Level · Zoom · Collimation', bg: '#0F2A44', border: '#22D3EE', fg: '#67E8F9'},
    {title: 'PATIENT ARCHIVE', sub: 'Case Queue & Clinical Log', bg: '#0D2E2A', border: '#10B981', fg: '#6EE7B7'},
    {title: 'CLINIC EQUIPMENT SHOP', sub: 'DR Upgrade · Film Inventory', bg: '#2C210E', border: '#F59E0B', fg: '#FDE68A'},
  ];
  cards.forEach((c, idx) => {
    const cy = 84 + idx * 180;
    ctx.fillStyle = c.bg;
    ctx.fillRect(682, cy, 320, 158);
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(682, cy, 320, 158);
    ctx.fillStyle = c.fg;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(c.title, 704, cy + 62);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '18px sans-serif';
    ctx.fillText(c.sub, 704, cy + 104);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPcSecondaryScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#07111F';
  ctx.fillRect(0, 0, 384, 512);
  ctx.fillStyle = '#0F2540';
  ctx.fillRect(0, 0, 384, 52);
  ctx.fillStyle = '#67E8F9';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('RIS WORKLIST · QUEUE', 20, 34);

  for (let i = 0; i < 6; i++) {
    const y = 70 + i * 70;
    ctx.fillStyle = i === 0 ? '#11304D' : '#0D1C30';
    ctx.fillRect(18, y, 348, 56);
    ctx.strokeStyle = i === 0 ? '#22D3EE' : '#1E3A5F';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, y, 348, 56);
    ctx.fillStyle = i === 0 ? '#67E8F9' : '#E2E8F0';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(i === 0 ? '● ACTIVE EXAM ROOM' : `WAIT #${i} · SCHEDULED`, 32, y + 26);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px monospace';
    ctx.fillText(i === 0 ? 'STATUS: IN PROGRESS' : 'WAITING LOUNGE', 32, y + 46);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createConsoleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 420;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#071220';
  ctx.fillRect(0, 0, 768, 420);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 752, 404);

  // Header bar
  ctx.fillStyle = '#0F2640';
  ctx.fillRect(18, 18, 732, 54);
  ctx.fillStyle = '#E0F2FE';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('DIGITAL HF X-RAY GENERATOR · kVp / mAs CONSOLE', 34, 53);

  // Digital Parameter Boxes (kVp | mAs | mA / ms)
  const boxes = [
    {label: 'TUBE VOLTAGE', val: '120', unit: 'kVp', col: '#22D3EE', x: 26},
    {label: 'TUBE CURRENT', val: '4.0', unit: 'mAs', col: '#34D399', x: 268},
    {label: 'ANODE / AEC', val: '200', unit: 'mA · LRG', col: '#FBBF24', x: 510},
  ];
  boxes.forEach((b) => {
    ctx.fillStyle = '#0B1D33';
    ctx.fillRect(b.x, 92, 228, 165);
    ctx.strokeStyle = b.col;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, 92, 228, 165);
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(b.label, b.x + 18, 124);
    ctx.fillStyle = b.col;
    ctx.font = 'bold 62px monospace';
    ctx.fillText(b.val, b.x + 20, 198);
    ctx.font = 'bold 22px monospace';
    ctx.fillText(b.unit, b.x + 20, 236);
  });

  // Bottom Status Strip
  ctx.fillStyle = '#0B3B2E';
  ctx.fillRect(26, 282, 228, 66);
  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('● ROTOR READY', 46, 324);

  ctx.fillStyle = '#451A03';
  ctx.fillRect(268, 282, 228, 66);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.strokeRect(268, 282, 228, 66);
  ctx.fillStyle = '#FDE68A';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('☢ EXPOSE HV', 292, 324);

  ctx.fillStyle = '#112238';
  ctx.fillRect(510, 282, 228, 66);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('HEAT: 18% · OK', 530, 322);

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('INTERLOCK: LEAD DOOR SHIELDED · LARGE FOCUS SPOT 1.2mm', 30, 386);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDoorSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('X-RAY ROOM', 128, 56);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('LEAD SHIELDED', 128, 94);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRoomHeaderPlaqueTexture(
  titleAr: string,
  subtitleEn: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#091526';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 502, 118);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 34px Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(titleAr, 256, 58);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 21px monospace';
  ctx.fillText(subtitleEn, 256, 98);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCrReaderTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#050F1D';
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 304);

  ctx.fillStyle = '#0E2440';
  ctx.fillRect(20, 20, 472, 62);
  ctx.fillStyle = '#67E8F9';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FCR LASER DIGITIZER · CR-X', 256, 60);

  // Waveform / laser scan bar graphic
  ctx.fillStyle = '#0A192D';
  ctx.fillRect(28, 100, 456, 110);
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 100, 456, 110);
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('INSERT EXPOSED IP CASSETTE', 256, 146);
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('HE-NE LASER SCAN · 10 PIXELS/MM', 256, 186);

  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(68, 232, 376, 52);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('▼ CASSETTE FEED SLOT ▼', 256, 266);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWaitingTvTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#071324';
  ctx.fillRect(0, 0, 512, 288);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 276);
  ctx.fillStyle = '#112947';
  ctx.fillRect(16, 16, 480, 62);
  ctx.fillStyle = '#FDE68A';
  ctx.font = 'bold 28px Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('صالة الانتظار · WAITING ROOM', 256, 56);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 24px Tahoma, Arial, sans-serif';
  ctx.fillText('يرجى الانتظار لحين مناداة اسمك للدخول', 256, 138);
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('RADIOLOGY DEPARTMENT · QUEUE DISPLAY', 256, 198);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(110, 224, 292, 36);
  ctx.fillStyle = '#052E16';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('EXAM ROOM 01: IN SESSION', 256, 248);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDoorStatusBadgeTexture(
  titleAr: string,
  statusAr: string,
  isLocked: boolean,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isLocked ? '#1E1116' : '#0B2320';
  ctx.fillRect(0, 0, 384, 192);
  ctx.strokeStyle = isLocked ? '#EF4444' : '#10B981';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 372, 180);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(titleAr, 192, 66);

  ctx.fillStyle = isLocked ? '#FCA5A5' : '#6EE7B7';
  ctx.font = 'bold 24px Tahoma, Arial, sans-serif';
  ctx.fillText(statusAr, 192, 116);

  ctx.fillStyle = isLocked ? '#F87171' : accentHex;
  ctx.font = 'bold 18px Tahoma, Arial, sans-serif';
  ctx.fillText(isLocked ? 'اشترِ الجهاز من المتجر للفتح' : 'انقر لفتح أو إغلاق الباب', 192, 158);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCassetteMesh(
  track: <T extends {dispose: () => void}>(item: T) => T,
  matBody: THREE.Material,
  matEdge: THREE.Material,
  matAccent: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.38, 0.024, 0.44)),
    matBody
  );
  plate.castShadow = true;
  group.add(plate);

  const rim = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.4, 0.018, 0.46)),
    matEdge
  );
  group.add(rim);

  const strip = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.34, 0.028, 0.045)),
    matAccent
  );
  strip.position.set(0, 0.002, 0.17);
  group.add(strip);

  return group;
}

export const RadiologyRoom3D: React.FC<RadiologyRoom3DProps> = ({
  patient,
  waitingPatients = [],
  requestedExam,
  selectedRegion,
  selectedPosture,
  techLocation,
  doorClosed,
  ctDoorOpen,
  mriDoorOpen,
  cassetteState,
  crExposedPending,
  isDeveloping,
  hasDR,
  shieldUsed,
  patientPrepped,
  isExposing,
  patientSpeech,
  language,
  graphicsQuality = 'low',
  paused = false,
  ownedUpgrades,
  joystickRef,
  onTechZoneChange,
  onSceneInteract,
  onAutoDowngradeQuality,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const speechBubbleRef = useRef<HTMLDivElement | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);

  // Refs synced from React props without rebuilding WebGL
  const selectedRegionRef = useRef<BodyRegion>(selectedRegion);
  const selectedPostureRef = useRef<PatientPosture>(selectedPosture);
  const techLocationRef = useRef<TechLocation>(techLocation);
  const doorClosedRef = useRef<boolean>(doorClosed);
  const waitingDoorOpenRef = useRef<boolean>(false);
  const ctDoorOpenRef = useRef<boolean>(ctDoorOpen);
  const mriDoorOpenRef = useRef<boolean>(mriDoorOpen);
  const cassetteStateRef = useRef<CassetteState>(cassetteState);
  const crExposedPendingRef = useRef<boolean>(crExposedPending);
  const isDevelopingRef = useRef<boolean>(isDeveloping);
  const hasDRRef = useRef<boolean>(hasDR);
  const shieldUsedRef = useRef<boolean>(shieldUsed);
  const patientPreppedRef = useRef<boolean>(patientPrepped);
  const isExposingRef = useRef<boolean>(isExposing);
  const patientSpeechRef = useRef<string | null>(patientSpeech);
  const languageRef = useRef<Language>(language);
  const graphicsQualityRef = useRef<GraphicsQuality>(graphicsQuality);
  const pausedRef = useRef<boolean>(paused);
  const modalityRef = useRef(requestedExam.modality);
  const ownedUpgradesRef = useRef<UpgradeId[]>(ownedUpgrades);
  const onSceneInteractRef = useRef(onSceneInteract);
  const onTechZoneChangeRef = useRef(onTechZoneChange);
  const onAutoDowngradeRef = useRef(onAutoDowngradeQuality);
  const applyLiveTierRef = useRef<((mode: GraphicsQuality) => void) | null>(
    null
  );
  const resumeLoopRef = useRef<(() => void) | null>(null);
  const suppressAutoCamRef = useRef<boolean>(false);
  const cameraMoveActiveRef = useRef<boolean>(true);
  const patientEnterAnimRef = useRef<number>(0);
  const handReachImpulseRef = useRef<number>(0);
  const patientAppearanceRef = useRef<{
    id: string;
    gender: 'M' | 'F';
    age: number;
  }>({
    id: patient?.id ?? 'default-m',
    gender: patient?.gender ?? 'M',
    age: patient?.age ?? 32,
  });
  const waitingPatientsRef = useRef<
    {id: string; gender: 'M' | 'F'; age: number}[]
  >(
    waitingPatients.map((p) => ({id: p.id, gender: p.gender, age: p.age}))
  );
  const applyPatientAppearanceRef = useRef<(() => void) | null>(null);
  const applyWaitingPatientsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    selectedRegionRef.current = selectedRegion;
  }, [selectedRegion]);

  useEffect(() => {
    selectedPostureRef.current = selectedPosture;
  }, [selectedPosture]);

  useEffect(() => {
    if (techLocationRef.current !== techLocation) {
      techLocationRef.current = techLocation;
      if (suppressAutoCamRef.current) {
        suppressAutoCamRef.current = false;
      } else {
        cameraMoveActiveRef.current = true;
      }
    }
  }, [techLocation]);

  useEffect(() => {
    if (doorClosedRef.current !== doorClosed) {
      doorClosedRef.current = doorClosed;
      handReachImpulseRef.current = 1.0;
    }
  }, [doorClosed]);

  useEffect(() => {
    if (ctDoorOpenRef.current !== ctDoorOpen) {
      ctDoorOpenRef.current = ctDoorOpen;
      handReachImpulseRef.current = 1.0;
    }
  }, [ctDoorOpen]);

  useEffect(() => {
    if (mriDoorOpenRef.current !== mriDoorOpen) {
      mriDoorOpenRef.current = mriDoorOpen;
      handReachImpulseRef.current = 1.0;
    }
  }, [mriDoorOpen]);

  useEffect(() => {
    if (cassetteStateRef.current !== cassetteState) {
      cassetteStateRef.current = cassetteState;
      handReachImpulseRef.current = 1.0;
    }
  }, [cassetteState]);

  useEffect(() => {
    crExposedPendingRef.current = crExposedPending;
  }, [crExposedPending]);
  useEffect(() => {
    isDevelopingRef.current = isDeveloping;
  }, [isDeveloping]);
  useEffect(() => {
    hasDRRef.current = hasDR;
  }, [hasDR]);
  useEffect(() => {
    shieldUsedRef.current = shieldUsed;
  }, [shieldUsed]);
  useEffect(() => {
    patientPreppedRef.current = patientPrepped;
  }, [patientPrepped]);
  useEffect(() => {
    if (isExposing && !isExposingRef.current) {
      handReachImpulseRef.current = 1.0;
    }
    isExposingRef.current = isExposing;
  }, [isExposing]);
  useEffect(() => {
    patientSpeechRef.current = patientSpeech;
  }, [patientSpeech]);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    modalityRef.current = requestedExam.modality;
  }, [requestedExam.modality]);
  useEffect(() => {
    ownedUpgradesRef.current = ownedUpgrades;
  }, [ownedUpgrades]);
  useEffect(() => {
    onSceneInteractRef.current = onSceneInteract;
  }, [onSceneInteract]);
  useEffect(() => {
    onTechZoneChangeRef.current = onTechZoneChange;
  }, [onTechZoneChange]);
  useEffect(() => {
    onAutoDowngradeRef.current = onAutoDowngradeQuality;
  }, [onAutoDowngradeQuality]);
  useEffect(() => {
    graphicsQualityRef.current = graphicsQuality;
    applyLiveTierRef.current?.(graphicsQuality);
  }, [graphicsQuality]);
  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) {
      resumeLoopRef.current?.();
    }
  }, [paused]);

  useEffect(() => {
    patientAppearanceRef.current = {
      id: patient?.id ?? 'default-m',
      gender: patient?.gender ?? 'M',
      age: patient?.age ?? 32,
    };
    applyPatientAppearanceRef.current?.();
    patientEnterAnimRef.current = 1.0;
    cameraMoveActiveRef.current = true;
  }, [patient?.id, patient?.gender, patient?.age]);

  const waitingSignature = waitingPatients.map((p) => p.id).join('|');
  useEffect(() => {
    waitingPatientsRef.current = waitingPatients.map((p) => ({
      id: p.id,
      gender: p.gender,
      age: p.age,
    }));
    applyWaitingPatientsRef.current?.();
  }, [waitingSignature]);

  // Refocus smoothly when switching between table and erect inside exam room
  useEffect(() => {
    if (techLocationRef.current === 'ROOM') {
      cameraMoveActiveRef.current = true;
    }
  }, [selectedPosture]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    type PerfTier = 'software' | 'low' | 'balanced' | 'high' | 'ultra';

    const detectHardware = (): {
      isSoftwareGl: boolean;
      hasWebGL2: boolean;
      isLowEndHardware: boolean;
      isMobileDevice: boolean;
    } => {
      const isMobileDevice =
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(pointer: coarse)').matches ||
          /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
      const cores = navigator.hardwareConcurrency || 4;
      const ramGb =
        (navigator as Navigator & {deviceMemory?: number}).deviceMemory ?? 4;

      try {
        const probe = document.createElement('canvas');
        const gl2 = probe.getContext('webgl2');
        const gl =
          gl2 ||
          probe.getContext('webgl') ||
          (probe.getContext('experimental-webgl') as WebGLRenderingContext | null);
        if (!gl) {
          return {
            isSoftwareGl: true,
            hasWebGL2: false,
            isLowEndHardware: true,
            isMobileDevice,
          };
        }
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();

        const isSoftwareGl =
          /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
        const lowGpuRegex =
          /Mali-(?:4|T|G3|G5[12])|Adreno \(TM\) (?:[234]\d\d|50\d|51\d|61\d)|PowerVR|Apple A(?:7|8|9|10)\b|Intel\(R\) HD Graphics (?:2|3|4)/i;
        const isLowEndHardware =
          isSoftwareGl ||
          !gl2 ||
          lowGpuRegex.test(gpu) ||
          ramGb <= 2 ||
          (isMobileDevice && cores <= 2);

        return {
          isSoftwareGl,
          hasWebGL2: Boolean(gl2),
          isLowEndHardware,
          isMobileDevice,
        };
      } catch {
        return {
          isSoftwareGl: true,
          hasWebGL2: false,
          isLowEndHardware: true,
          isMobileDevice,
        };
      }
    };

    const hw = detectHardware();
    const isSoftwareGl = hw.isSoftwareGl;

    const resolveTier = (_pref: GraphicsQuality): PerfTier => {
      if (isSoftwareGl) return 'software';
      return 'low';
    };

    let activeTier: PerfTier = resolveTier(graphicsQualityRef.current);
    const useLowShaders = activeTier === 'software' || activeTier === 'low';

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: activeTier !== 'low' && activeTier !== 'software',
        powerPreference: useLowShaders ? 'default' : 'high-performance',
        precision: useLowShaders ? 'mediump' : 'highp',
        stencil: false,
      });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: 'default',
          precision: 'mediump',
          depth: true,
          stencil: false,
        });
        activeTier = 'low';
      } catch {
        setWebglUnavailable(true);
        return;
      }
    }

    const initWidth = container.clientWidth || 1200;
    const initHeight = container.clientHeight || 720;

    const getPixelRatioForTier = (t: PerfTier): number => {
      const dpr = window.devicePixelRatio || 1;
      if (t === 'software') return 1;
      if (t === 'low') return dpr > 1.5 ? 0.9 : 1;
      if (t === 'balanced') return Math.min(dpr, 1.5);
      if (t === 'high') return Math.min(dpr, 2.0);
      return Math.min(dpr, 2.25);
    };

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = useLowShaders ? 1.24 : 1.2;
    renderer.setPixelRatio(getPixelRatioForTier(activeTier));
    renderer.setSize(initWidth, initHeight);
    renderer.shadowMap.enabled = !isSoftwareGl && activeTier !== 'low';
    renderer.shadowMap.type =
      activeTier === 'balanced' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09111c);
    scene.fog = new THREE.FogExp2(0x09111c, 0.018);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environmentIntensity = activeTier === 'ultra' ? 1.32 : 1.0;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      56,
      initWidth / initHeight,
      0.08,
      60
    );
    camera.rotation.order = 'YXZ';
    camera.position.set(0.35, 1.56, 1.58);
    // Add camera to scene so attached 3D first-person technician hands render properly
    scene.add(camera);

    const computeLookAngles = (
      from: THREE.Vector3,
      to: THREE.Vector3
    ): {yaw: number; pitch: number} => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dz = to.z - from.z;
      const horiz = Math.max(0.001, Math.hypot(dx, dz));
      return {
        yaw: Math.atan2(-dx, -dz),
        pitch: THREE.MathUtils.clamp(Math.atan2(dy, horiz), -1.08, 0.82),
      };
    };

    const initLook = computeLookAngles(
      camera.position,
      new THREE.Vector3(1.1, 1.12, -0.25)
    );
    let curYaw = initLook.yaw;
    let targetYaw = initLook.yaw;
    let curPitch = initLook.pitch;
    let targetPitch = initLook.pitch;
    camera.rotation.set(curPitch, curYaw, 0);

    let velX = 0;
    let velZ = 0;
    let walkPhase = 0;

    // =========================================================================
    // STUDIO 3-POINT MEDICAL LIGHTING RIG + SOFTBOX RECT AREA LIGHTS
    // =========================================================================
    const hemiLight = new THREE.HemisphereLight(
      0xe6f4ff,
      0x202f46,
      useLowShaders ? 1.48 : 1.18
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.72);
    keyLight.position.set(2.4, 5.4, 3.4);
    if (!isSoftwareGl && activeTier !== 'low') {
      const shadowRes =
        activeTier === 'ultra' ? 2048 : activeTier === 'high' ? 1536 : 1024;
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = shadowRes;
      keyLight.shadow.mapSize.height = shadowRes;
      keyLight.shadow.camera.left = -5.8;
      keyLight.shadow.camera.right = 7.6;
      keyLight.shadow.camera.top = 6.8;
      keyLight.shadow.camera.bottom = -5.8;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.018;
      keyLight.shadow.radius = 2.6;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
      0x38bdf8,
      useLowShaders ? 1.05 : 0.96
    );
    rimLight.position.set(-3.6, 3.2, -3.4);
    scene.add(rimLight);

    const ceilingFillLight = new THREE.PointLight(
      0xeef8ff,
      useLowShaders ? 1.75 : 1.5,
      useLowShaders ? 18 : 14
    );
    ceilingFillLight.position.set(1.2, 3.85, -0.3);
    scene.add(ceilingFillLight);

    const boothLight = new THREE.PointLight(0xbae6fd, 1.15, 5.5);
    boothLight.position.set(-2.45, 2.35, 3.15);
    if (!useLowShaders) {
      scene.add(boothLight);
    }

    const rectLights: THREE.RectAreaLight[] = [];
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softboxConfigs: [number, number, number, number, number, number][] =
        [
          [0.15, 4.1, -0.35, 3.2, 1.8, 2.2],
          [3.6, 4.1, -1.6, 2.6, 1.6, 1.8],
          [1.55, 4.08, 4.1, 2.4, 1.5, 1.7],
        ];
      softboxConfigs.forEach(([x, y, z, w, h, intensity]) => {
        const area = new THREE.RectAreaLight(0xeef8ff, intensity, w, h);
        area.position.set(x, y, z);
        area.lookAt(x, 0, z);
        area.visible = activeTier === 'ultra' || activeTier === 'high';
        scene.add(area);
        rectLights.push(area);
      });
    }

    const exposureFlashLight = new THREE.PointLight(0x22d3ee, 0, 4.5);
    scene.add(exposureFlashLight);

    // =========================================================================
    // PROCEDURAL MATERIALS & TEXTURES
    // =========================================================================
    const disposables: {dispose: () => void}[] = [];
    const track = <T extends {dispose: () => void}>(item: T): T => {
      disposables.push(item);
      return item;
    };

    const maxDeviceAniso = renderer.capabilities.getMaxAnisotropy();
    const texAniso = useLowShaders ? 1 : maxDeviceAniso;

    const floorTex = track(createTileFloorTexture());
    floorTex.anisotropy = texAniso;
    const shadowTex = track(createContactShadowTexture());
    const lightboxTex = track(createLightboxTexture());
    lightboxTex.anisotropy = texAniso;
    const detectorTex = track(createDetectorPanelTexture());
    detectorTex.anisotropy = texAniso;
    const pcScreenTex = track(createPcScreenTexture());
    pcScreenTex.anisotropy = texAniso;
    const pcSecondaryTex = track(createPcSecondaryScreenTexture());
    pcSecondaryTex.anisotropy = texAniso;
    const consoleTex = track(createConsoleTexture());
    consoleTex.anisotropy = texAniso;
    const doorSignTex = track(createDoorSignTexture());
    const wallChartTex = track(createWallChartTexture());
    wallChartTex.anisotropy = texAniso;
    const suiteHeaderTex = track(createSuiteHeaderTexture());
    suiteHeaderTex.anisotropy = texAniso;
    const waitingHeaderTex = track(
      createRoomHeaderPlaqueTexture(
        'صالة الانتظار · المرضى',
        'PATIENT WAITING LOUNGE',
        '#F59E0B'
      )
    );
    waitingHeaderTex.anisotropy = texAniso;
    const waitingTvTex = track(createWaitingTvTexture());
    waitingTvTex.anisotropy = texAniso;
    const ctHeaderTex = track(
      createRoomHeaderPlaqueTexture(
        'غرفة السيتي (المفراس)',
        'CT SCANNER SUITE · 64-SLICE',
        '#38BDF8'
      )
    );
    ctHeaderTex.anisotropy = texAniso;
    const mriHeaderTex = track(
      createRoomHeaderPlaqueTexture(
        'غرفة الرنين المغناطيسي',
        'MRI IMAGING SUITE · 1.5 TESLA',
        '#34D399'
      )
    );
    mriHeaderTex.anisotropy = texAniso;
    const ctLockedBadgeTex = track(
      createDoorStatusBadgeTexture(
        'غرفة السيتي / المفراس',
        'غير متوفر · قريباً 🔒',
        true,
        '#38BDF8'
      )
    );
    ctLockedBadgeTex.anisotropy = texAniso;
    const ctUnlockedBadgeTex = track(
      createDoorStatusBadgeTexture(
        'غرفة السيتي / المفراس',
        'متاح ومفتوح ✓',
        false,
        '#38BDF8'
      )
    );
    ctUnlockedBadgeTex.anisotropy = texAniso;
    const mriLockedBadgeTex = track(
      createDoorStatusBadgeTexture(
        'غرفة الرنين (MRI)',
        'غير متوفر · قريباً 🔒',
        true,
        '#34D399'
      )
    );
    mriLockedBadgeTex.anisotropy = texAniso;
    const crReaderTex = track(createCrReaderTexture());
    crReaderTex.anisotropy = texAniso;
    const mriUnlockedBadgeTex = track(
      createDoorStatusBadgeTexture(
        'غرفة الرنين (MRI)',
        'متاح ومفتوح ✓',
        false,
        '#34D399'
      )
    );
    mriUnlockedBadgeTex.anisotropy = texAniso;

    const floorPbrMaps = createTileFloorPbrMaps();
    track(floorPbrMaps.roughnessMap);
    track(floorPbrMaps.bumpMap);
    const wallBumpTex = track(createWallPlasterBumpTexture());

    const matFloor = track(
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughnessMap: floorPbrMaps.roughnessMap,
        bumpMap: floorPbrMaps.bumpMap,
        bumpScale: 0.012,
        roughness: 0.72,
        metalness: 0.14,
        envMapIntensity: 1.25,
      })
    );
    const matWall = track(
      new THREE.MeshStandardMaterial({
        color: 0x223247,
        bumpMap: wallBumpTex,
        bumpScale: 0.005,
        roughness: 0.72,
        metalness: 0.06,
      })
    );
    const matWallLower = track(
      new THREE.MeshStandardMaterial({
        color: 0x2b405a,
        bumpMap: wallBumpTex,
        bumpScale: 0.005,
        roughness: 0.54,
        metalness: 0.15,
      })
    );
    const matCeiling = track(
      new THREE.MeshStandardMaterial({
        color: 0x1a2738,
        roughness: 0.82,
        metalness: 0.04,
      })
    );
    const matCeilingPanel = track(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xdbeafe,
        emissiveIntensity: 1.12,
        roughness: 0.22,
      })
    );
    const matWarmWood = track(
      new THREE.MeshStandardMaterial({
        color: 0x7c5438,
        roughness: 0.58,
        metalness: 0.06,
      })
    );
    const matTrim = track(
      new THREE.MeshStandardMaterial({
        color: 0x3b526b,
        roughness: 0.3,
        metalness: 0.68,
        envMapIntensity: 1.2,
      })
    );
    const matClinicalWhite = track(
      useLowShaders
        ? new THREE.MeshStandardMaterial({
            color: 0xeaf1f8,
            roughness: 0.24,
            metalness: 0.16,
          })
        : new THREE.MeshPhysicalMaterial({
            color: 0xeef4fb,
            roughness: 0.2,
            metalness: 0.14,
            clearcoat: 0.65,
            clearcoatRoughness: 0.14,
            envMapIntensity: 1.22,
          })
    );
    const matRadiolucentDeck = track(
      useLowShaders
        ? new THREE.MeshStandardMaterial({
            color: 0x132032,
            roughness: 0.22,
            metalness: 0.25,
            transparent: true,
            opacity: 0.72,
          })
        : new THREE.MeshPhysicalMaterial({
            color: 0x132032,
            roughness: 0.12,
            metalness: 0.22,
            transparent: true,
            opacity: 0.72,
            clearcoat: 0.85,
            clearcoatRoughness: 0.08,
            envMapIntensity: 1.35,
          })
    );
    const matFoliage = track(
      new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.64,
        metalness: 0.03,
        side: THREE.DoubleSide,
      })
    );
    const matChrome = track(
      useLowShaders
        ? new THREE.MeshStandardMaterial({
            color: 0xdbe4ee,
            roughness: 0.18,
            metalness: 0.9,
          })
        : new THREE.MeshPhysicalMaterial({
            color: 0xe2e8f0,
            roughness: 0.11,
            metalness: 0.96,
            clearcoat: 0.45,
            clearcoatRoughness: 0.12,
            anisotropy: 0.7,
            envMapIntensity: 1.4,
          })
    );
    const matDarkPad = track(
      new THREE.MeshStandardMaterial({
        color: 0x141e2c,
        roughness: 0.74,
        metalness: 0.08,
      })
    );
    const matSkin = track(
      new THREE.MeshStandardMaterial({
        color: 0xdba88a,
        roughness: 0.62,
        metalness: 0.02,
      })
    );
    const matGloveBlue = track(
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.42,
        metalness: 0.05,
      })
    );
    const matCoatWhite = track(
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.65,
        metalness: 0.03,
      })
    );
    const matHair = track(
      new THREE.MeshStandardMaterial({
        color: 0x1e2530,
        roughness: 0.85,
        metalness: 0.04,
      })
    );
    const matScrubs = track(
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.72,
        metalness: 0.05,
      })
    );
    const matPants = track(
      new THREE.MeshStandardMaterial({
        color: 0x2b3b52,
        roughness: 0.78,
        metalness: 0.04,
      })
    );
    const matLeadApron = track(
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.42,
        metalness: 0.28,
      })
    );
    const matLeadGlass = track(
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.18,
        roughness: 0.08,
        metalness: 0.1,
        depthWrite: false,
      })
    );
    const matSuiteWindowGlass = track(
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.08,
        roughness: 0.06,
        metalness: 0.08,
        depthWrite: false,
      })
    );
    const matLedStrip = track(
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.1,
        roughness: 0.2,
      })
    );
    const matCassetteBody = track(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.55,
      })
    );
    const matCassetteEdge = track(
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.22,
        metalness: 0.82,
      })
    );
    const matHighlightGlow = track(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    const matWarningBeacon = track(
      new THREE.MeshStandardMaterial({
        color: 0x451a03,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.12,
        roughness: 0.25,
      })
    );

    // =========================================================================
    // 1. FIRST-PERSON 3D TECHNICIAN HANDS + HANDHELD X-RAY CASSETTE
    // =========================================================================
    const handsGroup = new THREE.Group();
    handsGroup.position.set(0, -0.26, -0.42);
    camera.add(handsGroup);

    const buildTechHand = (side: -1 | 1) => {
      const handRoot = new THREE.Group();
      handRoot.position.set(side * 0.22, -0.02, 0.05);
      handRoot.rotation.set(0.28, side * -0.18, side * 0.12);

      const forearm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.036, 0.22, 8, 12)),
        matCoatWhite
      );
      forearm.rotation.x = Math.PI / 2;
      forearm.position.set(0, -0.03, 0.16);
      handRoot.add(forearm);

      const wrist = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.03, 0.06, 8, 12)),
        matGloveBlue
      );
      wrist.rotation.x = Math.PI / 2;
      wrist.position.set(0, 0, 0.03);
      handRoot.add(wrist);

      const palm = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.055, 0.026, 0.072)),
        matGloveBlue
      );
      palm.position.set(0, 0.005, -0.025);
      handRoot.add(palm);

      const thumb = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.011, 0.035, 6, 8)),
        matGloveBlue
      );
      thumb.rotation.set(0.9, 0, side * 0.5);
      thumb.position.set(-side * 0.032, 0.014, -0.022);
      handRoot.add(thumb);

      [-0.018, -0.006, 0.006, 0.018].forEach((fx) => {
        const finger = new THREE.Mesh(
          track(new THREE.CapsuleGeometry(0.0085, 0.04, 6, 8)),
          matGloveBlue
        );
        finger.rotation.x = Math.PI / 2 + 0.18;
        finger.position.set(fx, 0.002, -0.078);
        handRoot.add(finger);
      });

      return handRoot;
    };

    const leftTechHand = buildTechHand(-1);
    const rightTechHand = buildTechHand(1);
    handsGroup.add(leftTechHand);
    handsGroup.add(rightTechHand);

    // 3D X-Ray Cassette Held Between Technician's Hands
    const handheldCassette = buildCassetteMesh(
      track,
      matCassetteBody,
      matCassetteEdge,
      matLedStrip
    );
    handheldCassette.position.set(0, 0.02, -0.06);
    handheldCassette.rotation.x = 0.48;
    handheldCassette.scale.setScalar(0.68);
    handheldCassette.visible = false;
    handsGroup.add(handheldCassette);

    // =========================================================================
    // 2. CLINIC ARCHITECTURE, LEAD PARTITION WALL & SWINGING LEAD DOOR
    // =========================================================================
    const interactiveMeshes: THREE.Mesh[] = [];

    const floorMesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(24, 24)),
      matFloor
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(1.0, 0, -0.5);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Enlarged Main X-Ray Room Outer Perimeter (x: -5.40 .. +7.40, z: -4.80 .. +2.05)
    const rightWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 4.3, 7.2)),
      matWall
    );
    rightWall.position.set(7.4, 2.15, -1.35);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const leftWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 4.3, 14.2)),
      matWall
    );
    leftWall.position.set(-5.4, 2.15, -2.2);
    scene.add(leftWall);

    const rightWainscot = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 1.05, 7.0)),
      matWallLower
    );
    rightWainscot.position.set(7.29, 0.525, -1.35);
    scene.add(rightWainscot);

    const leftWainscot = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 1.05, 13.9)),
      matWallLower
    );
    leftWainscot.position.set(-5.29, 0.525, -2.2);
    scene.add(leftWainscot);

    // North-East Equipment Back Wall (x: +1.25 .. +7.40 at z = -4.80)
    const backWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(6.35, 4.3, 0.18)),
      matWall
    );
    backWall.position.set(4.32, 2.15, -4.8);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const backWainscot = new THREE.Mesh(
      track(new THREE.BoxGeometry(6.25, 1.05, 0.04)),
      matWallLower
    );
    backWainscot.position.set(4.32, 0.525, -4.69);
    scene.add(backWainscot);

    const backLed = new THREE.Mesh(
      track(new THREE.BoxGeometry(6.0, 0.055, 0.04)),
      matLedStrip
    );
    backLed.position.set(4.32, 3.35, -4.68);
    scene.add(backLed);

    const backDado = new THREE.Mesh(
      track(new THREE.BoxGeometry(6.2, 0.055, 0.06)),
      matChrome
    );
    backDado.position.set(4.32, 1.07, -4.68);
    scene.add(backDado);

    // Warm Architectural Acoustic Wood Slats on Back Wall & Right Wall
    [5.85, 6.01, 6.17, 6.33].forEach((sx) => {
      const slat = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.05, 2.6, 0.04)),
        matWarmWood
      );
      slat.position.set(sx, 2.38, -4.69);
      scene.add(slat);
    });
    [-2.8, -2.64, -2.48, 0.85, 1.01, 1.17].forEach((sz) => {
      const slat = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.04, 2.6, 0.05)),
        matWarmWood
      );
      slat.position.set(7.29, 2.38, sz);
      scene.add(slat);
    });

    // Architectural High Ceiling (4.20m) & Recessed LED Skylight Coffers
    const ceilingMesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(24, 24)),
      matCeiling
    );
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(1.0, 4.2, -0.5);
    scene.add(ceilingMesh);

    [
      [-3.4, -3.1],
      [-1.0, -3.1],
      [1.4, -3.1],
      [3.8, -3.1],
      [5.8, -3.1],
      [-3.4, -0.8],
      [-1.0, -0.8],
      [1.4, -0.8],
      [3.8, -0.8],
      [5.8, -0.8],
      [-3.4, 1.0],
      [-1.0, 1.0],
      [1.4, 1.0],
      [3.8, 1.0],
      [5.8, 1.0],
      [-3.4, 3.1],
      [-2.1, -6.7],
      [1.48, 3.9],
      [1.48, 6.1],
      [5.42, 3.9],
      [5.42, 6.1],
    ].forEach(([lx, lz]) => {
      const cofferFrame = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.36, 0.05, 0.82)),
        matChrome
      );
      cofferFrame.position.set(lx, 4.18, lz);
      scene.add(cofferFrame);

      const cofferPanel = new THREE.Mesh(
        track(new THREE.PlaneGeometry(1.26, 0.72)),
        matCeilingPanel
      );
      cofferPanel.rotation.x = Math.PI / 2;
      cofferPanel.position.set(lx, 4.15, lz);
      scene.add(cofferPanel);
    });

    // Framed Radiography Reference Chart on Enlarged Right Wall
    const chartFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 0.96, 1.28)),
      matChrome
    );
    chartFrame.position.set(7.28, 1.92, -0.45);
    scene.add(chartFrame);

    const chartPoster = new THREE.Mesh(
      track(new THREE.PlaneGeometry(1.18, 0.86)),
      track(
        new THREE.MeshStandardMaterial({
          map: wallChartTex,
          emissiveMap: wallChartTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.25,
          roughness: 0.35,
        })
      )
    );
    chartPoster.rotation.y = -Math.PI / 2;
    chartPoster.position.set(7.25, 1.92, -0.45);
    scene.add(chartPoster);

    // Standing Zone Floor Decals (Erect Bucky Target + Lead Door Safety Threshold)
    const erectFloorRing = new THREE.Mesh(
      track(new THREE.RingGeometry(0.32, 0.38, 32)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      )
    );
    erectFloorRing.rotation.x = -Math.PI / 2;
    erectFloorRing.position.set(ERECT_PATIENT_X, 0.015, ERECT_Z);
    scene.add(erectFloorRing);

    const safetyThresholdStrip = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.95, 0.08)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.72,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      )
    );
    safetyThresholdStrip.rotation.x = -Math.PI / 2;
    safetyThresholdStrip.position.set(-1.04, 0.014, 1.94);
    scene.add(safetyThresholdStrip);

    // Wall Lightbox on Enlarged North Wall (x = 2.75, z = -4.67)
    const lightboxGroup = new THREE.Group();
    const lightboxFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.35, 1.22, 0.08)),
      matChrome
    );
    lightboxGroup.add(lightboxFrame);
    const lightboxScreen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(2.18, 1.06)),
      track(
        new THREE.MeshStandardMaterial({
          map: lightboxTex,
          emissiveMap: lightboxTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.9,
        })
      )
    );
    lightboxScreen.position.z = 0.045;
    lightboxGroup.add(lightboxScreen);
    lightboxGroup.position.set(2.75, 1.98, -4.67);
    scene.add(lightboxGroup);

    // Back-Wall Clinical Cabinetry & Countertop (x = 5.05, z = -4.50)
    const cabinetGroup = new THREE.Group();
    cabinetGroup.position.set(5.05, 0, -4.5);

    const baseCabinet = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.55, 0.84, 0.42)),
      matClinicalWhite
    );
    baseCabinet.position.y = 0.42;
    baseCabinet.castShadow = true;
    cabinetGroup.add(baseCabinet);

    const cabinetTop = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.6, 0.045, 0.46)),
      matDarkPad
    );
    cabinetTop.position.y = 0.86;
    cabinetGroup.add(cabinetTop);

    [-0.38, 0.38].forEach((hx) => {
      const handle = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.14, 0.022, 0.025)),
        matChrome
      );
      handle.position.set(hx, 0.72, 0.22);
      cabinetGroup.add(handle);
    });

    const upperCabinet = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.48, 0.62, 0.32)),
      matClinicalWhite
    );
    upperCabinet.position.set(0, 2.02, -0.04);
    cabinetGroup.add(upperCabinet);

    const upperCabinetLed = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.4, 0.025, 0.04)),
      matLedStrip
    );
    upperCabinetLed.position.set(0, 1.69, 0.06);
    cabinetGroup.add(upperCabinetLed);
    scene.add(cabinetGroup);

    // Mobile Lead Apron & Shield Rack (x = -4.82, z = -2.25)
    const apronRackGroup = new THREE.Group();
    apronRackGroup.position.set(-4.82, 0, -2.25);
    const apronBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 16)),
      matTrim
    );
    apronBase.position.y = 0.02;
    apronRackGroup.add(apronBase);
    const apronPole = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.025, 0.03, 1.48, 12)),
      matChrome
    );
    apronPole.position.y = 0.76;
    apronRackGroup.add(apronPole);
    const apronBar = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 12)),
      matChrome
    );
    apronBar.rotation.z = Math.PI / 2;
    apronBar.position.y = 1.48;
    apronRackGroup.add(apronBar);
    const hangingApron = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.42, 0.92, 0.07)),
      matLeadApron
    );
    hangingApron.position.set(0, 1.02, 0);
    hangingApron.castShadow = true;
    apronRackGroup.add(hangingApron);
    scene.add(apronRackGroup);

    // Potted Clinic Foliage Planter (x = 6.72, z = -4.25)
    const planterGroup = new THREE.Group();
    planterGroup.position.set(6.72, 0, -4.25);
    const potBody = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 18)),
      matClinicalWhite
    );
    potBody.position.y = 0.21;
    potBody.castShadow = true;
    planterGroup.add(potBody);
    [0, 1.25, 2.5, 3.8, 5.1].forEach((ang, idx) => {
      const leaf = new THREE.Mesh(
        track(new THREE.ConeGeometry(0.09, 0.48, 6)),
        matFoliage
      );
      leaf.position.set(Math.cos(ang) * 0.09, 0.58 + (idx % 2) * 0.08, Math.sin(ang) * 0.09);
      leaf.rotation.set(0.35 * Math.sin(ang), ang, -0.35 * Math.cos(ang));
      planterGroup.add(leaf);
    });
    scene.add(planterGroup);

    // =========================================================================
    // 2A. PATIENT WAITING ROOM (VISIBLE THROUGH CLEAR GLASS DOOR & WINDOWS)
    // =========================================================================
    const waitingRoomGroup = new THREE.Group();

    const buildWaitingPartitionPillar = (xCenter: number, width: number) => {
      const top = new THREE.Mesh(
        track(new THREE.BoxGeometry(width, 4.2, 0.16)),
        matWall
      );
      top.position.set(xCenter, 2.1, -4.8);
      waitingRoomGroup.add(top);

      const bot = new THREE.Mesh(
        track(new THREE.BoxGeometry(width + 0.01, 1.05, 0.18)),
        matWallLower
      );
      bot.position.set(xCenter, 0.525, -4.8);
      waitingRoomGroup.add(bot);
    };

    const buildWaitingGlassPanel = (xStart: number, xEnd: number) => {
      const w = xEnd - xStart;
      const cx = (xStart + xEnd) / 2;

      const knee = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 0.68, 0.17)),
        matWallLower
      );
      knee.position.set(cx, 0.34, -4.8);
      waitingRoomGroup.add(knee);

      const sill = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 0.06, 0.22)),
        matChrome
      );
      sill.position.set(cx, 0.7, -4.8);
      waitingRoomGroup.add(sill);

      const glass = new THREE.Mesh(
        track(new THREE.BoxGeometry(w, 2.08, 0.035)),
        matSuiteWindowGlass
      );
      glass.position.set(cx, 1.76, -4.8);
      waitingRoomGroup.add(glass);

      const headRail = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 0.08, 0.22)),
        matChrome
      );
      headRail.position.set(cx, 2.82, -4.8);
      waitingRoomGroup.add(headRail);

      const upper = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 1.38, 0.16)),
        matWall
      );
      upper.position.set(cx, 3.51, -4.8);
      waitingRoomGroup.add(upper);
    };

    buildWaitingPartitionPillar(-5.075, 0.65); // -5.40 .. -4.75
    buildWaitingGlassPanel(-4.75, -2.95); // Left Waiting Observation Window
    buildWaitingPartitionPillar(-2.875, 0.15); // -2.95 .. -2.80
    // Door opening at x: -2.80 .. -1.45 (width 1.35m)
    buildWaitingPartitionPillar(-1.375, 0.15); // -1.45 .. -1.30
    buildWaitingGlassPanel(-1.3, 0.75); // Right Waiting Observation Window
    buildWaitingPartitionPillar(1.0, 0.5); // +0.75 .. +1.25

    // Door Lintel & Illuminated Waiting Room Sign above Glass Door (facing South into Exam Room)
    const waitingDoorLintel = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.4, 1.75, 0.17)),
      matWall
    );
    waitingDoorLintel.position.set(-2.125, 3.325, -4.8);
    waitingRoomGroup.add(waitingDoorLintel);

    const waitingHeaderBack = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.3, 0.45, 0.045)),
      matChrome
    );
    waitingHeaderBack.position.set(-2.125, 3.18, -4.67);
    waitingRoomGroup.add(waitingHeaderBack);

    const waitingHeaderFace = new THREE.Mesh(
      track(new THREE.PlaneGeometry(2.22, 0.39)),
      track(
        new THREE.MeshStandardMaterial({
          map: waitingHeaderTex,
          emissiveMap: waitingHeaderTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.85,
        })
      )
    );
    waitingHeaderFace.position.set(-2.125, 3.18, -4.642);
    waitingRoomGroup.add(waitingHeaderFace);

    // Tempered Clear Glass Door to Waiting Room (hinged at x = -2.80, z = -4.80)
    const waitingDoorPivot = new THREE.Group();
    waitingDoorPivot.position.set(-2.8, 0, -4.8);

    const waitGlassLeaf = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.3, 2.42, 0.045)),
      matSuiteWindowGlass
    );
    waitGlassLeaf.position.set(0.66, 1.22, 0);
    waitGlassLeaf.layers.set(1);
    waitGlassLeaf.userData.action = {
      type: 'WAITING_DOOR',
    } satisfies SceneTargetAction;
    waitingDoorPivot.add(waitGlassLeaf);
    interactiveMeshes.push(waitGlassLeaf);

    // Chrome perimeter stiles & push bar on glass door
    const waitStileL = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.06, 2.44, 0.065)),
      matChrome
    );
    waitStileL.position.set(0.03, 1.22, 0);
    waitingDoorPivot.add(waitStileL);

    const waitStileR = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.06, 2.44, 0.065)),
      matChrome
    );
    waitStileR.position.set(1.29, 1.22, 0);
    waitingDoorPivot.add(waitStileR);

    const waitBottomRail = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.32, 0.14, 0.068)),
      matChrome
    );
    waitBottomRail.position.set(0.66, 0.07, 0);
    waitingDoorPivot.add(waitBottomRail);

    const waitTopRail = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.32, 0.08, 0.068)),
      matChrome
    );
    waitTopRail.position.set(0.66, 2.4, 0);
    waitingDoorPivot.add(waitTopRail);

    const waitPushBar = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.018, 0.018, 0.65, 12)),
      matChrome
    );
    waitPushBar.position.set(1.14, 1.12, 0.055);
    waitingDoorPivot.add(waitPushBar);

    waitingRoomGroup.add(waitingDoorPivot);

    // Waiting Room Enclosure Walls (x: -5.40 .. +1.25, z: -4.80 .. -8.80)
    const waitingEastWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 4.2, 4.15)),
      matWall
    );
    waitingEastWall.position.set(1.25, 2.1, -6.82);
    waitingRoomGroup.add(waitingEastWall);

    const waitingNorthWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(6.8, 4.2, 0.18)),
      matWall
    );
    waitingNorthWall.position.set(-2.08, 2.1, -8.8);
    waitingRoomGroup.add(waitingNorthWall);

    // Warm Inviting Waiting Lounge Lighting + Wood Slats + TV Display
    const waitingRoomLight = new THREE.PointLight(0xfff1d6, 2.35, 13.5);
    waitingRoomLight.position.set(-2.1, 3.7, -6.7);
    if (!useLowShaders) {
      scene.add(waitingRoomLight);
    }

    [-4.2, -4.04, -3.88, -0.3, -0.14, 0.02].forEach((sx) => {
      const wSlat = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.05, 2.6, 0.04)),
        matWarmWood
      );
      wSlat.position.set(sx, 2.15, -8.68);
      waitingRoomGroup.add(wSlat);
    });

    const waitTvFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.85, 1.05, 0.07)),
      matDarkPad
    );
    waitTvFrame.position.set(-2.12, 2.42, -8.67);
    waitingRoomGroup.add(waitTvFrame);

    const waitTvFace = new THREE.Mesh(
      track(new THREE.PlaneGeometry(1.74, 0.96)),
      track(
        new THREE.MeshStandardMaterial({
          map: waitingTvTex,
          emissiveMap: waitingTvTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.82,
        })
      )
    );
    waitTvFace.position.set(-2.12, 2.42, -8.63);
    waitingRoomGroup.add(waitTvFace);

    // Cushioned Hospital Waiting Bench Row (facing South toward Door so players see seated patients clearly)
    const waitBenchBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.85, 0.06, 0.48)),
      matChrome
    );
    waitBenchBase.position.set(-2.1, 0.36, -7.25);
    waitingRoomGroup.add(waitBenchBase);

    [-3.75, -2.1, -0.45].forEach((lx) => {
      const leg = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.08, 0.36, 0.42)),
        matTrim
      );
      leg.position.set(lx, 0.18, -7.25);
      waitingRoomGroup.add(leg);
    });

    const matBenchCushion = track(
      new THREE.MeshStandardMaterial({
        color: 0x0f766e,
        roughness: 0.58,
        metalness: 0.08,
      })
    );
    [-3.35, -2.1, -0.85].forEach((sx) => {
      const seat = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.74, 0.09, 0.52)),
        matBenchCushion
      );
      seat.position.set(sx, 0.43, -7.22);
      waitingRoomGroup.add(seat);

      const back = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.74, 0.52, 0.09)),
        matBenchCushion
      );
      back.position.set(sx, 0.72, -7.45);
      waitingRoomGroup.add(back);
    });

    // Reception Check-In Desk on Left Side of Waiting Room
    const receptionBody = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.68, 1.02, 1.95)),
      matClinicalWhite
    );
    receptionBody.position.set(-4.65, 0.51, -6.95);
    waitingRoomGroup.add(receptionBody);

    const receptionTop = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.76, 0.05, 2.02)),
      matWarmWood
    );
    receptionTop.position.set(-4.65, 1.04, -6.95);
    waitingRoomGroup.add(receptionTop);

    // Waiting Room Plant
    const waitPot = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.22, 0.16, 0.44, 16)),
      matClinicalWhite
    );
    waitPot.position.set(0.62, 0.22, -7.95);
    waitingRoomGroup.add(waitPot);
    [0, 1.5, 3.1, 4.7].forEach((ang) => {
      const leaf = new THREE.Mesh(
        track(new THREE.ConeGeometry(0.11, 0.56, 6)),
        matFoliage
      );
      leaf.position.set(0.62 + Math.cos(ang) * 0.1, 0.64, -7.95 + Math.sin(ang) * 0.1);
      leaf.rotation.set(0.35 * Math.sin(ang), ang, -0.35 * Math.cos(ang));
      waitingRoomGroup.add(leaf);
    });

    scene.add(waitingRoomGroup);

    // Lead-Lined Partition Wall + Observation Window + Swinging Lead Door (Expanded Booth x: -5.40 .. -0.52)
    const boothGroup = new THREE.Group();

    const boothBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.84, 0.96, 0.14)),
      matTrim
    );
    boothBase.position.set(-3.44, 0.48, 2.05);
    boothGroup.add(boothBase);

    const boothGlass = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.56, 1.28, 0.04)),
      matLeadGlass
    );
    boothGlass.position.set(-3.44, 1.58, 2.05);
    boothGroup.add(boothGlass);

    const boothHeader = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.84, 0.14, 0.16)),
      matTrim
    );
    boothHeader.position.set(-3.44, 2.28, 2.05);
    boothGroup.add(boothHeader);

    const boothUpperWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.86, 1.88, 0.16)),
      matWall
    );
    boothUpperWall.position.set(-3.44, 3.28, 2.05);
    boothGroup.add(boothUpperWall);

    // Illuminated Suite Header Sign above Lead-Glass Window
    const suiteSignFace = new THREE.Mesh(
      track(new THREE.PlaneGeometry(2.2, 0.38)),
      track(
        new THREE.MeshStandardMaterial({
          map: suiteHeaderTex,
          emissiveMap: suiteHeaderTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.72,
        })
      )
    );
    suiteSignFace.rotation.y = Math.PI;
    suiteSignFace.position.set(-3.44, 2.62, 1.95);
    boothGroup.add(suiteSignFace);

    // Door Frame & Overhead Warning Beacon (door opening at x: -1.48 to -0.58, z = 2.05)
    const doorLintel = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.15, 2.08, 0.18)),
      matWallLower
    );
    doorLintel.position.set(-1.02, 3.18, 2.05);
    boothGroup.add(doorLintel);

    const beaconMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.065, 0.08, 0.12, 16)),
      matWarningBeacon
    );
    beaconMesh.position.set(-1.02, 2.38, 2.16);
    boothGroup.add(beaconMesh);

    // Swinging Lead Door Pivot at hinge (-1.48, 0, 2.05)
    const leadDoorPivot = new THREE.Group();
    leadDoorPivot.position.set(-1.48, 0, 2.05);

    const doorSlab = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.88, 2.14, 0.08)),
      matTrim
    );
    doorSlab.position.set(0.44, 1.07, 0);
    doorSlab.castShadow = true;
    doorSlab.layers.set(1);
    doorSlab.userData.action = {type: 'DOOR'} satisfies SceneTargetAction;
    doorSlab.userData.label = 'انقر لفتح/إغلاق الباب الرصاصي';
    leadDoorPivot.add(doorSlab);
    interactiveMeshes.push(doorSlab);

    const doorSign = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.44, 0.22)),
      track(new THREE.MeshBasicMaterial({map: doorSignTex}))
    );
    doorSign.position.set(0.44, 1.56, 0.045);
    leadDoorPivot.add(doorSign);

    const doorSignBack = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.44, 0.22)),
      track(new THREE.MeshBasicMaterial({map: doorSignTex}))
    );
    doorSignBack.rotation.y = Math.PI;
    doorSignBack.position.set(0.44, 1.56, -0.045);
    leadDoorPivot.add(doorSignBack);

    const doorHandle = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.14, 0.035, 0.14)),
      matChrome
    );
    doorHandle.position.set(0.76, 1.02, 0);
    leadDoorPivot.add(doorHandle);

    boothGroup.add(leadDoorPivot);

    // Control Booth right enclosure wall & rear wall
    const boothSideWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.14, 4.2, 2.35)),
      matWallLower
    );
    boothSideWall.position.set(-0.52, 2.1, 3.22);
    boothGroup.add(boothSideWall);

    const boothBackWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(4.95, 4.2, 0.16)),
      matWall
    );
    boothBackWall.position.set(-2.96, 2.1, 4.35);
    boothGroup.add(boothBackWall);

    scene.add(boothGroup);

    // =========================================================================
    // 2B. MONUMENTAL DIAGNOSTIC SUITES: GIANT CT & MRI ROOMS + PANORAMIC GLASS
    // =========================================================================
    const diagnosticSuitesGroup = new THREE.Group();

    const buildFullPillar = (xCenter: number, width: number) => {
      const wallSeg = new THREE.Mesh(
        track(new THREE.BoxGeometry(width, 4.2, 0.16)),
        matWall
      );
      wallSeg.position.set(xCenter, 2.1, 2.05);
      wallSeg.receiveShadow = true;
      diagnosticSuitesGroup.add(wallSeg);

      const lowerSeg = new THREE.Mesh(
        track(new THREE.BoxGeometry(width + 0.01, 1.05, 0.18)),
        matWallLower
      );
      lowerSeg.position.set(xCenter, 0.525, 2.05);
      diagnosticSuitesGroup.add(lowerSeg);
    };

    const buildPanoramicWindow = (
      xStart: number,
      xEnd: number,
      accentHex: number
    ) => {
      const w = xEnd - xStart;
      const cx = (xStart + xEnd) / 2;

      const kneeWall = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 0.68, 0.17)),
        matWallLower
      );
      kneeWall.position.set(cx, 0.34, 2.05);
      diagnosticSuitesGroup.add(kneeWall);

      const sillRail = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 0.06, 0.22)),
        matChrome
      );
      sillRail.position.set(cx, 0.7, 2.05);
      diagnosticSuitesGroup.add(sillRail);

      const glassPane = new THREE.Mesh(
        track(new THREE.BoxGeometry(w, 2.08, 0.035)),
        matSuiteWindowGlass
      );
      glassPane.position.set(cx, 1.76, 2.05);
      diagnosticSuitesGroup.add(glassPane);

      const topFrameRail = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 0.08, 0.22)),
        matChrome
      );
      topFrameRail.position.set(cx, 2.82, 2.05);
      diagnosticSuitesGroup.add(topFrameRail);

      const upperHeaderWall = new THREE.Mesh(
        track(new THREE.BoxGeometry(w + 0.02, 1.38, 0.16)),
        matWall
      );
      upperHeaderWall.position.set(cx, 3.51, 2.05);
      diagnosticSuitesGroup.add(upperHeaderWall);

      const glowStripMat = track(
        new THREE.MeshStandardMaterial({
          color: accentHex,
          emissive: accentHex,
          emissiveIntensity: 0.95,
          roughness: 0.2,
        })
      );
      const topAccentBar = new THREE.Mesh(
        track(new THREE.BoxGeometry(w - 0.06, 0.045, 0.05)),
        glowStripMat
      );
      topAccentBar.position.set(cx, 2.79, 1.94);
      diagnosticSuitesGroup.add(topAccentBar);

      const botAccentBar = new THREE.Mesh(
        track(new THREE.BoxGeometry(w - 0.06, 0.038, 0.05)),
        glowStripMat
      );
      botAccentBar.position.set(cx, 0.72, 1.94);
      diagnosticSuitesGroup.add(botAccentBar);
    };

    // Structural Pillars & Giant Panoramic Windows along z = 2.05 (x = -0.52 .. 7.40)
    buildFullPillar(-0.36, 0.32); // West CT pier (-0.52 .. -0.20)
    buildFullPillar(1.09, 0.18); // CT door/window mullion (1.00 .. 1.18)
    buildPanoramicWindow(1.18, 3.32, 0x38bdf8); // Giant CT Window (2.14m wide x 2.08m tall)
    buildFullPillar(3.44, 0.24); // Suite dividing pier (3.32 .. 3.56)
    buildFullPillar(4.85, 0.18); // MRI door/window mullion (4.76 .. 4.94)
    buildPanoramicWindow(4.94, 7.22, 0x10b981); // Giant MRI Window (2.28m wide x 2.08m tall)
    buildFullPillar(7.31, 0.18); // East MRI pier (7.22 .. 7.40)

    // Monumental 4.2m High & 5.65m Deep Enclosure Walls for CT & MRI Suites
    const ctWestExtensionWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.16, 4.2, 3.4)),
      matWallLower
    );
    ctWestExtensionWall.position.set(-0.52, 2.1, 6.05);
    diagnosticSuitesGroup.add(ctWestExtensionWall);

    const suitesRearWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(8.1, 4.2, 0.18)),
      matWall
    );
    suitesRearWall.position.set(3.44, 2.1, 7.7);
    diagnosticSuitesGroup.add(suitesRearWall);

    const ctBackGlow = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.4, 0.07, 0.04)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          emissiveIntensity: 1.1,
        })
      )
    );
    ctBackGlow.position.set(1.48, 3.45, 7.58);
    diagnosticSuitesGroup.add(ctBackGlow);

    const mriBackGlow = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.4, 0.07, 0.04)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x34d399,
          emissive: 0x10b981,
          emissiveIntensity: 1.1,
        })
      )
    );
    mriBackGlow.position.set(5.42, 3.45, 7.58);
    diagnosticSuitesGroup.add(mriBackGlow);

    const suitesDividerWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.2, 4.2, 5.75)),
      matWallLower
    );
    suitesDividerWall.position.set(3.44, 2.1, 4.9);
    diagnosticSuitesGroup.add(suitesDividerWall);

    const mriRightWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 4.2, 5.75)),
      matWall
    );
    mriRightWall.position.set(7.4, 2.1, 4.9);
    diagnosticSuitesGroup.add(mriRightWall);

    // Helper to build a grand tall/wide Clinical Suite Door (1.20m wide x 2.45m tall) + huge sign
    const buildSuiteDoor = (opts: {
      hingeX: number;
      centerX: number;
      signCenterX: number;
      actionType: 'CT_DOOR' | 'MRI_DOOR';
      headerTex: THREE.CanvasTexture;
      lockedTex: THREE.CanvasTexture;
      unlockedTex: THREE.CanvasTexture;
      accentColor: number;
    }) => {
      const lintel = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.24, 1.75, 0.17)),
        matWall
      );
      lintel.position.set(opts.centerX, 3.325, 2.05);
      diagnosticSuitesGroup.add(lintel);

      // Giant Overhead Suite Header Sign spanning across Door + Panoramic Window
      const headerBacking = new THREE.Mesh(
        track(new THREE.BoxGeometry(2.55, 0.48, 0.045)),
        matChrome
      );
      headerBacking.position.set(opts.signCenterX, 3.24, 1.93);
      diagnosticSuitesGroup.add(headerBacking);

      const headerFace = new THREE.Mesh(
        track(new THREE.PlaneGeometry(2.46, 0.42)),
        track(
          new THREE.MeshStandardMaterial({
            map: opts.headerTex,
            emissiveMap: opts.headerTex,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0.85,
          })
        )
      );
      headerFace.rotation.y = Math.PI;
      headerFace.position.set(opts.signCenterX, 3.24, 1.902);
      diagnosticSuitesGroup.add(headerFace);

      const ledMat = track(
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 0.95,
          roughness: 0.25,
        })
      );
      const statusLed = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.92, 0.06, 0.06)),
        ledMat
      );
      statusLed.position.set(opts.centerX, 2.52, 1.94);
      diagnosticSuitesGroup.add(statusLed);

      const doorPivot = new THREE.Group();
      doorPivot.position.set(opts.hingeX, 0, 2.05);

      const slab = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.18, 2.45, 0.085)),
        matClinicalWhite
      );
      slab.position.set(0.59, 1.225, 0);
      slab.castShadow = true;
      slab.layers.set(1);
      slab.userData.action = {type: opts.actionType} satisfies SceneTargetAction;
      doorPivot.add(slab);
      interactiveMeshes.push(slab);

      const windowPane = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.32, 0.92, 0.096)),
        matSuiteWindowGlass
      );
      windowPane.position.set(0.88, 1.62, 0);
      doorPivot.add(windowPane);

      const handle = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.16, 0.04, 0.14)),
        matChrome
      );
      handle.position.set(1.02, 1.08, 0);
      doorPivot.add(handle);

      const stripe = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.075, 2.3, 0.092)),
        track(
          new THREE.MeshStandardMaterial({
            color: opts.accentColor,
            emissive: opts.accentColor,
            emissiveIntensity: 0.42,
            roughness: 0.35,
          })
        )
      );
      stripe.position.set(0.11, 1.225, 0);
      doorPivot.add(stripe);

      const lockedBadge = new THREE.Mesh(
        track(new THREE.PlaneGeometry(0.76, 0.36)),
        track(
          new THREE.MeshStandardMaterial({
            map: opts.lockedTex,
            emissiveMap: opts.lockedTex,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0.52,
          })
        )
      );
      lockedBadge.rotation.y = Math.PI;
      lockedBadge.position.set(0.46, 1.72, -0.046);
      doorPivot.add(lockedBadge);

      const unlockedBadge = new THREE.Mesh(
        track(new THREE.PlaneGeometry(0.76, 0.36)),
        track(
          new THREE.MeshStandardMaterial({
            map: opts.unlockedTex,
            emissiveMap: opts.unlockedTex,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0.52,
          })
        )
      );
      unlockedBadge.rotation.y = Math.PI;
      unlockedBadge.position.set(0.46, 1.72, -0.046);
      unlockedBadge.visible = false;
      doorPivot.add(unlockedBadge);

      diagnosticSuitesGroup.add(doorPivot);
      return {doorPivot, slab, ledMat, lockedBadge, unlockedBadge};
    };

    const ctDoorRig = buildSuiteDoor({
      hingeX: -0.2,
      centerX: 0.4,
      signCenterX: 1.52,
      actionType: 'CT_DOOR',
      headerTex: ctHeaderTex,
      lockedTex: ctLockedBadgeTex,
      unlockedTex: ctUnlockedBadgeTex,
      accentColor: 0x0ea5e9,
    });

    const mriDoorRig = buildSuiteDoor({
      hingeX: 3.56,
      centerX: 4.16,
      signCenterX: 5.38,
      actionType: 'MRI_DOOR',
      headerTex: mriHeaderTex,
      lockedTex: mriLockedBadgeTex,
      unlockedTex: mriUnlockedBadgeTex,
      accentColor: 0x10b981,
    });

    // Monumental CT Suite Interior & Colossal 64-Slice CT Scanner (x ~ 1.48, z ~ 5.25)
    const ctRoomLight = new THREE.PointLight(0xbae6fd, 2.35, 12.5);
    ctRoomLight.position.set(1.48, 3.7, 4.4);
    if (!useLowShaders) {
      scene.add(ctRoomLight);
    }

    const ctSuiteModel = new THREE.Group();
    ctSuiteModel.position.set(1.48, 0, 5.25);

    const ctGantryBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.6, 0.28, 1.08)),
      matTrim
    );
    ctGantryBase.position.set(0, 0.14, 0.42);
    ctSuiteModel.add(ctGantryBase);

    // Colossal Gantry Housing Shell + Wide Contoured Bore
    const ctGantryShoulder = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.65, 2.42, 0.76)),
      matClinicalWhite
    );
    ctGantryShoulder.position.set(0, 1.48, 0.46);
    ctGantryShoulder.castShadow = true;
    ctSuiteModel.add(ctGantryShoulder);

    const ctGantryBody = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.92, 0.42, 24, 48)),
      matClinicalWhite
    );
    ctGantryBody.position.set(0, 1.5, 0.28);
    ctSuiteModel.add(ctGantryBody);

    const ctBoreInner = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.56, 0.56, 0.92, 32, 1, true)),
      matDarkPad
    );
    ctBoreInner.rotation.x = Math.PI / 2;
    ctBoreInner.position.set(0, 1.5, 0.4);
    ctSuiteModel.add(ctBoreInner);

    const ctBoreGlow = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.64, 0.045, 14, 40)),
      matLedStrip
    );
    ctBoreGlow.position.set(0, 1.5, 0.02);
    ctSuiteModel.add(ctBoreGlow);

    const ctBedPedestal = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.68, 0.84, 1.15)),
      matClinicalWhite
    );
    ctBedPedestal.position.set(0, 0.42, -1.05);
    ctSuiteModel.add(ctBedPedestal);

    const ctCouch = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.78, 0.11, 2.75)),
      matDarkPad
    );
    ctCouch.position.set(0, 0.9, -0.75);
    ctSuiteModel.add(ctCouch);
    diagnosticSuitesGroup.add(ctSuiteModel);

    // Monumental MRI Suite Interior & Colossal 1.5T Cryogenic MRI (x ~ 5.42, z ~ 5.35)
    const mriRoomLight = new THREE.PointLight(0xa7f3d0, 2.35, 12.5);
    mriRoomLight.position.set(5.42, 3.7, 4.4);
    if (!useLowShaders) {
      scene.add(mriRoomLight);
    }

    const mriSuiteModel = new THREE.Group();
    mriSuiteModel.position.set(5.42, 0, 5.35);

    const mriBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.58, 0.28, 2.15)),
      matTrim
    );
    mriBase.position.set(0, 0.14, 0.32);
    mriSuiteModel.add(mriBase);

    const mriTunnel = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.28, 1.28, 2.05, 36, 1, true)),
      matClinicalWhite
    );
    mriTunnel.rotation.x = Math.PI / 2;
    mriTunnel.position.set(0, 1.54, 0.32);
    mriTunnel.castShadow = true;
    mriSuiteModel.add(mriTunnel);

    const mriFrontCollar = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.92, 0.38, 24, 48)),
      matClinicalWhite
    );
    mriFrontCollar.position.set(0, 1.54, -0.68);
    mriSuiteModel.add(mriFrontCollar);

    const mriBackCollar = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.92, 0.38, 24, 48)),
      matClinicalWhite
    );
    mriBackCollar.position.set(0, 1.54, 1.32);
    mriSuiteModel.add(mriBackCollar);

    const mriBoreLiner = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.58, 0.58, 2.08, 32, 1, true)),
      matDarkPad
    );
    mriBoreLiner.rotation.x = Math.PI / 2;
    mriBoreLiner.position.set(0, 1.54, 0.32);
    mriSuiteModel.add(mriBoreLiner);

    const mriVentStack = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.24, 0.28, 1.65, 18)),
      matChrome
    );
    mriVentStack.position.set(0, 3.38, 0.65);
    mriSuiteModel.add(mriVentStack);

    const mriTealRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.65, 0.048, 14, 40)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x34d399,
          emissive: 0x10b981,
          emissiveIntensity: 1.05,
          roughness: 0.2,
        })
      )
    );
    mriTealRing.position.set(0, 1.54, -0.76);
    mriSuiteModel.add(mriTealRing);

    const mriCouchPedestal = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.68, 0.84, 1.1)),
      matClinicalWhite
    );
    mriCouchPedestal.position.set(0, 0.42, -1.35);
    mriSuiteModel.add(mriCouchPedestal);

    const mriCouchTop = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.78, 0.11, 2.75)),
      matDarkPad
    );
    mriCouchTop.position.set(0, 0.9, -0.92);
    mriSuiteModel.add(mriCouchTop);
    diagnosticSuitesGroup.add(mriSuiteModel);

    scene.add(diagnosticSuitesGroup);

    // =========================================================================
    // 3. PROFESSIONAL CONTROL BOOTH WORKSTATION:
    //    CR LASER DIGITIZER + DUAL-MONITOR PACS PC + HF kVp/mAs CONSOLE
    // =========================================================================
    const deskTop = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.46, 0.075, 0.78)),
      matClinicalWhite
    );
    deskTop.position.set(-3.44, 0.86, 2.66);
    deskTop.castShadow = true;
    scene.add(deskTop);

    // Desk Support Pedestals & Chrome Legs
    [-5.05, -1.82].forEach((dx) => {
      const leg = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.14, 0.84, 0.68)),
        matTrim
      );
      leg.position.set(dx, 0.42, 2.66);
      leg.castShadow = true;
      scene.add(leg);
    });

    // A) INDUSTRIAL CR CASSETTE READER (x = -4.52, z = 2.68, angled toward operator)
    const crReaderGroup = new THREE.Group();
    crReaderGroup.position.set(-4.52, 0.9, 2.68);
    crReaderGroup.rotation.y = 0.46;

    const crPlinth = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.54, 0.04, 0.5)),
      matDarkPad
    );
    crPlinth.position.y = 0.02;
    crReaderGroup.add(crPlinth);

    const crBody = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.48, 0.56, 0.46)),
      matClinicalWhite
    );
    crBody.position.y = 0.32;
    crBody.castShadow = true;
    crBody.layers.set(1);
    crBody.userData.action = {type: 'CR_READER'} satisfies SceneTargetAction;
    crReaderGroup.add(crBody);
    interactiveMeshes.push(crBody);

    // Sculpted side armor plates + chrome corner rails + intake louver vents
    [-0.245, 0.245].forEach((sx) => {
      const sidePanel = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.025, 0.48, 0.4)),
        matTrim
      );
      sidePanel.position.set(sx, 0.31, 0);
      crReaderGroup.add(sidePanel);
    });

    const crTopHood = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.46, 0.16, 0.28)),
      matTrim
    );
    crTopHood.position.set(0, 0.58, -0.06);
    crTopHood.rotation.x = -0.32;
    crReaderGroup.add(crTopHood);

    const crFaceScreen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.4, 0.24)),
      track(
        new THREE.MeshStandardMaterial({
          map: crReaderTex,
          emissiveMap: crReaderTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.85,
        })
      )
    );
    crFaceScreen.position.set(0, 0.46, 0.225);
    crFaceScreen.rotation.x = -0.18;
    crReaderGroup.add(crFaceScreen);

    // Flared Aluminum Cassette Intake Chute & Dark Interior Pocket
    const crChuteBezel = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.42, 0.09, 0.08)),
      matChrome
    );
    crChuteBezel.position.set(0, 0.2, 0.225);
    crReaderGroup.add(crChuteBezel);

    const crSlotPocket = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.36, 0.045, 0.1)),
      matDarkPad
    );
    crSlotPocket.position.set(0, 0.2, 0.24);
    crReaderGroup.add(crSlotPocket);

    const crLedMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
    );
    const crStatusLed = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.42, 0.03, 0.03)),
      crLedMat
    );
    crStatusLed.position.set(0, 0.62, 0.17);
    crReaderGroup.add(crStatusLed);

    const crEjectBtn = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 14)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.45,
        })
      )
    );
    crEjectBtn.rotation.x = Math.PI / 2;
    crEjectBtn.position.set(0.18, 0.29, 0.235);
    crReaderGroup.add(crEjectBtn);

    const crInsertedCassette = buildCassetteMesh(
      track,
      matCassetteBody,
      matCassetteEdge,
      matLedStrip
    );
    crInsertedCassette.scale.setScalar(0.68);
    crInsertedCassette.position.set(0, 0.21, 0.34);
    crInsertedCassette.visible = false;
    crReaderGroup.add(crInsertedCassette);

    const crGlowRing = new THREE.Mesh(
      track(new THREE.RingGeometry(0.2, 0.26, 24)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        })
      )
    );
    crGlowRing.position.set(0, 0.21, 0.28);
    crReaderGroup.add(crGlowRing);
    scene.add(crReaderGroup);

    // B) DUAL-MONITOR MEDICAL PACS WORKSTATION (x = -3.32, z = 2.62)
    const clinicPcGroup = new THREE.Group();
    clinicPcGroup.position.set(-3.32, 0.9, 2.62);
    clinicPcGroup.rotation.y = 0.06;

    const pcDeskMat = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.92, 0.008, 0.36)),
      matDarkPad
    );
    pcDeskMat.position.set(0.04, 0.004, 0.18);
    clinicPcGroup.add(pcDeskMat);

    const pcStandBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.38, 0.025, 0.22)),
      matTrim
    );
    pcStandBase.position.set(0, 0.0125, -0.02);
    clinicPcGroup.add(pcStandBase);

    const pcStandSpine = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.026, 0.032, 0.38, 16)),
      matChrome
    );
    pcStandSpine.position.set(0, 0.2, -0.05);
    clinicPcGroup.add(pcStandSpine);

    // Primary 5MP Landscape Diagnostic Monitor
    const pcFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.76, 0.48, 0.042)),
      matTrim
    );
    pcFrame.position.set(-0.08, 0.38, 0);
    pcFrame.castShadow = true;
    pcFrame.layers.set(1);
    pcFrame.userData.action = {type: 'PC'} satisfies SceneTargetAction;
    clinicPcGroup.add(pcFrame);
    interactiveMeshes.push(pcFrame);

    const pcScreen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.71, 0.43)),
      track(
        new THREE.MeshStandardMaterial({
          map: pcScreenTex,
          emissiveMap: pcScreenTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.92,
        })
      )
    );
    pcScreen.position.set(-0.08, 0.38, 0.024);
    clinicPcGroup.add(pcScreen);

    // Secondary Vertical Portrait RIS Worklist Monitor (angled inward)
    const secMonitorPivot = new THREE.Group();
    secMonitorPivot.position.set(0.49, 0.39, 0.06);
    secMonitorPivot.rotation.y = -0.34;

    const secFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.34, 0.46, 0.038)),
      matTrim
    );
    secFrame.castShadow = true;
    secFrame.layers.set(1);
    secFrame.userData.action = {type: 'PC'} satisfies SceneTargetAction;
    secMonitorPivot.add(secFrame);
    interactiveMeshes.push(secFrame);

    const secScreen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.3, 0.42)),
      track(
        new THREE.MeshStandardMaterial({
          map: pcSecondaryTex,
          emissiveMap: pcSecondaryTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.85,
        })
      )
    );
    secScreen.position.set(0, 0, 0.021);
    secMonitorPivot.add(secScreen);
    clinicPcGroup.add(secMonitorPivot);

    // Brushed Slate Workstation Tower to side of monitors
    const pcTower = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 0.38, 0.36)),
      matTrim
    );
    pcTower.position.set(-0.58, 0.19, -0.02);
    pcTower.castShadow = true;
    pcTower.layers.set(1);
    pcTower.userData.action = {type: 'PC'} satisfies SceneTargetAction;
    clinicPcGroup.add(pcTower);
    interactiveMeshes.push(pcTower);

    const pcTowerGlow = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.015, 0.28, 0.02)),
      matLedStrip
    );
    pcTowerGlow.position.set(-0.52, 0.21, 0.165);
    clinicPcGroup.add(pcTowerGlow);

    // Low-Profile Backlit Keyboard + Mouse + Intercom Gooseneck Mic
    const pcKeyboard = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.42, 0.018, 0.14)),
      matTrim
    );
    pcKeyboard.position.set(-0.06, 0.014, 0.2);
    clinicPcGroup.add(pcKeyboard);

    const pcKeyBacklight = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.38, 0.006, 0.11)),
      matLedStrip
    );
    pcKeyBacklight.position.set(-0.06, 0.023, 0.2);
    clinicPcGroup.add(pcKeyBacklight);

    const pcMouse = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.028, 0.036, 6, 10)),
      matTrim
    );
    pcMouse.rotation.x = Math.PI / 2;
    pcMouse.scale.set(1, 1, 0.65);
    pcMouse.position.set(0.24, 0.018, 0.21);
    clinicPcGroup.add(pcMouse);

    scene.add(clinicPcGroup);

    // C) HOSPITAL-GRADE HF X-RAY GENERATOR CONSOLE (kVp / mAs) (x = -2.22, z = 2.65)
    const xrayConsoleGroup = new THREE.Group();
    xrayConsoleGroup.position.set(-2.22, 0.9, 2.65);
    xrayConsoleGroup.rotation.y = -0.24;

    const consoleBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.72, 0.075, 0.44)),
      matTrim
    );
    consoleBase.position.y = 0.038;
    consoleBase.castShadow = true;
    xrayConsoleGroup.add(consoleBase);

    const consoleBox = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.68, 0.16, 0.36)),
      matClinicalWhite
    );
    consoleBox.position.set(0, 0.12, -0.02);
    consoleBox.rotation.x = 0.26;
    consoleBox.castShadow = true;
    consoleBox.layers.set(1);
    consoleBox.userData.action = {type: 'CONSOLE'} satisfies SceneTargetAction;
    xrayConsoleGroup.add(consoleBox);
    interactiveMeshes.push(consoleBox);

    const consoleScreen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.58, 0.3)),
      track(
        new THREE.MeshStandardMaterial({
          map: consoleTex,
          emissiveMap: consoleTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.88,
        })
      )
    );
    consoleScreen.position.set(0, 0.205, -0.005);
    consoleScreen.rotation.x = -Math.PI / 2 + 0.26;
    xrayConsoleGroup.add(consoleScreen);

    // Two Machined Knurled Rotary Dials (kVp Encoder & mAs Encoder)
    [-0.18, 0.02].forEach((kx) => {
      const knobBase = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.032, 0.036, 0.015, 20)),
        matDarkPad
      );
      knobBase.position.set(kx, 0.082, 0.165);
      xrayConsoleGroup.add(knobBase);

      const knobDial = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.024, 0.026, 0.028, 20)),
        matChrome
      );
      knobDial.position.set(kx, 0.098, 0.165);
      xrayConsoleGroup.add(knobDial);
    });

    // Green Rotor/PREP Button + Guarded Illuminated EXPOSE Switch
    const prepBtn = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 18)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.75,
        })
      )
    );
    prepBtn.position.set(0.16, 0.09, 0.165);
    xrayConsoleGroup.add(prepBtn);

    const exposeGuardRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.036, 0.007, 10, 24)),
      matChrome
    );
    exposeGuardRing.rotation.x = Math.PI / 2;
    exposeGuardRing.position.set(0.26, 0.088, 0.165);
    xrayConsoleGroup.add(exposeGuardRing);

    const exposeSwitch = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.028, 0.028, 0.036, 18)),
      matLedStrip
    );
    exposeSwitch.position.set(0.26, 0.092, 0.165);
    xrayConsoleGroup.add(exposeSwitch);

    // Coiled Handswitch Cord & Ergonomic Trigger on Right Flank
    const handSwitchHolder = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.055, 0.11, 0.04)),
      matDarkPad
    );
    handSwitchHolder.position.set(0.39, 0.095, 0.06);
    xrayConsoleGroup.add(handSwitchHolder);

    const handTrigger = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.022, 0.08, 8, 12)),
      matClinicalWhite
    );
    handTrigger.position.set(0.41, 0.12, 0.06);
    handTrigger.rotation.z = -0.18;
    xrayConsoleGroup.add(handTrigger);

    scene.add(xrayConsoleGroup);

    // =========================================================================
    // 4. CASSETTE STORAGE RACK INSIDE EXAM ROOM (Clickable to pick up Cassette!)
    // =========================================================================
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-3.2, 0, -1.55);

    const rackCabinet = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.74, 0.84, 0.46)),
      matTrim
    );
    rackCabinet.position.y = 0.42;
    rackCabinet.castShadow = true;
    rackGroup.add(rackCabinet);

    const rackTop = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.78, 0.04, 0.5)),
      matClinicalWhite
    );
    rackTop.position.y = 0.86;
    rackGroup.add(rackTop);

    const rackCassette = buildCassetteMesh(
      track,
      matCassetteBody,
      matCassetteEdge,
      matLedStrip
    );
    rackCassette.position.set(0, 0.9, 0);
    rackGroup.add(rackCassette);

    const rackHitbox = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.78, 0.45, 0.55)),
      track(new THREE.MeshBasicMaterial({visible: false}))
    );
    rackHitbox.position.set(0, 1.0, 0);
    rackHitbox.layers.set(1);
    rackHitbox.userData.action = {
      type: 'CASSETTE_RACK',
    } satisfies SceneTargetAction;
    rackHitbox.userData.label = 'انقر لأخذ كاسيت الأشعة بيدك';
    rackGroup.add(rackHitbox);
    interactiveMeshes.push(rackHitbox);

    const rackGlowRing = new THREE.Mesh(
      track(new THREE.RingGeometry(0.25, 0.31, 28)),
      track(matHighlightGlow.clone())
    );
    rackGlowRing.rotation.x = -Math.PI / 2;
    rackGlowRing.position.set(0, 0.93, 0);
    rackGroup.add(rackGlowRing);
    scene.add(rackGroup);

    // =========================================================================
    // 5. MOTORIZED EXAMINATION TABLE + UNDER-TABLE BUCKY TRAY
    // =========================================================================
    const tableContactShadow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(3.4, 1.8)),
      track(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
        })
      )
    );
    tableContactShadow.rotation.x = -Math.PI / 2;
    tableContactShadow.position.y = 0.012;
    scene.add(tableContactShadow);

    const tableBaseGroup = new THREE.Group();
    const tableFoot = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.42, 0.1, 0.88)),
      matTrim
    );
    tableFoot.position.y = 0.05;
    tableFoot.castShadow = true;
    tableBaseGroup.add(tableFoot);

    const hydraulicPedestal = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.64, 0.68, 0.58)),
      matClinicalWhite
    );
    hydraulicPedestal.position.y = 0.42;
    hydraulicPedestal.castShadow = true;
    tableBaseGroup.add(hydraulicPedestal);

    const buckyHousing = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.55, 0.09, 0.94)),
      matTrim
    );
    buckyHousing.position.y = 0.77;
    buckyHousing.castShadow = true;
    tableBaseGroup.add(buckyHousing);

    // Full-Length Chrome Bucky Guide Rails underneath the Tabletop
    [-0.36, 0.36].forEach((rz) => {
      const buckyRail = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.016, 0.016, 2.38, 12)),
        matChrome
      );
      buckyRail.rotation.z = Math.PI / 2;
      buckyRail.position.set(0, 0.825, rz);
      tableBaseGroup.add(buckyRail);
    });
    scene.add(tableBaseGroup);

    // Sliding Under-Table Bucky Cassette Tray + Synchronized Carriage
    const tableBuckyDrawerGroup = new THREE.Group();
    tableBuckyDrawerGroup.position.set(-0.3, 0.815, 0.44);

    const drawerFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.54, 0.048, 0.52)),
      matChrome
    );
    tableBuckyDrawerGroup.add(drawerFrame);

    // Ergonomic Front Handle + Glowing Cyan Alignment Marker on Bucky Tray
    const drawerHandle = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.32, 0.032, 0.04)),
      matTrim
    );
    drawerHandle.position.set(0, 0, 0.28);
    tableBuckyDrawerGroup.add(drawerHandle);

    const drawerAlignLed = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.24, 0.016, 0.016)),
      matLedStrip
    );
    drawerAlignLed.position.set(0, 0.022, 0.285);
    tableBuckyDrawerGroup.add(drawerAlignLed);

    const tableInsertedCassette = buildCassetteMesh(
      track,
      matCassetteBody,
      matCassetteEdge,
      matLedStrip
    );
    tableInsertedCassette.position.set(0, 0.028, 0);
    tableInsertedCassette.visible = false;
    tableBuckyDrawerGroup.add(tableInsertedCassette);

    const tableBuckyGlow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.48, 0.48)),
      track(matHighlightGlow.clone())
    );
    tableBuckyGlow.rotation.x = -Math.PI / 2;
    tableBuckyGlow.position.set(0, 0.036, 0.02);
    tableBuckyDrawerGroup.add(tableBuckyGlow);

    const tableBuckyHitbox = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.8, 0.35, 0.78)),
      track(new THREE.MeshBasicMaterial({visible: false}))
    );
    tableBuckyHitbox.position.set(0, 0.04, 0.12);
    tableBuckyHitbox.layers.set(1);
    tableBuckyHitbox.userData.action = {
      type: 'TABLE_BUCKY',
    } satisfies SceneTargetAction;
    tableBuckyHitbox.userData.label = 'انقر لإدخال الكاسيت داخل درج الطاولة';
    tableBuckyDrawerGroup.add(tableBuckyHitbox);
    interactiveMeshes.push(tableBuckyHitbox);
    scene.add(tableBuckyDrawerGroup);

    const slidingTableGroup = new THREE.Group();
    // Side clinical white table rails framing the radiolucent carbon deck
    [-0.4, 0.4].forEach((tz) => {
      const sideRail = new THREE.Mesh(
        track(new THREE.BoxGeometry(2.75, 0.065, 0.08)),
        matClinicalWhite
      );
      sideRail.position.set(0, 0.885, tz);
      sideRail.castShadow = true;
      slidingTableGroup.add(sideRail);
    });

    const tabletop = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.72, 0.055, 0.72)),
      matRadiolucentDeck
    );
    tabletop.position.y = 0.885;
    tabletop.receiveShadow = true;
    slidingTableGroup.add(tabletop);

    const cushionPad = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.58, 0.028, 0.66)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x0f1a29,
          roughness: 0.55,
          metalness: 0.1,
          transparent: true,
          opacity: 0.76,
        })
      )
    );
    cushionPad.position.y = 0.928;
    cushionPad.receiveShadow = true;
    slidingTableGroup.add(cushionPad);

    const pillow = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.32, 0.075, 0.44)),
      matClinicalWhite
    );
    pillow.position.set(-1.02, 0.975, 0);
    slidingTableGroup.add(pillow);
    scene.add(slidingTableGroup);

    // =========================================================================
    // 6. UPRIGHT WALL BUCKY STAND + WALL CASSETTE SLOT
    // =========================================================================
    const wallBuckyGroup = new THREE.Group();
    wallBuckyGroup.position.set(ERECT_STAND_X, 0, ERECT_Z);

    const footPlatform = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.76, 0.04, 0.78)),
      matTrim
    );
    footPlatform.position.set(-0.46, 0.02, 0);
    wallBuckyGroup.add(footPlatform);

    const standColumn = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.16, 2.25, 0.22)),
      matClinicalWhite
    );
    standColumn.position.set(0.12, 1.15, 0);
    standColumn.castShadow = true;
    wallBuckyGroup.add(standColumn);

    const erectBuckyCarriage = new THREE.Group();
    erectBuckyCarriage.position.set(-0.08, 1.28, 0);

    const detectorHousing = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.1, 0.56, 0.54)),
      matClinicalWhite
    );
    detectorHousing.castShadow = true;
    erectBuckyCarriage.add(detectorHousing);

    const detectorFace = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.48, 0.5)),
      track(
        new THREE.MeshStandardMaterial({
          map: detectorTex,
          emissiveMap: detectorTex,
          emissive: new THREE.Color(0x38bdf8),
          emissiveIntensity: 0.35,
        })
      )
    );
    detectorFace.rotation.y = -Math.PI / 2;
    detectorFace.position.x = -0.053;
    erectBuckyCarriage.add(detectorFace);

    // Cassette inserted upright into Wall Bucky
    const wallInsertedCassette = buildCassetteMesh(
      track,
      matCassetteBody,
      matCassetteEdge,
      matLedStrip
    );
    wallInsertedCassette.rotation.z = Math.PI / 2;
    wallInsertedCassette.position.set(-0.025, 0, 0);
    wallInsertedCassette.visible = false;
    erectBuckyCarriage.add(wallInsertedCassette);

    const wallBuckyGlow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.48, 0.5)),
      track(matHighlightGlow.clone())
    );
    wallBuckyGlow.rotation.y = -Math.PI / 2;
    wallBuckyGlow.position.set(-0.062, 0, 0);
    erectBuckyCarriage.add(wallBuckyGlow);

    const wallBuckyHitbox = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.35, 0.65, 0.65)),
      track(new THREE.MeshBasicMaterial({visible: false}))
    );
    wallBuckyHitbox.position.set(-0.08, 0, 0);
    wallBuckyHitbox.layers.set(1);
    wallBuckyHitbox.userData.action = {
      type: 'WALL_BUCKY',
    } satisfies SceneTargetAction;
    wallBuckyHitbox.userData.label =
      'انقر لوضع الكاسيت داخل الحامل الواقف (البكي)';
    erectBuckyCarriage.add(wallBuckyHitbox);
    interactiveMeshes.push(wallBuckyHitbox);

    [-0.31, 0.31].forEach((hz) => {
      const grip = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 12)),
        matChrome
      );
      grip.position.set(-0.07, 0.05, hz);
      erectBuckyCarriage.add(grip);
    });

    wallBuckyGroup.add(erectBuckyCarriage);
    scene.add(wallBuckyGroup);

    // =========================================================================
    // 7. DETAILED ARTICULATED 3D PATIENT RIG (GENDER / AGE / WARDROBE)
    // =========================================================================
    const matPatientSkin = track(
      new THREE.MeshStandardMaterial({
        color: 0xdba88a,
        roughness: 0.52,
        metalness: 0.02,
      })
    );
    const matPatientTop = track(
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.66,
        metalness: 0.05,
      })
    );
    const matPatientAccent = track(
      new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        roughness: 0.54,
        metalness: 0.06,
      })
    );
    const matPatientBottom = track(
      new THREE.MeshStandardMaterial({
        color: 0x2b3b52,
        roughness: 0.72,
        metalness: 0.04,
      })
    );
    const matPatientHair = track(
      new THREE.MeshStandardMaterial({
        color: 0x1e2530,
        roughness: 0.46,
        metalness: 0.08,
      })
    );
    const matPatientHijab = track(
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.66,
        metalness: 0.03,
      })
    );
    const matPatientHijabTrim = track(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.68,
        metalness: 0.04,
      })
    );
    const matPatientEyeWhite = track(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.22,
        metalness: 0.02,
      })
    );
    const matPatientIris = track(
      new THREE.MeshStandardMaterial({
        color: 0x271911,
        roughness: 0.16,
        metalness: 0.05,
      })
    );
    const matPatientLips = track(
      new THREE.MeshStandardMaterial({
        color: 0xb56862,
        roughness: 0.48,
        metalness: 0.02,
      })
    );
    const matPatientBelt = track(
      new THREE.MeshStandardMaterial({
        color: 0x182232,
        roughness: 0.42,
        metalness: 0.18,
      })
    );
    const matPatientShoeUpper = track(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.42,
        metalness: 0.12,
      })
    );
    const matPatientShoeAccent = track(
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.45,
        metalness: 0.1,
      })
    );
    const matPatientPupil = track(
      new THREE.MeshStandardMaterial({
        color: 0x090d16,
        roughness: 0.12,
        metalness: 0.1,
      })
    );

    const patientWorldAnchor = new THREE.Group();
    const patientLocalBody = new THREE.Group();
    patientWorldAnchor.add(patientLocalBody);
    scene.add(patientWorldAnchor);

    // Pelvis & Lower Hip Base
    const pPelvis = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.142, 0.145, 14, 22)),
      matPatientBottom
    );
    pPelvis.rotation.z = Math.PI / 2;
    pPelvis.scale.set(1, 1.04, 0.78);
    pPelvis.position.set(0, -0.04, 0);
    pPelvis.castShadow = true;
    patientLocalBody.add(pPelvis);

    // Waistband Belt / Sash + Chrome Buckle
    const pBelt = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.153, 0.156, 0.04, 22)),
      matPatientBelt
    );
    pBelt.scale.set(1.06, 1, 0.76);
    pBelt.position.set(0, 0.048, 0.002);
    patientLocalBody.add(pBelt);

    const pBeltBuckle = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 0.034, 0.022)),
      matChrome
    );
    pBeltBuckle.position.set(0, 0.048, 0.121);
    patientLocalBody.add(pBeltBuckle);

    // Flared tunic / blouse hem for female patients
    const pTunicSkirt = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.158, 0.222, 0.3, 24)),
      matPatientTop
    );
    pTunicSkirt.scale.set(1.12, 1, 0.82);
    pTunicSkirt.position.set(0, -0.06, 0);
    pTunicSkirt.castShadow = true;
    pTunicSkirt.visible = false;
    patientLocalBody.add(pTunicSkirt);

    // Articulated Spine / Upper Torso Pivot (supports realistic breathing pitch, walking lean & speech posture)
    const pSpinePivot = new THREE.Group();
    pSpinePivot.position.set(0, 0.05, 0);
    patientLocalBody.add(pSpinePivot);

    const pAbdomen = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.138, 0.17, 14, 22)),
      matPatientTop
    );
    pAbdomen.scale.set(1.1, 1, 0.78);
    pAbdomen.position.set(0, 0.07, 0);
    pAbdomen.castShadow = true;
    pSpinePivot.add(pAbdomen);

    // Sculpted Ribcage + Shoulder Clavicle Bridge
    const pChestGroup = new THREE.Group();
    pChestGroup.position.set(0, 0.29, 0.01);
    pSpinePivot.add(pChestGroup);

    const pChest = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.165, 0.21, 16, 24)),
      matPatientTop
    );
    pChest.scale.set(1.18, 1, 0.78);
    pChest.castShadow = true;
    pChestGroup.add(pChest);

    const pClavicleBridge = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.066, 0.34, 10, 16)),
      matPatientTop
    );
    pClavicleBridge.rotation.z = Math.PI / 2;
    pClavicleBridge.scale.set(0.85, 1, 0.72);
    pClavicleBridge.position.set(0, 0.115, -0.005);
    pClavicleBridge.castShadow = true;
    pChestGroup.add(pClavicleBridge);

    // Tailored V-Neck Collar + Placket + Buttons + Chest Pocket + Pen Clip
    [-1, 1].forEach((side) => {
      const collar = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.015, 0.125, 6, 10)),
        matPatientAccent
      );
      collar.position.set(side * 0.056, 0.13, 0.112);
      collar.rotation.set(0.34, 0, side * -0.45);
      pChestGroup.add(collar);
    });

    const pPlacket = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.028, 0.23, 0.014)),
      matPatientAccent
    );
    pPlacket.position.set(0, -0.01, 0.13);
    pChestGroup.add(pPlacket);

    [0.06, -0.01, -0.08].forEach((by) => {
      const btn = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 10)),
        matClinicalWhite
      );
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, by, 0.138);
      pChestGroup.add(btn);
    });

    const chestPocket = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.072, 0.08, 0.016)),
      matPatientAccent
    );
    chestPocket.position.set(0.095, 0.02, 0.132);
    pChestGroup.add(chestPocket);

    const pocketPen = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.004, 0.004, 0.055, 8)),
      matChrome
    );
    pocketPen.position.set(0.11, 0.048, 0.14);
    pChestGroup.add(pocketPen);

    // Sculpted Head & Expressive Facial Features (Blinking Eyelids, Pupils, Cheekbones, Talking Lips)
    const pHeadGroup = new THREE.Group();
    pHeadGroup.position.set(0, 0.51, 0);
    const pNeck = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.052, 0.066, 0.14, 18)),
      matPatientSkin
    );
    pNeck.position.set(0, 0.05, 0);
    pHeadGroup.add(pNeck);

    const pHead = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.126, 28, 24)),
      matPatientSkin
    );
    pHead.scale.set(0.92, 1.07, 0.98);
    pHead.position.set(0, 0.222, 0.01);
    pHead.castShadow = true;
    pHeadGroup.add(pHead);

    // Sculpted Jaw / Chin + Subtle Cheekbones
    const pJaw = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.095, 20, 16)),
      matPatientSkin
    );
    pJaw.scale.set(0.85, 0.76, 0.9);
    pJaw.position.set(0, 0.146, 0.024);
    pHeadGroup.add(pJaw);

    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.036, 12, 10)),
        matPatientSkin
      );
      cheek.scale.set(1.1, 0.78, 0.82);
      cheek.position.set(side * 0.062, 0.198, 0.094);
      pHeadGroup.add(cheek);

      const ear = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.025, 12, 10)),
        matPatientSkin
      );
      ear.scale.set(0.45, 1.15, 0.75);
      ear.position.set(side * 0.116, 0.215, 0.005);
      pHeadGroup.add(ear);
    });

    // Natural Nose Bridge + Tip
    const pNoseBridge = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.011, 0.03, 6, 10)),
      matPatientSkin
    );
    pNoseBridge.rotation.x = -0.28;
    pNoseBridge.position.set(0, 0.215, 0.128);
    pHeadGroup.add(pNoseBridge);

    const pNoseTip = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.013, 10, 8)),
      matPatientSkin
    );
    pNoseTip.position.set(0, 0.196, 0.138);
    pHeadGroup.add(pNoseTip);

    // Layered Eyes (Sclera + Iris + Pupil + Blinking Upper Eyelids) & Expressive Eyebrows
    const browMeshes: THREE.Mesh[] = [];
    const eyelidMeshes: THREE.Mesh[] = [];
    [-1, 1].forEach((side) => {
      const sclera = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.017, 12, 10)),
        matPatientEyeWhite
      );
      sclera.scale.set(1.22, 0.78, 0.6);
      sclera.position.set(side * 0.043, 0.242, 0.114);
      pHeadGroup.add(sclera);

      const iris = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.0098, 10, 8)),
        matPatientIris
      );
      iris.position.set(side * 0.043, 0.242, 0.123);
      pHeadGroup.add(iris);

      const pupil = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.0052, 8, 8)),
        matPatientPupil
      );
      pupil.position.set(side * 0.043, 0.242, 0.129);
      pHeadGroup.add(pupil);

      const eyelid = new THREE.Mesh(
        track(
          new THREE.SphereGeometry(
            0.0185,
            12,
            10,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.52
          )
        ),
        matPatientSkin
      );
      eyelid.scale.set(1.24, 0.88, 0.72);
      eyelid.position.set(side * 0.043, 0.244, 0.115);
      eyelid.rotation.x = -1.15;
      pHeadGroup.add(eyelid);
      eyelidMeshes.push(eyelid);

      const brow = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.0055, 0.028, 6, 8)),
        matPatientHair
      );
      brow.rotation.z = Math.PI / 2 - side * 0.12;
      brow.position.set(side * 0.044, 0.266, 0.116);
      pHeadGroup.add(brow);
      browMeshes.push(brow);
    });

    // Natural Articulated Lips (upper & lower contour that animate gently during speech)
    const pLips = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0085, 0.032, 6, 10)),
      matPatientLips
    );
    pLips.rotation.z = Math.PI / 2;
    pLips.scale.set(1, 1, 0.65);
    pLips.position.set(0, 0.163, 0.116);
    pHeadGroup.add(pLips);

    // Base Scalp Hair + Male Sculpted Top Crown + Sideburns
    const pHair = new THREE.Mesh(
      track(
        new THREE.SphereGeometry(0.132, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58)
      ),
      matPatientHair
    );
    pHair.rotation.x = -0.35;
    pHair.position.set(0, 0.232, -0.005);
    pHeadGroup.add(pHair);

    const pHairCrown = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.068, 0.09, 10, 14)),
      matPatientHair
    );
    pHairCrown.scale.set(1.28, 0.62, 1.05);
    pHairCrown.rotation.x = 0.35;
    pHairCrown.position.set(0, 0.325, 0.032);
    pHeadGroup.add(pHairCrown);

    const pSideburns: THREE.Mesh[] = [];
    [-1, 1].forEach((side) => {
      const sb = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.018, 0.065, 0.032)),
        matPatientHair
      );
      sb.position.set(side * 0.11, 0.21, 0.035);
      pHeadGroup.add(sb);
      pSideburns.push(sb);
    });

    // Male Groomed Beard + Chin Taper + Mustache
    const pBeard = new THREE.Mesh(
      track(
        new THREE.SphereGeometry(
          0.114,
          18,
          14,
          -Math.PI * 0.45,
          Math.PI * 0.9,
          Math.PI * 0.54,
          Math.PI * 0.44
        )
      ),
      matPatientHair
    );
    pBeard.scale.set(0.91, 1.06, 0.99);
    pBeard.position.set(0, 0.205, 0.016);
    pBeard.rotation.y = Math.PI / 2;
    pBeard.visible = false;
    pHeadGroup.add(pBeard);

    const pMustache = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.01, 0.044, 6, 8)),
      matPatientHair
    );
    pMustache.rotation.z = Math.PI / 2;
    pMustache.position.set(0, 0.178, 0.12);
    pMustache.visible = false;
    pHeadGroup.add(pMustache);

    // Female Layered Long Hair
    const pBangL = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.035, 0.095, 8, 12)),
      matPatientHair
    );
    pBangL.position.set(-0.065, 0.285, 0.072);
    pBangL.rotation.set(0.28, 0, 0.62);
    pBangL.visible = false;
    pHeadGroup.add(pBangL);

    const pBangR = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.035, 0.095, 8, 12)),
      matPatientHair
    );
    pBangR.position.set(0.065, 0.285, 0.072);
    pBangR.rotation.set(0.28, 0, -0.62);
    pBangR.visible = false;
    pHeadGroup.add(pBangR);

    const pHairBand = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.126, 0.011, 8, 24)),
      matPatientAccent
    );
    pHairBand.rotation.x = Math.PI / 2 - 0.36;
    pHairBand.position.set(0, 0.255, 0.012);
    pHairBand.visible = false;
    pHeadGroup.add(pHairBand);

    const pLongHairBack = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.12, 0.25, 12, 18)),
      matPatientHair
    );
    pLongHairBack.scale.set(1.1, 1, 0.56);
    pLongHairBack.position.set(0, 0.095, -0.072);
    pLongHairBack.visible = false;
    pHeadGroup.add(pLongHairBack);

    const pHairSideL = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.038, 0.2, 10, 12)),
      matPatientHair
    );
    pHairSideL.position.set(-0.102, 0.12, -0.01);
    pHairSideL.visible = false;
    pHeadGroup.add(pHairSideL);

    const pHairSideR = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.038, 0.2, 10, 12)),
      matPatientHair
    );
    pHairSideR.position.set(0.102, 0.12, -0.01);
    pHairSideR.visible = false;
    pHeadGroup.add(pHairSideR);

    // Female Layered Draped Hijab
    const pHijabUnderscarf = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.118, 0.016, 10, 24)),
      matPatientHijabTrim
    );
    pHijabUnderscarf.rotation.x = 0.18;
    pHijabUnderscarf.position.set(0, 0.235, 0.025);
    pHijabUnderscarf.visible = false;
    pHeadGroup.add(pHijabUnderscarf);

    const pHijabCap = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.14, 24, 20)),
      matPatientHijab
    );
    pHijabCap.scale.set(0.96, 1.1, 1.03);
    pHijabCap.position.set(0, 0.224, -0.016);
    pHijabCap.visible = false;
    pHeadGroup.add(pHijabCap);

    const pHijabDrape = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.098, 0.175, 0.25, 22)),
      matPatientHijab
    );
    pHijabDrape.scale.set(1.06, 1, 0.88);
    pHijabDrape.position.set(0, 0.035, -0.005);
    pHijabDrape.visible = false;
    pHeadGroup.add(pHijabDrape);

    const pHijabFold = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.11, 0.022, 10, 20)),
      matPatientHijab
    );
    pHijabFold.rotation.x = Math.PI / 2 + 0.18;
    pHijabFold.position.set(0, 0.09, 0.025);
    pHijabFold.visible = false;
    pHeadGroup.add(pHijabFold);

    pSpinePivot.add(pHeadGroup);

    // 2-Bone Articulated Arms (Shoulder Pivot -> UpperArm -> Elbow Pivot -> Forearm -> Wrist -> Multi-Finger Hand)
    const shoulderPivots: THREE.Group[] = [];
    const elbowPivots: THREE.Group[] = [];
    const wristPivots: THREE.Group[] = [];
    [1, -1].forEach((side) => {
      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(side * 0.245, 0.39, 0);

      const shoulderCap = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.064, 16, 14)),
        matPatientTop
      );
      shoulderPivot.add(shoulderCap);

      const upperArm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.047, 0.2, 12, 16)),
        matPatientTop
      );
      upperArm.position.set(0, -0.14, 0);
      upperArm.castShadow = true;
      shoulderPivot.add(upperArm);

      const sleeveCuff = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.051, 0.053, 0.032, 16)),
        matPatientAccent
      );
      sleeveCuff.position.set(0, -0.235, 0);
      shoulderPivot.add(sleeveCuff);

      // Elbow Joint Pivot
      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -0.275, 0);
      shoulderPivot.add(elbowPivot);

      const elbowCap = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.042, 12, 10)),
        matPatientSkin
      );
      elbowPivot.add(elbowCap);

      const forearm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.037, 0.19, 12, 16)),
        matPatientSkin
      );
      forearm.position.set(0, -0.125, 0);
      forearm.castShadow = true;
      elbowPivot.add(forearm);

      if (side === -1) {
        const watchStrap = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.04, 0.04, 0.022, 14)),
          matPatientBelt
        );
        watchStrap.position.set(0, -0.215, 0);
        elbowPivot.add(watchStrap);
      } else {
        // Hospital Patient Identification Wristband
        const idBand = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.039, 0.039, 0.018, 14)),
          matClinicalWhite
        );
        idBand.position.set(0, -0.215, 0);
        elbowPivot.add(idBand);
      }

      // Wrist + Sculpted Multi-Finger Hand
      const wristPivot = new THREE.Group();
      wristPivot.position.set(0, -0.25, 0);
      elbowPivot.add(wristPivot);

      const palm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.025, 0.042, 8, 12)),
        matPatientSkin
      );
      palm.scale.set(0.7, 1, 1.18);
      palm.position.set(0, -0.042, 0);
      wristPivot.add(palm);

      const thumb = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.0085, 0.026, 6, 8)),
        matPatientSkin
      );
      thumb.position.set(-side * 0.014, -0.038, 0.028);
      thumb.rotation.x = 0.5;
      wristPivot.add(thumb);

      [-0.018, -0.006, 0.006, 0.018].forEach((fz, fi) => {
        const len = fi === 1 || fi === 2 ? 0.034 : 0.028;
        const finger = new THREE.Mesh(
          track(new THREE.CapsuleGeometry(0.0068, len, 6, 8)),
          matPatientSkin
        );
        finger.position.set(-side * 0.004, -0.078, fz);
        finger.rotation.z = side * 0.14;
        wristPivot.add(finger);
      });

      pSpinePivot.add(shoulderPivot);
      shoulderPivots.push(shoulderPivot);
      elbowPivots.push(elbowPivot);
      wristPivots.push(wristPivot);
    });

    // 3-Bone Articulated Legs (Hip -> Thigh -> Knee -> Shin -> Ankle -> Detailed Two-Tone Sneaker)
    const thighPivots: THREE.Group[] = [];
    const kneePivots: THREE.Group[] = [];
    const anklePivots: THREE.Group[] = [];
    [1, -1].forEach((side) => {
      const hipPivot = new THREE.Group();
      hipPivot.position.set(side * 0.108, -0.11, 0);

      const thigh = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.068, 0.32, 12, 18)),
        matPatientBottom
      );
      thigh.position.set(0, -0.21, 0);
      thigh.castShadow = true;
      hipPivot.add(thigh);

      const kneeJoint = new THREE.Group();
      kneeJoint.position.set(0, -0.43, 0);

      const kneeCap = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.063, 14, 12)),
        matPatientBottom
      );
      kneeJoint.add(kneeCap);

      const shin = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.053, 0.33, 12, 18)),
        matPatientBottom
      );
      shin.position.set(0, -0.21, 0);
      shin.castShadow = true;
      kneeJoint.add(shin);

      const ankleHem = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.057, 0.059, 0.03, 16)),
        matPatientBottom
      );
      ankleHem.position.set(0, -0.37, 0);
      kneeJoint.add(ankleHem);

      // Ankle Pivot + Detailed Sneaker
      const anklePivot = new THREE.Group();
      anklePivot.position.set(0, -0.415, 0);
      kneeJoint.add(anklePivot);

      const sockCollar = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.044, 0.046, 0.036, 14)),
        matClinicalWhite
      );
      sockCollar.position.set(0, 0.005, 0);
      anklePivot.add(sockCollar);

      const shoeSole = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.094, 0.026, 0.195)),
        matClinicalWhite
      );
      shoeSole.position.set(0, -0.036, 0.056);
      anklePivot.add(shoeSole);

      const shoeUpper = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.043, 0.1, 10, 14)),
        matPatientShoeUpper
      );
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.scale.set(1, 1, 0.72);
      shoeUpper.position.set(0, -0.01, 0.054);
      anklePivot.add(shoeUpper);

      const shoeHeelTrim = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.092, 0.034, 0.035)),
        matPatientShoeAccent
      );
      shoeHeelTrim.position.set(0, -0.012, -0.025);
      anklePivot.add(shoeHeelTrim);

      const shoeLaces = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.045, 0.008, 0.055)),
        matClinicalWhite
      );
      shoeLaces.position.set(0, 0.018, 0.068);
      shoeLaces.rotation.x = 0.24;
      anklePivot.add(shoeLaces);

      hipPivot.add(kneeJoint);
      patientLocalBody.add(hipPivot);
      thighPivots.push(hipPivot);
      kneePivots.push(kneeJoint);
      anklePivots.push(anklePivot);
    });

    const leadApronMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.36, 0.32, 0.045)),
      matLeadApron
    );
    leadApronMesh.position.set(0, -0.02, 0.145);
    leadApronMesh.visible = false;
    patientLocalBody.add(leadApronMesh);

    const MALE_TOP_COLORS = [0x1e3a8a, 0x2563eb, 0x334155, 0x3f6212, 0x0f766e];
    const MALE_ACCENT_COLORS = [0x60a5fa, 0x93c5fd, 0x94a3b8, 0x84cc16, 0x5eead4];
    const MALE_BOTTOM_COLORS = [0x1e293b, 0x273549, 0x312e81, 0x1f2937];
    const FEMALE_TOP_COLORS = [0x9d174d, 0x7e22ce, 0x0f766e, 0x0284c7, 0x047857];
    const FEMALE_ACCENT_COLORS = [0xf9a8d4, 0xd8b4fe, 0x5eead4, 0x7dd3fc, 0x6ee7b7];
    const FEMALE_HIJAB_COLORS = [0xf8fafc, 0xfbcfe8, 0xcbd5e1, 0xddd6fe, 0xa7f3d0];
    const SKIN_TONES = [0xe8bea0, 0xdba88a, 0xc8906e, 0xf0d2bc, 0xb87e5b];
    const LIP_TONES = [0xc2726d, 0xb56862, 0x9e5953, 0xcc7b75, 0x93524c];

    const applyPatientAppearance = () => {
      const info = patientAppearanceRef.current;
      const seed = hashPatientSeed(info.id);
      const isFemale = info.gender === 'F';

      const skinIdx = seed % SKIN_TONES.length;
      matPatientSkin.color.setHex(SKIN_TONES[skinIdx]);
      matPatientLips.color.setHex(LIP_TONES[skinIdx]);
      if (info.age >= 52) {
        matPatientHair.color.setHex(seed % 2 === 0 ? 0x94a3b8 : 0x64748b);
      } else {
        matPatientHair.color.setHex(seed % 3 === 0 ? 0x2c1d15 : 0x171b24);
      }

      if (isFemale) {
        pChest.scale.set(0.95, 0.96, 0.78);
        pClavicleBridge.scale.set(0.75, 0.88, 0.68);
        pAbdomen.scale.set(0.83, 1, 0.7);
        pPelvis.scale.set(1.16, 1.08, 0.84);
        pNeck.scale.set(0.82, 1, 0.82);
        pHead.scale.set(0.88, 1.04, 0.94);
        pTunicSkirt.visible = true;
        browMeshes.forEach((b) => {
          b.scale.set(0.85, 0.9, 0.85);
        });
        shoulderPivots.forEach((arm, idx) => {
          arm.position.x = (idx === 0 ? 1 : -1) * 0.21;
          arm.scale.set(0.87, 0.97, 0.87);
        });
        thighPivots.forEach((hip, idx) => {
          hip.position.x = (idx === 0 ? 1 : -1) * 0.114;
          hip.scale.set(0.95, 0.97, 0.95);
        });

        const topIdx = (seed >> 3) % FEMALE_TOP_COLORS.length;
        matPatientTop.color.setHex(FEMALE_TOP_COLORS[topIdx]);
        matPatientAccent.color.setHex(FEMALE_ACCENT_COLORS[topIdx]);
        matPatientBottom.color.setHex(0x1e293b);
        matPatientShoeUpper.color.setHex(0x475569);
        matPatientShoeAccent.color.setHex(FEMALE_ACCENT_COLORS[topIdx]);
        matPatientBelt.color.setHex(0x0f172a);
        const hijabIdx = (seed >> 5) % FEMALE_HIJAB_COLORS.length;
        matPatientHijab.color.setHex(FEMALE_HIJAB_COLORS[hijabIdx]);
        matPatientHijabTrim.color.setHex(FEMALE_TOP_COLORS[topIdx]);

        const wearsHijab = (seed >> 2) % 3 !== 0;
        pHijabCap.visible = wearsHijab;
        pHijabUnderscarf.visible = wearsHijab;
        pHijabDrape.visible = wearsHijab;
        pHijabFold.visible = wearsHijab;

        pHair.visible = !wearsHijab;
        pHairCrown.visible = false;
        pBangL.visible = !wearsHijab;
        pBangR.visible = !wearsHijab;
        pHairBand.visible = !wearsHijab;
        pLongHairBack.visible = !wearsHijab;
        pHairSideL.visible = !wearsHijab;
        pHairSideR.visible = !wearsHijab;
        pSideburns.forEach((sb) => {
          sb.visible = false;
        });
        pBeard.visible = false;
        pMustache.visible = false;
      } else {
        pChest.scale.set(1.24, 1.02, 0.82);
        pClavicleBridge.scale.set(0.88, 1.02, 0.74);
        pAbdomen.scale.set(1.12, 1.0, 0.8);
        pPelvis.scale.set(0.96, 1.02, 0.76);
        pNeck.scale.set(1.04, 1, 1.04);
        pHead.scale.set(0.94, 1.08, 0.99);
        pTunicSkirt.visible = false;
        browMeshes.forEach((b) => {
          b.scale.set(1.2, 1.05, 1.1);
        });
        shoulderPivots.forEach((arm, idx) => {
          arm.position.x = (idx === 0 ? 1 : -1) * 0.262;
          arm.scale.set(1.04, 1.02, 1.04);
        });
        thighPivots.forEach((hip, idx) => {
          hip.position.x = (idx === 0 ? 1 : -1) * 0.105;
          hip.scale.set(1.02, 1.02, 1.02);
        });

        const topIdx = (seed >> 3) % MALE_TOP_COLORS.length;
        matPatientTop.color.setHex(MALE_TOP_COLORS[topIdx]);
        matPatientAccent.color.setHex(MALE_ACCENT_COLORS[topIdx]);
        matPatientBottom.color.setHex(
          MALE_BOTTOM_COLORS[(seed >> 6) % MALE_BOTTOM_COLORS.length]
        );
        matPatientShoeUpper.color.setHex(0x1e293b);
        matPatientShoeAccent.color.setHex(MALE_ACCENT_COLORS[topIdx]);
        matPatientBelt.color.setHex(0x1e293b);

        pHijabCap.visible = false;
        pHijabUnderscarf.visible = false;
        pHijabDrape.visible = false;
        pHijabFold.visible = false;
        pBangL.visible = false;
        pBangR.visible = false;
        pHairBand.visible = false;
        pLongHairBack.visible = false;
        pHairSideL.visible = false;
        pHairSideR.visible = false;

        pHair.visible = true;
        pHairCrown.visible = info.age < 56;
        pSideburns.forEach((sb) => {
          sb.visible = true;
        });
        const hasBeard = info.age >= 22 && (seed >> 2) % 4 !== 0;
        pBeard.visible = hasBeard;
        pMustache.visible = hasBeard || (info.age >= 35 && seed % 2 === 0);
      }
    };

    applyPatientAppearanceRef.current = applyPatientAppearance;
    applyPatientAppearance();

    // Clickable Patient Anatomical Regions
    const hotspotRings: {region: BodyRegion; mesh: THREE.Mesh}[] = [];
    ANATOMY_SPOTS.forEach((spot) => {
      const hitMesh = new THREE.Mesh(
        track(new THREE.SphereGeometry(spot.radius, 14, 12)),
        track(new THREE.MeshBasicMaterial({visible: false}))
      );
      hitMesh.position.set(spot.lateralX, spot.spineY, 0.02);
      hitMesh.layers.set(1);
      hitMesh.userData.action = {
        type: 'REGION',
        region: spot.id,
      } satisfies SceneTargetAction;
      patientLocalBody.add(hitMesh);
      interactiveMeshes.push(hitMesh);

      const ring = new THREE.Mesh(
        track(
          new THREE.RingGeometry(spot.radius * 0.68, spot.radius * 0.9, 28)
        ),
        track(matHighlightGlow.clone())
      );
      ring.position.set(spot.lateralX, spot.spineY, 0.17);
      patientLocalBody.add(ring);
      hotspotRings.push({region: spot.id, mesh: ring});
    });

    // =========================================================================
    // 8. OVERHEAD CEILING X-RAY TUBE CRANE + OPTIONAL UPGRADES
    // =========================================================================
    const railGroup = new THREE.Group();
    [-0.7, 0.7].forEach((rz) => {
      const rail = new THREE.Mesh(
        track(new THREE.BoxGeometry(5.4, 0.08, 0.08)),
        matChrome
      );
      rail.position.set(0.4, 4.02, rz);
      railGroup.add(rail);
    });
    scene.add(railGroup);

    const gantryCarriage = new THREE.Group();
    const bridgeBar = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.3, 0.1, 1.54)),
      matTrim
    );
    bridgeBar.position.set(0, 3.97, 0);
    gantryCarriage.add(bridgeBar);

    const tubeAssembly = new THREE.Group();
    const teleColumn = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.075, 0.088, 2.85, 18)),
      matChrome
    );
    teleColumn.position.set(0, 1.48, 0);
    tubeAssembly.add(teleColumn);

    const tubePivot = new THREE.Group();
    const tubeCylinder = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.145, 0.145, 0.48, 24)),
      matClinicalWhite
    );
    tubeCylinder.rotation.z = Math.PI / 2;
    tubeCylinder.castShadow = true;
    tubePivot.add(tubeCylinder);

    [-0.25, 0.25].forEach((ex) => {
      const cap = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.14, 0.14, 0.045, 24)),
        matChrome
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.set(ex, 0, 0);
      tubePivot.add(cap);
    });

    const collimatorBox = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.22, 0.17, 0.22)),
      matTrim
    );
    collimatorBox.position.set(0, -0.19, 0);
    tubePivot.add(collimatorBox);

    const beamMat = track(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const beamCone = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.34, 0.92, 24, 1, true)),
      beamMat
    );
    beamCone.position.set(0, -0.72, 0);
    tubePivot.add(beamCone);

    tubeAssembly.add(tubePivot);
    tubeAssembly.position.set(0, 1.92, 0);
    gantryCarriage.add(tubeAssembly);
    scene.add(gantryCarriage);

    // Optional CT/MRI & Auto-Processor
    const ctMriGantryGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.88, 0.22, 20, 48)),
      matClinicalWhite
    );
    outerRing.rotation.y = Math.PI / 2;
    outerRing.position.set(-0.35, 1.25, 0);
    ctMriGantryGroup.add(outerRing);
    ctMriGantryGroup.visible = false;
    scene.add(ctMriGantryGroup);

    const processorGroup = new THREE.Group();
    const sideDesk = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.85, 0.78, 0.55)),
      matTrim
    );
    sideDesk.position.set(3.9, 0.39, -4.35);
    processorGroup.add(sideDesk);
    const procUnit = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.54, 0.32, 0.42)),
      matClinicalWhite
    );
    procUnit.position.set(3.9, 0.94, -4.35);
    processorGroup.add(procUnit);
    processorGroup.visible = false;
    scene.add(processorGroup);

    // =========================================================================
    // 8B. VISIBLE WAITING ROOM PATIENTS (STANDING BY DOOR + SEATED ON BENCHES)
    // =========================================================================
    interface WaitingRig {
      root: THREE.Group;
      spinePivot: THREE.Group;
      chest: THREE.Mesh;
      pelvis: THREE.Mesh;
      headGroup: THREE.Group;
      eyelids: THREE.Mesh[];
      shoulderPivots: THREE.Group[];
      elbowPivots: THREE.Group[];
      legPivots: THREE.Group[];
      phoneMesh: THREE.Mesh;
      hairScalp: THREE.Mesh;
      beard: THREE.Mesh;
      hijab: THREE.Mesh;
      hijabDrape: THREE.Mesh;
      longHair: THREE.Mesh;
      tunic: THREE.Mesh;
      matSkin: THREE.MeshStandardMaterial;
      matTop: THREE.MeshStandardMaterial;
      matAccent: THREE.MeshStandardMaterial;
      matBot: THREE.MeshStandardMaterial;
      matHair: THREE.MeshStandardMaterial;
      matHijab: THREE.MeshStandardMaterial;
      baseX: number;
      baseY: number;
      baseZ: number;
      seated: boolean;
      hasPhone: boolean;
    }

    // Shared Geometry Pool for Waiting Room Patients (saves ~115 GPU buffers on weak devices)
    const waitGeo = {
      pelvis: track(new THREE.CapsuleGeometry(0.14, 0.13, 8, 12)),
      tunic: track(new THREE.CylinderGeometry(0.155, 0.21, 0.26, 14)),
      chest: track(new THREE.CapsuleGeometry(0.16, 0.26, 10, 14)),
      wCollar: track(new THREE.CapsuleGeometry(0.013, 0.1, 4, 6)),
      neck: track(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12)),
      head: track(new THREE.SphereGeometry(0.122, 16, 14)),
      nose: track(new THREE.CapsuleGeometry(0.01, 0.025, 4, 6)),
      lips: track(new THREE.CapsuleGeometry(0.0075, 0.028, 4, 6)),
      ear: track(new THREE.SphereGeometry(0.022, 8, 6)),
      sclera: track(new THREE.SphereGeometry(0.0155, 8, 6)),
      iris: track(new THREE.SphereGeometry(0.009, 6, 6)),
      eyelid: track(
        new THREE.SphereGeometry(
          0.0165,
          8,
          6,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.52
        )
      ),
      brow: track(new THREE.CapsuleGeometry(0.005, 0.025, 4, 6)),
      hairScalp: track(
        new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58)
      ),
      beard: track(
        new THREE.SphereGeometry(
          0.106,
          12,
          8,
          -Math.PI * 0.45,
          Math.PI * 0.9,
          Math.PI * 0.55,
          Math.PI * 0.42
        )
      ),
      hijab: track(new THREE.SphereGeometry(0.135, 14, 12)),
      hijabDrape: track(new THREE.CylinderGeometry(0.095, 0.16, 0.22, 14)),
      longHair: track(new THREE.CapsuleGeometry(0.11, 0.22, 6, 10)),
      uArm: track(new THREE.CapsuleGeometry(0.044, 0.19, 6, 10)),
      fArm: track(new THREE.CapsuleGeometry(0.036, 0.18, 6, 10)),
      hand: track(new THREE.CapsuleGeometry(0.024, 0.038, 4, 8)),
      phone: track(new THREE.BoxGeometry(0.068, 0.01, 0.12)),
      seatedThigh: track(new THREE.CapsuleGeometry(0.062, 0.29, 6, 10)),
      seatedShin: track(new THREE.CapsuleGeometry(0.052, 0.34, 6, 10)),
      seatedSole: track(new THREE.BoxGeometry(0.09, 0.024, 0.18)),
      seatedShoe: track(new THREE.CapsuleGeometry(0.04, 0.09, 6, 10)),
      standThigh: track(new THREE.CapsuleGeometry(0.064, 0.33, 6, 10)),
      standShin: track(new THREE.CapsuleGeometry(0.052, 0.34, 6, 10)),
      standSole: track(new THREE.BoxGeometry(0.09, 0.025, 0.185)),
      standShoe: track(new THREE.CapsuleGeometry(0.042, 0.095, 6, 10)),
    };

    const buildWaitingPatientRig = (
      x: number,
      z: number,
      seated: boolean,
      hasPhone: boolean
    ): WaitingRig => {
      const root = new THREE.Group();
      const baseY = seated ? 0.51 : 0.96;
      root.position.set(x, baseY, z);

      const matSkin = track(
        new THREE.MeshStandardMaterial({color: 0xdba88a, roughness: 0.52})
      );
      const matTop = track(
        new THREE.MeshStandardMaterial({color: 0x2563eb, roughness: 0.66})
      );
      const matAccent = track(
        new THREE.MeshStandardMaterial({color: 0x93c5fd, roughness: 0.55})
      );
      const matBot = track(
        new THREE.MeshStandardMaterial({color: 0x1e293b, roughness: 0.72})
      );
      const matHair = track(
        new THREE.MeshStandardMaterial({color: 0x171b24, roughness: 0.52})
      );
      const matHijab = track(
        new THREE.MeshStandardMaterial({color: 0xf8fafc, roughness: 0.65})
      );

      const pelvis = new THREE.Mesh(waitGeo.pelvis, matBot);
      pelvis.rotation.z = Math.PI / 2;
      pelvis.scale.set(1, 1.04, 0.78);
      pelvis.position.set(0, -0.02, 0);
      root.add(pelvis);

      const tunic = new THREE.Mesh(waitGeo.tunic, matTop);
      tunic.position.set(0, -0.04, 0);
      tunic.visible = false;
      root.add(tunic);

      const spinePivot = new THREE.Group();
      spinePivot.position.set(0, 0.04, 0);
      root.add(spinePivot);

      const chest = new THREE.Mesh(waitGeo.chest, matTop);
      chest.scale.set(1.14, 1, 0.78);
      chest.position.set(0, 0.19, 0);
      chest.castShadow = activeTier === 'ultra' || activeTier === 'high';
      spinePivot.add(chest);

      [-1, 1].forEach((side) => {
        const wCollar = new THREE.Mesh(waitGeo.wCollar, matAccent);
        wCollar.position.set(side * 0.05, 0.33, 0.105);
        wCollar.rotation.set(0.32, 0, side * -0.45);
        spinePivot.add(wCollar);
      });

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.44, 0);

      const neck = new THREE.Mesh(waitGeo.neck, matSkin);
      neck.position.y = 0.04;
      headGroup.add(neck);

      const head = new THREE.Mesh(waitGeo.head, matSkin);
      head.scale.set(0.92, 1.06, 0.96);
      head.position.set(0, 0.195, 0.01);
      headGroup.add(head);

      const nose = new THREE.Mesh(waitGeo.nose, matSkin);
      nose.rotation.x = -0.26;
      nose.position.set(0, 0.188, 0.124);
      headGroup.add(nose);

      const lips = new THREE.Mesh(waitGeo.lips, matPatientLips);
      lips.rotation.z = Math.PI / 2;
      lips.position.set(0, 0.142, 0.112);
      headGroup.add(lips);

      const eyelids: THREE.Mesh[] = [];
      [-1, 1].forEach((side) => {
        const ear = new THREE.Mesh(waitGeo.ear, matSkin);
        ear.scale.set(0.45, 1.12, 0.72);
        ear.position.set(side * 0.112, 0.192, 0.005);
        headGroup.add(ear);

        const sclera = new THREE.Mesh(waitGeo.sclera, matPatientEyeWhite);
        sclera.scale.set(1.2, 0.78, 0.6);
        sclera.position.set(side * 0.041, 0.214, 0.11);
        headGroup.add(sclera);

        const iris = new THREE.Mesh(waitGeo.iris, matPatientIris);
        iris.position.set(side * 0.041, 0.214, 0.118);
        headGroup.add(iris);

        const eyelid = new THREE.Mesh(waitGeo.eyelid, matSkin);
        eyelid.scale.set(1.22, 0.88, 0.7);
        eyelid.position.set(side * 0.041, 0.216, 0.111);
        eyelid.rotation.x = -1.15;
        headGroup.add(eyelid);
        eyelids.push(eyelid);

        const brow = new THREE.Mesh(waitGeo.brow, matHair);
        brow.rotation.z = Math.PI / 2 - side * 0.12;
        brow.position.set(side * 0.042, 0.236, 0.112);
        headGroup.add(brow);
      });

      const hairScalp = new THREE.Mesh(waitGeo.hairScalp, matHair);
      hairScalp.rotation.x = -0.3;
      hairScalp.position.set(0, 0.21, -0.004);
      headGroup.add(hairScalp);

      const beard = new THREE.Mesh(waitGeo.beard, matHair);
      beard.rotation.y = Math.PI / 2;
      beard.position.set(0, 0.176, 0.016);
      beard.visible = false;
      headGroup.add(beard);

      const hijab = new THREE.Mesh(waitGeo.hijab, matHijab);
      hijab.scale.set(0.96, 1.08, 1.02);
      hijab.position.set(0, 0.2, -0.015);
      hijab.visible = false;
      headGroup.add(hijab);

      const hijabDrape = new THREE.Mesh(waitGeo.hijabDrape, matHijab);
      hijabDrape.position.set(0, 0.025, -0.004);
      hijabDrape.visible = false;
      headGroup.add(hijabDrape);

      const longHair = new THREE.Mesh(waitGeo.longHair, matHair);
      longHair.position.set(0, 0.08, -0.07);
      longHair.visible = false;
      headGroup.add(longHair);

      spinePivot.add(headGroup);

      // 2-Segment Articulated Arms + Optional Smartphone
      const shoulderPivots: THREE.Group[] = [];
      const elbowPivots: THREE.Group[] = [];
      let phoneMesh!: THREE.Mesh;

      [1, -1].forEach((side) => {
        const sPivot = new THREE.Group();
        sPivot.position.set(side * 0.225, 0.34, 0);

        const uArm = new THREE.Mesh(waitGeo.uArm, matTop);
        uArm.position.set(0, -0.13, 0);
        sPivot.add(uArm);

        const ePivot = new THREE.Group();
        ePivot.position.set(0, -0.25, 0);
        sPivot.add(ePivot);

        const fArm = new THREE.Mesh(waitGeo.fArm, matSkin);
        fArm.position.set(0, -0.115, 0);
        ePivot.add(fArm);

        const hand = new THREE.Mesh(waitGeo.hand, matSkin);
        hand.position.set(0, -0.24, 0);
        ePivot.add(hand);

        if (side === 1) {
          phoneMesh = new THREE.Mesh(
            waitGeo.phone,
            track(
              new THREE.MeshStandardMaterial({
                color: 0x0f172a,
                emissive: 0x38bdf8,
                emissiveIntensity: 0.75,
                roughness: 0.2,
              })
            )
          );
          phoneMesh.position.set(-0.01, -0.245, 0.042);
          phoneMesh.visible = hasPhone;
          ePivot.add(phoneMesh);
        }

        spinePivot.add(sPivot);
        shoulderPivots.push(sPivot);
        elbowPivots.push(ePivot);
      });

      // Articulated Legs + Two-Tone Sneakers resting on floor
      const legPivots: THREE.Group[] = [];
      [1, -1].forEach((side) => {
        const lPivot = new THREE.Group();
        lPivot.position.set(side * 0.1, -0.06, 0);

        if (seated) {
          const thigh = new THREE.Mesh(waitGeo.seatedThigh, matBot);
          thigh.rotation.x = Math.PI / 2;
          thigh.position.set(0, -0.02, 0.17);
          lPivot.add(thigh);

          const shin = new THREE.Mesh(waitGeo.seatedShin, matBot);
          shin.position.set(0, -0.23, 0.33);
          lPivot.add(shin);

          const sole = new THREE.Mesh(waitGeo.seatedSole, matClinicalWhite);
          sole.position.set(0, -0.438, 0.385);
          lPivot.add(sole);

          const shoe = new THREE.Mesh(waitGeo.seatedShoe, matPatientShoeUpper);
          shoe.rotation.x = Math.PI / 2;
          shoe.scale.set(1, 1, 0.72);
          shoe.position.set(0, -0.415, 0.385);
          lPivot.add(shoe);
        } else {
          const thigh = new THREE.Mesh(waitGeo.standThigh, matBot);
          thigh.position.set(0, -0.21, 0);
          lPivot.add(thigh);

          const shin = new THREE.Mesh(waitGeo.standShin, matBot);
          shin.position.set(0, -0.61, 0);
          lPivot.add(shin);

          const sole = new THREE.Mesh(waitGeo.standSole, matClinicalWhite);
          sole.position.set(0, -0.885, 0.055);
          lPivot.add(sole);

          const shoe = new THREE.Mesh(waitGeo.standShoe, matPatientShoeUpper);
          shoe.rotation.x = Math.PI / 2;
          shoe.scale.set(1, 1, 0.72);
          shoe.position.set(0, -0.86, 0.055);
          lPivot.add(shoe);
        }

        root.add(lPivot);
        legPivots.push(lPivot);
      });

      waitingRoomGroup.add(root);
      return {
        root,
        spinePivot,
        chest,
        pelvis,
        headGroup,
        eyelids,
        shoulderPivots,
        elbowPivots,
        legPivots,
        phoneMesh,
        hairScalp,
        beard,
        hijab,
        hijabDrape,
        longHair,
        tunic,
        matSkin,
        matTop,
        matAccent,
        matBot,
        matHair,
        matHijab,
        baseX: x,
        baseY,
        baseZ: z,
        seated,
        hasPhone,
      };
    };

    const waitingPatientRigs: WaitingRig[] = [
      buildWaitingPatientRig(-2.08, -5.7, false, true), // Next up: standing by glass Waiting Door with phone
      buildWaitingPatientRig(-3.35, -7.15, true, false), // Seated #2
      buildWaitingPatientRig(-2.1, -7.15, true, true), // Seated #3 reading phone
      buildWaitingPatientRig(-0.85, -7.15, true, false), // Seated #4
    ];

    const applyWaitingPatients = () => {
      const list = waitingPatientsRef.current;
      waitingPatientRigs.forEach((rig, idx) => {
        const info = list[idx];
        rig.root.visible = Boolean(info);
        if (!info) return;

        const seed = hashPatientSeed(info.id);
        const isFemale = info.gender === 'F';
        rig.matSkin.color.setHex(SKIN_TONES[seed % SKIN_TONES.length]);
        rig.matHair.color.setHex(
          info.age >= 52
            ? 0x94a3b8
            : seed % 3 === 0
              ? 0x2c1d15
              : 0x171b24
        );

        if (isFemale) {
          const topIdx = (seed >> 3) % FEMALE_TOP_COLORS.length;
          rig.chest.scale.set(0.95, 0.96, 0.76);
          rig.tunic.visible = true;
          rig.matTop.color.setHex(FEMALE_TOP_COLORS[topIdx]);
          rig.matAccent.color.setHex(FEMALE_ACCENT_COLORS[topIdx]);
          rig.matBot.color.setHex(0x1e293b);
          rig.matHijab.color.setHex(
            FEMALE_HIJAB_COLORS[(seed >> 5) % FEMALE_HIJAB_COLORS.length]
          );
          const wearsHijab = (seed >> 2) % 3 !== 0;
          rig.hijab.visible = wearsHijab;
          rig.hijabDrape.visible = wearsHijab;
          rig.hairScalp.visible = !wearsHijab;
          rig.longHair.visible = !wearsHijab;
          rig.beard.visible = false;
        } else {
          const topIdx = (seed >> 3) % MALE_TOP_COLORS.length;
          rig.chest.scale.set(1.2, 1.0, 0.82);
          rig.tunic.visible = false;
          rig.matTop.color.setHex(MALE_TOP_COLORS[topIdx]);
          rig.matAccent.color.setHex(MALE_ACCENT_COLORS[topIdx]);
          rig.matBot.color.setHex(
            MALE_BOTTOM_COLORS[(seed >> 6) % MALE_BOTTOM_COLORS.length]
          );
          rig.hijab.visible = false;
          rig.hijabDrape.visible = false;
          rig.longHair.visible = false;
          rig.hairScalp.visible = true;
          rig.beard.visible = info.age >= 24 && (seed >> 2) % 3 !== 0;
        }
      });
    };

    applyWaitingPatientsRef.current = applyWaitingPatients;
    applyWaitingPatients();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Ultra-HD HDR Post-Processing Pipeline (4x MSAA + Subtle Clinical Bloom + OutputPass)
    let composer: EffectComposer | null = null;
    let composerTarget: THREE.WebGLRenderTarget | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    let useComposer =
      !isSoftwareGl &&
      hw.hasWebGL2 &&
      (activeTier === 'ultra' || activeTier === 'high');

    if (!isSoftwareGl && hw.hasWebGL2) {
      try {
        const msaaSamples = Math.min(4, renderer.capabilities.maxSamples || 0);
        composerTarget = new THREE.WebGLRenderTarget(initWidth, initHeight, {
          type: THREE.HalfFloatType,
          samples: msaaSamples,
        });
        composer = new EffectComposer(renderer, composerTarget);
        composer.setPixelRatio(getPixelRatioForTier(activeTier));
        composer.setSize(initWidth, initHeight);
        composer.addPass(new RenderPass(scene, camera));
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(initWidth, initHeight),
          0.22,
          0.38,
          0.94
        );
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());
      } catch {
        useComposer = false;
        composer = null;
      }
    }

    // =========================================================================
    // 9. DIRECT FIRST-PERSON HEAD-LOOK + KEYBOARD WASD + RAYCASTING
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let activeDragPointerId: number | null = null;
    let pointerDownPos = {x: 0, y: 0};
    let lastDragPos = {x: 0, y: 0};
    let dragMaxDist = 0;
    let lastHoverTime = 0;
    const pressedKeys = new Set<string>();

    const getIntersects = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_pointerNdc, camera);
      return raycaster.intersectObjects(interactiveMeshes, false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (activeDragPointerId !== null) return;
      activeDragPointerId = e.pointerId;
      pointerDownPos = {x: e.clientX, y: e.clientY};
      lastDragPos = {x: e.clientX, y: e.clientY};
      dragMaxDist = 0;
      renderer.domElement.style.cursor = 'grabbing';
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture is unsupported
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activeDragPointerId !== e.pointerId) return;
      activeDragPointerId = null;
      renderer.domElement.style.cursor = 'grab';
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }

      if (dragMaxDist > 7) return;

      const hits = getIntersects(e.clientX, e.clientY);
      if (hits.length > 0) {
        const action = hits[0].object.userData.action as
          | SceneTargetAction
          | undefined;
        if (action) {
          handReachImpulseRef.current = 1.0;
          if (action.type === 'WAITING_DOOR') {
            waitingDoorOpenRef.current = !waitingDoorOpenRef.current;
          }
          onSceneInteractRef.current(action);
        }
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (activeDragPointerId === e.pointerId) {
        activeDragPointerId = null;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const getLocalizedActionLabel = (
      action: SceneTargetAction | undefined
    ): string | null => {
      if (!action) return null;
      const isAr = languageRef.current === 'ar';
      switch (action.type) {
        case 'REGION':
          return isAr
            ? `انقر لتوجيه أنبوب الأشعة نحو: ${REGION_LABELS_I18N.ar[action.region]}`
            : `Aim X-Ray tube at: ${REGION_LABELS_I18N.en[action.region]}`;
        case 'CASSETTE_RACK':
          return isAr
            ? 'انقر لأخذ كاسيت الأشعة بيدك'
            : 'Click to pick up X-Ray cassette';
        case 'TABLE_BUCKY':
          if (crExposedPendingRef.current) {
            return isAr
              ? 'انقر لسحب الكاسيت المصوّر ونقله لقارئ CR'
              : 'Click to retrieve exposed cassette for CR Reader';
          }
          return isAr
            ? 'انقر لإدخال الكاسيت داخل درج الطاولة'
            : 'Click to insert cassette into Table Bucky';
        case 'WALL_BUCKY':
          if (crExposedPendingRef.current) {
            return isAr
              ? 'انقر لسحب الكاسيت المصوّر ونقله لقارئ CR'
              : 'Click to retrieve exposed cassette for CR Reader';
          }
          return isAr
            ? 'انقر لوضع الكاسيت داخل الحامل الواقف (البكي)'
            : 'Click to insert cassette into Wall Bucky';
        case 'CR_READER':
          return isAr
            ? 'جهاز قارئ الكاسيت (CR) — انقر لإدخال الكاسيت وقراءته للحاسوب'
            : 'CR Cassette Reader — Click to insert & digitize cassette';
        case 'DOOR':
          return isAr
            ? 'انقر لفتح/إغلاق الباب الرصاصي'
            : 'Click to open/close Lead Door';
        case 'WAITING_DOOR':
          return isAr
            ? 'باب صالة الانتظار — انقر لفتح/إغلاق باب المرضى المنتظرين'
            : 'Waiting Room Door — Click to open/close';
        case 'CT_DOOR': {
          const unlocked = ownedUpgradesRef.current.includes('ct_scanner');
          if (unlocked) {
            return isAr
              ? 'غرفة السيتي (المفراس CT) — انقر لفتح/إغلاق الباب'
              : 'CT Scanner Suite — Click to open/close door';
          }
          return isAr
            ? 'غرفة السيتي (المفراس CT) مغلقة 🔒 — غير متوفر حالياً (قريباً)'
            : 'CT Scanner Suite Locked 🔒 — Unavailable (Coming Soon)';
        }
        case 'MRI_DOOR': {
          const unlocked = ownedUpgradesRef.current.includes('mri_suite');
          if (unlocked) {
            return isAr
              ? 'غرفة الرنين المغناطيسي (MRI) — انقر لفتح/إغلاق الباب'
              : 'MRI Suite — Click to open/close door';
          }
          return isAr
            ? 'غرفة الرنين المغناطيسي (MRI) مغلقة 🔒 — غير متوفر حالياً (قريباً)'
            : 'MRI Suite Locked 🔒 — Unavailable (Coming Soon)';
        }
        case 'CONSOLE':
          return isAr
            ? 'لوحة التحكم — اضبط kVp و mAs وأطلق الأشعة'
            : 'Exposure Console — Set kVp, mAs & Expose';
        case 'PC':
          return isAr
            ? 'حاسوب العيادة — انقر لفتح الصورة والأرشيف والمتجر'
            : 'Clinic PC — View Radiograph, Log & Shop';
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activeDragPointerId === e.pointerId) {
        const dx = e.clientX - lastDragPos.x;
        const dy = e.clientY - lastDragPos.y;
        lastDragPos = {x: e.clientX, y: e.clientY};
        dragMaxDist = Math.max(
          dragMaxDist,
          Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y)
        );
        if (dragMaxDist > 4) {
          cameraMoveActiveRef.current = false;
          const lookSens = e.pointerType === 'touch' ? 0.0056 : 0.0038;
          targetYaw -= dx * lookSens;
          targetPitch = THREE.MathUtils.clamp(
            targetPitch - dy * lookSens * 0.85,
            -1.08,
            0.82
          );
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;

      const hits = getIntersects(e.clientX, e.clientY);
      if (hits.length > 0) {
        const action = hits[0].object.userData.action as
          | SceneTargetAction
          | undefined;
        const label = getLocalizedActionLabel(action);
        if (label) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredLabel(label);
          return;
        }
      }
      renderer.domElement.style.cursor = 'grab';
      setHoveredLabel(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      pressedKeys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.code);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const applyTierLive = (t: PerfTier) => {
      activeTier = t;
      const dpr = getPixelRatioForTier(t);
      renderer.setPixelRatio(dpr);
      const enableShadows = !isSoftwareGl && t !== 'low';
      renderer.shadowMap.enabled = enableShadows;
      keyLight.castShadow = enableShadows;
      if (enableShadows) {
        const res = t === 'ultra' ? 2048 : t === 'high' ? 1536 : 1024;
        if (
          keyLight.shadow.mapSize.width !== res ||
          keyLight.shadow.mapSize.height !== res
        ) {
          keyLight.shadow.mapSize.width = res;
          keyLight.shadow.mapSize.height = res;
          keyLight.shadow.map?.dispose();
          keyLight.shadow.map = null;
        }
        renderer.shadowMap.type =
          t === 'balanced' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      }
      renderer.shadowMap.needsUpdate = true;
      scene.environmentIntensity = t === 'ultra' ? 1.32 : 1.0;
      const enableUltraExtras =
        !isSoftwareGl && (t === 'ultra' || t === 'high');
      rectLights.forEach((rl) => {
        rl.visible = enableUltraExtras;
      });
      useComposer = Boolean(composer) && hw.hasWebGL2 && enableUltraExtras;
      if (composer) {
        composer.setPixelRatio(dpr);
        const w = container.clientWidth || initWidth;
        const h = container.clientHeight || initHeight;
        composer.setSize(w, h);
      }
    };

    applyLiveTierRef.current = (pref: GraphicsQuality) => {
      applyTierLive(resolveTier(pref));
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = getPixelRatioForTier(activeTier);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h);
      if (composer) {
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // =========================================================================
    // 10. ANIMATION LOOP (First-Person Hands, Door, Cassette, Patient & Crane)
    // =========================================================================
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let loopRunning = false;
    let erectBlend = isErectPosture(selectedPostureRef.current) ? 1 : 0;
    let frameCounter = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!hw.hasWebGL2 || typeof gl?.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const scheduleNextFrame = () => {
      if (disposed || pausedRef.current || document.hidden) {
        loopRunning = false;
        return;
      }
      loopRunning = true;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    const resumeLoop = () => {
      if (disposed || pausedRef.current || document.hidden || loopRunning) {
        return;
      }
      clock.getDelta();
      loopRunning = true;
      frameId = requestAnimationFrame(tick);
    };

    resumeLoopRef.current = resumeLoop;

    const onVisibilityChange = () => {
      if (!document.hidden && !pausedRef.current) {
        resumeLoop();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    function tick() {
      if (disposed) return;
      if (pausedRef.current || document.hidden) {
        loopRunning = false;
        return;
      }
      const rawDelta = clock.getDelta();
      const delta = Math.min(rawDelta, 0.05);
      const elapsed = clock.getElapsedTime();
      frameCounter += 1;

      const posture = selectedPostureRef.current;
      const isErect = isErectPosture(posture);
      const isBoreScan =
        modalityRef.current === 'CT' || modalityRef.current === 'MRI';

      // 1. Velocity-Damped First-Person Walking (Virtual Joystick + WASD/Arrows)
      const kbFwd =
        (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp') ? 1 : 0) -
        (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown') ? 1 : 0);
      const kbStrafe =
        (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight') ? 1 : 0) -
        (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft') ? 1 : 0);

      const moveForward = THREE.MathUtils.clamp(
        joystickRef.current.y + kbFwd,
        -1,
        1
      );
      const moveStrafe = THREE.MathUtils.clamp(
        joystickRef.current.x + kbStrafe,
        -1,
        1
      );
      const inputMag = Math.min(1, Math.hypot(moveStrafe, moveForward));

      let desiredVx = 0;
      let desiredVz = 0;
      if (inputMag > 0.04) {
        cameraMoveActiveRef.current = false;
        _fwd.set(-Math.sin(curYaw), 0, -Math.cos(curYaw));
        _right.set(Math.cos(curYaw), 0, -Math.sin(curYaw));
        const maxSpeed = 2.75;
        desiredVx = (_fwd.x * moveForward + _right.x * moveStrafe) * maxSpeed;
        desiredVz = (_fwd.z * moveForward + _right.z * moveStrafe) * maxSpeed;
      }

      velX = THREE.MathUtils.damp(velX, desiredVx, 14.0, delta);
      velZ = THREE.MathUtils.damp(velZ, desiredVz, 14.0, delta);

      const stepX = velX * delta;
      const stepZ = velZ * delta;
      const curSpeed = Math.hypot(velX, velZ);
      const speedNorm = Math.min(1, curSpeed / 2.65);

      const hasCT = ownedUpgradesRef.current.includes('ct_scanner');
      const hasMRI = ownedUpgradesRef.current.includes('mri_suite');
      const canEnterCt = hasCT && ctDoorOpenRef.current;
      const canEnterMri = hasMRI && mriDoorOpenRef.current;

      if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
        const curX = camera.position.x;
        const curZ = camera.position.z;
        let nextX = curX;
        let nextZ = curZ;

        if (
          canStandAt(
            curX + stepX,
            curZ,
            doorClosedRef.current,
            canEnterCt,
            canEnterMri,
            waitingDoorOpenRef.current
          )
        ) {
          nextX = curX + stepX;
        } else {
          velX = 0;
        }
        if (
          canStandAt(
            nextX,
            curZ + stepZ,
            doorClosedRef.current,
            canEnterCt,
            canEnterMri,
            waitingDoorOpenRef.current
          )
        ) {
          nextZ = curZ + stepZ;
        } else {
          velZ = 0;
        }

        if (nextX !== curX || nextZ !== curZ) {
          camera.position.x = nextX;
          camera.position.z = nextZ;

          // Update React zone state seamlessly as radiographer crosses the doorway
          if (
            nextZ >= 2.22 &&
            nextX <= -0.55 &&
            techLocationRef.current !== 'BOOTH'
          ) {
            suppressAutoCamRef.current = true;
            techLocationRef.current = 'BOOTH';
            onTechZoneChangeRef.current?.('BOOTH');
          } else if (nextZ <= 1.88 && techLocationRef.current !== 'ROOM') {
            suppressAutoCamRef.current = true;
            techLocationRef.current = 'ROOM';
            onTechZoneChangeRef.current?.('ROOM');
          }
        }
      }

      if (cameraMoveActiveRef.current && inputMag <= 0.04) {
        if (techLocationRef.current === 'BOOTH') {
          _camGoalPos.set(-3.05, 1.56, 3.55);
          _camGoalTarget.set(-2.55, 1.15, 1.6);
        } else if (isErect && !isBoreScan) {
          _camGoalPos.set(0.15, 1.56, 1.55);
          _camGoalTarget.set(2.0, 1.15, -0.35);
        } else {
          _camGoalPos.set(-0.45, 1.58, 1.68);
          _camGoalTarget.set(0.05, 1.0, -0.1);
        }

        const goalLook = computeLookAngles(_camGoalPos, _camGoalTarget);
        const posAlpha = 1 - Math.exp(-5.5 * delta);
        camera.position.lerp(_camGoalPos, posAlpha);
        targetYaw = dampAngle(targetYaw, goalLook.yaw, 6.0, delta);
        targetPitch = THREE.MathUtils.damp(
          targetPitch,
          goalLook.pitch,
          6.0,
          delta
        );

        if (
          camera.position.distanceTo(_camGoalPos) < 0.025 &&
          Math.abs(targetYaw - goalLook.yaw) < 0.02
        ) {
          cameraMoveActiveRef.current = false;
        }
      }

      curYaw = dampAngle(curYaw, targetYaw, 16, delta);
      curPitch = THREE.MathUtils.damp(curPitch, targetPitch, 16, delta);
      camera.rotation.set(curPitch, curYaw, 0);

      // Smooth eye-level cadence during walking
      if (speedNorm > 0.04) {
        walkPhase += delta * (4.0 + speedNorm * 6.5);
        const eyeBob = Math.sin(walkPhase * 2) * 0.011 * speedNorm;
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          1.56 + eyeBob,
          12,
          delta
        );
      } else if (!cameraMoveActiveRef.current) {
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          1.56,
          10,
          delta
        );
      }

      // 2. First-Person 3D Technician Hands, Held Cassette & CR Reader Animation
      if (handReachImpulseRef.current > 0) {
        handReachImpulseRef.current = Math.max(
          0,
          handReachImpulseRef.current - delta * 2.8
        );
      }
      const reachForward = Math.sin(handReachImpulseRef.current * Math.PI) * 0.14;
      const cState = cassetteStateRef.current;
      const holdingCassette =
        cState === 'IN_HAND' || cState === 'EXPOSED_IN_HAND';
      handheldCassette.visible = holdingCassette;

      // Tint cassette LED strip amber when exposed (ready for CR Reader)
      matLedStrip.emissive.setHex(
        cState === 'EXPOSED_IN_HAND' ||
          cState === 'IN_CR_READER' ||
          crExposedPendingRef.current
          ? 0xf59e0b
          : 0x06b6d4
      );

      // Update CR Reader slot & status glow
      crInsertedCassette.visible = cState === 'IN_CR_READER';
      if (cState === 'IN_CR_READER' || isDevelopingRef.current) {
        crInsertedCassette.position.z =
          0.22 + Math.sin(elapsed * 8) * 0.02;
        crLedMat.color.setHex(0x22d3ee);
        crLedMat.emissive.setHex(0x22d3ee);
        crLedMat.emissiveIntensity = 1.6 + Math.sin(elapsed * 12) * 0.5;
        (crGlowRing.material as THREE.MeshBasicMaterial).opacity = 0;
      } else if (cState === 'EXPOSED_IN_HAND' && !hasDRRef.current) {
        crLedMat.color.setHex(0xf59e0b);
        crLedMat.emissive.setHex(0xf59e0b);
        crLedMat.emissiveIntensity = 1.4 + Math.sin(elapsed * 6) * 0.4;
        (crGlowRing.material as THREE.MeshBasicMaterial).opacity =
          0.5 + Math.sin(elapsed * 5) * 0.25;
      } else {
        crLedMat.color.setHex(hasDRRef.current ? 0x475569 : 0x38bdf8);
        crLedMat.emissive.setHex(hasDRRef.current ? 0x1e293b : 0x0ea5e9);
        crLedMat.emissiveIntensity = hasDRRef.current ? 0.15 : 0.7;
        (crGlowRing.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      const walkSwayX =
        speedNorm > 0.05 ? Math.sin(walkPhase) * 0.014 * speedNorm : 0;
      const walkBobY =
        speedNorm > 0.05 ? Math.abs(Math.cos(walkPhase)) * 0.015 * speedNorm : 0;
      const idleBobY = Math.sin(elapsed * 2.2) * 0.005;
      handsGroup.position.set(
        walkSwayX,
        -0.25 + idleBobY + walkBobY + (holdingCassette ? 0.03 : 0),
        -0.42 - reachForward
      );

      // Hands move slightly inward to cradle cassette when holding it
      const handSpreadX = holdingCassette ? 0.145 : 0.22;
      leftTechHand.position.x = THREE.MathUtils.damp(
        leftTechHand.position.x,
        -handSpreadX,
        10,
        delta
      );
      rightTechHand.position.x = THREE.MathUtils.damp(
        rightTechHand.position.x,
        handSpreadX,
        10,
        delta
      );

      // 3. Lead Door + Waiting Room Glass Door + CT Suite Door + MRI Suite Door Animations
      const doorGoalY = doorClosedRef.current ? 0 : -1.25;
      leadDoorPivot.rotation.y = THREE.MathUtils.damp(
        leadDoorPivot.rotation.y,
        doorGoalY,
        7.0,
        delta
      );

      waitingDoorPivot.rotation.y = THREE.MathUtils.damp(
        waitingDoorPivot.rotation.y,
        waitingDoorOpenRef.current ? -1.25 : 0,
        7.0,
        delta
      );

      // Lifelike idle breathing, blinking, phone glances & weight-shifting in Waiting Room
      // On low-spec devices, update waiting-room rig animations every 2nd frame to save CPU
      if (activeTier !== 'low' || frameCounter % 2 === 0) {
        const rigDelta = activeTier === 'low' ? Math.min(delta * 2, 0.08) : delta;
        waitingPatientRigs.forEach((rig, idx) => {
          if (!rig.root.visible) return;
          const phase = elapsed * 1.35 + idx * 1.7;
          const blinkCycle = (elapsed + idx * 1.15) % 4.1;
          const isBlinking = blinkCycle > 3.92;
          rig.eyelids.forEach((lid) => {
            lid.rotation.x = THREE.MathUtils.damp(
              lid.rotation.x,
              isBlinking ? 0.62 : -1.15,
              28,
              rigDelta
            );
          });

          rig.spinePivot.rotation.x = rig.hasPhone
            ? 0.06 + Math.sin(phase) * 0.012
            : Math.sin(phase) * 0.014;
          rig.chest.scale.z = 0.78 + Math.sin(phase * 1.1) * 0.022;

          if (rig.hasPhone) {
            const checkPhone = Math.sin(phase * 0.45) > -0.35;
            rig.headGroup.rotation.x = THREE.MathUtils.damp(
              rig.headGroup.rotation.x,
              checkPhone ? 0.28 : -0.04,
              5,
              rigDelta
            );
            rig.headGroup.rotation.y = THREE.MathUtils.damp(
              rig.headGroup.rotation.y,
              checkPhone ? 0.14 : Math.sin(phase * 0.5) * 0.22,
              4,
              rigDelta
            );
            rig.shoulderPivots[0].rotation.set(-0.62, 0.15, -0.08);
            rig.elbowPivots[0].rotation.set(-1.35, 0, -0.18);
            rig.shoulderPivots[1].rotation.set(
              rig.seated ? -0.32 : 0.05,
              0,
              rig.seated ? 0.14 : -0.08
            );
            rig.elbowPivots[1].rotation.set(rig.seated ? -0.82 : -0.22, 0, 0);
          } else {
            rig.headGroup.rotation.x = Math.sin(phase * 0.42) * 0.05;
            rig.headGroup.rotation.y = Math.sin(phase * 0.52) * 0.24;
            rig.shoulderPivots[0].rotation.set(-0.35, 0, 0.1);
            rig.elbowPivots[0].rotation.set(-0.92, 0, -0.2);
            rig.shoulderPivots[1].rotation.set(-0.35, 0, -0.1);
            rig.elbowPivots[1].rotation.set(-0.92, 0, 0.2);
          }

          if (!rig.seated) {
            const sway = Math.sin(phase * 0.6) * 0.028;
            rig.root.position.x = rig.baseX + sway;
            rig.root.position.y = rig.baseY + Math.abs(Math.sin(phase * 0.6)) * 0.008;
            rig.legPivots[0].rotation.z = -sway * 1.1;
            rig.legPivots[1].rotation.z = -sway * 1.1;
          }
        });
      }

      ctDoorRig.lockedBadge.visible = !hasCT;
      ctDoorRig.unlockedBadge.visible = hasCT;
      ctDoorRig.ledMat.color.setHex(hasCT ? 0x10b981 : 0xef4444);
      ctDoorRig.ledMat.emissive.setHex(hasCT ? 0x10b981 : 0xef4444);
      ctDoorRig.doorPivot.rotation.y = THREE.MathUtils.damp(
        ctDoorRig.doorPivot.rotation.y,
        canEnterCt ? -1.25 : 0,
        7.0,
        delta
      );

      mriDoorRig.lockedBadge.visible = !hasMRI;
      mriDoorRig.unlockedBadge.visible = hasMRI;
      mriDoorRig.ledMat.color.setHex(hasMRI ? 0x10b981 : 0xef4444);
      mriDoorRig.ledMat.emissive.setHex(hasMRI ? 0x10b981 : 0xef4444);
      mriDoorRig.doorPivot.rotation.y = THREE.MathUtils.damp(
        mriDoorRig.doorPivot.rotation.y,
        canEnterMri ? -1.25 : 0,
        7.0,
        delta
      );

      // 4. Cassette Locations & Synchronized Under-Table Bucky Movement
      const targetSpot =
        ANATOMY_SPOTS.find((s) => s.id === selectedRegionRef.current) ||
        ANATOMY_SPOTS[2];
      rackCassette.visible = cState === 'RACK';
      tableInsertedCassette.visible = cState === 'TABLE_BUCKY';
      wallInsertedCassette.visible = cState === 'WALL_BUCKY';

      // Slide Table Bucky Carriage along X & Z in lockstep with the active exam region
      const drawerGoalX = THREE.MathUtils.clamp(
        targetSpot.tableWorldX,
        -0.92,
        0.92
      );
      const drawerGoalZ =
        cState === 'IN_HAND' && !isErect
          ? 0.64
          : cState === 'TABLE_BUCKY'
            ? THREE.MathUtils.clamp(targetSpot.tableWorldZ * 0.45, -0.22, 0.28)
            : 0.44;
      tableBuckyDrawerGroup.position.x = THREE.MathUtils.damp(
        tableBuckyDrawerGroup.position.x,
        drawerGoalX,
        7.5,
        delta
      );
      tableBuckyDrawerGroup.position.z = THREE.MathUtils.damp(
        tableBuckyDrawerGroup.position.z,
        drawerGoalZ,
        7.5,
        delta
      );

      // Highlight glow hints on Rack / Table Bucky / Wall Bucky
      (rackGlowRing.material as THREE.MeshBasicMaterial).opacity =
        cState === 'RACK' ? 0.45 + Math.sin(elapsed * 4) * 0.18 : 0.08;

      const tableGlowMat = tableBuckyGlow.material as THREE.MeshBasicMaterial;
      const wallGlowMat = wallBuckyGlow.material as THREE.MeshBasicMaterial;
      if (crExposedPendingRef.current && cState === 'TABLE_BUCKY') {
        tableGlowMat.color.setHex(0xf59e0b);
        tableGlowMat.opacity = 0.6 + Math.sin(elapsed * 6) * 0.28;
      } else {
        tableGlowMat.color.setHex(0x22d3ee);
        tableGlowMat.opacity =
          cState === 'IN_HAND' && !isErect
            ? 0.55 + Math.sin(elapsed * 5) * 0.25
            : cState === 'TABLE_BUCKY' && !isErect
              ? 0.22
              : 0.0;
      }

      if (crExposedPendingRef.current && cState === 'WALL_BUCKY') {
        wallGlowMat.color.setHex(0xf59e0b);
        wallGlowMat.opacity = 0.6 + Math.sin(elapsed * 6) * 0.28;
      } else {
        wallGlowMat.color.setHex(0x22d3ee);
        wallGlowMat.opacity =
          cState === 'IN_HAND' && isErect
            ? 0.55 + Math.sin(elapsed * 5) * 0.25
            : 0.0;
      }

      // 5. Realistic Patient Walk-In Choreography + Posture & Articulated Kinematics
      const targetErect = isErect && !isBoreScan ? 1 : 0;
      erectBlend = THREE.MathUtils.damp(erectBlend, targetErect, 6.2, delta);

      if (patientEnterAnimRef.current > 0) {
        patientEnterAnimRef.current = Math.max(
          0,
          patientEnterAnimRef.current - delta * 0.56
        );
      }
      const enterP = patientEnterAnimRef.current;

      const arcLift = Math.sin(erectBlend * Math.PI) * 0.34;
      const lyingY =
        posture === 'TABLE_LEFT_LAT' || posture === 'TABLE_RIGHT_LAT'
          ? 1.14
          : 1.09;
      const standingY = 0.96;

      let anchorGoalX = THREE.MathUtils.lerp(
        slidingTableGroup.position.x,
        ERECT_PATIENT_X,
        erectBlend
      );
      let anchorGoalY =
        THREE.MathUtils.lerp(lyingY, standingY, erectBlend) + arcLift;
      let anchorGoalZ = THREE.MathUtils.lerp(0, ERECT_Z, erectBlend);
      let anchorRollZ = THREE.MathUtils.lerp(Math.PI / 2, 0, erectBlend);
      let walkAmp = 0;
      let walkCycle = 0;
      let walkYawOverride: number | null = null;

      if (enterP > 0.001) {
        if (targetErect === 1) {
          // Walk smoothly from Waiting Room Door area (-1.2, -3.15) to Wall Bucky standing spot
          const walkProgress = 1 - enterP;
          const easeP =
            walkProgress * walkProgress * (3 - 2 * walkProgress);
          anchorGoalX = THREE.MathUtils.lerp(-1.15, ERECT_PATIENT_X, easeP);
          anchorGoalZ = THREE.MathUtils.lerp(-3.15, ERECT_Z, easeP);
          walkAmp = Math.sin(Math.min(1, enterP * 1.25) * Math.PI * 0.5);
          walkCycle = walkProgress * Math.PI * 5.2;
          anchorGoalY = standingY + Math.abs(Math.sin(walkCycle)) * 0.025 * walkAmp;
          anchorRollZ = 0;
          if (enterP > 0.24) {
            walkYawOverride = Math.atan2(
              ERECT_PATIENT_X - -1.15,
              ERECT_Z - -3.15
            );
          }
        } else {
          // First walk upright to table bedside, then smoothly sit & recline onto cushion
          if (enterP > 0.42) {
            const pWalk = (1 - enterP) / 0.58;
            const easeW = pWalk * pWalk * (3 - 2 * pWalk);
            const tableSideX = slidingTableGroup.position.x + 0.12;
            const tableSideZ = 0.92;
            anchorGoalX = THREE.MathUtils.lerp(-1.15, tableSideX, easeW);
            anchorGoalZ = THREE.MathUtils.lerp(-3.0, tableSideZ, easeW);
            walkAmp = Math.sin(Math.min(1, (1 - pWalk) * 1.4) * Math.PI * 0.5);
            walkCycle = pWalk * Math.PI * 4.4;
            anchorGoalY = standingY + Math.abs(Math.sin(walkCycle)) * 0.024 * walkAmp;
            anchorRollZ = 0;
            walkYawOverride = Math.atan2(tableSideX - -1.15, tableSideZ - -3.0);
          } else {
            const pLie = 1 - enterP / 0.42;
            const easeL = pLie * pLie * (3 - 2 * pLie);
            anchorGoalX = THREE.MathUtils.lerp(
              slidingTableGroup.position.x + 0.12,
              slidingTableGroup.position.x,
              easeL
            );
            anchorGoalZ = THREE.MathUtils.lerp(0.92, 0, easeL);
            anchorGoalY =
              THREE.MathUtils.lerp(standingY, lyingY, easeL) +
              Math.sin(easeL * Math.PI) * 0.24;
            anchorRollZ = THREE.MathUtils.lerp(0, Math.PI / 2, easeL);
          }
        }
      }

      patientWorldAnchor.position.set(anchorGoalX, anchorGoalY, anchorGoalZ);
      patientWorldAnchor.rotation.z = anchorRollZ;

      const patientTargetYaw =
        walkYawOverride !== null
          ? walkYawOverride
          : getTargetBodyYaw(isBoreScan ? 'SUPINE' : posture);
      patientLocalBody.rotation.y = dampAngle(
        patientLocalBody.rotation.y,
        patientTargetYaw,
        6.8,
        delta
      );

      // Subtle stepping & arm counterbalance while turning in erect posture
      let yawDelta = Math.abs(patientTargetYaw - patientLocalBody.rotation.y);
      if (yawDelta > Math.PI) yawDelta = Math.PI * 2 - yawDelta;
      const turningStep =
        erectBlend > 0.7 && walkAmp < 0.05 && yawDelta > 0.06
          ? Math.min(1, yawDelta * 1.4) * 0.42
          : 0;
      const activeStride = walkAmp > 0.02 ? walkAmp : turningStep;
      const activeCycle = walkAmp > 0.02 ? walkCycle : elapsed * 10.5;

      const isErectLat =
        posture === 'ERECT_LEFT_LAT' || posture === 'ERECT_RIGHT_LAT';
      const isTableLat =
        posture === 'TABLE_LEFT_LAT' || posture === 'TABLE_RIGHT_LAT';
      const isHandTableExam =
        !isErect && selectedRegionRef.current === 'hand';
      const isSpeaking = Boolean(patientSpeechRef.current);

      // Blinking Eyelids (quick natural blink every ~3.9s)
      const pBlinkPhase = elapsed % 3.9;
      const pBlinking = pBlinkPhase > 3.81;
      eyelidMeshes.forEach((lid) => {
        lid.rotation.x = THREE.MathUtils.damp(
          lid.rotation.x,
          pBlinking ? 0.62 : -1.15,
          30,
          delta
        );
      });

      // Talking Lips + Head Nod / Gaze Micro-Animation
      const talkOsc = isSpeaking ? Math.abs(Math.sin(elapsed * 14.5)) : 0;
      pLips.scale.y = THREE.MathUtils.damp(
        pLips.scale.y,
        1 + talkOsc * 0.85,
        24,
        delta
      );

      const headGoalY =
        posture === 'PRONE'
          ? 0.56
          : isSpeaking
            ? Math.sin(elapsed * 2.6) * 0.14
            : walkAmp > 0.05
              ? 0
              : Math.sin(elapsed * 0.85) * 0.07;
      const headGoalX = isSpeaking
        ? Math.sin(elapsed * 4.5) * 0.08
        : walkAmp > 0.05
          ? 0.03
          : Math.sin(elapsed * 1.2) * 0.02;
      pHeadGroup.rotation.y = THREE.MathUtils.damp(
        pHeadGroup.rotation.y,
        headGoalY,
        6.5,
        delta
      );
      pHeadGroup.rotation.x = THREE.MathUtils.damp(
        pHeadGroup.rotation.x,
        headGoalX,
        6.5,
        delta
      );

      // Physiological Breathing + Spine Micro-Motion (pauses on breath hold!)
      const breathWave = patientPreppedRef.current ? 0 : Math.sin(elapsed * 2.25);
      pChestGroup.scale.set(
        1 + breathWave * 0.018,
        1,
        1 + breathWave * 0.032
      );
      pSpinePivot.rotation.x = THREE.MathUtils.damp(
        pSpinePivot.rotation.x,
        activeStride * 0.045 + breathWave * 0.012,
        6,
        delta
      );
      pSpinePivot.rotation.y = THREE.MathUtils.damp(
        pSpinePivot.rotation.y,
        Math.sin(activeCycle) * 0.06 * activeStride,
        8,
        delta
      );

      // Anatomically Authentic 2-Bone Arm & Wrist Joint Targets per Posture / Walk / Speech
      shoulderPivots.forEach((sPivot, idx) => {
        const sideSign = idx === 0 ? 1 : -1; // idx 0: Left (+X), idx 1: Right (-X)
        const ePivot = elbowPivots[idx];
        const wPivot = wristPivots[idx];

        let sX = -0.05;
        let sZ = sideSign * 0.08;
        let eX = -0.18;
        let eZ = 0;
        let wX = 0;

        if (activeStride > 0.03) {
          const swing = Math.sin(activeCycle) * sideSign * activeStride;
          sX = swing * 0.34 - 0.04;
          sZ = sideSign * 0.1;
          eX = -0.22 - Math.max(0, -swing) * 0.25;
        } else if (isErect && isErectLat) {
          // Lateral chest/cervical: raise arms gracefully overhead so chest clears beam
          sX = -2.22;
          sZ = sideSign * 0.12;
          eX = -0.78;
          eZ = -sideSign * 0.18;
        } else if (isErect && posture === 'ERECT_PA') {
          // PA Chest: elbows bent slightly forward/outward wrapping toward Bucky
          sX = -0.26;
          sZ = sideSign * 0.26;
          eX = -0.88;
          eZ = -sideSign * 0.36;
          wX = 0.18;
        } else if (!isErect && posture === 'PRONE') {
          sX = -1.7;
          sZ = sideSign * 0.24;
          eX = -1.1;
          eZ = -sideSign * 0.25;
        } else if (!isErect && isTableLat) {
          const isTopArm =
            (posture === 'TABLE_LEFT_LAT' && idx === 1) ||
            (posture === 'TABLE_RIGHT_LAT' && idx === 0);
          sX = isTopArm ? -0.35 : -0.95;
          sZ = sideSign * (isTopArm ? 0.14 : 0.08);
          eX = isTopArm ? -0.85 : -1.05;
        } else if (!isErect && isHandTableExam && idx === 1) {
          // Extend examined right arm smoothly outward onto hand target pad
          sX = 0.04;
          sZ = -0.44;
          eX = -0.35;
          wX = -0.15;
        } else if (isSpeaking && idx === 1 && isErect) {
          // Polite natural hand gesture while speaking
          sX = -0.34 + Math.sin(elapsed * 4.2) * 0.07;
          sZ = -0.14;
          eX = -0.95 + Math.sin(elapsed * 5.0) * 0.12;
        } else {
          // Natural relaxed arm hang / table supine rest
          sX = isErect ? -0.05 : 0.06;
          sZ = sideSign * (isErect ? 0.09 : 0.12);
          eX = isErect ? -0.2 : -0.1;
        }

        const breathLift = breathWave * 0.004;
        sPivot.position.y = 0.39 + breathLift;
        sPivot.rotation.x = THREE.MathUtils.damp(sPivot.rotation.x, sX, 7.5, delta);
        sPivot.rotation.z = THREE.MathUtils.damp(sPivot.rotation.z, sZ, 7.5, delta);
        ePivot.rotation.x = THREE.MathUtils.damp(ePivot.rotation.x, eX, 8, delta);
        ePivot.rotation.z = THREE.MathUtils.damp(ePivot.rotation.z, eZ, 8, delta);
        wPivot.rotation.x = THREE.MathUtils.damp(wPivot.rotation.x, wX, 8, delta);
      });

      // Articulated 3-Bone Leg, Knee & Ankle Relaxation Kinematics
      thighPivots.forEach((hip, idx) => {
        const sideSign = idx === 0 ? 1 : -1;
        const knee = kneePivots[idx];
        const ankle = anklePivots[idx];

        let hipGoalX = 0;
        let hipGoalZ = sideSign * 0.02;
        let kneeGoalX = 0.04;
        let ankleGoalX = isErect ? 0 : 0.28;

        if (activeStride > 0.03) {
          const legPhase = Math.sin(activeCycle) * sideSign * activeStride;
          hipGoalX = -legPhase * 0.44;
          kneeGoalX = Math.max(0.05, legPhase * 0.62 + 0.16 * activeStride);
          ankleGoalX = legPhase * 0.16;
        } else if (isTableLat) {
          const isTopLeg =
            (posture === 'TABLE_LEFT_LAT' && idx === 1) ||
            (posture === 'TABLE_RIGHT_LAT' && idx === 0);
          hipGoalX = isTopLeg ? -0.52 : -0.22;
          kneeGoalX = isTopLeg ? 0.92 : 0.42;
          ankleGoalX = 0.22;
        } else if (isErect) {
          // Natural weight shift idle stance
          const sway = Math.sin(elapsed * 0.7) * 0.025;
          hipGoalZ = sideSign * 0.03 + sway;
          kneeGoalX = idx === 0 ? 0.03 : 0.06;
        } else {
          // Comfortable relaxed supine/prone leg alignment
          hipGoalZ = sideSign * 0.045;
          kneeGoalX = posture === 'PRONE' ? 0.06 : 0.03;
          ankleGoalX = posture === 'PRONE' ? 0.42 : 0.28;
        }

        hip.rotation.x = THREE.MathUtils.damp(hip.rotation.x, hipGoalX, 8, delta);
        hip.rotation.z = THREE.MathUtils.damp(hip.rotation.z, hipGoalZ, 7, delta);
        knee.rotation.x = THREE.MathUtils.damp(knee.rotation.x, kneeGoalX, 8, delta);
        ankle.rotation.x = THREE.MathUtils.damp(ankle.rotation.x, ankleGoalX, 7, delta);
      });

      // 6. Ceiling X-Ray Crane & Wall Bucky Receptor
      const goalGantryX = THREE.MathUtils.lerp(
        targetSpot.tableWorldX,
        isExposingRef.current ? 1.05 : 0.96,
        erectBlend
      );
      const goalTubeZ = THREE.MathUtils.lerp(
        targetSpot.tableWorldZ,
        ERECT_Z,
        erectBlend
      );
      const goalTubeY = THREE.MathUtils.lerp(
        isExposingRef.current ? 1.8 : 1.92,
        targetSpot.erectWorldY,
        erectBlend
      );
      const goalPivotZ = THREE.MathUtils.lerp(0, Math.PI / 2, erectBlend);

      gantryCarriage.position.x = THREE.MathUtils.damp(
        gantryCarriage.position.x,
        goalGantryX,
        7.5,
        delta
      );
      tubeAssembly.position.z = THREE.MathUtils.damp(
        tubeAssembly.position.z,
        goalTubeZ,
        7.5,
        delta
      );
      tubeAssembly.position.y = THREE.MathUtils.damp(
        tubeAssembly.position.y,
        goalTubeY,
        7.5,
        delta
      );
      tubePivot.rotation.z = THREE.MathUtils.damp(
        tubePivot.rotation.z,
        goalPivotZ,
        7.5,
        delta
      );

      erectBuckyCarriage.position.y = THREE.MathUtils.damp(
        erectBuckyCarriage.position.y,
        targetSpot.erectWorldY,
        7.5,
        delta
      );

      // 7. Exposure Beam Flash + Warning Beacon
      beamMat.opacity = THREE.MathUtils.damp(
        beamMat.opacity,
        isExposingRef.current ? 0.68 : 0.14,
        15,
        delta
      );
      exposureFlashLight.intensity = THREE.MathUtils.damp(
        exposureFlashLight.intensity,
        isExposingRef.current ? 2.8 : 0,
        14,
        delta
      );
      exposureFlashLight.position.set(
        gantryCarriage.position.x + (erectBlend > 0.5 ? 0.55 : 0),
        tubeAssembly.position.y - (erectBlend > 0.5 ? 0 : 0.45),
        tubeAssembly.position.z
      );
      matWarningBeacon.emissiveIntensity = THREE.MathUtils.damp(
        matWarningBeacon.emissiveIntensity,
        isExposingRef.current ? 2.5 : 0.14,
        14,
        delta
      );

      // 8. Upgrades & Lead Shield
      ctMriGantryGroup.visible = isBoreScan;
      processorGroup.visible =
        ownedUpgradesRef.current.includes('auto_processor');
      leadApronMesh.visible =
        shieldUsedRef.current && selectedRegionRef.current !== 'pelvis';

      hotspotRings.forEach(({region, mesh}) => {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const isSel = region === selectedRegionRef.current;
        mat.color.setHex(isSel ? 0x22d3ee : 0x64748b);
        mat.opacity = isSel ? 0.9 : 0.22;
        const s = isSel ? 1.06 + Math.sin(elapsed * 4) * 0.05 : 1;
        mesh.scale.set(s, s, 1);
      });

      if (useComposer && composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      // Project large, high-contrast 3D speech bubble clearly above patient's head
      const bubbleEl = speechBubbleRef.current;
      if (bubbleEl) {
        if (patientSpeechRef.current) {
          pHeadGroup.getWorldPosition(_headWorldPos);
          _headWorldPos.y += isErect ? 0.54 : 0.44;
          _headProj.copy(_headWorldPos).project(camera);
          const cw = container?.clientWidth || 0;
          const ch = container?.clientHeight || 0;
          if (
            cw > 0 &&
            ch > 0 &&
            _headProj.z > -1 &&
            _headProj.z < 1 &&
            Math.abs(_headProj.x) <= 1.25 &&
            Math.abs(_headProj.y) <= 1.25
          ) {
            const padX = Math.min(145, cw * 0.28);
            const sx = THREE.MathUtils.clamp(
              (_headProj.x * 0.5 + 0.5) * cw,
              padX,
              Math.max(padX, cw - padX)
            );
            const topSafe = ch < 560 ? 64 : 96;
            const bottomSafe = ch < 560 ? 66 : 92;
            const sy = THREE.MathUtils.clamp(
              (-_headProj.y * 0.5 + 0.5) * ch,
              topSafe,
              Math.max(topSafe, ch - bottomSafe)
            );
            bubbleEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
            bubbleEl.style.opacity = '1';
          } else {
            bubbleEl.style.opacity = '0';
          }
        } else {
          bubbleEl.style.opacity = '0';
        }
      }

      scheduleNextFrame();
    }

    if (!pausedRef.current && !document.hidden) {
      loopRunning = true;
      tick();
    }

    return () => {
      disposed = true;
      loopRunning = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      disposables.forEach((d) => d.dispose());
      bloomPass?.dispose();
      composerTarget?.dispose();
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-[#09111C] select-none overflow-hidden">
      {!webglUnavailable ? (
        <div ref={mountRef} className="w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-6">
          <img
            src={CLINIC_ROOM_IMAGE}
            alt={language === 'ar' ? 'غرفة الأشعة' : 'Radiology Room'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-80"
          />
        </div>
      )}

      {/* Floating Large High-Contrast 3D Patient Dialogue Speech Bubble */}
      <div
        ref={speechBubbleRef}
        style={{opacity: 0, left: 0, top: 0}}
        className="hud-speech-bubble pointer-events-none absolute z-30 transition-opacity duration-200 min-w-[205px] sm:min-w-[260px] max-w-[310px] sm:max-w-[420px]"
      >
        {patientSpeech && (
          <div className="hud-speech-card relative rounded-2xl bg-[#F8FAFC] border-[3px] border-cyan-500 px-4 py-3 sm:px-5 sm:py-3.5 text-slate-950 shadow-[0_18px_46px_rgba(0,0,0,0.82)] text-center">
            <div className="hud-speech-tag inline-block rounded-md bg-cyan-600 px-2 py-0.5 text-[10px] sm:text-xs font-extrabold tracking-wide text-white mb-1.5">
              {language === 'ar' ? 'المريض يتحدث' : 'PATIENT'}
            </div>
            <p className="hud-speech-text text-sm sm:text-base md:text-lg font-extrabold leading-relaxed text-slate-950">
              {patientSpeech}
            </p>
            <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-[#F8FAFC] border-r-[3px] border-b-[3px] border-cyan-500" />
          </div>
        )}
      </div>

      {/* Contextual 3D Interaction Hover Prompt (No backdrop-blur over WebGL) */}
      {hoveredLabel && (
        <div className="hud-hover-label pointer-events-none fixed sm:absolute top-24 left-1/2 -translate-x-1/2 z-20 rounded-lg bg-[#080F1B]/95 border border-cyan-500/70 px-4 py-2 text-xs font-bold text-cyan-200 shadow-lg whitespace-nowrap">
          {hoveredLabel}
        </div>
      )}
    </div>
  );
};
