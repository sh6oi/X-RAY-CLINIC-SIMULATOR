import type {
  BodyRegion,
  Modality,
  PatientPosture,
  ProjectionType,
} from '../types/radiology';

interface RenderRadiographParams {
  region: BodyRegion;
  modality: Modality;
  projection: ProjectionType;
  posture: PatientPosture;
  patientSeed: string;
}

const radiographCache = new Map<string, string>();

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function addFilmGrainAndVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  isBoreModality: boolean
) {
  // Subtle diagnostic vignette
  const vig = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    w * 0.24,
    w * 0.5,
    h * 0.5,
    w * 0.72
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, isBoreModality ? 'rgba(0,0,0,0.85)' : 'rgba(2,5,10,0.58)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Fast deterministic quantum mottle speckles
  let s = seed ^ 0x9e3779b9;
  ctx.fillStyle = 'rgba(220, 235, 250, 0.035)';
  for (let i = 0; i < 650; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const x = (s & 1023) % w;
    const y = ((s >>> 10) & 1023) % h;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
}

function boneGradient(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha = 0.88
): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, `rgba(218, 229, 242, ${alpha})`);
  g.addColorStop(0.5, `rgba(182, 198, 218, ${alpha * 0.88})`);
  g.addColorStop(1, `rgba(214, 226, 240, ${alpha})`);
  return g;
}

function drawVertebraBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tilt = 0,
  spinousDir: -1 | 0 | 1 = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  // Spinous process for lateral view
  if (spinousDir !== 0) {
    ctx.fillStyle = 'rgba(185, 200, 218, 0.62)';
    ctx.beginPath();
    ctx.moveTo(spinousDir * (w * 0.42), -h * 0.12);
    ctx.lineTo(spinousDir * (w * 1.15), h * 0.15);
    ctx.lineTo(spinousDir * (w * 1.05), h * 0.42);
    ctx.lineTo(spinousDir * (w * 0.4), h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 244, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Trabecular interior
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, 'rgba(225, 236, 248, 0.88)');
  g.addColorStop(0.22, 'rgba(165, 182, 204, 0.68)');
  g.addColorStop(0.78, 'rgba(165, 182, 204, 0.68)');
  g.addColorStop(1, 'rgba(225, 236, 248, 0.88)');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240, 247, 255, 0.82)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.restore();
}

function drawChestRadiograph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projection: ProjectionType,
  posture: PatientPosture
) {
  const cx = w * 0.5;
  const isLateral = projection === 'LATERAL' || posture.includes('_LAT');
  const isOblique =
    projection === 'OBLIQUE' ||
    posture.includes('RAO') ||
    posture.includes('LAO') ||
    posture.includes('RPO') ||
    posture.includes('LPO');
  const isAP =
    projection === 'AP' || posture === 'ERECT_AP' || posture === 'SUPINE';
  const isErect = posture.startsWith('ERECT_');

  if (isLateral) {
    // TRUE LATERAL CHEST RADIOGRAPH (unmistakable side profile)
    const facingLeft = posture.includes('LEFT') ? 1 : -1;
    ctx.save();
    if (facingLeft < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Soft-tissue thoracic silhouette (anterior chest left, spine right)
    const bodyGrad = ctx.createRadialGradient(
      w * 0.48,
      h * 0.5,
      60,
      w * 0.5,
      h * 0.5,
      w * 0.45
    );
    bodyGrad.addColorStop(0, 'rgba(55, 72, 92, 0.52)');
    bodyGrad.addColorStop(1, 'rgba(10, 16, 24, 0.1)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.54, w * 0.29, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark aerated retrosternal + lung space
    const lungGrad = ctx.createRadialGradient(
      w * 0.45,
      h * 0.46,
      20,
      w * 0.45,
      h * 0.48,
      w * 0.25
    );
    lungGrad.addColorStop(0, 'rgba(4, 8, 14, 0.92)');
    lungGrad.addColorStop(0.75, 'rgba(12, 20, 30, 0.78)');
    lungGrad.addColorStop(1, 'rgba(35, 48, 64, 0.35)');
    ctx.fillStyle = lungGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.31, h * 0.22);
    ctx.quadraticCurveTo(w * 0.22, h * 0.48, w * 0.25, h * 0.72);
    ctx.quadraticCurveTo(w * 0.46, h * 0.66, w * 0.66, h * 0.79);
    ctx.lineTo(w * 0.66, h * 0.22);
    ctx.closePath();
    ctx.fill();

    // Thoracic spine posteriorly (T1..T12)
    for (let i = 0; i < 11; i++) {
      const vy = h * (0.21 + i * 0.056);
      const vx = w * (0.64 + Math.sin(i * 0.28) * 0.025);
      drawVertebraBlock(ctx, vx, vy, 30 + i * 0.7, 25, 0.05, 1);
    }

    // Sternum anteriorly (manubrium + gladiolus)
    ctx.strokeStyle = 'rgba(220, 232, 245, 0.85)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.29, h * 0.25);
    ctx.lineTo(w * 0.24, h * 0.62);
    ctx.stroke();

    // Lateral sweeping posterior ribs
    ctx.strokeStyle = 'rgba(185, 202, 222, 0.35)';
    ctx.lineWidth = 7;
    for (let r = 0; r < 9; r++) {
      const ry = h * (0.24 + r * 0.058);
      ctx.beginPath();
      ctx.moveTo(w * 0.65, ry);
      ctx.bezierCurveTo(
        w * 0.52,
        ry + 12,
        w * 0.36,
        ry + 36,
        w * 0.25,
        ry + 52
      );
      ctx.stroke();
    }

    // Anterior heart silhouette (resting against lower sternum)
    const heartGrad = ctx.createRadialGradient(
      w * 0.34,
      h * 0.58,
      12,
      w * 0.34,
      h * 0.58,
      w * 0.14
    );
    heartGrad.addColorStop(0, 'rgba(195, 210, 226, 0.72)');
    heartGrad.addColorStop(1, 'rgba(130, 148, 168, 0.0)');
    ctx.fillStyle = heartGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.34, h * 0.58, w * 0.11, h * 0.14, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Tracheal radiolucent column + raised humeral arms at top
    ctx.strokeStyle = 'rgba(4, 8, 12, 0.78)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.08);
    ctx.lineTo(w * 0.47, h * 0.4);
    ctx.stroke();

    // Bilateral overlapping hemidiaphragm domes sweeping to deep posterior costophrenic angles
    ctx.strokeStyle = 'rgba(220, 232, 244, 0.85)';
    ctx.lineWidth = 3.2;
    [0, 1].forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(w * 0.24, h * (0.69 + d * 0.025));
      ctx.quadraticCurveTo(
        w * 0.44,
        h * (0.62 + d * 0.028),
        w * 0.65,
        h * (0.78 + d * 0.022)
      );
      ctx.stroke();
    });

    // Subdiaphragmatic denser abdomen
    const abdGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    abdGrad.addColorStop(0, 'rgba(150, 168, 188, 0.58)');
    abdGrad.addColorStop(1, 'rgba(175, 192, 210, 0.82)');
    ctx.fillStyle = abdGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.23, h * 0.72);
    ctx.quadraticCurveTo(w * 0.45, h * 0.65, w * 0.68, h * 0.8);
    ctx.lineTo(w * 0.76, h);
    ctx.lineTo(w * 0.21, h);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    return;
  }

  if (isOblique) {
    // 45° OBLIQUE CHEST (RAO / LAO / RPO / LPO): Spine shifted off-center, wide ribs on one side
    const shiftRight = posture.includes('RAO') || posture.includes('LPO');
    ctx.save();
    if (!shiftRight) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Soft-tissue oblique thorax contour
    ctx.fillStyle = 'rgba(40, 56, 74, 0.55)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.54, w * 0.37, h * 0.38, -0.04, 0, Math.PI * 2);
    ctx.fill();

    // Elongated wide lung field (left/open side) + narrow compressed side
    ctx.fillStyle = 'rgba(6, 11, 18, 0.88)';
    ctx.beginPath();
    ctx.ellipse(w * 0.37, h * 0.49, w * 0.22, h * 0.29, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.71, h * 0.49, w * 0.11, h * 0.26, -0.06, 0, Math.PI * 2);
    ctx.fill();

    // Eccentric vertebral column at x = 0.61w
    for (let i = 0; i < 12; i++) {
      drawVertebraBlock(
        ctx,
        w * 0.61,
        h * (0.16 + i * 0.055),
        34,
        24,
        0.04
      );
    }

    // Widely splayed oblique rib arches on open side
    ctx.strokeStyle = 'rgba(210, 224, 240, 0.62)';
    ctx.lineWidth = 7;
    for (let r = 0; r < 9; r++) {
      const ry = h * (0.2 + r * 0.06);
      ctx.beginPath();
      ctx.moveTo(w * 0.61, ry);
      ctx.bezierCurveTo(
        w * 0.34,
        ry - 14,
        w * 0.14,
        ry + 24,
        w * 0.22,
        ry + 62
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w * 0.61, ry);
      ctx.bezierCurveTo(
        w * 0.77,
        ry - 6,
        w * 0.85,
        ry + 20,
        w * 0.79,
        ry + 44
      );
      ctx.stroke();
    }

    // Asymmetric oblique clavicle
    ctx.strokeStyle = 'rgba(232, 242, 252, 0.86)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(w * 0.56, h * 0.24);
    ctx.quadraticCurveTo(w * 0.38, h * 0.19, w * 0.2, h * 0.26);
    ctx.stroke();

    // Shifted cardiac silhouette
    ctx.fillStyle = 'rgba(182, 200, 220, 0.65)';
    ctx.beginPath();
    ctx.ellipse(w * 0.49, h * 0.58, w * 0.11, h * 0.15, 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  // FRONTAL CHEST (PA vs AP): Distinct clavicles, scapulae & cardiac magnification!
  // Soft tissue torso
  ctx.fillStyle = 'rgba(42, 58, 76, 0.48)';
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.08);
  ctx.lineTo(w * 0.64, h * 0.08);
  ctx.quadraticCurveTo(w * 0.88, h * 0.24, w * 0.86, h * 0.92);
  ctx.lineTo(w * 0.14, h * 0.92);
  ctx.quadraticCurveTo(w * 0.12, h * 0.24, w * 0.36, h * 0.08);
  ctx.fill();

  // Aerated dark bilateral lung fields
  [-1, 1].forEach((side) => {
    const lx = cx + side * w * 0.17;
    const lg = ctx.createRadialGradient(lx, h * 0.46, 15, lx, h * 0.48, w * 0.22);
    lg.addColorStop(0, 'rgba(4, 8, 14, 0.94)');
    lg.addColorStop(0.75, 'rgba(10, 18, 28, 0.84)');
    lg.addColorStop(1, 'rgba(32, 46, 62, 0.35)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.04, h * 0.18);
    ctx.bezierCurveTo(
      cx + side * w * 0.25,
      h * 0.15,
      cx + side * w * 0.36,
      h * 0.45,
      cx + side * w * 0.34,
      h * 0.74
    );
    ctx.quadraticCurveTo(
      cx + side * w * 0.18,
      h * 0.69,
      cx + side * w * 0.05,
      h * 0.71
    );
    ctx.closePath();
    ctx.fill();

    // Subtle bronchovascular markings radiating from hilum
    ctx.strokeStyle = 'rgba(155, 178, 202, 0.22)';
    ctx.lineWidth = 2;
    for (let v = 0; v < 6; v++) {
      const ang = -0.7 + v * 0.32;
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.08, h * 0.46);
      ctx.quadraticCurveTo(
        cx + side * (w * 0.18),
        h * (0.46 + Math.sin(ang) * 0.14),
        cx + side * (w * 0.28),
        h * (0.46 + Math.sin(ang) * 0.24)
      );
      ctx.stroke();
    }
  });

  // Posterior horizontal ribs + fainter downward-sloping anterior ribs
  for (let r = 0; r < 9; r++) {
    const ry = h * (0.19 + r * 0.056);
    const span = w * (0.18 + Math.sin((r / 8) * Math.PI * 0.82) * 0.17);
    ctx.strokeStyle = 'rgba(205, 220, 236, 0.56)';
    ctx.lineWidth = 7.5;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(cx + side * 12, ry);
      ctx.quadraticCurveTo(
        cx + side * span * 0.72,
        ry - 14,
        cx + side * span,
        ry + 24
      );
      ctx.stroke();

      // Anterior rib continuation
      ctx.strokeStyle = 'rgba(185, 202, 222, 0.28)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx + side * span, ry + 24);
      ctx.quadraticCurveTo(
        cx + side * span * 0.55,
        ry + 55,
        cx + side * 38,
        ry + 68
      );
      ctx.stroke();
    });
  }

  // Spine + Mediastinum + Cardiac Silhouette (wider in AP than PA!)
  const cardioScale = isAP ? 1.18 : 1.0;
  ctx.fillStyle = 'rgba(182, 198, 218, 0.74)';
  ctx.beginPath();
  ctx.rect(cx - 28, h * 0.15, 56, h * 0.58);
  ctx.fill();

  // Heart shadow (left ventricle pointing to viewer's right in standard PA/AP DICOM)
  const heartGrad = ctx.createRadialGradient(
    cx + 42 * cardioScale,
    h * 0.58,
    18,
    cx + 38 * cardioScale,
    h * 0.58,
    92 * cardioScale
  );
  heartGrad.addColorStop(0, 'rgba(210, 224, 240, 0.85)');
  heartGrad.addColorStop(0.75, 'rgba(175, 194, 214, 0.58)');
  heartGrad.addColorStop(1, 'rgba(140, 160, 180, 0)');
  ctx.fillStyle = heartGrad;
  ctx.beginPath();
  ctx.ellipse(
    cx + 42 * cardioScale,
    h * 0.59,
    72 * cardioScale,
    94,
    -0.28,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Vertebral bodies faintly visible behind mediastinum
  for (let i = 0; i < 10; i++) {
    drawVertebraBlock(ctx, cx, h * (0.18 + i * 0.056), 36, 26, 0);
  }

  // Clavicles: AP projects higher & straighter; PA angles down nicely
  ctx.strokeStyle = 'rgba(234, 242, 252, 0.9)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const innerY = isAP ? h * 0.21 : h * 0.245;
    const outerY = isAP ? h * 0.195 : h * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx + side * 18, innerY);
    ctx.quadraticCurveTo(
      cx + side * w * 0.14,
      innerY - 14,
      cx + side * w * 0.28,
      outerY
    );
    ctx.stroke();

    // Scapulae: retracted outward in PA, slightly overlapping lung margins in AP
    const scapX = isAP ? cx + side * w * 0.28 : cx + side * w * 0.35;
    ctx.fillStyle = 'rgba(185, 200, 220, 0.24)';
    ctx.beginPath();
    ctx.moveTo(scapX, h * 0.23);
    ctx.lineTo(scapX + side * 46, h * 0.26);
    ctx.lineTo(scapX + side * 12, h * 0.44);
    ctx.closePath();
    ctx.fill();
  });

  // Tracheal lucency
  ctx.strokeStyle = 'rgba(5, 10, 16, 0.78)';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.08);
  ctx.lineTo(cx, h * 0.34);
  ctx.stroke();

  // Diaphragmatic domes + Subdiaphragmatic liver/stomach (gastric air bubble if Erect!)
  const subGrad = ctx.createLinearGradient(0, h * 0.68, 0, h);
  subGrad.addColorStop(0, 'rgba(162, 180, 200, 0.68)');
  subGrad.addColorStop(1, 'rgba(195, 210, 226, 0.88)');
  ctx.fillStyle = subGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.76);
  ctx.quadraticCurveTo(w * 0.3, h * 0.64, cx, h * 0.7);
  ctx.quadraticCurveTo(w * 0.7, h * 0.66, w * 0.86, h * 0.77);
  ctx.lineTo(w * 0.86, h);
  ctx.lineTo(w * 0.14, h);
  ctx.closePath();
  ctx.fill();

  if (isErect) {
    // Erect Gastric Air-Fluid Bubble beneath left hemidiaphragm!
    ctx.fillStyle = 'rgba(8, 14, 22, 0.72)';
    ctx.beginPath();
    ctx.arc(w * 0.69, h * 0.77, 24, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSkullRadiograph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projection: ProjectionType,
  posture: PatientPosture
) {
  const cx = w * 0.5;
  const isLateral = projection === 'LATERAL' || posture.includes('_LAT');
  const isOblique =
    projection === 'OBLIQUE' ||
    posture.includes('LAO') ||
    posture.includes('RAO') ||
    posture.includes('RPO') ||
    posture.includes('LPO');

  if (isLateral) {
    // TRUE LATERAL SKULL (Calvarium, Sella Turcica, Sinuses, Mandible Ramus)
    const faceLeft = posture.includes('RIGHT') ? 1 : -1;
    ctx.save();
    if (faceLeft < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Calvarium outer & inner tables
    const vaultGrad = ctx.createRadialGradient(
      w * 0.54,
      h * 0.36,
      30,
      w * 0.52,
      h * 0.38,
      w * 0.34
    );
    vaultGrad.addColorStop(0, 'rgba(95, 115, 138, 0.42)');
    vaultGrad.addColorStop(0.75, 'rgba(150, 170, 192, 0.56)');
    vaultGrad.addColorStop(1, 'rgba(220, 232, 245, 0.85)');

    ctx.fillStyle = vaultGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.53, h * 0.37, w * 0.31, h * 0.25, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 245, 255, 0.9)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Inner table subtle rim
    ctx.strokeStyle = 'rgba(195, 212, 232, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(w * 0.53, h * 0.37, w * 0.285, h * 0.228, -0.08, 0, Math.PI * 2);
    ctx.stroke();

    // Frontal Sinus (anterior dark aerated cavity)
    ctx.fillStyle = 'rgba(8, 14, 22, 0.8)';
    ctx.beginPath();
    ctx.ellipse(w * 0.24, h * 0.38, 13, 22, -0.18, 0, Math.PI * 2);
    ctx.fill();

    // Sella Turcica (characteristic J-shaped pituitary fossa at skull base center)
    ctx.strokeStyle = 'rgba(242, 248, 255, 0.94)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.46);
    ctx.lineTo(w * 0.45, h * 0.47);
    ctx.arc(w * 0.47, h * 0.485, 14, Math.PI, 0, true);
    ctx.lineTo(w * 0.51, h * 0.46);
    ctx.stroke();

    // Sphenoid Sinus below Sella + Aerated Mastoid Cells posteriorly
    ctx.fillStyle = 'rgba(12, 20, 30, 0.72)';
    ctx.beginPath();
    ctx.ellipse(w * 0.44, h * 0.52, 22, 14, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Nasal Bone + Maxilla + Hard Palate
    ctx.strokeStyle = 'rgba(225, 236, 248, 0.88)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.23, h * 0.44);
    ctx.lineTo(w * 0.17, h * 0.52);
    ctx.moveTo(w * 0.22, h * 0.61);
    ctx.lineTo(w * 0.42, h * 0.6);
    ctx.stroke();

    // Maxillary sinus lucency
    ctx.fillStyle = 'rgba(10, 16, 25, 0.65)';
    ctx.beginPath();
    ctx.ellipse(w * 0.27, h * 0.55, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Superimposed Teeth & Mandible Ramus + Body
    ctx.fillStyle = boneGradient(ctx, w * 0.2, h * 0.65, w * 0.48, h * 0.76, 0.84);
    ctx.beginPath();
    ctx.moveTo(w * 0.46, h * 0.54);
    ctx.lineTo(w * 0.49, h * 0.72);
    ctx.quadraticCurveTo(w * 0.46, h * 0.78, w * 0.36, h * 0.77);
    ctx.lineTo(w * 0.21, h * 0.75);
    ctx.lineTo(w * 0.21, h * 0.69);
    ctx.lineTo(w * 0.41, h * 0.69);
    ctx.lineTo(w * 0.41, h * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 248, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Teeth row
    ctx.fillStyle = 'rgba(245, 250, 255, 0.92)';
    for (let t = 0; t < 6; t++) {
      ctx.fillRect(w * (0.21 + t * 0.025), h * 0.625, 11, 22);
    }

    // Upper cervical vertebrae (C1-C4 lateral)
    for (let c = 0; c < 4; c++) {
      drawVertebraBlock(ctx, w * 0.54, h * (0.64 + c * 0.068), 32, 24, 0, 1);
    }

    ctx.restore();
    return;
  }

  // FRONTAL / OBLIQUE SKULL
  const obShift = isOblique ? w * 0.08 : 0;
  ctx.fillStyle = 'rgba(130, 148, 170, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx + obShift * 0.25, h * 0.42, w * 0.28, h * 0.31, isOblique ? 0.14 : 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235, 244, 255, 0.92)';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Frontal Sinuses (dark lobulated cavities above bridge of nose)
  ctx.fillStyle = 'rgba(8, 14, 22, 0.76)';
  ctx.beginPath();
  ctx.ellipse(cx - 18 + obShift, h * 0.34, 20, 14, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 18 + obShift, h * 0.34, 20, 14, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Bilateral Orbits (darker eye sockets with bright cortical rims)
  [-1, 1].forEach((side) => {
    const ox = cx + side * w * 0.115 + obShift;
    const oy = h * 0.43;
    const rx = isOblique && side > 0 ? w * 0.062 : w * 0.08;
    ctx.fillStyle = 'rgba(14, 22, 34, 0.78)';
    ctx.beginPath();
    ctx.ellipse(ox, oy, rx, h * 0.068, side * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 244, 255, 0.85)';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Maxillary Sinus below each orbit
    ctx.fillStyle = 'rgba(10, 18, 28, 0.68)';
    ctx.beginPath();
    ctx.moveTo(ox - side * 14, h * 0.51);
    ctx.lineTo(ox + side * 26, h * 0.52);
    ctx.lineTo(ox + side * 10, h * 0.61);
    ctx.closePath();
    ctx.fill();
  });

  // Nasal septum + piriform aperture
  ctx.fillStyle = 'rgba(6, 12, 20, 0.82)';
  ctx.beginPath();
  ctx.moveTo(cx + obShift, h * 0.44);
  ctx.lineTo(cx - 20 + obShift, h * 0.58);
  ctx.lineTo(cx + 20 + obShift, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(240, 248, 255, 0.9)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx + obShift, h * 0.43);
  ctx.lineTo(cx + obShift, h * 0.58);
  ctx.stroke();

  // Mandibular U-arch & Teeth
  ctx.strokeStyle = 'rgba(230, 240, 252, 0.88)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.22, h * 0.56);
  ctx.lineTo(cx - w * 0.17, h * 0.76);
  ctx.quadraticCurveTo(cx + obShift * 0.4, h * 0.85, cx + w * 0.17, h * 0.76);
  ctx.lineTo(cx + w * 0.22, h * 0.56);
  ctx.stroke();

  // Upper & lower teeth
  ctx.fillStyle = 'rgba(245, 250, 255, 0.92)';
  for (let t = -4; t <= 4; t++) {
    ctx.fillRect(cx + obShift * 0.5 + t * 14 - 5, h * 0.64, 9, 26);
  }
}

function drawCervicalRadiograph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projection: ProjectionType,
  posture: PatientPosture
) {
  const cx = w * 0.5;
  const isLateral = projection === 'LATERAL' || posture.includes('_LAT');
  const isOblique =
    projection === 'OBLIQUE' ||
    posture.includes('LAO') ||
    posture.includes('RAO') ||
    posture.includes('RPO') ||
    posture.includes('LPO');

  if (isLateral) {
    // LATERAL CERVICAL SPINE (C1–C7 Lordosis + Airway + Mandible/Occiput)
    // Soft tissue neck profile
    ctx.fillStyle = 'rgba(48, 66, 84, 0.42)';
    ctx.fillRect(w * 0.34, h * 0.1, w * 0.38, h * 0.82);

    // Base of skull / Occiput & Mandible top left
    ctx.fillStyle = boneGradient(ctx, w * 0.15, h * 0.12, w * 0.52, h * 0.26, 0.78);
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.16);
    ctx.lineTo(w * 0.42, h * 0.14);
    ctx.lineTo(w * 0.34, h * 0.32);
    ctx.lineTo(w * 0.14, h * 0.26);
    ctx.closePath();
    ctx.fill();

    // Anterior dark radiolucent tracheal/pharyngeal air column!
    ctx.fillStyle = 'rgba(4, 9, 15, 0.88)';
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.2);
    ctx.quadraticCurveTo(w * 0.42, h * 0.55, w * 0.39, h * 0.9);
    ctx.lineTo(w * 0.44, h * 0.9);
    ctx.quadraticCurveTo(w * 0.46, h * 0.55, w * 0.42, h * 0.2);
    ctx.closePath();
    ctx.fill();

    // C1..C7 vertebral bodies with smooth lordotic curve + spinous processes posteriorly
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const vx = w * 0.53 - Math.sin(t * Math.PI) * 16;
      const vy = h * (0.2 + i * 0.095);
      const bw = i === 0 ? 44 : 42 + i * 2.5;
      const bh = i === 0 ? 22 : 34;
      drawVertebraBlock(ctx, vx, vy, bw, bh, (t - 0.5) * 0.18, 1);
    }
    return;
  }

  if (isOblique) {
    // 45° OBLIQUE CERVICAL SPINE (Neural Intervertebral Foramina!)
    ctx.fillStyle = 'rgba(46, 62, 80, 0.44)';
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.52, w * 0.24, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 7; i++) {
      const vy = h * (0.2 + i * 0.095);
      drawVertebraBlock(ctx, cx - 18, vy, 58, 34, 0.08);
      // Bright oval intervertebral neural foramina
      ctx.fillStyle = 'rgba(8, 14, 24, 0.85)';
      ctx.beginPath();
      ctx.ellipse(cx + 26, vy + 16, 13, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232, 242, 252, 0.82)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    return;
  }

  // AP CERVICAL SPINE (Stacked C3–C7 + Uncinate Processes + Trachea)
  ctx.fillStyle = 'rgba(46, 62, 80, 0.44)';
  ctx.fillRect(w * 0.28, h * 0.1, w * 0.44, h * 0.84);

  // Dark central trachea
  ctx.fillStyle = 'rgba(6, 12, 20, 0.72)';
  ctx.fillRect(cx - 18, h * 0.25, 36, h * 0.65);

  for (let i = 0; i < 6; i++) {
    const vy = h * (0.26 + i * 0.092);
    drawVertebraBlock(ctx, cx, vy, 74 + i * 4, 38, 0);
    // Midline spinous process teardrop
    ctx.strokeStyle = 'rgba(235, 244, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, vy + 8, 6, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // First ribs & clavicles framing base
  ctx.strokeStyle = 'rgba(220, 234, 248, 0.8)';
  ctx.lineWidth = 10;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx + side * 24, h * 0.82);
    ctx.quadraticCurveTo(cx + side * 90, h * 0.77, cx + side * 160, h * 0.84);
    ctx.stroke();
  });
}

function drawLumbarRadiograph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projection: ProjectionType,
  posture: PatientPosture
) {
  const cx = w * 0.5;
  const isLateral = projection === 'LATERAL' || posture.includes('_LAT');
  const isOblique =
    projection === 'OBLIQUE' ||
    posture.includes('RPO') ||
    posture.includes('LPO') ||
    posture.includes('RAO') ||
    posture.includes('LAO');

  if (isLateral) {
    // TRUE LATERAL LUMBAR SPINE (L1–L5 + L5-S1 Lumbosacral Sacrum)
    const dir = posture.includes('RIGHT') ? -1 : 1;
    ctx.save();
    if (dir < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = 'rgba(46, 62, 82, 0.42)';
    ctx.fillRect(w * 0.2, h * 0.06, w * 0.6, h * 0.88);

    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const vx = w * 0.46 - Math.sin(t * Math.PI) * 20;
      const vy = h * (0.16 + i * 0.125);
      drawVertebraBlock(ctx, vx, vy, 72 + i * 3, 52, (t - 0.5) * 0.22, 1);
    }

    // Angled Sacrum at bottom
    ctx.fillStyle = boneGradient(ctx, w * 0.45, h * 0.74, w * 0.62, h * 0.9, 0.85);
    ctx.beginPath();
    ctx.moveTo(w * 0.43, h * 0.75);
    ctx.lineTo(w * 0.56, h * 0.78);
    ctx.quadraticCurveTo(w * 0.66, h * 0.88, w * 0.62, h * 0.94);
    ctx.lineTo(w * 0.5, h * 0.92);
    ctx.closePath();
    ctx.fill();

    // Subtle bowel gas shadows anteriorly
    ctx.fillStyle = 'rgba(7, 13, 21, 0.55)';
    [
      [0.29, 0.34, 24, 18],
      [0.27, 0.58, 30, 22],
    ].forEach(([gx, gy, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(w * gx, h * gy, rx, ry, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
    return;
  }

  if (isOblique) {
    // 45° OBLIQUE LUMBAR SPINE ("Scotty Dog" silhouette!)
    const flip = posture.includes('LPO') || posture.includes('LAO');
    ctx.save();
    if (flip) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = 'rgba(42, 58, 78, 0.42)';
    ctx.fillRect(w * 0.22, h * 0.06, w * 0.56, h * 0.88);

    for (let i = 0; i < 5; i++) {
      const vy = h * (0.17 + i * 0.13);
      drawVertebraBlock(ctx, cx - 12, vy, 86, 56, 0.05);
      // "Scotty Dog" ear/neck/eye silhouette inside vertebral body
      ctx.strokeStyle = 'rgba(240, 248, 255, 0.9)';
      ctx.lineWidth = 3;
      // Eye (pedicle)
      ctx.beginPath();
      ctx.ellipse(cx + 12, vy - 4, 8, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Ear (superior articular process) + Nose (transverse process)
      ctx.beginPath();
      ctx.moveTo(cx + 22, vy - 24);
      ctx.lineTo(cx + 22, vy + 4);
      ctx.lineTo(cx + 46, vy + 4);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // AP / PA LUMBAR SPINE (Vertebrae L1-L5, Owl-Eye Pedicles, Transverse Processes, Iliac Crests)
  ctx.fillStyle = 'rgba(42, 58, 78, 0.42)';
  ctx.fillRect(w * 0.2, h * 0.06, w * 0.6, h * 0.88);

  // Iliac crests bottom left/right
  ctx.fillStyle = boneGradient(ctx, w * 0.14, h * 0.7, w * 0.35, h * 0.9, 0.58);
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx + side * 52, h * 0.72);
    ctx.quadraticCurveTo(cx + side * 165, h * 0.67, cx + side * 185, h * 0.92);
    ctx.lineTo(cx + side * 48, h * 0.92);
    ctx.closePath();
    ctx.fill();
  });

  for (let i = 0; i < 5; i++) {
    const vy = h * (0.17 + i * 0.125);
    const bw = 96 + i * 5;
    // Transverse processes
    ctx.strokeStyle = 'rgba(218, 232, 248, 0.78)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.86, vy - 6);
    ctx.lineTo(cx + bw * 0.86, vy - 6);
    ctx.stroke();

    drawVertebraBlock(ctx, cx, vy, bw, 56, 0);

    // Pedicle "Owl Eyes" + Midline Spinous Tear Drop
    ctx.strokeStyle = 'rgba(242, 249, 255, 0.88)';
    ctx.lineWidth = 2.8;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(cx + side * (bw * 0.3), vy - 8, 9, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.ellipse(cx, vy + 10, 6, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPelvisRadiograph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projection: ProjectionType,
  posture: PatientPosture
) {
  const cx = w * 0.5;
  const isLateral = projection === 'LATERAL' || posture.includes('_LAT');
  const isOblique =
    projection === 'OBLIQUE' ||
    posture.includes('RPO') ||
    posture.includes('LPO') ||
    posture.includes('RAO') ||
    posture.includes('LAO');

  if (isLateral) {
    // LATERAL PELVIS / SACRUM & SUPERIMPOSED FEMORAL HEADS
    ctx.fillStyle = 'rgba(42, 58, 76, 0.46)';
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.54, w * 0.34, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Curved Sacrum posteriorly
    ctx.strokeStyle = 'rgba(232, 242, 252, 0.88)';
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.24);
    ctx.quadraticCurveTo(w * 0.72, h * 0.44, w * 0.58, h * 0.64);
    ctx.stroke();

    // Superimposed iliac wings + femoral heads & shafts
    ctx.fillStyle = boneGradient(ctx, w * 0.32, h * 0.25, w * 0.65, h * 0.7, 0.62);
    ctx.beginPath();
    ctx.ellipse(w * 0.47, h * 0.44, w * 0.16, h * 0.22, -0.22, 0, Math.PI * 2);
    ctx.fill();

    [0, 1].forEach((f) => {
      ctx.fillStyle = 'rgba(218, 232, 248, 0.72)';
      ctx.beginPath();
      ctx.arc(w * (0.43 + f * 0.04), h * (0.62 + f * 0.02), 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 250, 255, 0.88)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillRect(w * (0.39 + f * 0.04), h * 0.66, 36, h * 0.3);
    });
    return;
  }

  // AP / PA / OBLIQUE PELVIS (Asymmetric iliac fan if Oblique!)
  const obAsym = isOblique ? 0.24 : 0;
  ctx.fillStyle = 'rgba(42, 58, 76, 0.42)';
  ctx.fillRect(w * 0.08, h * 0.14, w * 0.84, h * 0.76);

  // Sacrum + L5 centrally
  drawVertebraBlock(ctx, cx + obAsym * 35, h * 0.22, 86, 48, 0);
  ctx.fillStyle = boneGradient(ctx, cx - 60, h * 0.28, cx + 60, h * 0.52, 0.75);
  ctx.beginPath();
  ctx.moveTo(cx - 56 + obAsym * 35, h * 0.28);
  ctx.lineTo(cx + 56 + obAsym * 35, h * 0.28);
  ctx.lineTo(cx + 24 + obAsym * 35, h * 0.53);
  ctx.lineTo(cx - 24 + obAsym * 35, h * 0.53);
  ctx.closePath();
  ctx.fill();

  [-1, 1].forEach((side) => {
    const scaleX = isOblique ? (side < 0 ? 1.24 : 0.74) : 1;
    // Iliac wing
    ctx.fillStyle = boneGradient(ctx, cx, h * 0.2, cx + side * 220, h * 0.55, 0.78);
    ctx.beginPath();
    ctx.moveTo(cx + side * 46, h * 0.34);
    ctx.bezierCurveTo(
      cx + side * 145 * scaleX,
      h * 0.16,
      cx + side * 245 * scaleX,
      h * 0.28,
      cx + side * 175 * scaleX,
      h * 0.55
    );
    ctx.lineTo(cx + side * 95 * scaleX, h * 0.62);
    ctx.lineTo(cx + side * 40, h * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(236, 245, 255, 0.86)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Obturator foramen (dark oval surrounded by pubic/ischial ring)
    ctx.fillStyle = 'rgba(10, 18, 28, 0.76)';
    ctx.beginPath();
    ctx.ellipse(
      cx + side * 66 * scaleX,
      h * 0.62,
      28 * (isOblique && side > 0 ? 1.3 : 1),
      22,
      side * 0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 242, 252, 0.85)';
    ctx.lineWidth = 9;
    ctx.stroke();

    // Femoral head + neck + trochanters + shaft
    const fx = cx + side * 142 * scaleX;
    const fy = h * 0.58;
    ctx.fillStyle = boneGradient(ctx, fx - 30, fy, fx + 40, fy + 160, 0.9);
    ctx.beginPath();
    ctx.arc(fx, fy, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 250, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Femoral neck -> shaft
    ctx.beginPath();
    ctx.moveTo(fx + side * 10, fy - 14);
    ctx.lineTo(fx + side * 66, fy + 28);
    ctx.lineTo(fx + side * 72, h * 0.94);
    ctx.lineTo(fx + side * 28, h * 0.94);
    ctx.lineTo(fx + side * 22, fy + 48);
    ctx.lineTo(fx - side * 8, fy + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

function drawHandRadiograph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projection: ProjectionType,
  posture: PatientPosture
) {
  const cx = w * 0.5;
  const isLateral = projection === 'LATERAL' || posture.includes('_LAT');
  const isOblique =
    projection === 'OBLIQUE' ||
    posture.includes('LPO') ||
    posture.includes('RPO');

  if (isLateral) {
    // TRUE LATERAL HAND & WRIST (Superimposed Metacarpals + Extended Thumb)
    ctx.fillStyle = 'rgba(38, 52, 68, 0.45)';
    ctx.beginPath();
    ctx.roundRect(cx - 65, h * 0.16, 130, h * 0.78, 55);
    ctx.fill();

    // Superimposed Radius & Ulna at wrist base
    ctx.fillStyle = boneGradient(ctx, cx - 26, h * 0.72, cx + 26, h * 0.96, 0.9);
    ctx.fillRect(cx - 26, h * 0.72, 52, h * 0.24);
    ctx.strokeStyle = 'rgba(242, 248, 255, 0.88)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - 26, h * 0.72, 52, h * 0.24);

    // Stacked carpal block
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.66, 28, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Overlapping metacarpals & digits rising vertically
    [0, 1, 2].forEach((m) => {
      ctx.fillStyle = 'rgba(220, 232, 245, 0.78)';
      ctx.beginPath();
      ctx.roundRect(cx - 16 + m * 5, h * 0.44, 20, h * 0.2, 6);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.roundRect(cx - 13 + m * 4, h * 0.16, 16, h * 0.26, 6);
      ctx.fill();
      ctx.stroke();
    });

    // Separated Thumb projecting left anteriorly!
    ctx.save();
    ctx.translate(cx - 18, h * 0.62);
    ctx.rotate(-0.56);
    ctx.fillStyle = boneGradient(ctx, -10, -90, 10, 0, 0.92);
    ctx.beginPath();
    ctx.roundRect(-9, -62, 18, 62, 6);
    ctx.roundRect(-7, -112, 14, 46, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // PA vs 45° OBLIQUE HAND
  const spread = isOblique ? 0.68 : 1.0;
  const tiltAll = isOblique ? -0.14 : 0;
  ctx.save();
  ctx.translate(cx, h * 0.56);
  ctx.rotate(tiltAll);
  ctx.translate(-cx, -h * 0.56);

  // Soft-tissue hand glove silhouette
  ctx.fillStyle = 'rgba(38, 52, 68, 0.42)';
  ctx.beginPath();
  ctx.roundRect(cx - 120 * spread, h * 0.14, 240 * spread, h * 0.78, 80);
  ctx.fill();

  // Distal Radius & Ulna
  ctx.fillStyle = boneGradient(ctx, cx - 60, h * 0.74, cx + 60, h * 0.96, 0.9);
  ctx.strokeStyle = 'rgba(242, 248, 255, 0.88)';
  ctx.lineWidth = 2.2;
  // Radius (thumb side left)
  ctx.beginPath();
  ctx.roundRect(cx - 64 * spread, h * 0.74, 52, h * 0.22, 8);
  ctx.fill();
  ctx.stroke();
  // Ulna
  ctx.beginPath();
  ctx.roundRect(cx + 8 * spread, h * 0.75, 34, h * 0.21, 8);
  ctx.fill();
  ctx.stroke();

  // 8 Carpal bones cluster
  [-32, -8, 16, 36].forEach((kx, idx) => {
    [0, 1].forEach((row) => {
      ctx.beginPath();
      ctx.ellipse(
        cx + kx * spread,
        h * (0.68 - row * 0.042 + (idx % 2) * 0.008),
        13,
        11,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
    });
  });

  // 5 Digits: Thumb + 4 Fingers
  const digits = [
    {xOff: -68, ang: -0.58, lenM: 58, lenP: [38, 26]}, // Thumb
    {xOff: -34, ang: -0.12, lenM: 76, lenP: [48, 32, 22]},
    {xOff: -8, ang: 0.0, lenM: 84, lenP: [54, 36, 24]},
    {xOff: 18, ang: 0.1, lenM: 78, lenP: [48, 32, 22]},
    {xOff: 42, ang: 0.22, lenM: 68, lenP: [38, 26, 18]},
  ];
  digits.forEach((d) => {
    ctx.save();
    ctx.translate(cx + d.xOff * spread, h * 0.61);
    ctx.rotate(d.ang * spread);
    // Metacarpal
    ctx.beginPath();
    ctx.roundRect(-7, -d.lenM, 14, d.lenM, 5);
    ctx.fill();
    ctx.stroke();

    let curY = -d.lenM - 5;
    d.lenP.forEach((plen, pIdx) => {
      ctx.beginPath();
      ctx.roundRect(-6 + pIdx * 0.8, curY - plen, 12 - pIdx * 1.6, plen, 4);
      ctx.fill();
      ctx.stroke();
      curY -= plen + 4;
    });
    ctx.restore();
  });

  ctx.restore();
}

function drawKneeRadiograph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projection: ProjectionType,
  posture: PatientPosture
) {
  const cx = w * 0.5;
  const isLateral = projection === 'LATERAL' || posture.includes('_LAT');
  const isOblique =
    projection === 'OBLIQUE' ||
    posture.includes('RPO') ||
    posture.includes('LPO');
  const isWeightBearing = posture === 'ERECT_AP';

  if (isLateral) {
    // TRUE LATERAL KNEE (Anterior Patella clearly visible + Flexed Joint!)
    ctx.fillStyle = 'rgba(42, 58, 76, 0.44)';
    ctx.fillRect(w * 0.22, h * 0.06, w * 0.56, h * 0.88);

    // Distal Femur coming down with slight flexion angle
    ctx.fillStyle = boneGradient(ctx, w * 0.34, h * 0.08, w * 0.58, h * 0.48, 0.9);
    ctx.strokeStyle = 'rgba(244, 250, 255, 0.88)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.08);
    ctx.lineTo(w * 0.58, h * 0.08);
    ctx.lineTo(w * 0.58, h * 0.36);
    ctx.bezierCurveTo(w * 0.65, h * 0.44, w * 0.6, h * 0.54, w * 0.47, h * 0.53);
    ctx.bezierCurveTo(w * 0.35, h * 0.52, w * 0.36, h * 0.42, w * 0.42, h * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // PATELLA projected cleanly anteriorly on left with clear patellofemoral space!
    ctx.beginPath();
    ctx.moveTo(w * 0.27, h * 0.33);
    ctx.quadraticCurveTo(w * 0.34, h * 0.32, w * 0.34, h * 0.42);
    ctx.quadraticCurveTo(w * 0.31, h * 0.49, w * 0.26, h * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Proximal Tibia + Tibial Tuberosity + Posterior Fibular Head
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.55);
    ctx.lineTo(w * 0.61, h * 0.56);
    ctx.lineTo(w * 0.58, h * 0.92);
    ctx.lineTo(w * 0.41, h * 0.92);
    ctx.lineTo(w * 0.38, h * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fibula overlapping posterior tibia
    ctx.fillStyle = 'rgba(210, 224, 240, 0.78)';
    ctx.beginPath();
    ctx.ellipse(w * 0.6, h * 0.63, 18, 22, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(w * 0.57, h * 0.66, 16, h * 0.26);
    return;
  }

  // AP / OBLIQUE KNEE
  const gap = isWeightBearing ? 6 : 14;
  const fibOffset = isOblique ? 115 : 88;
  ctx.fillStyle = 'rgba(42, 58, 76, 0.44)';
  ctx.fillRect(w * 0.22, h * 0.06, w * 0.56, h * 0.88);

  // Distal Femur + Condyles
  ctx.fillStyle = boneGradient(ctx, cx - 80, h * 0.08, cx + 80, h * 0.5, 0.88);
  ctx.strokeStyle = 'rgba(242, 249, 255, 0.88)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - 50, h * 0.08);
  ctx.lineTo(cx + 50, h * 0.08);
  ctx.lineTo(cx + 56, h * 0.32);
  ctx.quadraticCurveTo(cx + 95, h * 0.4, cx + 82, h * 0.49);
  ctx.lineTo(cx + 16, h * 0.49);
  ctx.quadraticCurveTo(cx, h * 0.45, cx - 16, h * 0.49);
  ctx.lineTo(cx - 82, h * 0.49);
  ctx.quadraticCurveTo(cx - 95, h * 0.4, cx - 56, h * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Patella outline projected over femoral condyles (shifted slightly if Oblique!)
  ctx.fillStyle = 'rgba(235, 244, 255, 0.32)';
  ctx.beginPath();
  ctx.ellipse(
    cx + (isOblique ? 28 : 0),
    h * 0.36,
    40,
    46,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  // Tibial Plateau + Tibial Shaft
  const ty = h * 0.49 + gap;
  ctx.fillStyle = boneGradient(ctx, cx - 80, ty, cx + 80, h * 0.94, 0.9);
  ctx.beginPath();
  ctx.moveTo(cx - 82, ty);
  ctx.lineTo(cx - 10, ty - 6);
  ctx.lineTo(cx + 10, ty - 6);
  ctx.lineTo(cx + 82, ty);
  ctx.lineTo(cx + 50, h * 0.72);
  ctx.lineTo(cx + 46, h * 0.94);
  ctx.lineTo(cx - 46, h * 0.94);
  ctx.lineTo(cx - 50, h * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fibular Head & Shaft laterally (projected clearly free in Oblique!)
  ctx.fillStyle = boneGradient(ctx, cx + fibOffset - 16, ty + 18, cx + fibOffset + 18, h * 0.94, 0.85);
  ctx.beginPath();
  ctx.ellipse(cx + fibOffset, ty + 32, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(cx + fibOffset - 10, ty + 48, 18, h * 0.36);
}

function drawCtAxialSlice(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  region: BodyRegion
) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  ctx.fillStyle = '#020509';
  ctx.fillRect(0, 0, w, h);

  // Circular CT Gantry Reconstruction Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.44, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#070E18';
  ctx.fillRect(0, 0, w, h);

  if (region === 'head') {
    // Axial Brain CT: Bright hyperdense skull ring + brain parenchyma + dark CSF ventricles
    ctx.strokeStyle = 'rgba(244, 249, 255, 0.96)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.28, h * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(128, 142, 160, 0.62)';
    ctx.fill();

    // Falx cerebri midline + Butterfly Lateral Ventricles
    ctx.strokeStyle = 'rgba(210, 222, 236, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.32);
    ctx.lineTo(cx, cy + h * 0.32);
    ctx.stroke();

    ctx.fillStyle = 'rgba(12, 20, 30, 0.86)';
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.ellipse(cx + s * 24, cy - 12, 14, 48, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Axial Chest / Pelvis / Cervical CT Slice
    ctx.fillStyle = 'rgba(110, 128, 148, 0.46)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, w * 0.37, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    if (region === 'chest') {
      // Dark bilateral lungs + pulmonary vessels + central heart + descending aorta + posterior vertebra
      [-1, 1].forEach((s) => {
        ctx.fillStyle = 'rgba(5, 10, 18, 0.92)';
        ctx.beginPath();
        ctx.ellipse(cx + s * 98, cy + 6, 86, 110, s * -0.15, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(195, 210, 226, 0.82)';
      ctx.beginPath();
      ctx.ellipse(cx + 22, cy - 36, 56, 62, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bright posterior vertebral body + rib cross sections
    ctx.fillStyle = 'rgba(242, 248, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy + 115, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - 135, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMriSagittalSlice(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  region: BodyRegion
) {
  const cx = w * 0.5;
  ctx.fillStyle = '#050911';
  ctx.fillRect(0, 0, w, h);

  if (region === 'knee') {
    // T2 Sagittal Knee MRI (bright articular cartilage, dark meniscal triangles, ACL!)
    ctx.fillStyle = 'rgba(110, 125, 142, 0.58)';
    ctx.fillRect(w * 0.22, h * 0.08, w * 0.56, h * 0.84);

    // Femoral condyle (dark cortical rim + bright marrow)
    ctx.fillStyle = 'rgba(182, 196, 212, 0.82)';
    ctx.strokeStyle = 'rgba(15, 22, 32, 0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(w * 0.34, h * 0.1, w * 0.3, h * 0.38, 42);
    ctx.fill();
    ctx.stroke();

    // Tibia
    ctx.beginPath();
    ctx.roundRect(w * 0.35, h * 0.54, w * 0.28, h * 0.36, 20);
    ctx.fill();
    ctx.stroke();

    // Patella
    ctx.beginPath();
    ctx.ellipse(w * 0.27, h * 0.38, 22, 36, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark bow-tie Meniscus + oblique ACL band
    ctx.fillStyle = 'rgba(12, 16, 24, 0.95)';
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.49);
    ctx.lineTo(w * 0.45, h * 0.52);
    ctx.lineTo(w * 0.36, h * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.49);
    ctx.lineTo(w * 0.53, h * 0.52);
    ctx.lineTo(w * 0.62, h * 0.54);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (region === 'head') {
    // Sagittal Brain MRI: Corpus callosum, Cerebellum, Brainstem, Bright CSF
    ctx.fillStyle = 'rgba(145, 160, 178, 0.72)';
    ctx.beginPath();
    ctx.ellipse(cx + 12, h * 0.42, w * 0.31, h * 0.27, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Bright C-shaped Corpus Callosum
    ctx.strokeStyle = 'rgba(235, 244, 255, 0.92)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 10, h * 0.44, 82, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Brainstem descending + Cerebellum
    ctx.fillStyle = 'rgba(185, 200, 218, 0.78)';
    ctx.fillRect(cx - 10, h * 0.46, 32, h * 0.34);
    ctx.beginPath();
    ctx.ellipse(cx + 68, h * 0.58, 56, 44, -0.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Sagittal Lumbar / Cervical Spine MRI: Bright T2 CSF canal + bright discs!
  ctx.fillStyle = 'rgba(92, 108, 126, 0.48)';
  ctx.fillRect(w * 0.24, h * 0.06, w * 0.52, h * 0.88);

  // Hyperintense bright T2 CSF column + dark spinal cord inside
  ctx.fillStyle = 'rgba(232, 244, 255, 0.92)';
  ctx.fillRect(w * 0.52, h * 0.1, 30, h * 0.78);
  ctx.fillStyle = 'rgba(52, 66, 84, 0.9)';
  ctx.fillRect(w * 0.555, h * 0.1, 11, h * 0.74);

  for (let i = 0; i < 6; i++) {
    const vy = h * (0.14 + i * 0.125);
    ctx.fillStyle = 'rgba(135, 152, 172, 0.82)';
    ctx.beginPath();
    ctx.roundRect(w * 0.36, vy, 74, 48, 6);
    ctx.fill();
    // Bright hydrated intervertebral disc
    if (i < 5) {
      ctx.fillStyle = 'rgba(218, 236, 252, 0.88)';
      ctx.beginPath();
      ctx.roundRect(w * 0.37, vy + 52, 70, 14, 5);
      ctx.fill();
    }
  }
}

export function renderProceduralRadiograph({
  region,
  modality,
  projection,
  posture,
  patientSeed,
}: RenderRadiographParams): string {
  const key = `${region}|${modality}|${projection}|${posture}|${patientSeed}`;
  const cached = radiographCache.get(key);
  if (cached) return cached;

  const size = 640;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Dark exposed diagnostic plate background
  const bgGrad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    40,
    size * 0.5,
    size * 0.5,
    size * 0.68
  );
  bgGrad.addColorStop(0, '#0a121d');
  bgGrad.addColorStop(1, '#03060c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  if (modality === 'CT' || projection === 'AXIAL') {
    drawCtAxialSlice(ctx, size, size, region);
  } else if (modality === 'MRI' || projection === 'SAGITTAL') {
    drawMriSagittalSlice(ctx, size, size, region);
  } else {
    switch (region) {
      case 'chest':
        drawChestRadiograph(ctx, size, size, projection, posture);
        break;
      case 'head':
        drawSkullRadiograph(ctx, size, size, projection, posture);
        break;
      case 'cervical':
        drawCervicalRadiograph(ctx, size, size, projection, posture);
        break;
      case 'lumbar':
        drawLumbarRadiograph(ctx, size, size, projection, posture);
        break;
      case 'pelvis':
        drawPelvisRadiograph(ctx, size, size, projection, posture);
        break;
      case 'hand':
        drawHandRadiograph(ctx, size, size, projection, posture);
        break;
      case 'knee':
        drawKneeRadiograph(ctx, size, size, projection, posture);
        break;
    }
  }

  addFilmGrainAndVignette(
    ctx,
    size,
    size,
    hashSeed(key),
    modality !== 'XRAY'
  );

  // Authentic radiographic lead-letter anatomical marker embedded on plate corner
  ctx.save();
  ctx.fillStyle = 'rgba(226, 240, 255, 0.88)';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'right';
  const sideMarker = posture.includes('LEFT') || posture.includes('LAO') || posture.includes('LPO')
    ? 'L'
    : 'R';
  const projBadge =
    modality === 'CT'
      ? 'AXIAL CT'
      : modality === 'MRI'
        ? 'SAG T2'
        : projection === 'LATERAL'
          ? 'LAT'
          : projection === 'OBLIQUE'
            ? posture.replace('ERECT_', '').replace('TABLE_', '')
            : projection;
  ctx.fillText(`${sideMarker}  ${projBadge}`, size - 24, 42);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  // Limit cache size cleanly
  if (radiographCache.size > 48) {
    const firstKey = radiographCache.keys().next().value;
    if (firstKey) radiographCache.delete(firstKey);
  }
  radiographCache.set(key, dataUrl);
  return dataUrl;
}
