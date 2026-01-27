# react-three-eris — Missing & Future Extensions

This document outlines what is **intentionally missing** from react-three-eris today, what a “full” game engine typically includes, and which future extensions could fit the project’s scope without overreaching.

---

## Positioning

react-three-eris is best understood as a **runtime kernel**, not a full game engine.

It focuses on:
- time and ordering
- fixed-step simulation
- physics-authoritative execution
- clean boundaries between simulation, physics, rendering, and React

It intentionally **delegates** rendering, UI, and tooling to the surrounding ecosystem (React + Three).

---

## What a “Full” Game Engine Usually Includes

Compared to traditional engines, react-three-eris does **not** currently provide the following categories.

### 1. Runtime & Simulation Infrastructure

Typical engines also include:
- entity lifecycle management (spawn, despawn, pooling)
- scene / level loading & unloading
- save/load systems with versioned migrations
- job system / worker scheduler for parallel tasks
- deterministic replay & rollback tooling
- profiling, tracing, and runtime diagnostics

react-three-eris currently focuses only on **execution order and stepping**, not lifecycle or tooling.

---

### 2. Rendering Ownership

Full engines usually manage:
- render pipeline orchestration (passes, ordering, forward/deferred)
- postprocessing graphs
- culling and LOD systems
- batching and instancing infrastructure
- shader/material variant management
- lighting probes and bake pipelines

react-three-eris intentionally does **not** own rendering.
Three.js already provides a mature renderer, and React Three Fiber already provides scene composition.

---

### 3. Physics Feature Layer

Beyond stepping a physics world, engines often add:
- collision layer/mask authoring and policies
- unified query APIs (raycast, shapecast, overlap)
- trigger enter/stay/exit event systems
- higher-level character controller behaviors
- network-friendly physics state extraction

react-three-eris currently provides a boundary for physics stepping, not a full physics feature suite.

---

### 4. Content Pipeline & Tooling

This is the largest missing area compared to a full engine:
- asset import pipelines (GLTF variants, texture compression, LOD generation)
- editor tooling (scene editors, gizmos, inspectors)
- prefab/blueprint systems
- build pipelines (platform targets, bundling, patching)
- in-world debugging and live property editing

These are deliberately out of scope.

---

## Scene Graph Ownership: A Deliberate Non-Goal

react-three-eris **should not own the scene graph**.

Reasons:
- React already provides declarative scene construction and lifecycle
- Three.js scene graph is a rendering detail, not simulation state
- Owning the graph would conflict with React’s reconciliation and suspense model

Instead, react-three-eris should:
- maintain stable entity IDs and runtime state
- map entity state → Three object references during renderApply
- treat React as the *authoring* layer and eris as the *runtime* layer

---

## Recommended Future Extensions (Good Fits)

These additions align well with the current philosophy and add “engine feel” without scope explosion.

### World & Scene Management
- logical “worlds” or “levels”
- controlled load/unload boundaries
- save/load hooks

### Input Abstraction
- action/axis mapping
- rebinding support
- multi-device input normalization

### Networking Module
- command buffer abstraction
- tick synchronization
- snapshot & delta compression
- client/server role separation

### Debug & Diagnostics
- pause / resume / step-one-tick
- fixed-step accumulator inspection
- entity & system inspectors
- in-engine debug HUD

### Asset Registry (Lightweight)
- logical asset IDs
- loader integration (GLTF, textures)
- reference counting & disposal hooks

---

## High-Risk / Likely Out-of-Scope Extensions

These areas tend to balloon complexity and conflict with the ecosystem:

- full render pipeline ownership
- editor / scene graph UI
- prefab or visual scripting systems
- custom shader graph editors
- competing UI frameworks
- full asset import pipelines

---

## Recommended Framing

react-three-eris should present itself as:

> A physics-authoritative runtime kernel for React Three Fiber applications.

It owns:
- execution order
- time
- simulation phases
- physics stepping
- integration boundaries

It does **not** attempt to replace:
- Three.js
- React
- asset pipelines
- editors or tooling

---

## Summary

react-three-eris intentionally leaves many “engine” features unimplemented.

This is a strength, not a weakness.

By focusing on:
- correctness
- ordering
- determinism-ready structure
- composability

…it enables advanced game architectures while remaining small, understandable, and future-proof.
