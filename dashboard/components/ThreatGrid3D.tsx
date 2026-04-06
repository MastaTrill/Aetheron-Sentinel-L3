"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function Cube() {
  return (
    <mesh rotation={[0.4, 0.6, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="red" emissive="darkred" emissiveIntensity={1} />
    </mesh>
  );
}

export default function ThreatGrid3D() {
  return (
    <div className="panel h-64">
      <Canvas camera={{ position: [4, 4, 4] }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} />
        <Cube />
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
}
