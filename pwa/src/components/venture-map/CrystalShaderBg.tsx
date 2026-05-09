"use client";

/**
 * CrystalShaderBg — Sabo Sugi "Crystal of Data" の raymarching shader を
 * cyberspace ページの背景レイヤーとして組み込む。
 *
 * オリジナル: https://codepen.io/sabosugi/full/LEbGORv
 * (まさが見せてくれた参照、ライセンス: 個人作品。AMD OS 内部利用なので
 *  shader ロジックを移植、color uniform は AMD ブランドカラー寄りに微調整)
 *
 * 実装メモ:
 * - OrthographicCamera + 全画面 Plane に shader を適用 (raymarching)
 * - 130 iter で octahedron SDF (|x|+|y|+|z|-size) を marching
 * - 内部に 3D noise (NOISE_TRANSFORM 行列) で乱流的色を蓄積
 * - edge thickness で骨格 (フレームライン) を強調
 * - 自動回転 (uRotationSpeed) のみ。Mouse 操作は前景 OrbitControls に譲る
 *   (背景 canvas は pointer-events: none)
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec2 uMouseRot;
  uniform float uFractalSpeed;
  uniform float uRotationSpeed;
  uniform float uPlasmaDensity;
  uniform float uShapeStretch;
  uniform float uShapeSize;
  uniform vec3 uColorPlasma;
  uniform vec3 uColorFrame;

  const mat3 NOISE_TRANSFORM = mat3(
      -0.21,  1.33,  0.52,
       0.72,  0.52,  1.67,
       0.77,  0.49,  0.18
  );

  float calculateNoise(vec3 pos) {
      vec3 a = cos(NOISE_TRANSFORM * pos);
      vec3 b = sin(17.1 * pos * NOISE_TRANSFORM);
      return dot(a, b);
  }

  mat2 getRotationMatrix(float theta) {
      float c = cos(theta);
      float s = sin(theta);
      return mat2(c, -s, s, c);
  }

  vec2 normalizeCoordinates(vec2 fragCoord, vec2 resolution) {
      return (fragCoord * 2.0 - resolution.xy) / resolution.y;
  }

  void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      vec2 uv = normalizeCoordinates(fragCoord, iResolution.xy);
      uv *= 0.8;

      vec4 colorAccumulator = vec4(0.0);
      float totalDistance = 0.0;
      float globalTime = iTime;

      for (int i = 0; i < 130; i++) {
          float iterationFloat = float(i);
          vec3 p = vec3(uv * totalDistance, totalDistance);
          vec3 localPos = p;

          localPos.z -= 6.0;
          localPos.y -= sin(globalTime * 1.0) * 0.1;

          localPos.xz *= getRotationMatrix(globalTime * 0.5 * uRotationSpeed + uMouseRot.x);
          localPos.yz *= getRotationMatrix(sin(globalTime * 0.3) * 0.1 + uMouseRot.y);

          vec3 shapePos = localPos;
          shapePos.y *= uShapeStretch;

          float bounds = ((abs(shapePos.x) + abs(shapePos.y) + abs(shapePos.z)) - uShapeSize) * 0.45;

          if (bounds > 0.005) {
              totalDistance += bounds;
          } else {
              vec3 noisePos = localPos;
              float timeOffset = globalTime * 0.1 * uFractalSpeed;
              float wavePerturbation = sin(noisePos.z * 3.1 + noisePos.x * 1.7 + timeOffset) * -0.076 + -0.011;

              float noiseHighFreq = calculateNoise(noisePos / 1.0 + globalTime * 0.2 * uFractalSpeed);
              float noiseLowFreq = calculateNoise(noisePos / 4.5 + globalTime * 0.13 * uFractalSpeed) * 0.8;

              float noiseVal = wavePerturbation + abs(noiseHighFreq - noiseLowFreq);
              float surfaceDist = abs(bounds);
              float edgeDist = min(abs(shapePos.x), min(abs(shapePos.y), abs(shapePos.z)));

              float edgeProximity = smoothstep(0.15, 0.0, edgeDist) * smoothstep(0.25, 0.0, surfaceDist);
              float stepWithNoise = 0.02 + noiseVal * uPlasmaDensity;
              float currentStep = mix(stepWithNoise, 0.015, edgeProximity);

              float lineThickness = 0.04;
              float lineIntensity = smoothstep(lineThickness, 0.01, edgeDist) * smoothstep(0.02, -0.1, surfaceDist);

              vec4 frameColor = vec4(uColorFrame, 1.0) * lineIntensity * 12.1;
              vec4 baseColor = vec4(-3.0, 0.80, 2.8, 1.1);
              vec4 glowColor = baseColor * cos(iterationFloat * 0.034) + iterationFloat * 0.017;
              glowColor.rgb *= uColorPlasma;

              colorAccumulator += (glowColor + frameColor) / (currentStep * currentStep * 150000.0);
              totalDistance += currentStep;
          }
          if (totalDistance > 12.0) break;
      }
      gl_FragColor = colorAccumulator;
  }
`;

interface Props {
  /** 自動回転速度 (default 0.3) */
  rotationSpeed?: number;
  /** 形状の上下伸縮 (default 0.65) */
  shapeStretch?: number;
  /** 形状サイズ (default 2.7) */
  shapeSize?: number;
  /** plasma 密度 (default 0.05) */
  plasmaDensity?: number;
  /** plasma の色 (CSS 色 or hex 数値) */
  plasmaColor?: string | number;
  /** フレームライン色 */
  frameColor?: string | number;
  /** 全体の濃度 (CSS opacity, 0-1)。前景 PJ 視認性確保のため (default 0.85) */
  opacity?: number;
}

export function CrystalShaderBg({
  rotationSpeed = 0.3,
  shapeStretch = 0.65,
  shapeSize = 2.7,
  plasmaDensity = 0.05,
  plasmaColor = 0xffffff,
  frameColor = 0xeef1ff,
  opacity = 0.85,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();

    const uniforms: Record<string, { value: unknown }> = {
      iTime: { value: 0 },
      iResolution: {
        value: new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
      },
      uMouseRot: { value: new THREE.Vector2(0, 0) },
      uFractalSpeed: { value: 1.0 },
      uRotationSpeed: { value: rotationSpeed },
      uPlasmaDensity: { value: plasmaDensity },
      uShapeStretch: { value: shapeStretch },
      uShapeSize: { value: shapeSize },
      uColorPlasma: { value: new THREE.Color(plasmaColor) },
      uColorFrame: { value: new THREE.Color(frameColor) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const clock = new THREE.Clock();
    let raf = 0;
    let alive = true;

    const resize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      (uniforms.iResolution.value as THREE.Vector2).set(w, h);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // 緩やかな揺らぎ: マウス回転は使わないが、低周波 sin で微妙にカメラ揺れ
    const animate = () => {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      (uniforms.iTime.value as number) = t;
      const mr = uniforms.uMouseRot.value as THREE.Vector2;
      mr.x = Math.sin(t * 0.18) * 0.4;
      mr.y = Math.cos(t * 0.13) * 0.2;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [rotationSpeed, shapeStretch, shapeSize, plasmaDensity, plasmaColor, frameColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        opacity,
      }}
    />
  );
}
