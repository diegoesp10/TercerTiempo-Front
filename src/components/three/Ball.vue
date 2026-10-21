<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue';
import { useLoop } from '@tresjs/core';
import type { Mesh } from 'three';
import { createBallTexture } from '@/three/ballTexture';

const props = withDefaults(defineProps<{ spin?: number; float?: number; radius?: number }>(), { spin: 0.35, float: 0.12, radius: 1 });

const texture = createBallTexture();
const mesh = shallowRef<Mesh | null>(null);

// Giro continuo con una ligera oscilación vertical y un cabeceo, como un balón flotando.
const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const ball = mesh.value;
  if (!ball) return;
  ball.rotation.y = elapsed * props.spin;
  ball.rotation.x = Math.sin(elapsed * 0.6) * 0.18 + 0.35;
  ball.position.y = Math.sin(elapsed * 1.4) * props.float;
});

onBeforeUnmount(() => texture.dispose());
</script>

<template>
  <TresMesh ref="mesh" cast-shadow>
    <TresSphereGeometry :args="[radius, 96, 96]" />
    <TresMeshStandardMaterial :map="texture" :roughness="0.42" :metalness="0.08" />
  </TresMesh>
</template>
