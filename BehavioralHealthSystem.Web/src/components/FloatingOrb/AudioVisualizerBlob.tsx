import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './FloatingOrb.css';

interface AudioVisualizerBlobProps {
  isAgentSpeaking: boolean;
  agentId: string;
}

const vertexShader = `
  uniform float u_time;
  uniform float u_frequency;

  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x) {
    return mod289(((x*34.0)+10.0)*x);
  }

  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
  }

  float pnoise(vec3 P, vec3 rep) {
    vec3 Pi0 = mod(floor(P), rep);
    vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }

  void main() {
    float noise = 4.0 * pnoise(position + u_time, vec3(10.0));
    float displacement = (u_frequency / 30.0) * (noise / 10.0);
    vec3 newPosition = position + normal * displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  uniform float u_red;
  uniform float u_green;
  uniform float u_blue;

  void main() {
    gl_FragColor = vec4(vec3(u_red, u_green, u_blue), 1.0);
  }
`;

export const AudioVisualizerBlob: React.FC<AudioVisualizerBlobProps> = ({
  isAgentSpeaking,
  agentId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const blobRef = useRef<THREE.Mesh | null>(null);
  const uniformsRef = useRef<any>(null);
  const clockRef = useRef(new THREE.Clock());
  const animationIdRef = useRef<number | null>(null);
  const frequencyRef = useRef(0);
  const targetFrequencyRef = useRef(0);
  const isAgentSpeakingRef = useRef(isAgentSpeaking);

  const getAgentColor = (id: string): { r: number; g: number; b: number } => {
    switch (id.toLowerCase()) {
      case 'tars': return { r: 0.29, g: 0.89, b: 0.29 }; // #4ae24a (green)
      case 'matron': return { r: 0.89, g: 0.29, b: 0.56 }; // #e24a90
      case 'phq2': return { r: 0.29, g: 0.89, b: 0.89 }; // #4ae2e2
      case 'phq9': return { r: 0.64, g: 0.29, b: 0.89 }; // #a24ae2
      case 'vocalist': return { r: 0.89, g: 0.64, b: 0.29 }; // #e2a24a
      default: return { r: 0.29, g: 0.89, b: 0.29 };
    }
  };

  // Keep ref in sync with prop
  useEffect(() => {
    isAgentSpeakingRef.current = isAgentSpeaking;
  }, [isAgentSpeaking]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 25);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Uniforms
    const color = getAgentColor(agentId);
    const uniforms = {
      u_time: { value: 0.0 },
      u_frequency: { value: 0.0 },
      u_red: { value: color.r },
      u_green: { value: color.g },
      u_blue: { value: color.b }
    };
    uniformsRef.current = uniforms;

    // Material with shaders
    const material = new THREE.ShaderMaterial({
      wireframe: true,
      uniforms,
      vertexShader,
      fragmentShader
    });

    // Geometry and mesh
    const geometry = new THREE.IcosahedronGeometry(12, 30);
    const blob = new THREE.Mesh(geometry, material);
    scene.add(blob);
    blobRef.current = blob;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xaaaaaa, 0.8);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 0.9);
    spotLight.position.set(-10, 40, 20);
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      const isSpeaking = isAgentSpeakingRef.current;

      // Update target frequency
      if (isSpeaking) {
        targetFrequencyRef.current = 80;
      } else {
        targetFrequencyRef.current = 0;
      }

      // Smooth frequency interpolation - slower decay for longer animation
      frequencyRef.current += (targetFrequencyRef.current - frequencyRef.current) * 0.005;

      // Update uniforms
      uniforms.u_time.value = clockRef.current.getElapsedTime();
      uniforms.u_frequency.value = frequencyRef.current;

      // Rotate blob
      blob.rotation.x += 0.0003;
      blob.rotation.y += 0.0005;

      // Render
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [agentId]);

  return (
    <div className="floating-orb-container" ref={containerRef} data-agent={agentId} />
  );
};

export default AudioVisualizerBlob;
