import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import type {
  BodyRegion,
  CassetteState,
  ExamProtocol,
  PatientCase,
  PatientPosture,
  TechLocation,
  UpgradeId,
} from '../types/radiology';
import {CLINIC_ROOM_IMAGE, REGION_LABELS_AR} from '../data/radiologyData';

export type SceneTargetAction =
  | {type: 'REGION'; region: BodyRegion}
  | {type: 'CASSETTE_RACK'}
  | {type: 'TABLE_BUCKY'}
  | {type: 'WALL_BUCKY'}
  | {type: 'DOOR'}
  | {type: 'CONSOLE'}
  | {type: 'PC'};

interface RadiologyRoom3DProps {
  patient: PatientCase | null;
  requestedExam: ExamProtocol;
  selectedRegion: BodyRegion;
  selectedPosture: PatientPosture;
  techLocation: TechLocation;
  doorClosed: boolean;
  cassetteState: CassetteState;
  shieldUsed: boolean;
  patientPrepped: boolean;
  isExposing: boolean;
  ownedUpgrades: UpgradeId[];
  joystickRef: React.MutableRefObject<{x: number; y: number}>;
  onTechZoneChange?: (loc: TechLocation) => void;
  onSceneInteract: (action: SceneTargetAction) => void;
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

function hashPatientSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function canStandAt(x: number, z: number, doorClosed: boolean): boolean {
  // Exam Room interior (north of partition wall)
  if (z <= 1.86) {
    if (x < -3.72 || x > 4.08 || z < -2.42) return false;
    // Avoid walking inside solid X-ray table core
    if (Math.abs(x) < 1.48 && Math.abs(z) < 0.56) return false;
    // Avoid cassette rack cabinet
    if (x < -1.16 && z < -1.5) return false;
    return true;
  }

  // Doorway threshold (forgiving clearance between Exam Room and Control Booth)
  if (z > 1.86 && z < 2.24) {
    if (doorClosed) return false;
    return x >= -1.46 && x <= -0.56;
  }

  // Control Booth interior (behind lead-glass window & desk)
  if (z >= 2.24) {
    if (x < -3.75 || x > -0.64 || z > 3.78) return false;
    // Avoid clipping into booth desk (x: -3.55..-1.45, z: 2.24..3.05)
    if (x > -3.58 && x < -1.44 && z < 3.06) return false;
    return true;
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
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  // Luxury clinical slate-terrazzo porcelain base
  ctx.fillStyle = '#182436';
  ctx.fillRect(0, 0, 512, 512);
  // Subtle alternating porcelain tile sheen
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      ctx.fillStyle =
        (gx + gy) % 2 === 0 ? 'rgba(38, 56, 82, 0.36)' : 'rgba(22, 34, 52, 0.36)';
      ctx.fillRect(gx * 128 + 2, gy * 128 + 2, 124, 124);
    }
  }
  ctx.strokeStyle = '#24364E';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  for (let i = 0; i < 620; i++) {
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(103, 232, 249, 0.08)'
        : i % 2 === 0
          ? 'rgba(226, 232, 240, 0.08)'
          : 'rgba(148, 163, 184, 0.06)';
    ctx.fillRect((i * 73) % 512, (i * 137) % 512, 2.5, 2.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
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
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#07111E';
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = '#0F223A';
  ctx.fillRect(0, 0, 512, 40);
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('PACS WORKSTATION · CLINIC PC', 20, 27);
  // Left image frame
  ctx.strokeStyle = '#22D3EE';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 56, 200, 236);
  ctx.fillStyle = '#0A192C';
  ctx.fillRect(22, 58, 196, 232);
  // Stylized chest x-ray preview inside PC monitor
  ctx.strokeStyle = 'rgba(226,232,240,0.85)';
  ctx.lineWidth = 3;
  for (let r = 0; r < 5; r++) {
    ctx.beginPath();
    ctx.ellipse(120, 115 + r * 26, 56 - r * 3, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Right buttons/cards
  ctx.fillStyle = '#132842';
  ctx.fillRect(240, 56, 250, 68);
  ctx.fillRect(240, 138, 250, 68);
  ctx.fillRect(240, 220, 250, 72);
  ctx.fillStyle = '#67E8F9';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('IMAGE EDITOR', 260, 96);
  ctx.fillStyle = '#A7F3D0';
  ctx.fillText('PATIENT ARCHIVE', 260, 178);
  ctx.fillStyle = '#FDE68A';
  ctx.fillText('CLINIC STORE', 260, 262);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createConsoleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0A1624';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 244, 148);
  ctx.fillStyle = '#22D3EE';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('kVp  |  mAs', 20, 42);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(20, 62, 100, 26);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(136, 62, 100, 26);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('READY', 42, 81);
  ctx.fillText('EXPOSE', 152, 81);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px monospace';
  ctx.fillText('X-RAY GENERATOR', 22, 128);
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
  requestedExam,
  selectedRegion,
  selectedPosture,
  techLocation,
  doorClosed,
  cassetteState,
  shieldUsed,
  patientPrepped,
  isExposing,
  ownedUpgrades,
  joystickRef,
  onTechZoneChange,
  onSceneInteract,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);

  // Refs synced from React props without rebuilding WebGL
  const selectedRegionRef = useRef<BodyRegion>(selectedRegion);
  const selectedPostureRef = useRef<PatientPosture>(selectedPosture);
  const techLocationRef = useRef<TechLocation>(techLocation);
  const doorClosedRef = useRef<boolean>(doorClosed);
  const cassetteStateRef = useRef<CassetteState>(cassetteState);
  const shieldUsedRef = useRef<boolean>(shieldUsed);
  const patientPreppedRef = useRef<boolean>(patientPrepped);
  const isExposingRef = useRef<boolean>(isExposing);
  const modalityRef = useRef(requestedExam.modality);
  const ownedUpgradesRef = useRef<UpgradeId[]>(ownedUpgrades);
  const onSceneInteractRef = useRef(onSceneInteract);
  const onTechZoneChangeRef = useRef(onTechZoneChange);
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
  const applyPatientAppearanceRef = useRef<(() => void) | null>(null);

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
    if (cassetteStateRef.current !== cassetteState) {
      cassetteStateRef.current = cassetteState;
      handReachImpulseRef.current = 1.0;
    }
  }, [cassetteState]);

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
    patientAppearanceRef.current = {
      id: patient?.id ?? 'default-m',
      gender: patient?.gender ?? 'M',
      age: patient?.age ?? 32,
    };
    applyPatientAppearanceRef.current?.();
    patientEnterAnimRef.current = 1.0;
    cameraMoveActiveRef.current = true;
  }, [patient?.id, patient?.gender, patient?.age]);

  // Refocus smoothly when switching between table and erect inside exam room
  useEffect(() => {
    if (techLocationRef.current === 'ROOM') {
      cameraMoveActiveRef.current = true;
    }
  }, [selectedPosture]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const initWidth = container.clientWidth || 1200;
    const initHeight = container.clientHeight || 720;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(initWidth, initHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09111c);
    scene.fog = new THREE.FogExp2(0x09111c, 0.036);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
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
    // STUDIO 3-POINT MEDICAL LIGHTING RIG
    // =========================================================================
    const hemiLight = new THREE.HemisphereLight(0xe6f4ff, 0x202f46, 1.15);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.65);
    keyLight.position.set(2.4, 5.4, 3.4);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.left = -4.5;
      keyLight.shadow.camera.right = 4.5;
      keyLight.shadow.camera.top = 4.5;
      keyLight.shadow.camera.bottom = -4.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-3.6, 3.2, -3.4);
    scene.add(rimLight);

    const ceilingFillLight = new THREE.PointLight(0xeef8ff, 1.35, 11);
    ceilingFillLight.position.set(0.5, 3.25, -0.3);
    scene.add(ceilingFillLight);

    const boothLight = new THREE.PointLight(0xbae6fd, 1.05, 5.0);
    boothLight.position.set(-2.45, 2.35, 3.15);
    scene.add(boothLight);

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

    const floorTex = track(createTileFloorTexture());
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = track(createContactShadowTexture());
    const lightboxTex = track(createLightboxTexture());
    lightboxTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const detectorTex = track(createDetectorPanelTexture());
    detectorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const pcScreenTex = track(createPcScreenTexture());
    pcScreenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const consoleTex = track(createConsoleTexture());
    consoleTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const doorSignTex = track(createDoorSignTexture());
    const wallChartTex = track(createWallChartTexture());
    wallChartTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const suiteHeaderTex = track(createSuiteHeaderTexture());
    suiteHeaderTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const matFloor = track(
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.36,
        metalness: 0.16,
      })
    );
    const matWall = track(
      new THREE.MeshStandardMaterial({
        color: 0x223247,
        roughness: 0.72,
        metalness: 0.06,
      })
    );
    const matWallLower = track(
      new THREE.MeshStandardMaterial({
        color: 0x2b405a,
        roughness: 0.56,
        metalness: 0.14,
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
        emissiveIntensity: 0.95,
        roughness: 0.25,
      })
    );
    const matWarmWood = track(
      new THREE.MeshStandardMaterial({
        color: 0x7c5438,
        roughness: 0.62,
        metalness: 0.06,
      })
    );
    const matTrim = track(
      new THREE.MeshStandardMaterial({
        color: 0x3b526b,
        roughness: 0.34,
        metalness: 0.62,
      })
    );
    const matClinicalWhite = track(
      new THREE.MeshStandardMaterial({
        color: 0xeaf1f8,
        roughness: 0.24,
        metalness: 0.16,
      })
    );
    const matRadiolucentDeck = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x132032,
        roughness: 0.16,
        metalness: 0.25,
        transparent: true,
        opacity: 0.72,
        clearcoat: 0.6,
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
      new THREE.MeshPhysicalMaterial({
        color: 0xdbe4ee,
        roughness: 0.14,
        metalness: 0.94,
        clearcoat: 0.4,
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
      new THREE.MeshPhysicalMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.18,
        roughness: 0.06,
        metalness: 0.1,
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
      track(new THREE.PlaneGeometry(13, 11)),
      matFloor
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const backWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(12.5, 3.8, 0.18)),
      matWall
    );
    backWall.position.set(0.2, 1.9, -2.85);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const backWainscot = new THREE.Mesh(
      track(new THREE.BoxGeometry(12.4, 1.05, 0.04)),
      matWallLower
    );
    backWainscot.position.set(0.2, 0.525, -2.74);
    scene.add(backWainscot);

    const rightWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 3.8, 10.5)),
      matWall
    );
    rightWall.position.set(4.5, 1.9, 0.4);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const leftWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 3.8, 10.5)),
      matWall
    );
    leftWall.position.set(-4.1, 1.9, 0.4);
    scene.add(leftWall);

    const backLed = new THREE.Mesh(
      track(new THREE.BoxGeometry(11.6, 0.055, 0.04)),
      matLedStrip
    );
    backLed.position.set(0.2, 3.05, -2.73);
    scene.add(backLed);

    // Anodized Dado Trim Rails along walls
    const backDado = new THREE.Mesh(
      track(new THREE.BoxGeometry(12.2, 0.055, 0.06)),
      matChrome
    );
    backDado.position.set(0.2, 1.07, -2.73);
    scene.add(backDado);

    const rightWainscot = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 1.05, 10.2)),
      matWallLower
    );
    rightWainscot.position.set(4.39, 0.525, 0.4);
    scene.add(rightWainscot);

    const leftWainscot = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 1.05, 10.2)),
      matWallLower
    );
    leftWainscot.position.set(-3.99, 0.525, 0.4);
    scene.add(leftWainscot);

    // Warm Architectural Acoustic Wood Slats on Back Wall & Right Wall
    [-3.6, -3.44, -3.28, -3.12, 3.12, 3.28, 3.44, 3.6].forEach((sx) => {
      const slat = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.05, 2.35, 0.04)),
        matWarmWood
      );
      slat.position.set(sx, 2.25, -2.74);
      scene.add(slat);
    });
    [-1.4, -1.24, -1.08, 0.9, 1.06, 1.22].forEach((sz) => {
      const slat = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.04, 2.35, 0.05)),
        matWarmWood
      );
      slat.position.set(4.39, 2.25, sz);
      scene.add(slat);
    });

    // Architectural Ceiling & Recessed LED Skylight Coffers
    const ceilingMesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(12.8, 10.6)),
      matCeiling
    );
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(0.2, 3.55, 0.4);
    scene.add(ceilingMesh);

    [
      [-1.4, -1.2],
      [0.6, -1.2],
      [2.6, -1.2],
      [-1.4, 0.7],
      [0.6, 0.7],
      [2.6, 0.7],
      [-2.35, 3.05],
    ].forEach(([lx, lz]) => {
      const cofferFrame = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.18, 0.05, 0.72)),
        matChrome
      );
      cofferFrame.position.set(lx, 3.53, lz);
      scene.add(cofferFrame);

      const cofferPanel = new THREE.Mesh(
        track(new THREE.PlaneGeometry(1.08, 0.62)),
        matCeilingPanel
      );
      cofferPanel.rotation.x = Math.PI / 2;
      cofferPanel.position.set(lx, 3.5, lz);
      scene.add(cofferPanel);
    });

    // Framed Radiography Reference Chart on Right Wall
    const chartFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 0.96, 1.28)),
      matChrome
    );
    chartFrame.position.set(4.38, 1.92, -0.15);
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
    chartPoster.position.set(4.35, 1.92, -0.15);
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

    // Wall Lightbox
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
    lightboxGroup.position.set(0.2, 1.92, -2.71);
    scene.add(lightboxGroup);

    // Back-Wall Clinical Cabinetry & Countertop (x = 2.45, z = -2.54)
    const cabinetGroup = new THREE.Group();
    cabinetGroup.position.set(2.45, 0, -2.54);

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

    // Mobile Lead Apron & Shield Rack (x = -3.45, z = -2.25)
    const apronRackGroup = new THREE.Group();
    apronRackGroup.position.set(-3.45, 0, -2.25);
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

    // Potted Clinic Foliage Planter (x = 3.82, z = -2.35)
    const planterGroup = new THREE.Group();
    planterGroup.position.set(3.82, 0, -2.35);
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

    // Lead-Lined Partition Wall + Observation Window + Swinging Lead Door
    const boothGroup = new THREE.Group();

    // Window section (x: -3.95 to -1.55, z = 2.05)
    const boothBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.45, 0.96, 0.14)),
      matTrim
    );
    boothBase.position.set(-2.72, 0.48, 2.05);
    boothGroup.add(boothBase);

    const boothGlass = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.26, 1.28, 0.04)),
      matLeadGlass
    );
    boothGlass.position.set(-2.72, 1.58, 2.05);
    boothGroup.add(boothGlass);

    const boothHeader = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.45, 0.14, 0.16)),
      matTrim
    );
    boothHeader.position.set(-2.72, 2.28, 2.05);
    boothGroup.add(boothHeader);

    // Illuminated Suite Header Sign above Lead-Glass Window
    const suiteSignFace = new THREE.Mesh(
      track(new THREE.PlaneGeometry(1.9, 0.34)),
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
    suiteSignFace.position.set(-2.72, 2.55, 1.96);
    boothGroup.add(suiteSignFace);

    // Door Frame & Overhead Warning Beacon (door opening at x: -1.48 to -0.58, z = 2.05)
    const doorLintel = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.15, 0.6, 0.18)),
      matWallLower
    );
    doorLintel.position.set(-1.02, 2.45, 2.05);
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

    // Control Booth right enclosure wall & rear wall (creates a distinct walk-in room)
    const boothSideWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.14, 2.7, 2.1)),
      matWallLower
    );
    boothSideWall.position.set(-0.52, 1.35, 3.1);
    boothGroup.add(boothSideWall);

    const boothBackWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.6, 2.7, 0.16)),
      matWall
    );
    boothBackWall.position.set(-2.25, 1.35, 4.15);
    boothGroup.add(boothBackWall);

    scene.add(boothGroup);

    // =========================================================================
    // 3. CONTROL BOOTH WORKSTATION: 3D CLINIC PC + 3D X-RAY CONSOLE
    // =========================================================================
    const deskTop = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.15, 0.08, 0.68)),
      matClinicalWhite
    );
    deskTop.position.set(-2.55, 0.86, 2.66);
    deskTop.castShadow = true;
    scene.add(deskTop);

    // 3D Clinic Computer Monitor (Clickable -> opens PACS Image Editor / Log / Shop!)
    const clinicPcGroup = new THREE.Group();
    clinicPcGroup.position.set(-2.98, 0.9, 2.62);
    clinicPcGroup.rotation.y = 0.22;

    const pcStand = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 0.16, 0.12)),
      matTrim
    );
    pcStand.position.y = 0.08;
    clinicPcGroup.add(pcStand);

    const pcFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.68, 0.44, 0.04)),
      matTrim
    );
    pcFrame.position.y = 0.34;
    pcFrame.layers.set(1);
    pcFrame.userData.action = {type: 'PC'} satisfies SceneTargetAction;
    pcFrame.userData.label =
      'انقر لفتح الحاسوب (تعديل الصورة · المرضى · المتجر)';
    clinicPcGroup.add(pcFrame);
    interactiveMeshes.push(pcFrame);

    const pcScreen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.62, 0.38)),
      track(
        new THREE.MeshStandardMaterial({
          map: pcScreenTex,
          emissiveMap: pcScreenTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.85,
        })
      )
    );
    pcScreen.position.set(0, 0.34, 0.025);
    clinicPcGroup.add(pcScreen);

    const pcKeyboard = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.42, 0.02, 0.15)),
      matDarkPad
    );
    pcKeyboard.position.set(0, 0.01, 0.22);
    clinicPcGroup.add(pcKeyboard);
    scene.add(clinicPcGroup);

    // 3D X-Ray Generator Control Console (Clickable -> opens / focuses Exposure Console)
    const xrayConsoleGroup = new THREE.Group();
    xrayConsoleGroup.position.set(-2.12, 0.9, 2.64);
    xrayConsoleGroup.rotation.y = -0.18;

    const consoleBox = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.56, 0.18, 0.34)),
      matClinicalWhite
    );
    consoleBox.position.y = 0.09;
    consoleBox.rotation.x = 0.22;
    consoleBox.layers.set(1);
    consoleBox.userData.action = {type: 'CONSOLE'} satisfies SceneTargetAction;
    consoleBox.userData.label = 'انقر لضبط لوحة kVp و mAs وإطلاق الأشعة';
    xrayConsoleGroup.add(consoleBox);
    interactiveMeshes.push(consoleBox);

    const consoleScreen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.48, 0.26)),
      track(
        new THREE.MeshStandardMaterial({
          map: consoleTex,
          emissiveMap: consoleTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.75,
        })
      )
    );
    consoleScreen.position.set(0, 0.185, 0.02);
    consoleScreen.rotation.x = -Math.PI / 2 + 0.22;
    xrayConsoleGroup.add(consoleScreen);

    const exposeSwitch = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 16)),
      matLedStrip
    );
    exposeSwitch.position.set(0.2, 0.16, 0.1);
    xrayConsoleGroup.add(exposeSwitch);
    scene.add(xrayConsoleGroup);

    // =========================================================================
    // 4. CASSETTE STORAGE RACK INSIDE EXAM ROOM (Clickable to pick up Cassette!)
    // =========================================================================
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-1.65, 0, -1.9);

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

    const patientWorldAnchor = new THREE.Group();
    const patientLocalBody = new THREE.Group();
    patientWorldAnchor.add(patientLocalBody);
    scene.add(patientWorldAnchor);

    const pPelvis = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.145, 0.14, 14, 22)),
      matPatientBottom
    );
    pPelvis.rotation.z = Math.PI / 2;
    pPelvis.scale.set(1, 1.05, 0.78);
    pPelvis.position.set(0, -0.04, 0);
    pPelvis.castShadow = true;
    patientLocalBody.add(pPelvis);

    const pAbdomen = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.142, 0.18, 14, 22)),
      matPatientTop
    );
    pAbdomen.scale.set(1.12, 1, 0.78);
    pAbdomen.position.set(0, 0.12, 0);
    pAbdomen.castShadow = true;
    patientLocalBody.add(pAbdomen);

    const pChest = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.168, 0.22, 16, 24)),
      matPatientTop
    );
    pChest.scale.set(1.18, 1, 0.78);
    pChest.position.set(0, 0.34, 0.01);
    pChest.castShadow = true;
    patientLocalBody.add(pChest);

    // Tailored V-Neck Scrub/Shirt Collar + Chest Pocket + Badge
    [-1, 1].forEach((side) => {
      const collar = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.016, 0.12, 6, 10)),
        matPatientAccent
      );
      collar.position.set(side * 0.055, 0.47, 0.115);
      collar.rotation.set(0.32, 0, side * -0.45);
      patientLocalBody.add(collar);
    });

    const chestPocket = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.075, 0.085, 0.018)),
      matPatientAccent
    );
    chestPocket.position.set(0.095, 0.36, 0.14);
    patientLocalBody.add(chestPocket);

    // Waistband Belt / Sash + Chrome Buckle
    const pBelt = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.155, 0.158, 0.042, 22)),
      matPatientBelt
    );
    pBelt.scale.set(1.06, 1, 0.76);
    pBelt.position.set(0, 0.055, 0.002);
    patientLocalBody.add(pBelt);

    const pBeltBuckle = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.052, 0.036, 0.022)),
      matChrome
    );
    pBeltBuckle.position.set(0, 0.055, 0.122);
    patientLocalBody.add(pBeltBuckle);

    // Flared tunic / blouse hem + side pockets for female patients
    const pTunicSkirt = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16, 0.222, 0.3, 24)),
      matPatientTop
    );
    pTunicSkirt.scale.set(1.12, 1, 0.82);
    pTunicSkirt.position.set(0, -0.06, 0);
    pTunicSkirt.castShadow = true;
    pTunicSkirt.visible = false;
    patientLocalBody.add(pTunicSkirt);

    // Sculpted Head & Expressive Facial Features
    const pHeadGroup = new THREE.Group();
    pHeadGroup.position.set(0, 0.56, 0);
    const pNeck = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.054, 0.066, 0.14, 18)),
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

    // Sculpted Jaw / Chin taper
    const pJaw = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.095, 20, 16)),
      matPatientSkin
    );
    pJaw.scale.set(0.86, 0.76, 0.9);
    pJaw.position.set(0, 0.145, 0.024);
    pHeadGroup.add(pJaw);

    // Sculpted Left & Right Ears
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.025, 12, 10)),
        matPatientSkin
      );
      ear.scale.set(0.45, 1.15, 0.75);
      ear.position.set(side * 0.116, 0.215, 0.005);
      pHeadGroup.add(ear);
    });

    // Natural Rounded Nose Bridge + Tip
    const pNoseBridge = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.012, 0.032, 6, 10)),
      matPatientSkin
    );
    pNoseBridge.rotation.x = -0.28;
    pNoseBridge.position.set(0, 0.212, 0.128);
    pHeadGroup.add(pNoseBridge);

    // Layered Eyes (Sclera + Iris) & Expressive Eyebrows
    const browMeshes: THREE.Mesh[] = [];
    [-1, 1].forEach((side) => {
      const sclera = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.017, 12, 10)),
        matPatientEyeWhite
      );
      sclera.scale.set(1.2, 0.8, 0.6);
      sclera.position.set(side * 0.043, 0.242, 0.114);
      pHeadGroup.add(sclera);

      const iris = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.01, 10, 8)),
        matPatientIris
      );
      iris.position.set(side * 0.043, 0.242, 0.123);
      pHeadGroup.add(iris);

      const brow = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.0055, 0.028, 6, 8)),
        matPatientHair
      );
      brow.rotation.z = Math.PI / 2 - side * 0.12;
      brow.position.set(side * 0.044, 0.265, 0.116);
      pHeadGroup.add(brow);
      browMeshes.push(brow);
    });

    // Natural Lips / Smile Contour
    const pLips = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0085, 0.032, 6, 10)),
      matPatientLips
    );
    pLips.rotation.z = Math.PI / 2;
    pLips.scale.set(1, 1, 0.65);
    pLips.position.set(0, 0.162, 0.116);
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

    // Female Layered Long Hair (Parted Bangs + Crown + Shoulder Back Locks + Hairband)
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

    // Female Layered Draped Hijab (Underscarf Band + Outer Wrap + Pleated Shoulder Shawl)
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

    patientLocalBody.add(pHeadGroup);

    // Sculpted Arms + Sleeve Cuffs + Wristwatch + Natural Hands
    const armGroups: THREE.Group[] = [];
    [1, -1].forEach((side) => {
      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(side * 0.25, 0.44, 0);
      const shoulder = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.064, 16, 14)),
        matPatientTop
      );
      shoulderPivot.add(shoulder);
      const upperArm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.048, 0.23, 12, 16)),
        matPatientTop
      );
      upperArm.position.set(0, -0.155, 0);
      upperArm.castShadow = true;
      shoulderPivot.add(upperArm);

      const sleeveCuff = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.052, 0.054, 0.035, 16)),
        matPatientAccent
      );
      sleeveCuff.position.set(0, -0.265, 0);
      shoulderPivot.add(sleeveCuff);

      const forearm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.039, 0.21, 12, 16)),
        matPatientSkin
      );
      forearm.position.set(0, -0.415, 0.04);
      forearm.rotation.x = -0.15;
      forearm.castShadow = true;
      shoulderPivot.add(forearm);

      if (side === -1) {
        const watchStrap = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.042, 0.042, 0.024, 14)),
          matPatientBelt
        );
        watchStrap.position.set(0, -0.5, 0.052);
        watchStrap.rotation.x = -0.15;
        shoulderPivot.add(watchStrap);
      }

      // Rounded Sculpted Hand + Thumb
      const palm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.028, 0.055, 8, 12)),
        matPatientSkin
      );
      palm.scale.set(0.75, 1, 1.15);
      palm.position.set(0, -0.565, 0.062);
      shoulderPivot.add(palm);

      const thumb = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.011, 0.028, 6, 8)),
        matPatientSkin
      );
      thumb.position.set(-side * 0.016, -0.548, 0.088);
      thumb.rotation.x = 0.55;
      shoulderPivot.add(thumb);

      patientLocalBody.add(shoulderPivot);
      armGroups.push(shoulderPivot);
    });

    // Sculpted Legs + Trousers Cuffs + Two-Tone Medical Sneakers
    const thighPivots: THREE.Group[] = [];
    const kneePivots: THREE.Group[] = [];
    [1, -1].forEach((side) => {
      const hipPivot = new THREE.Group();
      hipPivot.position.set(side * 0.11, -0.12, 0);
      const thigh = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.068, 0.34, 12, 18)),
        matPatientBottom
      );
      thigh.position.set(0, -0.22, 0);
      thigh.castShadow = true;
      hipPivot.add(thigh);
      const kneeJoint = new THREE.Group();
      kneeJoint.position.set(0, -0.44, 0);
      const kneeCap = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.064, 14, 12)),
        matPatientBottom
      );
      kneeJoint.add(kneeCap);
      const shin = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.054, 0.34, 12, 18)),
        matPatientBottom
      );
      shin.position.set(0, -0.22, 0);
      shin.castShadow = true;
      kneeJoint.add(shin);

      // Two-tone Sneaker (Upper + White Outsole + Toe Cap)
      const shoeSole = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.09, 0.026, 0.185)),
        matClinicalWhite
      );
      shoeSole.position.set(0, -0.448, 0.058);
      kneeJoint.add(shoeSole);

      const shoeUpper = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.042, 0.095, 8, 14)),
        matPatientShoeUpper
      );
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.scale.set(1, 1, 0.72);
      shoeUpper.position.set(0, -0.422, 0.055);
      kneeJoint.add(shoeUpper);

      hipPivot.add(kneeJoint);
      patientLocalBody.add(hipPivot);
      thighPivots.push(hipPivot);
      kneePivots.push(kneeJoint);
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
        // Tailored female silhouette + tunic dress + layered hijab or flowing hair
        pChest.scale.set(0.95, 0.96, 0.78);
        pAbdomen.scale.set(0.83, 1, 0.7);
        pPelvis.scale.set(1.16, 1.08, 0.84);
        pNeck.scale.set(0.82, 1, 0.82);
        pHead.scale.set(0.88, 1.04, 0.94);
        pTunicSkirt.visible = true;
        browMeshes.forEach((b) => {
          b.scale.set(0.85, 0.9, 0.85);
        });
        armGroups.forEach((arm, idx) => {
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
        // Structured male silhouette + styled crown/sideburns + optional beard
        pChest.scale.set(1.26, 1.02, 0.82);
        pAbdomen.scale.set(1.14, 1.0, 0.8);
        pPelvis.scale.set(0.96, 1.02, 0.76);
        pNeck.scale.set(1.04, 1, 1.04);
        pHead.scale.set(0.94, 1.08, 0.99);
        pTunicSkirt.visible = false;
        browMeshes.forEach((b) => {
          b.scale.set(1.2, 1.05, 1.1);
        });
        armGroups.forEach((arm, idx) => {
          arm.position.x = (idx === 0 ? 1 : -1) * 0.268;
          arm.scale.set(1.05, 1.02, 1.05);
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
      hitMesh.userData.label = `انقر لتوجيه أنبوب الأشعة نحو: ${REGION_LABELS_AR[spot.id]}`;
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
        track(new THREE.BoxGeometry(4.6, 0.08, 0.08)),
        matChrome
      );
      rail.position.set(0.2, 3.38, rz);
      railGroup.add(rail);
    });
    scene.add(railGroup);

    const gantryCarriage = new THREE.Group();
    const bridgeBar = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.3, 0.1, 1.54)),
      matTrim
    );
    bridgeBar.position.set(0, 3.33, 0);
    gantryCarriage.add(bridgeBar);

    const tubeAssembly = new THREE.Group();
    const teleColumn = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.075, 0.088, 2.2, 18)),
      matChrome
    );
    teleColumn.position.set(0, 1.15, 0);
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
    sideDesk.position.set(2.8, 0.39, -2.15);
    processorGroup.add(sideDesk);
    const procUnit = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.54, 0.32, 0.42)),
      matClinicalWhite
    );
    procUnit.position.set(2.8, 0.94, -2.15);
    processorGroup.add(procUnit);
    processorGroup.visible = false;
    scene.add(processorGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
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
        const label = hits[0].object.userData.label as string | undefined;
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

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // =========================================================================
    // 10. ANIMATION LOOP (First-Person Hands, Door, Cassette, Patient & Crane)
    // =========================================================================
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let erectBlend = isErectPosture(selectedPostureRef.current) ? 1 : 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

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

      if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
        const curX = camera.position.x;
        const curZ = camera.position.z;
        let nextX = curX;
        let nextZ = curZ;

        if (canStandAt(curX + stepX, curZ, doorClosedRef.current)) {
          nextX = curX + stepX;
        } else {
          velX = 0;
        }
        if (canStandAt(nextX, curZ + stepZ, doorClosedRef.current)) {
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
          _camGoalPos.set(-2.55, 1.56, 3.35);
          _camGoalTarget.set(-1.35, 1.15, 0.9);
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

      // 2. First-Person 3D Technician Hands & Held Cassette Animation
      if (handReachImpulseRef.current > 0) {
        handReachImpulseRef.current = Math.max(
          0,
          handReachImpulseRef.current - delta * 2.8
        );
      }
      const reachForward = Math.sin(handReachImpulseRef.current * Math.PI) * 0.14;
      const holdingCassette = cassetteStateRef.current === 'IN_HAND';
      handheldCassette.visible = holdingCassette;

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

      // 3. Lead Door Swing Animation
      const doorGoalY = doorClosedRef.current ? 0 : -1.25;
      leadDoorPivot.rotation.y = THREE.MathUtils.damp(
        leadDoorPivot.rotation.y,
        doorGoalY,
        7.0,
        delta
      );

      // 4. Cassette Locations & Synchronized Under-Table Bucky Movement
      const targetSpot =
        ANATOMY_SPOTS.find((s) => s.id === selectedRegionRef.current) ||
        ANATOMY_SPOTS[2];
      const cState = cassetteStateRef.current;
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
      (tableBuckyGlow.material as THREE.MeshBasicMaterial).opacity =
        cState === 'IN_HAND' && !isErect
          ? 0.55 + Math.sin(elapsed * 5) * 0.25
          : cState === 'TABLE_BUCKY' && !isErect
            ? 0.22
            : 0.0;
      (wallBuckyGlow.material as THREE.MeshBasicMaterial).opacity =
        cState === 'IN_HAND' && isErect
          ? 0.55 + Math.sin(elapsed * 5) * 0.25
          : 0.0;

      // 5. Patient Entry + Posture Kinematics
      const targetErect = isErect && !isBoreScan ? 1 : 0;
      erectBlend = THREE.MathUtils.damp(erectBlend, targetErect, 6.5, delta);

      if (patientEnterAnimRef.current > 0) {
        patientEnterAnimRef.current = Math.max(
          0,
          patientEnterAnimRef.current - delta * 1.4
        );
      }

      const arcLift = Math.sin(erectBlend * Math.PI) * 0.36;
      const lyingY =
        posture === 'TABLE_LEFT_LAT' || posture === 'TABLE_RIGHT_LAT'
          ? 1.14
          : 1.09;
      const standingY = 0.96;

      const enterOffsetZ = patientEnterAnimRef.current * 0.85;
      const anchorGoalX = THREE.MathUtils.lerp(
        slidingTableGroup.position.x,
        ERECT_PATIENT_X,
        erectBlend
      );
      const anchorGoalY =
        THREE.MathUtils.lerp(lyingY, standingY, erectBlend) + arcLift;
      const anchorGoalZ =
        THREE.MathUtils.lerp(0, ERECT_Z, erectBlend) + enterOffsetZ;

      patientWorldAnchor.position.set(anchorGoalX, anchorGoalY, anchorGoalZ);
      patientWorldAnchor.rotation.z = THREE.MathUtils.lerp(
        Math.PI / 2,
        0,
        erectBlend
      );

      const patientBodyYaw = getTargetBodyYaw(isBoreScan ? 'SUPINE' : posture);
      patientLocalBody.rotation.y = dampAngle(
        patientLocalBody.rotation.y,
        patientBodyYaw,
        7.5,
        delta
      );

      const isErectLat =
        posture === 'ERECT_LEFT_LAT' || posture === 'ERECT_RIGHT_LAT';
      const isTableLat =
        posture === 'TABLE_LEFT_LAT' || posture === 'TABLE_RIGHT_LAT';

      pHeadGroup.rotation.y = THREE.MathUtils.damp(
        pHeadGroup.rotation.y,
        posture === 'PRONE' ? 0.5 : 0,
        7,
        delta
      );

      const armGoalX = isErectLat ? -2.05 : posture === 'ERECT_PA' ? -0.45 : 0;
      const armGoalZ = posture === 'ERECT_PA' ? 0.16 : 0.06;
      armGroups.forEach((arm, idx) => {
        const sideSign = idx === 0 ? 1 : -1;
        arm.rotation.x = THREE.MathUtils.damp(arm.rotation.x, armGoalX, 7, delta);
        arm.rotation.z = THREE.MathUtils.damp(
          arm.rotation.z,
          sideSign * armGoalZ,
          7,
          delta
        );
      });

      const hipFlex = isTableLat ? -0.34 : 0;
      const kneeFlex = isTableLat ? 0.56 : 0;
      thighPivots.forEach((hip) => {
        hip.rotation.x = THREE.MathUtils.damp(hip.rotation.x, hipFlex, 7, delta);
      });
      kneePivots.forEach((knee) => {
        knee.rotation.x = THREE.MathUtils.damp(
          knee.rotation.x,
          kneeFlex,
          7,
          delta
        );
      });

      const breathAmp = patientPreppedRef.current ? 0.002 : 0.013;
      pChest.position.z = 0.01 + Math.sin(elapsed * 2.4) * breathAmp;

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

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
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
            alt="غرفة الأشعة"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-80"
          />
        </div>
      )}

      {/* Contextual 3D Interaction Hover Prompt (No backdrop-blur over WebGL) */}
      {hoveredLabel && (
        <div className="pointer-events-none fixed sm:absolute top-24 left-1/2 -translate-x-1/2 z-20 rounded-lg bg-[#080F1B]/95 border border-cyan-500/70 px-4 py-2 text-xs font-bold text-cyan-200 shadow-lg whitespace-nowrap">
          {hoveredLabel}
        </div>
      )}
    </div>
  );
};
