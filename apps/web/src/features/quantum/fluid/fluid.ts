// @ts-nocheck
// Target: TypeScript (strict)
/* eslint-disable @typescript-eslint/no-explicit-any */

// Numeric type helpers
function u8(n: number): number { return n & 0xFF; }
function u16(n: number): number { return n & 0xFFFF; }
function u32(n: number): number { return n >>> 0; }
function i8(n: number): number { return (n << 24) >> 24; }
function i16(n: number): number { return (n << 16) >> 16; }
function i32(n: number): number { return n | 0; }
function f32(n: number): number { return Math.fround(n); }

type KainNode = Node | DocumentFragment;

export type FluidClass =
  | { type: 'FluidClass'; tag: 'Air' }
  | { type: 'FluidClass'; tag: 'Water' }
  | { type: 'FluidClass'; tag: 'Smoke' }
  | { type: 'FluidClass'; tag: 'Plasma' }
  | { type: 'FluidClass'; tag: 'Lava' }
  | { type: 'FluidClass'; tag: 'Oil' }
  | { type: 'FluidClass'; tag: 'Gel' }
  | { type: 'FluidClass'; tag: 'Foam' }
  | { type: 'FluidClass'; tag: 'Dust' }
  | { type: 'FluidClass'; tag: 'Cloud' }
  | { type: 'FluidClass'; tag: 'IonizedGas' }
  | { type: 'FluidClass'; tag: 'Superfluid' }
  | { type: 'FluidClass'; tag: 'Granular' }
  | { type: 'FluidClass'; tag: 'Magma' }
  | { type: 'FluidClass'; tag: 'QuantumCondensate' }
  | { type: 'FluidClass'; tag: 'ExoticMatter' }
  | { type: 'FluidClass'; tag: 'DarkFluid' }
  | { type: 'FluidClass'; tag: 'Cryogenic' }
  | { type: 'FluidClass'; tag: 'Biofluid' }
  | { type: 'FluidClass'; tag: 'ReactiveMixture' }
  | { type: 'FluidClass'; tag: 'PolymerSolution' }
  | { type: 'FluidClass'; tag: 'Ferrofluid' }
  | { type: 'FluidClass'; tag: 'NonNewtonian' }
  | { type: 'FluidClass'; tag: 'Viscoelastic' }
  | { type: 'FluidClass'; tag: 'Thixotropic' }
  | { type: 'FluidClass'; tag: 'Rheopectic' }
  | { type: 'FluidClass'; tag: 'ShearThinning' }
  | { type: 'FluidClass'; tag: 'ShearThickening' }
  | { type: 'FluidClass'; tag: 'YieldStress' }
  | { type: 'FluidClass'; tag: 'Microfluid' }
  | { type: 'FluidClass'; tag: 'NanoFluid' }
  | { type: 'FluidClass'; tag: 'AstroPlasma' }
  | { type: 'FluidClass'; tag: 'Hypersonic' }
  | { type: 'FluidClass'; tag: 'HyperSonicJet' }
  | { type: 'FluidClass'; tag: 'MachSteady' }
  | { type: 'FluidClass'; tag: 'MachUnsteady' }
  | { type: 'FluidClass'; tag: 'TurbulentJet' }
  | { type: 'FluidClass'; tag: 'CalmLake' }
  | { type: 'FluidClass'; tag: 'RogueWave' }
  | { type: 'FluidClass'; tag: 'SupersonicShock' }
  | { type: 'FluidClass'; tag: 'SubsonicFlow' }
  | { type: 'FluidClass'; tag: 'TransonicFlow' }
  | { type: 'FluidClass'; tag: 'Compressible' }
  | { type: 'FluidClass'; tag: 'Incompressible' }
  | { type: 'FluidClass'; tag: 'TwoPhase' }
  | { type: 'FluidClass'; tag: 'ThreePhase' }
  | { type: 'FluidClass'; tag: 'Multiphase' }
  | { type: 'FluidClass'; tag: 'Cavitating' }
  | { type: 'FluidClass'; tag: 'DropletMist' }
  | { type: 'FluidClass'; tag: 'Spray' }
  | { type: 'FluidClass'; tag: 'BubbleColumn' }
  | { type: 'FluidClass'; tag: 'Slurry' }
  | { type: 'FluidClass'; tag: 'PoroElastic' }
  | { type: 'FluidClass'; tag: 'Seepage' }
  | { type: 'FluidClass'; tag: 'MHD' }
  | { type: 'FluidClass'; tag: 'QuantumVortex' }
  | { type: 'FluidClass'; tag: 'MagnetizedDust' }
  | { type: 'FluidClass'; tag: 'CosmicRayPlasma' }
  | { type: 'FluidClass'; tag: 'StellarWind' }
  | { type: 'FluidClass'; tag: 'AccretionDisk' }
  | { type: 'FluidClass'; tag: 'InterstellarMedium' }
  | { type: 'FluidClass'; tag: 'PlanetaryAtmosphere' }
  | { type: 'FluidClass'; tag: 'OceanCurrent' }
  | { type: 'FluidClass'; tag: 'EstuaryFlow' }
  | { type: 'FluidClass'; tag: 'RiverRapid' }
  | { type: 'FluidClass'; tag: 'Tsunami' }
  | { type: 'FluidClass'; tag: 'GlacierMelt' }
  | { type: 'FluidClass'; tag: 'IceSheetShear' }
  | { type: 'FluidClass'; tag: 'CryoVolcanic' }
  | { type: 'FluidClass'; tag: 'TitanMethaneSea' }
  | { type: 'FluidClass'; tag: 'VenusSulfuric' }
  | { type: 'FluidClass'; tag: 'JovianJet' }
  | { type: 'FluidClass'; tag: 'SolarProminence' }
  | { type: 'FluidClass'; tag: 'NeutronStarCrust' }
  | { type: 'FluidClass'; tag: 'BlackHoleJet' }
  | { type: 'FluidClass'; tag: 'DysonJet' }
  | { type: 'FluidClass'; tag: 'WarpBubble' }
  | { type: 'FluidClass'; tag: 'ExoticQuantumFoam' }
  | { type: 'FluidClass'; tag: 'FluidClass_MAX' };
export const FluidClass = {
  Air: (): FluidClass => ({ type: 'FluidClass', tag: 'Air' }),
  Water: (): FluidClass => ({ type: 'FluidClass', tag: 'Water' }),
  Smoke: (): FluidClass => ({ type: 'FluidClass', tag: 'Smoke' }),
  Plasma: (): FluidClass => ({ type: 'FluidClass', tag: 'Plasma' }),
  Lava: (): FluidClass => ({ type: 'FluidClass', tag: 'Lava' }),
  Oil: (): FluidClass => ({ type: 'FluidClass', tag: 'Oil' }),
  Gel: (): FluidClass => ({ type: 'FluidClass', tag: 'Gel' }),
  Foam: (): FluidClass => ({ type: 'FluidClass', tag: 'Foam' }),
  Dust: (): FluidClass => ({ type: 'FluidClass', tag: 'Dust' }),
  Cloud: (): FluidClass => ({ type: 'FluidClass', tag: 'Cloud' }),
  IonizedGas: (): FluidClass => ({ type: 'FluidClass', tag: 'IonizedGas' }),
  Superfluid: (): FluidClass => ({ type: 'FluidClass', tag: 'Superfluid' }),
  Granular: (): FluidClass => ({ type: 'FluidClass', tag: 'Granular' }),
  Magma: (): FluidClass => ({ type: 'FluidClass', tag: 'Magma' }),
  QuantumCondensate: (): FluidClass => ({ type: 'FluidClass', tag: 'QuantumCondensate' }),
  ExoticMatter: (): FluidClass => ({ type: 'FluidClass', tag: 'ExoticMatter' }),
  DarkFluid: (): FluidClass => ({ type: 'FluidClass', tag: 'DarkFluid' }),
  Cryogenic: (): FluidClass => ({ type: 'FluidClass', tag: 'Cryogenic' }),
  Biofluid: (): FluidClass => ({ type: 'FluidClass', tag: 'Biofluid' }),
  ReactiveMixture: (): FluidClass => ({ type: 'FluidClass', tag: 'ReactiveMixture' }),
  PolymerSolution: (): FluidClass => ({ type: 'FluidClass', tag: 'PolymerSolution' }),
  Ferrofluid: (): FluidClass => ({ type: 'FluidClass', tag: 'Ferrofluid' }),
  NonNewtonian: (): FluidClass => ({ type: 'FluidClass', tag: 'NonNewtonian' }),
  Viscoelastic: (): FluidClass => ({ type: 'FluidClass', tag: 'Viscoelastic' }),
  Thixotropic: (): FluidClass => ({ type: 'FluidClass', tag: 'Thixotropic' }),
  Rheopectic: (): FluidClass => ({ type: 'FluidClass', tag: 'Rheopectic' }),
  ShearThinning: (): FluidClass => ({ type: 'FluidClass', tag: 'ShearThinning' }),
  ShearThickening: (): FluidClass => ({ type: 'FluidClass', tag: 'ShearThickening' }),
  YieldStress: (): FluidClass => ({ type: 'FluidClass', tag: 'YieldStress' }),
  Microfluid: (): FluidClass => ({ type: 'FluidClass', tag: 'Microfluid' }),
  NanoFluid: (): FluidClass => ({ type: 'FluidClass', tag: 'NanoFluid' }),
  AstroPlasma: (): FluidClass => ({ type: 'FluidClass', tag: 'AstroPlasma' }),
  Hypersonic: (): FluidClass => ({ type: 'FluidClass', tag: 'Hypersonic' }),
  HyperSonicJet: (): FluidClass => ({ type: 'FluidClass', tag: 'HyperSonicJet' }),
  MachSteady: (): FluidClass => ({ type: 'FluidClass', tag: 'MachSteady' }),
  MachUnsteady: (): FluidClass => ({ type: 'FluidClass', tag: 'MachUnsteady' }),
  TurbulentJet: (): FluidClass => ({ type: 'FluidClass', tag: 'TurbulentJet' }),
  CalmLake: (): FluidClass => ({ type: 'FluidClass', tag: 'CalmLake' }),
  RogueWave: (): FluidClass => ({ type: 'FluidClass', tag: 'RogueWave' }),
  SupersonicShock: (): FluidClass => ({ type: 'FluidClass', tag: 'SupersonicShock' }),
  SubsonicFlow: (): FluidClass => ({ type: 'FluidClass', tag: 'SubsonicFlow' }),
  TransonicFlow: (): FluidClass => ({ type: 'FluidClass', tag: 'TransonicFlow' }),
  Compressible: (): FluidClass => ({ type: 'FluidClass', tag: 'Compressible' }),
  Incompressible: (): FluidClass => ({ type: 'FluidClass', tag: 'Incompressible' }),
  TwoPhase: (): FluidClass => ({ type: 'FluidClass', tag: 'TwoPhase' }),
  ThreePhase: (): FluidClass => ({ type: 'FluidClass', tag: 'ThreePhase' }),
  Multiphase: (): FluidClass => ({ type: 'FluidClass', tag: 'Multiphase' }),
  Cavitating: (): FluidClass => ({ type: 'FluidClass', tag: 'Cavitating' }),
  DropletMist: (): FluidClass => ({ type: 'FluidClass', tag: 'DropletMist' }),
  Spray: (): FluidClass => ({ type: 'FluidClass', tag: 'Spray' }),
  BubbleColumn: (): FluidClass => ({ type: 'FluidClass', tag: 'BubbleColumn' }),
  Slurry: (): FluidClass => ({ type: 'FluidClass', tag: 'Slurry' }),
  PoroElastic: (): FluidClass => ({ type: 'FluidClass', tag: 'PoroElastic' }),
  Seepage: (): FluidClass => ({ type: 'FluidClass', tag: 'Seepage' }),
  MHD: (): FluidClass => ({ type: 'FluidClass', tag: 'MHD' }),
  QuantumVortex: (): FluidClass => ({ type: 'FluidClass', tag: 'QuantumVortex' }),
  MagnetizedDust: (): FluidClass => ({ type: 'FluidClass', tag: 'MagnetizedDust' }),
  CosmicRayPlasma: (): FluidClass => ({ type: 'FluidClass', tag: 'CosmicRayPlasma' }),
  StellarWind: (): FluidClass => ({ type: 'FluidClass', tag: 'StellarWind' }),
  AccretionDisk: (): FluidClass => ({ type: 'FluidClass', tag: 'AccretionDisk' }),
  InterstellarMedium: (): FluidClass => ({ type: 'FluidClass', tag: 'InterstellarMedium' }),
  PlanetaryAtmosphere: (): FluidClass => ({ type: 'FluidClass', tag: 'PlanetaryAtmosphere' }),
  OceanCurrent: (): FluidClass => ({ type: 'FluidClass', tag: 'OceanCurrent' }),
  EstuaryFlow: (): FluidClass => ({ type: 'FluidClass', tag: 'EstuaryFlow' }),
  RiverRapid: (): FluidClass => ({ type: 'FluidClass', tag: 'RiverRapid' }),
  Tsunami: (): FluidClass => ({ type: 'FluidClass', tag: 'Tsunami' }),
  GlacierMelt: (): FluidClass => ({ type: 'FluidClass', tag: 'GlacierMelt' }),
  IceSheetShear: (): FluidClass => ({ type: 'FluidClass', tag: 'IceSheetShear' }),
  CryoVolcanic: (): FluidClass => ({ type: 'FluidClass', tag: 'CryoVolcanic' }),
  TitanMethaneSea: (): FluidClass => ({ type: 'FluidClass', tag: 'TitanMethaneSea' }),
  VenusSulfuric: (): FluidClass => ({ type: 'FluidClass', tag: 'VenusSulfuric' }),
  JovianJet: (): FluidClass => ({ type: 'FluidClass', tag: 'JovianJet' }),
  SolarProminence: (): FluidClass => ({ type: 'FluidClass', tag: 'SolarProminence' }),
  NeutronStarCrust: (): FluidClass => ({ type: 'FluidClass', tag: 'NeutronStarCrust' }),
  BlackHoleJet: (): FluidClass => ({ type: 'FluidClass', tag: 'BlackHoleJet' }),
  DysonJet: (): FluidClass => ({ type: 'FluidClass', tag: 'DysonJet' }),
  WarpBubble: (): FluidClass => ({ type: 'FluidClass', tag: 'WarpBubble' }),
  ExoticQuantumFoam: (): FluidClass => ({ type: 'FluidClass', tag: 'ExoticQuantumFoam' }),
  FluidClass_MAX: (): FluidClass => ({ type: 'FluidClass', tag: 'FluidClass_MAX' }),
} as const;

export type SolverFamily =
  | { type: 'SolverFamily'; tag: 'LatticeBoltzmann' }
  | { type: 'SolverFamily'; tag: 'SmoothedParticleHydro' }
  | { type: 'SolverFamily'; tag: 'FiniteVolume' }
  | { type: 'SolverFamily'; tag: 'FiniteElement' }
  | { type: 'SolverFamily'; tag: 'FiniteDifference' }
  | { type: 'SolverFamily'; tag: 'Spectral' }
  | { type: 'SolverFamily'; tag: 'VortexMethod' }
  | { type: 'SolverFamily'; tag: 'MarkerAndCell' }
  | { type: 'SolverFamily'; tag: 'LevelSet' }
  | { type: 'SolverFamily'; tag: 'PhaseField' }
  | { type: 'SolverFamily'; tag: 'ParticleInCell' }
  | { type: 'SolverFamily'; tag: 'MultigridPressure' }
  | { type: 'SolverFamily'; tag: 'FractionalStep' }
  | { type: 'SolverFamily'; tag: 'SemiLagrangian' }
  | { type: 'SolverFamily'; tag: 'FluxLimiter' }
  | { type: 'SolverFamily'; tag: 'DiscontinuousGalerkin' }
  | { type: 'SolverFamily'; tag: 'ImmersedBoundary' }
  | { type: 'SolverFamily'; tag: 'ArbitraryLagrangianEulerian' }
  | { type: 'SolverFamily'; tag: 'HybridGridParticle' }
  | { type: 'SolverFamily'; tag: 'DeepLearningSurrogate' }
  | { type: 'SolverFamily'; tag: 'PhysicsInformedNN' }
  | { type: 'SolverFamily'; tag: 'QuantumLattice' }
  | { type: 'SolverFamily'; tag: 'MagnetoHydro' }
  | { type: 'SolverFamily'; tag: 'RadiativeHydro' }
  | { type: 'SolverFamily'; tag: 'ReactiveFlow' }
  | { type: 'SolverFamily'; tag: 'CombustionLES' }
  | { type: 'SolverFamily'; tag: 'CombustionRANS' }
  | { type: 'SolverFamily'; tag: 'TurbulenceDNS' }
  | { type: 'SolverFamily'; tag: 'TurbulenceLES' }
  | { type: 'SolverFamily'; tag: 'TurbulenceRANS' }
  | { type: 'SolverFamily'; tag: 'GeometricMultigrid' }
  | { type: 'SolverFamily'; tag: 'AlgebraicMultigrid' }
  | { type: 'SolverFamily'; tag: 'MultiscaleWavelet' }
  | { type: 'SolverFamily'; tag: 'MultiphaseLBM' }
  | { type: 'SolverFamily'; tag: 'SPHPressurePoisson' }
  | { type: 'SolverFamily'; tag: 'SPHWeaklyCompressible' }
  | { type: 'SolverFamily'; tag: 'SPHImplicitIncompressible' }
  | { type: 'SolverFamily'; tag: 'PoroElasticFEM' }
  | { type: 'SolverFamily'; tag: 'PoroViscoElasticFEM' }
  | { type: 'SolverFamily'; tag: 'NonNewtonianFEM' }
  | { type: 'SolverFamily'; tag: 'ThinFilm' }
  | { type: 'SolverFamily'; tag: 'ShallowWater' }
  | { type: 'SolverFamily'; tag: 'Boussinesq' }
  | { type: 'SolverFamily'; tag: 'NavierStokesCompressible' }
  | { type: 'SolverFamily'; tag: 'NavierStokesIncompressible' }
  | { type: 'SolverFamily'; tag: 'MagnetoThermalCoupled' }
  | { type: 'SolverFamily'; tag: 'ElectroHydroDynamics' }
  | { type: 'SolverFamily'; tag: 'QuantumHydro' }
  | { type: 'SolverFamily'; tag: 'SolverFamily_MAX' };
export const SolverFamily = {
  LatticeBoltzmann: (): SolverFamily => ({ type: 'SolverFamily', tag: 'LatticeBoltzmann' }),
  SmoothedParticleHydro: (): SolverFamily => ({ type: 'SolverFamily', tag: 'SmoothedParticleHydro' }),
  FiniteVolume: (): SolverFamily => ({ type: 'SolverFamily', tag: 'FiniteVolume' }),
  FiniteElement: (): SolverFamily => ({ type: 'SolverFamily', tag: 'FiniteElement' }),
  FiniteDifference: (): SolverFamily => ({ type: 'SolverFamily', tag: 'FiniteDifference' }),
  Spectral: (): SolverFamily => ({ type: 'SolverFamily', tag: 'Spectral' }),
  VortexMethod: (): SolverFamily => ({ type: 'SolverFamily', tag: 'VortexMethod' }),
  MarkerAndCell: (): SolverFamily => ({ type: 'SolverFamily', tag: 'MarkerAndCell' }),
  LevelSet: (): SolverFamily => ({ type: 'SolverFamily', tag: 'LevelSet' }),
  PhaseField: (): SolverFamily => ({ type: 'SolverFamily', tag: 'PhaseField' }),
  ParticleInCell: (): SolverFamily => ({ type: 'SolverFamily', tag: 'ParticleInCell' }),
  MultigridPressure: (): SolverFamily => ({ type: 'SolverFamily', tag: 'MultigridPressure' }),
  FractionalStep: (): SolverFamily => ({ type: 'SolverFamily', tag: 'FractionalStep' }),
  SemiLagrangian: (): SolverFamily => ({ type: 'SolverFamily', tag: 'SemiLagrangian' }),
  FluxLimiter: (): SolverFamily => ({ type: 'SolverFamily', tag: 'FluxLimiter' }),
  DiscontinuousGalerkin: (): SolverFamily => ({ type: 'SolverFamily', tag: 'DiscontinuousGalerkin' }),
  ImmersedBoundary: (): SolverFamily => ({ type: 'SolverFamily', tag: 'ImmersedBoundary' }),
  ArbitraryLagrangianEulerian: (): SolverFamily => ({ type: 'SolverFamily', tag: 'ArbitraryLagrangianEulerian' }),
  HybridGridParticle: (): SolverFamily => ({ type: 'SolverFamily', tag: 'HybridGridParticle' }),
  DeepLearningSurrogate: (): SolverFamily => ({ type: 'SolverFamily', tag: 'DeepLearningSurrogate' }),
  PhysicsInformedNN: (): SolverFamily => ({ type: 'SolverFamily', tag: 'PhysicsInformedNN' }),
  QuantumLattice: (): SolverFamily => ({ type: 'SolverFamily', tag: 'QuantumLattice' }),
  MagnetoHydro: (): SolverFamily => ({ type: 'SolverFamily', tag: 'MagnetoHydro' }),
  RadiativeHydro: (): SolverFamily => ({ type: 'SolverFamily', tag: 'RadiativeHydro' }),
  ReactiveFlow: (): SolverFamily => ({ type: 'SolverFamily', tag: 'ReactiveFlow' }),
  CombustionLES: (): SolverFamily => ({ type: 'SolverFamily', tag: 'CombustionLES' }),
  CombustionRANS: (): SolverFamily => ({ type: 'SolverFamily', tag: 'CombustionRANS' }),
  TurbulenceDNS: (): SolverFamily => ({ type: 'SolverFamily', tag: 'TurbulenceDNS' }),
  TurbulenceLES: (): SolverFamily => ({ type: 'SolverFamily', tag: 'TurbulenceLES' }),
  TurbulenceRANS: (): SolverFamily => ({ type: 'SolverFamily', tag: 'TurbulenceRANS' }),
  GeometricMultigrid: (): SolverFamily => ({ type: 'SolverFamily', tag: 'GeometricMultigrid' }),
  AlgebraicMultigrid: (): SolverFamily => ({ type: 'SolverFamily', tag: 'AlgebraicMultigrid' }),
  MultiscaleWavelet: (): SolverFamily => ({ type: 'SolverFamily', tag: 'MultiscaleWavelet' }),
  MultiphaseLBM: (): SolverFamily => ({ type: 'SolverFamily', tag: 'MultiphaseLBM' }),
  SPHPressurePoisson: (): SolverFamily => ({ type: 'SolverFamily', tag: 'SPHPressurePoisson' }),
  SPHWeaklyCompressible: (): SolverFamily => ({ type: 'SolverFamily', tag: 'SPHWeaklyCompressible' }),
  SPHImplicitIncompressible: (): SolverFamily => ({ type: 'SolverFamily', tag: 'SPHImplicitIncompressible' }),
  PoroElasticFEM: (): SolverFamily => ({ type: 'SolverFamily', tag: 'PoroElasticFEM' }),
  PoroViscoElasticFEM: (): SolverFamily => ({ type: 'SolverFamily', tag: 'PoroViscoElasticFEM' }),
  NonNewtonianFEM: (): SolverFamily => ({ type: 'SolverFamily', tag: 'NonNewtonianFEM' }),
  ThinFilm: (): SolverFamily => ({ type: 'SolverFamily', tag: 'ThinFilm' }),
  ShallowWater: (): SolverFamily => ({ type: 'SolverFamily', tag: 'ShallowWater' }),
  Boussinesq: (): SolverFamily => ({ type: 'SolverFamily', tag: 'Boussinesq' }),
  NavierStokesCompressible: (): SolverFamily => ({ type: 'SolverFamily', tag: 'NavierStokesCompressible' }),
  NavierStokesIncompressible: (): SolverFamily => ({ type: 'SolverFamily', tag: 'NavierStokesIncompressible' }),
  MagnetoThermalCoupled: (): SolverFamily => ({ type: 'SolverFamily', tag: 'MagnetoThermalCoupled' }),
  ElectroHydroDynamics: (): SolverFamily => ({ type: 'SolverFamily', tag: 'ElectroHydroDynamics' }),
  QuantumHydro: (): SolverFamily => ({ type: 'SolverFamily', tag: 'QuantumHydro' }),
  SolverFamily_MAX: (): SolverFamily => ({ type: 'SolverFamily', tag: 'SolverFamily_MAX' }),
} as const;

export type HybridSolver =
  | { type: 'HybridSolver'; tag: 'LBM_SPH_Coupled' }
  | { type: 'HybridSolver'; tag: 'FVM_LBM_Adaptive' }
  | { type: 'HybridSolver'; tag: 'Spectral_FEM_Coupled' }
  | { type: 'HybridSolver'; tag: 'FLIP_APIC_Hybrid' }
  | { type: 'HybridSolver'; tag: 'MPM_FEM_Coupled' }
  | { type: 'HybridSolver'; tag: 'PIC_FLIP_Blend' }
  | { type: 'HybridSolver'; tag: 'Eulerian_Lagrangian_ALE' }
  | { type: 'HybridSolver'; tag: 'Wavelet_Particle_Hybrid' }
  | { type: 'HybridSolver'; tag: 'Grid_Particle_Octree' }
  | { type: 'HybridSolver'; tag: 'Multigrid_AMR_Coupled' }
  | { type: 'HybridSolver'; tag: 'HybridSolver_MAX' };
export const HybridSolver = {
  LBM_SPH_Coupled: (): HybridSolver => ({ type: 'HybridSolver', tag: 'LBM_SPH_Coupled' }),
  FVM_LBM_Adaptive: (): HybridSolver => ({ type: 'HybridSolver', tag: 'FVM_LBM_Adaptive' }),
  Spectral_FEM_Coupled: (): HybridSolver => ({ type: 'HybridSolver', tag: 'Spectral_FEM_Coupled' }),
  FLIP_APIC_Hybrid: (): HybridSolver => ({ type: 'HybridSolver', tag: 'FLIP_APIC_Hybrid' }),
  MPM_FEM_Coupled: (): HybridSolver => ({ type: 'HybridSolver', tag: 'MPM_FEM_Coupled' }),
  PIC_FLIP_Blend: (): HybridSolver => ({ type: 'HybridSolver', tag: 'PIC_FLIP_Blend' }),
  Eulerian_Lagrangian_ALE: (): HybridSolver => ({ type: 'HybridSolver', tag: 'Eulerian_Lagrangian_ALE' }),
  Wavelet_Particle_Hybrid: (): HybridSolver => ({ type: 'HybridSolver', tag: 'Wavelet_Particle_Hybrid' }),
  Grid_Particle_Octree: (): HybridSolver => ({ type: 'HybridSolver', tag: 'Grid_Particle_Octree' }),
  Multigrid_AMR_Coupled: (): HybridSolver => ({ type: 'HybridSolver', tag: 'Multigrid_AMR_Coupled' }),
  HybridSolver_MAX: (): HybridSolver => ({ type: 'HybridSolver', tag: 'HybridSolver_MAX' }),
} as const;

export type PressureSolver =
  | { type: 'PressureSolver'; tag: 'Jacobi' }
  | { type: 'PressureSolver'; tag: 'GaussSeidel' }
  | { type: 'PressureSolver'; tag: 'ConjugateGradient' }
  | { type: 'PressureSolver'; tag: 'BiCGSTAB' }
  | { type: 'PressureSolver'; tag: 'GMRES' }
  | { type: 'PressureSolver'; tag: 'Multigrid_V_Cycle' }
  | { type: 'PressureSolver'; tag: 'Multigrid_W_Cycle' }
  | { type: 'PressureSolver'; tag: 'Multigrid_F_Cycle' }
  | { type: 'PressureSolver'; tag: 'RedBlack_SOR' }
  | { type: 'PressureSolver'; tag: 'Chebyshev_Iteration' }
  | { type: 'PressureSolver'; tag: 'FFT_Poisson' }
  | { type: 'PressureSolver'; tag: 'Direct_LU' }
  | { type: 'PressureSolver'; tag: 'Direct_Cholesky' }
  | { type: 'PressureSolver'; tag: 'Preconditioned_CG' }
  | { type: 'PressureSolver'; tag: 'Algebraic_Multigrid' }
  | { type: 'PressureSolver'; tag: 'Geometric_Multigrid' }
  | { type: 'PressureSolver'; tag: 'PressureSolver_MAX' };
export const PressureSolver = {
  Jacobi: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Jacobi' }),
  GaussSeidel: (): PressureSolver => ({ type: 'PressureSolver', tag: 'GaussSeidel' }),
  ConjugateGradient: (): PressureSolver => ({ type: 'PressureSolver', tag: 'ConjugateGradient' }),
  BiCGSTAB: (): PressureSolver => ({ type: 'PressureSolver', tag: 'BiCGSTAB' }),
  GMRES: (): PressureSolver => ({ type: 'PressureSolver', tag: 'GMRES' }),
  Multigrid_V_Cycle: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Multigrid_V_Cycle' }),
  Multigrid_W_Cycle: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Multigrid_W_Cycle' }),
  Multigrid_F_Cycle: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Multigrid_F_Cycle' }),
  RedBlack_SOR: (): PressureSolver => ({ type: 'PressureSolver', tag: 'RedBlack_SOR' }),
  Chebyshev_Iteration: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Chebyshev_Iteration' }),
  FFT_Poisson: (): PressureSolver => ({ type: 'PressureSolver', tag: 'FFT_Poisson' }),
  Direct_LU: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Direct_LU' }),
  Direct_Cholesky: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Direct_Cholesky' }),
  Preconditioned_CG: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Preconditioned_CG' }),
  Algebraic_Multigrid: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Algebraic_Multigrid' }),
  Geometric_Multigrid: (): PressureSolver => ({ type: 'PressureSolver', tag: 'Geometric_Multigrid' }),
  PressureSolver_MAX: (): PressureSolver => ({ type: 'PressureSolver', tag: 'PressureSolver_MAX' }),
} as const;

export type AdvectionScheme =
  | { type: 'AdvectionScheme'; tag: 'SemiLagrangian' }
  | { type: 'AdvectionScheme'; tag: 'MacCormack' }
  | { type: 'AdvectionScheme'; tag: 'BFECC' }
  | { type: 'AdvectionScheme'; tag: 'FLIP' }
  | { type: 'AdvectionScheme'; tag: 'APIC' }
  | { type: 'AdvectionScheme'; tag: 'PolyPIC' }
  | { type: 'AdvectionScheme'; tag: 'Upwind_First' }
  | { type: 'AdvectionScheme'; tag: 'Upwind_Third' }
  | { type: 'AdvectionScheme'; tag: 'Upwind_Fifth' }
  | { type: 'AdvectionScheme'; tag: 'WENO3' }
  | { type: 'AdvectionScheme'; tag: 'WENO5' }
  | { type: 'AdvectionScheme'; tag: 'ENO' }
  | { type: 'AdvectionScheme'; tag: 'TVD_Superbee' }
  | { type: 'AdvectionScheme'; tag: 'TVD_MinMod' }
  | { type: 'AdvectionScheme'; tag: 'TVD_VanLeer' }
  | { type: 'AdvectionScheme'; tag: 'TVD_MC' }
  | { type: 'AdvectionScheme'; tag: 'Lax_Wendroff' }
  | { type: 'AdvectionScheme'; tag: 'Beam_Warming' }
  | { type: 'AdvectionScheme'; tag: 'Fromm' }
  | { type: 'AdvectionScheme'; tag: 'Quick' }
  | { type: 'AdvectionScheme'; tag: 'AdvectionScheme_MAX' };
export const AdvectionScheme = {
  SemiLagrangian: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'SemiLagrangian' }),
  MacCormack: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'MacCormack' }),
  BFECC: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'BFECC' }),
  FLIP: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'FLIP' }),
  APIC: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'APIC' }),
  PolyPIC: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'PolyPIC' }),
  Upwind_First: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'Upwind_First' }),
  Upwind_Third: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'Upwind_Third' }),
  Upwind_Fifth: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'Upwind_Fifth' }),
  WENO3: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'WENO3' }),
  WENO5: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'WENO5' }),
  ENO: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'ENO' }),
  TVD_Superbee: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'TVD_Superbee' }),
  TVD_MinMod: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'TVD_MinMod' }),
  TVD_VanLeer: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'TVD_VanLeer' }),
  TVD_MC: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'TVD_MC' }),
  Lax_Wendroff: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'Lax_Wendroff' }),
  Beam_Warming: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'Beam_Warming' }),
  Fromm: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'Fromm' }),
  Quick: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'Quick' }),
  AdvectionScheme_MAX: (): AdvectionScheme => ({ type: 'AdvectionScheme', tag: 'AdvectionScheme_MAX' }),
} as const;

export type BoundaryType =
  | { type: 'BoundaryType'; tag: 'Periodic' }
  | { type: 'BoundaryType'; tag: 'Dirichlet' }
  | { type: 'BoundaryType'; tag: 'Neumann' }
  | { type: 'BoundaryType'; tag: 'Slip' }
  | { type: 'BoundaryType'; tag: 'NoSlip' }
  | { type: 'BoundaryType'; tag: 'Inflow' }
  | { type: 'BoundaryType'; tag: 'Outflow' }
  | { type: 'BoundaryType'; tag: 'Symmetry' }
  | { type: 'BoundaryType'; tag: 'Open' }
  | { type: 'BoundaryType'; tag: 'Wall' }
  | { type: 'BoundaryType'; tag: 'Sponge' }
  | { type: 'BoundaryType'; tag: 'Reflective' }
  | { type: 'BoundaryType'; tag: 'Absorbing' }
  | { type: 'BoundaryType'; tag: 'MovingWall' }
  | { type: 'BoundaryType'; tag: 'Adaptive' }
  | { type: 'BoundaryType'; tag: 'Porous' }
  | { type: 'BoundaryType'; tag: 'FreeSurface' }
  | { type: 'BoundaryType'; tag: 'Contact_Line' }
  | { type: 'BoundaryType'; tag: 'BoundaryType_MAX' };
export const BoundaryType = {
  Periodic: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Periodic' }),
  Dirichlet: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Dirichlet' }),
  Neumann: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Neumann' }),
  Slip: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Slip' }),
  NoSlip: (): BoundaryType => ({ type: 'BoundaryType', tag: 'NoSlip' }),
  Inflow: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Inflow' }),
  Outflow: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Outflow' }),
  Symmetry: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Symmetry' }),
  Open: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Open' }),
  Wall: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Wall' }),
  Sponge: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Sponge' }),
  Reflective: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Reflective' }),
  Absorbing: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Absorbing' }),
  MovingWall: (): BoundaryType => ({ type: 'BoundaryType', tag: 'MovingWall' }),
  Adaptive: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Adaptive' }),
  Porous: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Porous' }),
  FreeSurface: (): BoundaryType => ({ type: 'BoundaryType', tag: 'FreeSurface' }),
  Contact_Line: (): BoundaryType => ({ type: 'BoundaryType', tag: 'Contact_Line' }),
  BoundaryType_MAX: (): BoundaryType => ({ type: 'BoundaryType', tag: 'BoundaryType_MAX' }),
} as const;

export type VelocityProfile =
  | { type: 'VelocityProfile'; tag: 'Uniform' }
  | { type: 'VelocityProfile'; tag: 'Parabolic' }
  | { type: 'VelocityProfile'; tag: 'PowerLaw' }
  | { type: 'VelocityProfile'; tag: 'LogLaw' }
  | { type: 'VelocityProfile'; tag: 'Synthetic_Turbulence' }
  | { type: 'VelocityProfile'; tag: 'Vortex_Ring' }
  | { type: 'VelocityProfile'; tag: 'Jet_Profile' }
  | { type: 'VelocityProfile'; tag: 'Wake_Profile' }
  | { type: 'VelocityProfile'; tag: 'Blasius_BoundaryLayer' }
  | { type: 'VelocityProfile'; tag: 'Falkner_Skan' }
  | { type: 'VelocityProfile'; tag: 'VelocityProfile_MAX' };
export const VelocityProfile = {
  Uniform: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Uniform' }),
  Parabolic: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Parabolic' }),
  PowerLaw: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'PowerLaw' }),
  LogLaw: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'LogLaw' }),
  Synthetic_Turbulence: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Synthetic_Turbulence' }),
  Vortex_Ring: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Vortex_Ring' }),
  Jet_Profile: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Jet_Profile' }),
  Wake_Profile: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Wake_Profile' }),
  Blasius_BoundaryLayer: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Blasius_BoundaryLayer' }),
  Falkner_Skan: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'Falkner_Skan' }),
  VelocityProfile_MAX: (): VelocityProfile => ({ type: 'VelocityProfile', tag: 'VelocityProfile_MAX' }),
} as const;

export type TemperatureProfile =
  | { type: 'TemperatureProfile'; tag: 'Constant' }
  | { type: 'TemperatureProfile'; tag: 'Linear_Gradient' }
  | { type: 'TemperatureProfile'; tag: 'Exponential_Decay' }
  | { type: 'TemperatureProfile'; tag: 'Gaussian_Plume' }
  | { type: 'TemperatureProfile'; tag: 'Stratified' }
  | { type: 'TemperatureProfile'; tag: 'Adiabatic' }
  | { type: 'TemperatureProfile'; tag: 'Isothermal' }
  | { type: 'TemperatureProfile'; tag: 'TemperatureProfile_MAX' };
export const TemperatureProfile = {
  Constant: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'Constant' }),
  Linear_Gradient: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'Linear_Gradient' }),
  Exponential_Decay: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'Exponential_Decay' }),
  Gaussian_Plume: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'Gaussian_Plume' }),
  Stratified: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'Stratified' }),
  Adiabatic: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'Adiabatic' }),
  Isothermal: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'Isothermal' }),
  TemperatureProfile_MAX: (): TemperatureProfile => ({ type: 'TemperatureProfile', tag: 'TemperatureProfile_MAX' }),
} as const;

export type PressureProfile =
  | { type: 'PressureProfile'; tag: 'Constant' }
  | { type: 'PressureProfile'; tag: 'Hydrostatic' }
  | { type: 'PressureProfile'; tag: 'Atmospheric' }
  | { type: 'PressureProfile'; tag: 'Custom_Gradient' }
  | { type: 'PressureProfile'; tag: 'Isentropic' }
  | { type: 'PressureProfile'; tag: 'PressureProfile_MAX' };
export const PressureProfile = {
  Constant: (): PressureProfile => ({ type: 'PressureProfile', tag: 'Constant' }),
  Hydrostatic: (): PressureProfile => ({ type: 'PressureProfile', tag: 'Hydrostatic' }),
  Atmospheric: (): PressureProfile => ({ type: 'PressureProfile', tag: 'Atmospheric' }),
  Custom_Gradient: (): PressureProfile => ({ type: 'PressureProfile', tag: 'Custom_Gradient' }),
  Isentropic: (): PressureProfile => ({ type: 'PressureProfile', tag: 'Isentropic' }),
  PressureProfile_MAX: (): PressureProfile => ({ type: 'PressureProfile', tag: 'PressureProfile_MAX' }),
} as const;

export type TurbulenceModel =
  | { type: 'TurbulenceModel'; tag: 'None' }
  | { type: 'TurbulenceModel'; tag: 'DNS' }
  | { type: 'TurbulenceModel'; tag: 'LES' }
  | { type: 'TurbulenceModel'; tag: 'RANS_kEpsilon' }
  | { type: 'TurbulenceModel'; tag: 'RANS_kOmega' }
  | { type: 'TurbulenceModel'; tag: 'SpalartAllmaras' }
  | { type: 'TurbulenceModel'; tag: 'Smagorinsky' }
  | { type: 'TurbulenceModel'; tag: 'WALE' }
  | { type: 'TurbulenceModel'; tag: 'DynamicSmagorinsky' }
  | { type: 'TurbulenceModel'; tag: 'Vreman' }
  | { type: 'TurbulenceModel'; tag: 'RNG_kEpsilon' }
  | { type: 'TurbulenceModel'; tag: 'SST_kOmega' }
  | { type: 'TurbulenceModel'; tag: 'DetachedEddy' }
  | { type: 'TurbulenceModel'; tag: 'HybridRANSLES' }
  | { type: 'TurbulenceModel'; tag: 'MultiScaleVortex' }
  | { type: 'TurbulenceModel'; tag: 'TurbulenceModel_MAX' };
export const TurbulenceModel = {
  None: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'None' }),
  DNS: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'DNS' }),
  LES: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'LES' }),
  RANS_kEpsilon: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'RANS_kEpsilon' }),
  RANS_kOmega: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'RANS_kOmega' }),
  SpalartAllmaras: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'SpalartAllmaras' }),
  Smagorinsky: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'Smagorinsky' }),
  WALE: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'WALE' }),
  DynamicSmagorinsky: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'DynamicSmagorinsky' }),
  Vreman: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'Vreman' }),
  RNG_kEpsilon: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'RNG_kEpsilon' }),
  SST_kOmega: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'SST_kOmega' }),
  DetachedEddy: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'DetachedEddy' }),
  HybridRANSLES: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'HybridRANSLES' }),
  MultiScaleVortex: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'MultiScaleVortex' }),
  TurbulenceModel_MAX: (): TurbulenceModel => ({ type: 'TurbulenceModel', tag: 'TurbulenceModel_MAX' }),
} as const;

export type LESModel =
  | { type: 'LESModel'; tag: 'Smagorinsky' }
  | { type: 'LESModel'; tag: 'Dynamic_Smagorinsky' }
  | { type: 'LESModel'; tag: 'WALE' }
  | { type: 'LESModel'; tag: 'Vreman' }
  | { type: 'LESModel'; tag: 'Sigma' }
  | { type: 'LESModel'; tag: 'AMD' }
  | { type: 'LESModel'; tag: 'Anisotropic_Minimum_Dissipation' }
  | { type: 'LESModel'; tag: 'LESModel_MAX' };
export const LESModel = {
  Smagorinsky: (): LESModel => ({ type: 'LESModel', tag: 'Smagorinsky' }),
  Dynamic_Smagorinsky: (): LESModel => ({ type: 'LESModel', tag: 'Dynamic_Smagorinsky' }),
  WALE: (): LESModel => ({ type: 'LESModel', tag: 'WALE' }),
  Vreman: (): LESModel => ({ type: 'LESModel', tag: 'Vreman' }),
  Sigma: (): LESModel => ({ type: 'LESModel', tag: 'Sigma' }),
  AMD: (): LESModel => ({ type: 'LESModel', tag: 'AMD' }),
  Anisotropic_Minimum_Dissipation: (): LESModel => ({ type: 'LESModel', tag: 'Anisotropic_Minimum_Dissipation' }),
  LESModel_MAX: (): LESModel => ({ type: 'LESModel', tag: 'LESModel_MAX' }),
} as const;

export type RANSModel =
  | { type: 'RANSModel'; tag: 'k_Epsilon_Standard' }
  | { type: 'RANSModel'; tag: 'k_Epsilon_RNG' }
  | { type: 'RANSModel'; tag: 'k_Epsilon_Realizable' }
  | { type: 'RANSModel'; tag: 'k_Omega_Standard' }
  | { type: 'RANSModel'; tag: 'k_Omega_SST' }
  | { type: 'RANSModel'; tag: 'k_Omega_BSL' }
  | { type: 'RANSModel'; tag: 'Spalart_Allmaras' }
  | { type: 'RANSModel'; tag: 'v2f' }
  | { type: 'RANSModel'; tag: 'Reynolds_Stress_Model' }
  | { type: 'RANSModel'; tag: 'RANSModel_MAX' };
export const RANSModel = {
  k_Epsilon_Standard: (): RANSModel => ({ type: 'RANSModel', tag: 'k_Epsilon_Standard' }),
  k_Epsilon_RNG: (): RANSModel => ({ type: 'RANSModel', tag: 'k_Epsilon_RNG' }),
  k_Epsilon_Realizable: (): RANSModel => ({ type: 'RANSModel', tag: 'k_Epsilon_Realizable' }),
  k_Omega_Standard: (): RANSModel => ({ type: 'RANSModel', tag: 'k_Omega_Standard' }),
  k_Omega_SST: (): RANSModel => ({ type: 'RANSModel', tag: 'k_Omega_SST' }),
  k_Omega_BSL: (): RANSModel => ({ type: 'RANSModel', tag: 'k_Omega_BSL' }),
  Spalart_Allmaras: (): RANSModel => ({ type: 'RANSModel', tag: 'Spalart_Allmaras' }),
  v2f: (): RANSModel => ({ type: 'RANSModel', tag: 'v2f' }),
  Reynolds_Stress_Model: (): RANSModel => ({ type: 'RANSModel', tag: 'Reynolds_Stress_Model' }),
  RANSModel_MAX: (): RANSModel => ({ type: 'RANSModel', tag: 'RANSModel_MAX' }),
} as const;

export type WallFunction =
  | { type: 'WallFunction'; tag: 'Standard_Log_Law' }
  | { type: 'WallFunction'; tag: 'Scalable_Wall_Function' }
  | { type: 'WallFunction'; tag: 'Enhanced_Wall_Treatment' }
  | { type: 'WallFunction'; tag: 'Low_Reynolds_Number' }
  | { type: 'WallFunction'; tag: 'Rough_Wall' }
  | { type: 'WallFunction'; tag: 'Smooth_Wall' }
  | { type: 'WallFunction'; tag: 'WallFunction_MAX' };
export const WallFunction = {
  Standard_Log_Law: (): WallFunction => ({ type: 'WallFunction', tag: 'Standard_Log_Law' }),
  Scalable_Wall_Function: (): WallFunction => ({ type: 'WallFunction', tag: 'Scalable_Wall_Function' }),
  Enhanced_Wall_Treatment: (): WallFunction => ({ type: 'WallFunction', tag: 'Enhanced_Wall_Treatment' }),
  Low_Reynolds_Number: (): WallFunction => ({ type: 'WallFunction', tag: 'Low_Reynolds_Number' }),
  Rough_Wall: (): WallFunction => ({ type: 'WallFunction', tag: 'Rough_Wall' }),
  Smooth_Wall: (): WallFunction => ({ type: 'WallFunction', tag: 'Smooth_Wall' }),
  WallFunction_MAX: (): WallFunction => ({ type: 'WallFunction', tag: 'WallFunction_MAX' }),
} as const;

export type TransitionModel =
  | { type: 'TransitionModel'; tag: 'None' }
  | { type: 'TransitionModel'; tag: 'Gamma_ReTheta' }
  | { type: 'TransitionModel'; tag: 'Gamma' }
  | { type: 'TransitionModel'; tag: 'Intermittency_Transport' }
  | { type: 'TransitionModel'; tag: 'Bypass_Transition' }
  | { type: 'TransitionModel'; tag: 'Natural_Transition' }
  | { type: 'TransitionModel'; tag: 'TransitionModel_MAX' };
export const TransitionModel = {
  None: (): TransitionModel => ({ type: 'TransitionModel', tag: 'None' }),
  Gamma_ReTheta: (): TransitionModel => ({ type: 'TransitionModel', tag: 'Gamma_ReTheta' }),
  Gamma: (): TransitionModel => ({ type: 'TransitionModel', tag: 'Gamma' }),
  Intermittency_Transport: (): TransitionModel => ({ type: 'TransitionModel', tag: 'Intermittency_Transport' }),
  Bypass_Transition: (): TransitionModel => ({ type: 'TransitionModel', tag: 'Bypass_Transition' }),
  Natural_Transition: (): TransitionModel => ({ type: 'TransitionModel', tag: 'Natural_Transition' }),
  TransitionModel_MAX: (): TransitionModel => ({ type: 'TransitionModel', tag: 'TransitionModel_MAX' }),
} as const;

export type SyntheticTurbulence =
  | { type: 'SyntheticTurbulence'; tag: 'None' }
  | { type: 'SyntheticTurbulence'; tag: 'Digital_Filter' }
  | { type: 'SyntheticTurbulence'; tag: 'Synthetic_Eddy_Method' }
  | { type: 'SyntheticTurbulence'; tag: 'Divergence_Free_Synthetic' }
  | { type: 'SyntheticTurbulence'; tag: 'Vortex_Method' }
  | { type: 'SyntheticTurbulence'; tag: 'Random_Flow_Generation' }
  | { type: 'SyntheticTurbulence'; tag: 'SyntheticTurbulence_MAX' };
export const SyntheticTurbulence = {
  None: (): SyntheticTurbulence => ({ type: 'SyntheticTurbulence', tag: 'None' }),
  Digital_Filter: (): SyntheticTurbulence => ({ type: 'SyntheticTurbulence', tag: 'Digital_Filter' }),
  Synthetic_Eddy_Method: (): SyntheticTurbulence => ({ type: 'SyntheticTurbulence', tag: 'Synthetic_Eddy_Method' }),
  Divergence_Free_Synthetic: (): SyntheticTurbulence => ({ type: 'SyntheticTurbulence', tag: 'Divergence_Free_Synthetic' }),
  Vortex_Method: (): SyntheticTurbulence => ({ type: 'SyntheticTurbulence', tag: 'Vortex_Method' }),
  Random_Flow_Generation: (): SyntheticTurbulence => ({ type: 'SyntheticTurbulence', tag: 'Random_Flow_Generation' }),
  SyntheticTurbulence_MAX: (): SyntheticTurbulence => ({ type: 'SyntheticTurbulence', tag: 'SyntheticTurbulence_MAX' }),
} as const;

export type ReynoldsStressModel =
  | { type: 'ReynoldsStressModel'; tag: 'Isotropic' }
  | { type: 'ReynoldsStressModel'; tag: 'Linear_Pressure_Strain' }
  | { type: 'ReynoldsStressModel'; tag: 'Quadratic_Pressure_Strain' }
  | { type: 'ReynoldsStressModel'; tag: 'Elliptic_Relaxation' }
  | { type: 'ReynoldsStressModel'; tag: 'Algebraic_Stress' }
  | { type: 'ReynoldsStressModel'; tag: 'ReynoldsStressModel_MAX' };
export const ReynoldsStressModel = {
  Isotropic: (): ReynoldsStressModel => ({ type: 'ReynoldsStressModel', tag: 'Isotropic' }),
  Linear_Pressure_Strain: (): ReynoldsStressModel => ({ type: 'ReynoldsStressModel', tag: 'Linear_Pressure_Strain' }),
  Quadratic_Pressure_Strain: (): ReynoldsStressModel => ({ type: 'ReynoldsStressModel', tag: 'Quadratic_Pressure_Strain' }),
  Elliptic_Relaxation: (): ReynoldsStressModel => ({ type: 'ReynoldsStressModel', tag: 'Elliptic_Relaxation' }),
  Algebraic_Stress: (): ReynoldsStressModel => ({ type: 'ReynoldsStressModel', tag: 'Algebraic_Stress' }),
  ReynoldsStressModel_MAX: (): ReynoldsStressModel => ({ type: 'ReynoldsStressModel', tag: 'ReynoldsStressModel_MAX' }),
} as const;

export type CouplingField =
  | { type: 'CouplingField'; tag: 'Thermal' }
  | { type: 'CouplingField'; tag: 'Chemical' }
  | { type: 'CouplingField'; tag: 'Electrical' }
  | { type: 'CouplingField'; tag: 'Magnetic' }
  | { type: 'CouplingField'; tag: 'Quantum' }
  | { type: 'CouplingField'; tag: 'Structural' }
  | { type: 'CouplingField'; tag: 'Acoustics' }
  | { type: 'CouplingField'; tag: 'Radiation' }
  | { type: 'CouplingField'; tag: 'CosmicRay' }
  | { type: 'CouplingField'; tag: 'Gravity' }
  | { type: 'CouplingField'; tag: 'Elasticity' }
  | { type: 'CouplingField'; tag: 'Porous' }
  | { type: 'CouplingField'; tag: 'BioChemical' }
  | { type: 'CouplingField'; tag: 'Electrokinetic' }
  | { type: 'CouplingField'; tag: 'Photochemical' }
  | { type: 'CouplingField'; tag: 'CouplingField_MAX' };
export const CouplingField = {
  Thermal: (): CouplingField => ({ type: 'CouplingField', tag: 'Thermal' }),
  Chemical: (): CouplingField => ({ type: 'CouplingField', tag: 'Chemical' }),
  Electrical: (): CouplingField => ({ type: 'CouplingField', tag: 'Electrical' }),
  Magnetic: (): CouplingField => ({ type: 'CouplingField', tag: 'Magnetic' }),
  Quantum: (): CouplingField => ({ type: 'CouplingField', tag: 'Quantum' }),
  Structural: (): CouplingField => ({ type: 'CouplingField', tag: 'Structural' }),
  Acoustics: (): CouplingField => ({ type: 'CouplingField', tag: 'Acoustics' }),
  Radiation: (): CouplingField => ({ type: 'CouplingField', tag: 'Radiation' }),
  CosmicRay: (): CouplingField => ({ type: 'CouplingField', tag: 'CosmicRay' }),
  Gravity: (): CouplingField => ({ type: 'CouplingField', tag: 'Gravity' }),
  Elasticity: (): CouplingField => ({ type: 'CouplingField', tag: 'Elasticity' }),
  Porous: (): CouplingField => ({ type: 'CouplingField', tag: 'Porous' }),
  BioChemical: (): CouplingField => ({ type: 'CouplingField', tag: 'BioChemical' }),
  Electrokinetic: (): CouplingField => ({ type: 'CouplingField', tag: 'Electrokinetic' }),
  Photochemical: (): CouplingField => ({ type: 'CouplingField', tag: 'Photochemical' }),
  CouplingField_MAX: (): CouplingField => ({ type: 'CouplingField', tag: 'CouplingField_MAX' }),
} as const;

export type CouplingStrategy =
  | { type: 'CouplingStrategy'; tag: 'Explicit_Sequential' }
  | { type: 'CouplingStrategy'; tag: 'Implicit_Sequential' }
  | { type: 'CouplingStrategy'; tag: 'Implicit_Parallel' }
  | { type: 'CouplingStrategy'; tag: 'Staggered_Iterative' }
  | { type: 'CouplingStrategy'; tag: 'Monolithic' }
  | { type: 'CouplingStrategy'; tag: 'Partitioned' }
  | { type: 'CouplingStrategy'; tag: 'CouplingStrategy_MAX' };
export const CouplingStrategy = {
  Explicit_Sequential: (): CouplingStrategy => ({ type: 'CouplingStrategy', tag: 'Explicit_Sequential' }),
  Implicit_Sequential: (): CouplingStrategy => ({ type: 'CouplingStrategy', tag: 'Implicit_Sequential' }),
  Implicit_Parallel: (): CouplingStrategy => ({ type: 'CouplingStrategy', tag: 'Implicit_Parallel' }),
  Staggered_Iterative: (): CouplingStrategy => ({ type: 'CouplingStrategy', tag: 'Staggered_Iterative' }),
  Monolithic: (): CouplingStrategy => ({ type: 'CouplingStrategy', tag: 'Monolithic' }),
  Partitioned: (): CouplingStrategy => ({ type: 'CouplingStrategy', tag: 'Partitioned' }),
  CouplingStrategy_MAX: (): CouplingStrategy => ({ type: 'CouplingStrategy', tag: 'CouplingStrategy_MAX' }),
} as const;

export type RadiationModel =
  | { type: 'RadiationModel'; tag: 'None' }
  | { type: 'RadiationModel'; tag: 'P1_Approximation' }
  | { type: 'RadiationModel'; tag: 'Discrete_Ordinates' }
  | { type: 'RadiationModel'; tag: 'Monte_Carlo' }
  | { type: 'RadiationModel'; tag: 'Rosseland_Diffusion' }
  | { type: 'RadiationModel'; tag: 'Six_Flux' }
  | { type: 'RadiationModel'; tag: 'Spherical_Harmonics' }
  | { type: 'RadiationModel'; tag: 'RadiationModel_MAX' };
export const RadiationModel = {
  None: (): RadiationModel => ({ type: 'RadiationModel', tag: 'None' }),
  P1_Approximation: (): RadiationModel => ({ type: 'RadiationModel', tag: 'P1_Approximation' }),
  Discrete_Ordinates: (): RadiationModel => ({ type: 'RadiationModel', tag: 'Discrete_Ordinates' }),
  Monte_Carlo: (): RadiationModel => ({ type: 'RadiationModel', tag: 'Monte_Carlo' }),
  Rosseland_Diffusion: (): RadiationModel => ({ type: 'RadiationModel', tag: 'Rosseland_Diffusion' }),
  Six_Flux: (): RadiationModel => ({ type: 'RadiationModel', tag: 'Six_Flux' }),
  Spherical_Harmonics: (): RadiationModel => ({ type: 'RadiationModel', tag: 'Spherical_Harmonics' }),
  RadiationModel_MAX: (): RadiationModel => ({ type: 'RadiationModel', tag: 'RadiationModel_MAX' }),
} as const;

export type FSIMethod =
  | { type: 'FSIMethod'; tag: 'None' }
  | { type: 'FSIMethod'; tag: 'Immersed_Boundary' }
  | { type: 'FSIMethod'; tag: 'Arbitrary_Lagrangian_Eulerian' }
  | { type: 'FSIMethod'; tag: 'Overset_Grid' }
  | { type: 'FSIMethod'; tag: 'Fictitious_Domain' }
  | { type: 'FSIMethod'; tag: 'Penalty_Method' }
  | { type: 'FSIMethod'; tag: 'FSIMethod_MAX' };
export const FSIMethod = {
  None: (): FSIMethod => ({ type: 'FSIMethod', tag: 'None' }),
  Immersed_Boundary: (): FSIMethod => ({ type: 'FSIMethod', tag: 'Immersed_Boundary' }),
  Arbitrary_Lagrangian_Eulerian: (): FSIMethod => ({ type: 'FSIMethod', tag: 'Arbitrary_Lagrangian_Eulerian' }),
  Overset_Grid: (): FSIMethod => ({ type: 'FSIMethod', tag: 'Overset_Grid' }),
  Fictitious_Domain: (): FSIMethod => ({ type: 'FSIMethod', tag: 'Fictitious_Domain' }),
  Penalty_Method: (): FSIMethod => ({ type: 'FSIMethod', tag: 'Penalty_Method' }),
  FSIMethod_MAX: (): FSIMethod => ({ type: 'FSIMethod', tag: 'FSIMethod_MAX' }),
} as const;

export type ReactionMechanism =
  | { type: 'ReactionMechanism'; tag: 'None' }
  | { type: 'ReactionMechanism'; tag: 'Single_Step' }
  | { type: 'ReactionMechanism'; tag: 'Two_Step' }
  | { type: 'ReactionMechanism'; tag: 'Skeletal' }
  | { type: 'ReactionMechanism'; tag: 'Detailed_GRI_Mech' }
  | { type: 'ReactionMechanism'; tag: 'Detailed_San_Diego' }
  | { type: 'ReactionMechanism'; tag: 'Flamelet' }
  | { type: 'ReactionMechanism'; tag: 'PDF_Transport' }
  | { type: 'ReactionMechanism'; tag: 'ReactionMechanism_MAX' };
export const ReactionMechanism = {
  None: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'None' }),
  Single_Step: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'Single_Step' }),
  Two_Step: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'Two_Step' }),
  Skeletal: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'Skeletal' }),
  Detailed_GRI_Mech: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'Detailed_GRI_Mech' }),
  Detailed_San_Diego: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'Detailed_San_Diego' }),
  Flamelet: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'Flamelet' }),
  PDF_Transport: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'PDF_Transport' }),
  ReactionMechanism_MAX: (): ReactionMechanism => ({ type: 'ReactionMechanism', tag: 'ReactionMechanism_MAX' }),
} as const;

export type VisualizationMode =
  | { type: 'VisualizationMode'; tag: 'Density' }
  | { type: 'VisualizationMode'; tag: 'Velocity' }
  | { type: 'VisualizationMode'; tag: 'Pressure' }
  | { type: 'VisualizationMode'; tag: 'Temperature' }
  | { type: 'VisualizationMode'; tag: 'Vorticity' }
  | { type: 'VisualizationMode'; tag: 'Streamlines' }
  | { type: 'VisualizationMode'; tag: 'Pathlines' }
  | { type: 'VisualizationMode'; tag: 'Streaklines' }
  | { type: 'VisualizationMode'; tag: 'ShockDetector' }
  | { type: 'VisualizationMode'; tag: 'Schlieren' }
  | { type: 'VisualizationMode'; tag: 'Interferometry' }
  | { type: 'VisualizationMode'; tag: 'Holography' }
  | { type: 'VisualizationMode'; tag: 'PhaseField' }
  | { type: 'VisualizationMode'; tag: 'VolumeRaymarch' }
  | { type: 'VisualizationMode'; tag: 'SurfaceLevelSet' }
  | { type: 'VisualizationMode'; tag: 'FoamCrest' }
  | { type: 'VisualizationMode'; tag: 'SprayParticles' }
  | { type: 'VisualizationMode'; tag: 'BubbleDynamics' }
  | { type: 'VisualizationMode'; tag: 'MHDFieldLines' }
  | { type: 'VisualizationMode'; tag: 'QuantumPhase' }
  | { type: 'VisualizationMode'; tag: 'TurbulenceEnergy' }
  | { type: 'VisualizationMode'; tag: 'SpectralEnergy' }
  | { type: 'VisualizationMode'; tag: 'Divergence' }
  | { type: 'VisualizationMode'; tag: 'Curl' }
  | { type: 'VisualizationMode'; tag: 'AdaptiveMesh' }
  | { type: 'VisualizationMode'; tag: 'MeshQuality' }
  | { type: 'VisualizationMode'; tag: 'BoundaryLayer' }
  | { type: 'VisualizationMode'; tag: 'DataAssimilationError' }
  | { type: 'VisualizationMode'; tag: 'VisualizationMode_MAX' };
export const VisualizationMode = {
  Density: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Density' }),
  Velocity: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Velocity' }),
  Pressure: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Pressure' }),
  Temperature: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Temperature' }),
  Vorticity: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Vorticity' }),
  Streamlines: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Streamlines' }),
  Pathlines: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Pathlines' }),
  Streaklines: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Streaklines' }),
  ShockDetector: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'ShockDetector' }),
  Schlieren: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Schlieren' }),
  Interferometry: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Interferometry' }),
  Holography: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Holography' }),
  PhaseField: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'PhaseField' }),
  VolumeRaymarch: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'VolumeRaymarch' }),
  SurfaceLevelSet: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'SurfaceLevelSet' }),
  FoamCrest: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'FoamCrest' }),
  SprayParticles: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'SprayParticles' }),
  BubbleDynamics: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'BubbleDynamics' }),
  MHDFieldLines: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'MHDFieldLines' }),
  QuantumPhase: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'QuantumPhase' }),
  TurbulenceEnergy: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'TurbulenceEnergy' }),
  SpectralEnergy: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'SpectralEnergy' }),
  Divergence: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Divergence' }),
  Curl: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'Curl' }),
  AdaptiveMesh: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'AdaptiveMesh' }),
  MeshQuality: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'MeshQuality' }),
  BoundaryLayer: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'BoundaryLayer' }),
  DataAssimilationError: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'DataAssimilationError' }),
  VisualizationMode_MAX: (): VisualizationMode => ({ type: 'VisualizationMode', tag: 'VisualizationMode_MAX' }),
} as const;

export type QualityTier =
  | { type: 'QualityTier'; tag: 'Preview' }
  | { type: 'QualityTier'; tag: 'Medium' }
  | { type: 'QualityTier'; tag: 'High' }
  | { type: 'QualityTier'; tag: 'Ultra' }
  | { type: 'QualityTier'; tag: 'Cinematic' }
  | { type: 'QualityTier'; tag: 'Research' }
  | { type: 'QualityTier'; tag: 'Exascale' }
  | { type: 'QualityTier'; tag: 'QualityTier_MAX' };
export const QualityTier = {
  Preview: (): QualityTier => ({ type: 'QualityTier', tag: 'Preview' }),
  Medium: (): QualityTier => ({ type: 'QualityTier', tag: 'Medium' }),
  High: (): QualityTier => ({ type: 'QualityTier', tag: 'High' }),
  Ultra: (): QualityTier => ({ type: 'QualityTier', tag: 'Ultra' }),
  Cinematic: (): QualityTier => ({ type: 'QualityTier', tag: 'Cinematic' }),
  Research: (): QualityTier => ({ type: 'QualityTier', tag: 'Research' }),
  Exascale: (): QualityTier => ({ type: 'QualityTier', tag: 'Exascale' }),
  QualityTier_MAX: (): QualityTier => ({ type: 'QualityTier', tag: 'QualityTier_MAX' }),
} as const;

export type GPUBackend =
  | { type: 'GPUBackend'; tag: 'Default' }
  | { type: 'GPUBackend'; tag: 'RDGDirect' }
  | { type: 'GPUBackend'; tag: 'AsyncCompute' }
  | { type: 'GPUBackend'; tag: 'MeshShader' }
  | { type: 'GPUBackend'; tag: 'WaveOps' }
  | { type: 'GPUBackend'; tag: 'CooperativeMatrix' }
  | { type: 'GPUBackend'; tag: 'RayTracing' }
  | { type: 'GPUBackend'; tag: 'GPUBackend_MAX' };
export const GPUBackend = {
  Default: (): GPUBackend => ({ type: 'GPUBackend', tag: 'Default' }),
  RDGDirect: (): GPUBackend => ({ type: 'GPUBackend', tag: 'RDGDirect' }),
  AsyncCompute: (): GPUBackend => ({ type: 'GPUBackend', tag: 'AsyncCompute' }),
  MeshShader: (): GPUBackend => ({ type: 'GPUBackend', tag: 'MeshShader' }),
  WaveOps: (): GPUBackend => ({ type: 'GPUBackend', tag: 'WaveOps' }),
  CooperativeMatrix: (): GPUBackend => ({ type: 'GPUBackend', tag: 'CooperativeMatrix' }),
  RayTracing: (): GPUBackend => ({ type: 'GPUBackend', tag: 'RayTracing' }),
  GPUBackend_MAX: (): GPUBackend => ({ type: 'GPUBackend', tag: 'GPUBackend_MAX' }),
} as const;

export type AdaptiveStrategy =
  | { type: 'AdaptiveStrategy'; tag: 'None' }
  | { type: 'AdaptiveStrategy'; tag: 'AMR' }
  | { type: 'AdaptiveStrategy'; tag: 'Octree' }
  | { type: 'AdaptiveStrategy'; tag: 'BVH' }
  | { type: 'AdaptiveStrategy'; tag: 'SparseGrid' }
  | { type: 'AdaptiveStrategy'; tag: 'SparseVoxel' }
  | { type: 'AdaptiveStrategy'; tag: 'MultiResolutionTiles' }
  | { type: 'AdaptiveStrategy'; tag: 'PatchBased' }
  | { type: 'AdaptiveStrategy'; tag: 'Wavelet' }
  | { type: 'AdaptiveStrategy'; tag: 'AdaptiveStrategy_MAX' };
export const AdaptiveStrategy = {
  None: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'None' }),
  AMR: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'AMR' }),
  Octree: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'Octree' }),
  BVH: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'BVH' }),
  SparseGrid: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'SparseGrid' }),
  SparseVoxel: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'SparseVoxel' }),
  MultiResolutionTiles: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'MultiResolutionTiles' }),
  PatchBased: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'PatchBased' }),
  Wavelet: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'Wavelet' }),
  AdaptiveStrategy_MAX: (): AdaptiveStrategy => ({ type: 'AdaptiveStrategy', tag: 'AdaptiveStrategy_MAX' }),
} as const;

export type TimeIntegrator =
  | { type: 'TimeIntegrator'; tag: 'EulerExplicit' }
  | { type: 'TimeIntegrator'; tag: 'EulerImplicit' }
  | { type: 'TimeIntegrator'; tag: 'RK2' }
  | { type: 'TimeIntegrator'; tag: 'RK3' }
  | { type: 'TimeIntegrator'; tag: 'RK4' }
  | { type: 'TimeIntegrator'; tag: 'BDF2' }
  | { type: 'TimeIntegrator'; tag: 'CrankNicolson' }
  | { type: 'TimeIntegrator'; tag: 'AdamsBashforth2' }
  | { type: 'TimeIntegrator'; tag: 'AdamsMoulton2' }
  | { type: 'TimeIntegrator'; tag: 'PredictorCorrector' }
  | { type: 'TimeIntegrator'; tag: 'Exponential' }
  | { type: 'TimeIntegrator'; tag: 'Symplectic' }
  | { type: 'TimeIntegrator'; tag: 'IMEX' }
  | { type: 'TimeIntegrator'; tag: 'TimeIntegrator_MAX' };
export const TimeIntegrator = {
  EulerExplicit: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'EulerExplicit' }),
  EulerImplicit: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'EulerImplicit' }),
  RK2: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'RK2' }),
  RK3: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'RK3' }),
  RK4: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'RK4' }),
  BDF2: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'BDF2' }),
  CrankNicolson: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'CrankNicolson' }),
  AdamsBashforth2: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'AdamsBashforth2' }),
  AdamsMoulton2: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'AdamsMoulton2' }),
  PredictorCorrector: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'PredictorCorrector' }),
  Exponential: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'Exponential' }),
  Symplectic: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'Symplectic' }),
  IMEX: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'IMEX' }),
  TimeIntegrator_MAX: (): TimeIntegrator => ({ type: 'TimeIntegrator', tag: 'TimeIntegrator_MAX' }),
} as const;

export type ParticleType =
  | { type: 'ParticleType'; tag: 'Tracer' }
  | { type: 'ParticleType'; tag: 'Droplet' }
  | { type: 'ParticleType'; tag: 'Bubble' }
  | { type: 'ParticleType'; tag: 'Solid' }
  | { type: 'ParticleType'; tag: 'ReactiveParticle' }
  | { type: 'ParticleType'; tag: 'Evaporating' }
  | { type: 'ParticleType'; tag: 'Condensing' }
  | { type: 'ParticleType'; tag: 'Charged' }
  | { type: 'ParticleType'; tag: 'ParticleType_MAX' };
export const ParticleType = {
  Tracer: (): ParticleType => ({ type: 'ParticleType', tag: 'Tracer' }),
  Droplet: (): ParticleType => ({ type: 'ParticleType', tag: 'Droplet' }),
  Bubble: (): ParticleType => ({ type: 'ParticleType', tag: 'Bubble' }),
  Solid: (): ParticleType => ({ type: 'ParticleType', tag: 'Solid' }),
  ReactiveParticle: (): ParticleType => ({ type: 'ParticleType', tag: 'ReactiveParticle' }),
  Evaporating: (): ParticleType => ({ type: 'ParticleType', tag: 'Evaporating' }),
  Condensing: (): ParticleType => ({ type: 'ParticleType', tag: 'Condensing' }),
  Charged: (): ParticleType => ({ type: 'ParticleType', tag: 'Charged' }),
  ParticleType_MAX: (): ParticleType => ({ type: 'ParticleType', tag: 'ParticleType_MAX' }),
} as const;

export type DragModel =
  | { type: 'DragModel'; tag: 'Stokes' }
  | { type: 'DragModel'; tag: 'Schiller_Naumann' }
  | { type: 'DragModel'; tag: 'Wen_Yu' }
  | { type: 'DragModel'; tag: 'Ergun' }
  | { type: 'DragModel'; tag: 'Gidaspow' }
  | { type: 'DragModel'; tag: 'Syamlal_OBrien' }
  | { type: 'DragModel'; tag: 'Morsi_Alexander' }
  | { type: 'DragModel'; tag: 'DragModel_MAX' };
export const DragModel = {
  Stokes: (): DragModel => ({ type: 'DragModel', tag: 'Stokes' }),
  Schiller_Naumann: (): DragModel => ({ type: 'DragModel', tag: 'Schiller_Naumann' }),
  Wen_Yu: (): DragModel => ({ type: 'DragModel', tag: 'Wen_Yu' }),
  Ergun: (): DragModel => ({ type: 'DragModel', tag: 'Ergun' }),
  Gidaspow: (): DragModel => ({ type: 'DragModel', tag: 'Gidaspow' }),
  Syamlal_OBrien: (): DragModel => ({ type: 'DragModel', tag: 'Syamlal_OBrien' }),
  Morsi_Alexander: (): DragModel => ({ type: 'DragModel', tag: 'Morsi_Alexander' }),
  DragModel_MAX: (): DragModel => ({ type: 'DragModel', tag: 'DragModel_MAX' }),
} as const;

export type CollisionModel =
  | { type: 'CollisionModel'; tag: 'None' }
  | { type: 'CollisionModel'; tag: 'Hard_Sphere' }
  | { type: 'CollisionModel'; tag: 'Soft_Sphere_DEM' }
  | { type: 'CollisionModel'; tag: 'Stochastic' }
  | { type: 'CollisionModel'; tag: 'Deterministic' }
  | { type: 'CollisionModel'; tag: 'CollisionModel_MAX' };
export const CollisionModel = {
  None: (): CollisionModel => ({ type: 'CollisionModel', tag: 'None' }),
  Hard_Sphere: (): CollisionModel => ({ type: 'CollisionModel', tag: 'Hard_Sphere' }),
  Soft_Sphere_DEM: (): CollisionModel => ({ type: 'CollisionModel', tag: 'Soft_Sphere_DEM' }),
  Stochastic: (): CollisionModel => ({ type: 'CollisionModel', tag: 'Stochastic' }),
  Deterministic: (): CollisionModel => ({ type: 'CollisionModel', tag: 'Deterministic' }),
  CollisionModel_MAX: (): CollisionModel => ({ type: 'CollisionModel', tag: 'CollisionModel_MAX' }),
} as const;

export type BreakupModel =
  | { type: 'BreakupModel'; tag: 'None' }
  | { type: 'BreakupModel'; tag: 'TAB' }
  | { type: 'BreakupModel'; tag: 'ETAB' }
  | { type: 'BreakupModel'; tag: 'KH_RT' }
  | { type: 'BreakupModel'; tag: 'Pilch_Erdman' }
  | { type: 'BreakupModel'; tag: 'Reitz_Diwakar' }
  | { type: 'BreakupModel'; tag: 'BreakupModel_MAX' };
export const BreakupModel = {
  None: (): BreakupModel => ({ type: 'BreakupModel', tag: 'None' }),
  TAB: (): BreakupModel => ({ type: 'BreakupModel', tag: 'TAB' }),
  ETAB: (): BreakupModel => ({ type: 'BreakupModel', tag: 'ETAB' }),
  KH_RT: (): BreakupModel => ({ type: 'BreakupModel', tag: 'KH_RT' }),
  Pilch_Erdman: (): BreakupModel => ({ type: 'BreakupModel', tag: 'Pilch_Erdman' }),
  Reitz_Diwakar: (): BreakupModel => ({ type: 'BreakupModel', tag: 'Reitz_Diwakar' }),
  BreakupModel_MAX: (): BreakupModel => ({ type: 'BreakupModel', tag: 'BreakupModel_MAX' }),
} as const;

export type CoalescenceModel =
  | { type: 'CoalescenceModel'; tag: 'None' }
  | { type: 'CoalescenceModel'; tag: 'ORouke' }
  | { type: 'CoalescenceModel'; tag: 'Chesters' }
  | { type: 'CoalescenceModel'; tag: 'Prince_Blanch' }
  | { type: 'CoalescenceModel'; tag: 'Luo_Svendsen' }
  | { type: 'CoalescenceModel'; tag: 'CoalescenceModel_MAX' };
export const CoalescenceModel = {
  None: (): CoalescenceModel => ({ type: 'CoalescenceModel', tag: 'None' }),
  ORouke: (): CoalescenceModel => ({ type: 'CoalescenceModel', tag: 'ORouke' }),
  Chesters: (): CoalescenceModel => ({ type: 'CoalescenceModel', tag: 'Chesters' }),
  Prince_Blanch: (): CoalescenceModel => ({ type: 'CoalescenceModel', tag: 'Prince_Blanch' }),
  Luo_Svendsen: (): CoalescenceModel => ({ type: 'CoalescenceModel', tag: 'Luo_Svendsen' }),
  CoalescenceModel_MAX: (): CoalescenceModel => ({ type: 'CoalescenceModel', tag: 'CoalescenceModel_MAX' }),
} as const;

export type EvaporationModel =
  | { type: 'EvaporationModel'; tag: 'None' }
  | { type: 'EvaporationModel'; tag: 'Frossling' }
  | { type: 'EvaporationModel'; tag: 'Abramzon_Sirignano' }
  | { type: 'EvaporationModel'; tag: 'Langmuir_Knudsen' }
  | { type: 'EvaporationModel'; tag: 'Ranz_Marshall' }
  | { type: 'EvaporationModel'; tag: 'EvaporationModel_MAX' };
export const EvaporationModel = {
  None: (): EvaporationModel => ({ type: 'EvaporationModel', tag: 'None' }),
  Frossling: (): EvaporationModel => ({ type: 'EvaporationModel', tag: 'Frossling' }),
  Abramzon_Sirignano: (): EvaporationModel => ({ type: 'EvaporationModel', tag: 'Abramzon_Sirignano' }),
  Langmuir_Knudsen: (): EvaporationModel => ({ type: 'EvaporationModel', tag: 'Langmuir_Knudsen' }),
  Ranz_Marshall: (): EvaporationModel => ({ type: 'EvaporationModel', tag: 'Ranz_Marshall' }),
  EvaporationModel_MAX: (): EvaporationModel => ({ type: 'EvaporationModel', tag: 'EvaporationModel_MAX' }),
} as const;

export type TrackingScheme =
  | { type: 'TrackingScheme'; tag: 'Euler_Explicit' }
  | { type: 'TrackingScheme'; tag: 'Runge_Kutta_4' }
  | { type: 'TrackingScheme'; tag: 'Analytical_Integration' }
  | { type: 'TrackingScheme'; tag: 'Implicit_Euler' }
  | { type: 'TrackingScheme'; tag: 'TrackingScheme_MAX' };
export const TrackingScheme = {
  Euler_Explicit: (): TrackingScheme => ({ type: 'TrackingScheme', tag: 'Euler_Explicit' }),
  Runge_Kutta_4: (): TrackingScheme => ({ type: 'TrackingScheme', tag: 'Runge_Kutta_4' }),
  Analytical_Integration: (): TrackingScheme => ({ type: 'TrackingScheme', tag: 'Analytical_Integration' }),
  Implicit_Euler: (): TrackingScheme => ({ type: 'TrackingScheme', tag: 'Implicit_Euler' }),
  TrackingScheme_MAX: (): TrackingScheme => ({ type: 'TrackingScheme', tag: 'TrackingScheme_MAX' }),
} as const;

export type LoadBalancingStrategy =
  | { type: 'LoadBalancingStrategy'; tag: 'Static' }
  | { type: 'LoadBalancingStrategy'; tag: 'Dynamic_Workload' }
  | { type: 'LoadBalancingStrategy'; tag: 'Hilbert_Curve' }
  | { type: 'LoadBalancingStrategy'; tag: 'Space_Filling_Curve' }
  | { type: 'LoadBalancingStrategy'; tag: 'Graph_Partitioning' }
  | { type: 'LoadBalancingStrategy'; tag: 'LoadBalancingStrategy_MAX' };
export const LoadBalancingStrategy = {
  Static: (): LoadBalancingStrategy => ({ type: 'LoadBalancingStrategy', tag: 'Static' }),
  Dynamic_Workload: (): LoadBalancingStrategy => ({ type: 'LoadBalancingStrategy', tag: 'Dynamic_Workload' }),
  Hilbert_Curve: (): LoadBalancingStrategy => ({ type: 'LoadBalancingStrategy', tag: 'Hilbert_Curve' }),
  Space_Filling_Curve: (): LoadBalancingStrategy => ({ type: 'LoadBalancingStrategy', tag: 'Space_Filling_Curve' }),
  Graph_Partitioning: (): LoadBalancingStrategy => ({ type: 'LoadBalancingStrategy', tag: 'Graph_Partitioning' }),
  LoadBalancingStrategy_MAX: (): LoadBalancingStrategy => ({ type: 'LoadBalancingStrategy', tag: 'LoadBalancingStrategy_MAX' }),
} as const;

export type DomainDecomposition =
  | { type: 'DomainDecomposition'; tag: 'None' }
  | { type: 'DomainDecomposition'; tag: 'Slab' }
  | { type: 'DomainDecomposition'; tag: 'Pencil' }
  | { type: 'DomainDecomposition'; tag: 'Block' }
  | { type: 'DomainDecomposition'; tag: 'Adaptive_Octree' }
  | { type: 'DomainDecomposition'; tag: 'Hilbert_SFC' }
  | { type: 'DomainDecomposition'; tag: 'DomainDecomposition_MAX' };
export const DomainDecomposition = {
  None: (): DomainDecomposition => ({ type: 'DomainDecomposition', tag: 'None' }),
  Slab: (): DomainDecomposition => ({ type: 'DomainDecomposition', tag: 'Slab' }),
  Pencil: (): DomainDecomposition => ({ type: 'DomainDecomposition', tag: 'Pencil' }),
  Block: (): DomainDecomposition => ({ type: 'DomainDecomposition', tag: 'Block' }),
  Adaptive_Octree: (): DomainDecomposition => ({ type: 'DomainDecomposition', tag: 'Adaptive_Octree' }),
  Hilbert_SFC: (): DomainDecomposition => ({ type: 'DomainDecomposition', tag: 'Hilbert_SFC' }),
  DomainDecomposition_MAX: (): DomainDecomposition => ({ type: 'DomainDecomposition', tag: 'DomainDecomposition_MAX' }),
} as const;

export type CacheStrategy =
  | { type: 'CacheStrategy'; tag: 'None' }
  | { type: 'CacheStrategy'; tag: 'LRU' }
  | { type: 'CacheStrategy'; tag: 'LFU' }
  | { type: 'CacheStrategy'; tag: 'Adaptive' }
  | { type: 'CacheStrategy'; tag: 'Predictive' }
  | { type: 'CacheStrategy'; tag: 'CacheStrategy_MAX' };
export const CacheStrategy = {
  None: (): CacheStrategy => ({ type: 'CacheStrategy', tag: 'None' }),
  LRU: (): CacheStrategy => ({ type: 'CacheStrategy', tag: 'LRU' }),
  LFU: (): CacheStrategy => ({ type: 'CacheStrategy', tag: 'LFU' }),
  Adaptive: (): CacheStrategy => ({ type: 'CacheStrategy', tag: 'Adaptive' }),
  Predictive: (): CacheStrategy => ({ type: 'CacheStrategy', tag: 'Predictive' }),
  CacheStrategy_MAX: (): CacheStrategy => ({ type: 'CacheStrategy', tag: 'CacheStrategy_MAX' }),
} as const;

export type PrecisionMode =
  | { type: 'PrecisionMode'; tag: 'Float16' }
  | { type: 'PrecisionMode'; tag: 'Float32' }
  | { type: 'PrecisionMode'; tag: 'Float64' }
  | { type: 'PrecisionMode'; tag: 'Mixed_Precision' }
  | { type: 'PrecisionMode'; tag: 'Adaptive_Precision' }
  | { type: 'PrecisionMode'; tag: 'PrecisionMode_MAX' };
export const PrecisionMode = {
  Float16: (): PrecisionMode => ({ type: 'PrecisionMode', tag: 'Float16' }),
  Float32: (): PrecisionMode => ({ type: 'PrecisionMode', tag: 'Float32' }),
  Float64: (): PrecisionMode => ({ type: 'PrecisionMode', tag: 'Float64' }),
  Mixed_Precision: (): PrecisionMode => ({ type: 'PrecisionMode', tag: 'Mixed_Precision' }),
  Adaptive_Precision: (): PrecisionMode => ({ type: 'PrecisionMode', tag: 'Adaptive_Precision' }),
  PrecisionMode_MAX: (): PrecisionMode => ({ type: 'PrecisionMode', tag: 'PrecisionMode_MAX' }),
} as const;

export type ConvergenceCriteria =
  | { type: 'ConvergenceCriteria'; tag: 'Absolute_Residual' }
  | { type: 'ConvergenceCriteria'; tag: 'Relative_Residual' }
  | { type: 'ConvergenceCriteria'; tag: 'Solution_Change' }
  | { type: 'ConvergenceCriteria'; tag: 'Energy_Norm' }
  | { type: 'ConvergenceCriteria'; tag: 'L2_Norm' }
  | { type: 'ConvergenceCriteria'; tag: 'Linf_Norm' }
  | { type: 'ConvergenceCriteria'; tag: 'ConvergenceCriteria_MAX' };
export const ConvergenceCriteria = {
  Absolute_Residual: (): ConvergenceCriteria => ({ type: 'ConvergenceCriteria', tag: 'Absolute_Residual' }),
  Relative_Residual: (): ConvergenceCriteria => ({ type: 'ConvergenceCriteria', tag: 'Relative_Residual' }),
  Solution_Change: (): ConvergenceCriteria => ({ type: 'ConvergenceCriteria', tag: 'Solution_Change' }),
  Energy_Norm: (): ConvergenceCriteria => ({ type: 'ConvergenceCriteria', tag: 'Energy_Norm' }),
  L2_Norm: (): ConvergenceCriteria => ({ type: 'ConvergenceCriteria', tag: 'L2_Norm' }),
  Linf_Norm: (): ConvergenceCriteria => ({ type: 'ConvergenceCriteria', tag: 'Linf_Norm' }),
  ConvergenceCriteria_MAX: (): ConvergenceCriteria => ({ type: 'ConvergenceCriteria', tag: 'ConvergenceCriteria_MAX' }),
} as const;

export type ValidationCaseType =
  | { type: 'ValidationCaseType'; tag: 'TaylorGreenVortex' }
  | { type: 'ValidationCaseType'; tag: 'LidDrivenCavity' }
  | { type: 'ValidationCaseType'; tag: 'PoiseuilleFlow' }
  | { type: 'ValidationCaseType'; tag: 'CouetteFlow' }
  | { type: 'ValidationCaseType'; tag: 'RayleighBenardConvection' }
  | { type: 'ValidationCaseType'; tag: 'KelvinHelmholtzInstability' }
  | { type: 'ValidationCaseType'; tag: 'RayleighTaylorInstability' }
  | { type: 'ValidationCaseType'; tag: 'ShockTube_Sod' }
  | { type: 'ValidationCaseType'; tag: 'ShockTube_Lax' }
  | { type: 'ValidationCaseType'; tag: 'DamBreak' }
  | { type: 'ValidationCaseType'; tag: 'RisingBubble' }
  | { type: 'ValidationCaseType'; tag: 'FallingDroplet' }
  | { type: 'ValidationCaseType'; tag: 'VonKarmanVortexStreet' }
  | { type: 'ValidationCaseType'; tag: 'BackwardFacingStep' }
  | { type: 'ValidationCaseType'; tag: 'ChannelFlow' }
  | { type: 'ValidationCaseType'; tag: 'ValidationCaseType_MAX' };
export const ValidationCaseType = {
  TaylorGreenVortex: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'TaylorGreenVortex' }),
  LidDrivenCavity: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'LidDrivenCavity' }),
  PoiseuilleFlow: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'PoiseuilleFlow' }),
  CouetteFlow: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'CouetteFlow' }),
  RayleighBenardConvection: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'RayleighBenardConvection' }),
  KelvinHelmholtzInstability: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'KelvinHelmholtzInstability' }),
  RayleighTaylorInstability: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'RayleighTaylorInstability' }),
  ShockTube_Sod: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'ShockTube_Sod' }),
  ShockTube_Lax: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'ShockTube_Lax' }),
  DamBreak: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'DamBreak' }),
  RisingBubble: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'RisingBubble' }),
  FallingDroplet: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'FallingDroplet' }),
  VonKarmanVortexStreet: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'VonKarmanVortexStreet' }),
  BackwardFacingStep: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'BackwardFacingStep' }),
  ChannelFlow: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'ChannelFlow' }),
  ValidationCaseType_MAX: (): ValidationCaseType => ({ type: 'ValidationCaseType', tag: 'ValidationCaseType_MAX' }),
} as const;

export interface FluidPresetShape {
  id: number;
  name: string;
  fluid_class: FluidClass;
  solver: SolverFamily;
  turbulence: TurbulenceModel;
  boundary: BoundaryType;
  coupling: Array<CouplingField>;
  quality: QualityTier;
  backend: GPUBackend;
  adaptive: AdaptiveStrategy;
  time_integrator: TimeIntegrator;
  viscosity: number;
  density: number;
  surface_tension: number;
  compressibility: number;
  conductivity: number;
  permittivity: number;
  permeability: number;
  chemical_reactivity: number;
  radiation_absorption: number;
  gravity_scale: number;
  anisotropy: number;
  cavitation_threshold: number;
  yield_stress: number;
  foam_threshold: number;
  spray_threshold: number;
  bubble_coalescence: number;
  turbulence_intensity: number;
  vorticity_confinement: number;
  adaptive_refine_threshold: number;
  adaptive_coarsen_threshold: number;
}
export class FluidPreset implements FluidPresetShape {
  id: number;
  name: string;
  fluid_class: FluidClass;
  solver: SolverFamily;
  turbulence: TurbulenceModel;
  boundary: BoundaryType;
  coupling: Array<CouplingField>;
  quality: QualityTier;
  backend: GPUBackend;
  adaptive: AdaptiveStrategy;
  time_integrator: TimeIntegrator;
  viscosity: number;
  density: number;
  surface_tension: number;
  compressibility: number;
  conductivity: number;
  permittivity: number;
  permeability: number;
  chemical_reactivity: number;
  radiation_absorption: number;
  gravity_scale: number;
  anisotropy: number;
  cavitation_threshold: number;
  yield_stress: number;
  foam_threshold: number;
  spray_threshold: number;
  bubble_coalescence: number;
  turbulence_intensity: number;
  vorticity_confinement: number;
  adaptive_refine_threshold: number;
  adaptive_coarsen_threshold: number;
  
  constructor(id: number, name: string, fluid_class: FluidClass, solver: SolverFamily, turbulence: TurbulenceModel, boundary: BoundaryType, coupling: Array<CouplingField>, quality: QualityTier, backend: GPUBackend, adaptive: AdaptiveStrategy, time_integrator: TimeIntegrator, viscosity: number, density: number, surface_tension: number, compressibility: number, conductivity: number, permittivity: number, permeability: number, chemical_reactivity: number, radiation_absorption: number, gravity_scale: number, anisotropy: number, cavitation_threshold: number, yield_stress: number, foam_threshold: number, spray_threshold: number, bubble_coalescence: number, turbulence_intensity: number, vorticity_confinement: number, adaptive_refine_threshold: number, adaptive_coarsen_threshold: number) {
    this.id = id;
    this.name = name;
    this.fluid_class = fluid_class;
    this.solver = solver;
    this.turbulence = turbulence;
    this.boundary = boundary;
    this.coupling = coupling;
    this.quality = quality;
    this.backend = backend;
    this.adaptive = adaptive;
    this.time_integrator = time_integrator;
    this.viscosity = viscosity;
    this.density = density;
    this.surface_tension = surface_tension;
    this.compressibility = compressibility;
    this.conductivity = conductivity;
    this.permittivity = permittivity;
    this.permeability = permeability;
    this.chemical_reactivity = chemical_reactivity;
    this.radiation_absorption = radiation_absorption;
    this.gravity_scale = gravity_scale;
    this.anisotropy = anisotropy;
    this.cavitation_threshold = cavitation_threshold;
    this.yield_stress = yield_stress;
    this.foam_threshold = foam_threshold;
    this.spray_threshold = spray_threshold;
    this.bubble_coalescence = bubble_coalescence;
    this.turbulence_intensity = turbulence_intensity;
    this.vorticity_confinement = vorticity_confinement;
    this.adaptive_refine_threshold = adaptive_refine_threshold;
    this.adaptive_coarsen_threshold = adaptive_coarsen_threshold;
  }
}

export interface FluidMaterialShape {
  id: number;
  name: string;
  molecular_weight: number;
  critical_temperature: number;
  critical_pressure: number;
  boiling_point: number;
  melting_point: number;
  triple_point_temp: number;
  triple_point_pressure: number;
  viscosity_ref: number;
  viscosity_temperature_coeff: number;
  thermal_conductivity: number;
  thermal_diffusivity: number;
  mass_diffusivity: number;
  gas_constant: number;
  specific_heat_cp: number;
  specific_heat_cv: number;
  gamma: number;
  surface_tension_ref: number;
  surface_tension_temp_coeff: number;
  contact_angle_glass: number;
  contact_angle_metal: number;
  contact_angle_polymer: number;
  refractive_index: number;
  absorption_coefficient: [number, number, number];
  scattering_coefficient: [number, number, number];
  anisotropy_factor: number;
  electrical_conductivity: number;
  magnetic_susceptibility: number;
  dielectric_constant: number;
  ph_value: number;
  oxidation_potential: number;
  reaction_enthalpy: number;
  activation_energy: number;
}
export class FluidMaterial implements FluidMaterialShape {
  id: number;
  name: string;
  molecular_weight: number;
  critical_temperature: number;
  critical_pressure: number;
  boiling_point: number;
  melting_point: number;
  triple_point_temp: number;
  triple_point_pressure: number;
  viscosity_ref: number;
  viscosity_temperature_coeff: number;
  thermal_conductivity: number;
  thermal_diffusivity: number;
  mass_diffusivity: number;
  gas_constant: number;
  specific_heat_cp: number;
  specific_heat_cv: number;
  gamma: number;
  surface_tension_ref: number;
  surface_tension_temp_coeff: number;
  contact_angle_glass: number;
  contact_angle_metal: number;
  contact_angle_polymer: number;
  refractive_index: number;
  absorption_coefficient: [number, number, number];
  scattering_coefficient: [number, number, number];
  anisotropy_factor: number;
  electrical_conductivity: number;
  magnetic_susceptibility: number;
  dielectric_constant: number;
  ph_value: number;
  oxidation_potential: number;
  reaction_enthalpy: number;
  activation_energy: number;
  
  constructor(id: number, name: string, molecular_weight: number, critical_temperature: number, critical_pressure: number, boiling_point: number, melting_point: number, triple_point_temp: number, triple_point_pressure: number, viscosity_ref: number, viscosity_temperature_coeff: number, thermal_conductivity: number, thermal_diffusivity: number, mass_diffusivity: number, gas_constant: number, specific_heat_cp: number, specific_heat_cv: number, gamma: number, surface_tension_ref: number, surface_tension_temp_coeff: number, contact_angle_glass: number, contact_angle_metal: number, contact_angle_polymer: number, refractive_index: number, absorption_coefficient: [number, number, number], scattering_coefficient: [number, number, number], anisotropy_factor: number, electrical_conductivity: number, magnetic_susceptibility: number, dielectric_constant: number, ph_value: number, oxidation_potential: number, reaction_enthalpy: number, activation_energy: number) {
    this.id = id;
    this.name = name;
    this.molecular_weight = molecular_weight;
    this.critical_temperature = critical_temperature;
    this.critical_pressure = critical_pressure;
    this.boiling_point = boiling_point;
    this.melting_point = melting_point;
    this.triple_point_temp = triple_point_temp;
    this.triple_point_pressure = triple_point_pressure;
    this.viscosity_ref = viscosity_ref;
    this.viscosity_temperature_coeff = viscosity_temperature_coeff;
    this.thermal_conductivity = thermal_conductivity;
    this.thermal_diffusivity = thermal_diffusivity;
    this.mass_diffusivity = mass_diffusivity;
    this.gas_constant = gas_constant;
    this.specific_heat_cp = specific_heat_cp;
    this.specific_heat_cv = specific_heat_cv;
    this.gamma = gamma;
    this.surface_tension_ref = surface_tension_ref;
    this.surface_tension_temp_coeff = surface_tension_temp_coeff;
    this.contact_angle_glass = contact_angle_glass;
    this.contact_angle_metal = contact_angle_metal;
    this.contact_angle_polymer = contact_angle_polymer;
    this.refractive_index = refractive_index;
    this.absorption_coefficient = absorption_coefficient;
    this.scattering_coefficient = scattering_coefficient;
    this.anisotropy_factor = anisotropy_factor;
    this.electrical_conductivity = electrical_conductivity;
    this.magnetic_susceptibility = magnetic_susceptibility;
    this.dielectric_constant = dielectric_constant;
    this.ph_value = ph_value;
    this.oxidation_potential = oxidation_potential;
    this.reaction_enthalpy = reaction_enthalpy;
    this.activation_energy = activation_energy;
  }
}

export interface MaterialLookupShape {
  id: number;
  name: string;
  absorption: [number, number, number];
  scattering: [number, number, number];
  emission: [number, number, number];
  ior: number;
  roughness: number;
  metallic: number;
  subsurface: number;
  foam_color: [number, number, number];
  bubble_color: [number, number, number];
  dispersion: number;
}
export class MaterialLookup implements MaterialLookupShape {
  id: number;
  name: string;
  absorption: [number, number, number];
  scattering: [number, number, number];
  emission: [number, number, number];
  ior: number;
  roughness: number;
  metallic: number;
  subsurface: number;
  foam_color: [number, number, number];
  bubble_color: [number, number, number];
  dispersion: number;
  
  constructor(id: number, name: string, absorption: [number, number, number], scattering: [number, number, number], emission: [number, number, number], ior: number, roughness: number, metallic: number, subsurface: number, foam_color: [number, number, number], bubble_color: [number, number, number], dispersion: number) {
    this.id = id;
    this.name = name;
    this.absorption = absorption;
    this.scattering = scattering;
    this.emission = emission;
    this.ior = ior;
    this.roughness = roughness;
    this.metallic = metallic;
    this.subsurface = subsurface;
    this.foam_color = foam_color;
    this.bubble_color = bubble_color;
    this.dispersion = dispersion;
  }
}

export interface BoundaryProfileShape {
  id: number;
  name: string;
  boundary_type: BoundaryType;
  velocity_profile: VelocityProfile;
  temperature_profile: TemperatureProfile;
  pressure_profile: PressureProfile;
  friction: number;
  slip_factor: number;
  inflow_velocity: [number, number, number];
  inflow_temperature: number;
  inflow_density: number;
  sponge_strength: number;
  moving_velocity: [number, number, number];
  wall_roughness: number;
  wall_temperature: number;
  wall_heat_flux: number;
  slip_length: number;
  contact_angle_advancing: number;
  contact_angle_receding: number;
  contact_angle_hysteresis: number;
  porous_permeability: number;
  porous_porosity: number;
  sponge_layer_thickness: number;
  sponge_damping_coefficient: number;
  moving_wall_angular_velocity: [number, number, number];
  inflow_turbulence_seed: number;
  outflow_convective_velocity: number;
}
export class BoundaryProfile implements BoundaryProfileShape {
  id: number;
  name: string;
  boundary_type: BoundaryType;
  velocity_profile: VelocityProfile;
  temperature_profile: TemperatureProfile;
  pressure_profile: PressureProfile;
  friction: number;
  slip_factor: number;
  inflow_velocity: [number, number, number];
  inflow_temperature: number;
  inflow_density: number;
  sponge_strength: number;
  moving_velocity: [number, number, number];
  wall_roughness: number;
  wall_temperature: number;
  wall_heat_flux: number;
  slip_length: number;
  contact_angle_advancing: number;
  contact_angle_receding: number;
  contact_angle_hysteresis: number;
  porous_permeability: number;
  porous_porosity: number;
  sponge_layer_thickness: number;
  sponge_damping_coefficient: number;
  moving_wall_angular_velocity: [number, number, number];
  inflow_turbulence_seed: number;
  outflow_convective_velocity: number;
  
  constructor(id: number, name: string, boundary_type: BoundaryType, velocity_profile: VelocityProfile, temperature_profile: TemperatureProfile, pressure_profile: PressureProfile, friction: number, slip_factor: number, inflow_velocity: [number, number, number], inflow_temperature: number, inflow_density: number, sponge_strength: number, moving_velocity: [number, number, number], wall_roughness: number, wall_temperature: number, wall_heat_flux: number, slip_length: number, contact_angle_advancing: number, contact_angle_receding: number, contact_angle_hysteresis: number, porous_permeability: number, porous_porosity: number, sponge_layer_thickness: number, sponge_damping_coefficient: number, moving_wall_angular_velocity: [number, number, number], inflow_turbulence_seed: number, outflow_convective_velocity: number) {
    this.id = id;
    this.name = name;
    this.boundary_type = boundary_type;
    this.velocity_profile = velocity_profile;
    this.temperature_profile = temperature_profile;
    this.pressure_profile = pressure_profile;
    this.friction = friction;
    this.slip_factor = slip_factor;
    this.inflow_velocity = inflow_velocity;
    this.inflow_temperature = inflow_temperature;
    this.inflow_density = inflow_density;
    this.sponge_strength = sponge_strength;
    this.moving_velocity = moving_velocity;
    this.wall_roughness = wall_roughness;
    this.wall_temperature = wall_temperature;
    this.wall_heat_flux = wall_heat_flux;
    this.slip_length = slip_length;
    this.contact_angle_advancing = contact_angle_advancing;
    this.contact_angle_receding = contact_angle_receding;
    this.contact_angle_hysteresis = contact_angle_hysteresis;
    this.porous_permeability = porous_permeability;
    this.porous_porosity = porous_porosity;
    this.sponge_layer_thickness = sponge_layer_thickness;
    this.sponge_damping_coefficient = sponge_damping_coefficient;
    this.moving_wall_angular_velocity = moving_wall_angular_velocity;
    this.inflow_turbulence_seed = inflow_turbulence_seed;
    this.outflow_convective_velocity = outflow_convective_velocity;
  }
}

export interface TurbulenceProfileShape {
  id: number;
  name: string;
  model: TurbulenceModel;
  les_model: LESModel;
  rans_model: RANSModel;
  wall_function: WallFunction;
  c_mu: number;
  c1: number;
  c2: number;
  k_min: number;
  omega_min: number;
  length_scale: number;
  filter_width: number;
  wall_damping: number;
  smagorinsky_constant: number;
  wale_constant: number;
  vreman_constant: number;
  y_plus_target: number;
  transition_model: TransitionModel;
  intermittency: number;
  transition_onset_reynolds: number;
  synthetic_method: SyntheticTurbulence;
  eddy_count: number;
  eddy_lifetime: number;
}
export class TurbulenceProfile implements TurbulenceProfileShape {
  id: number;
  name: string;
  model: TurbulenceModel;
  les_model: LESModel;
  rans_model: RANSModel;
  wall_function: WallFunction;
  c_mu: number;
  c1: number;
  c2: number;
  k_min: number;
  omega_min: number;
  length_scale: number;
  filter_width: number;
  wall_damping: number;
  smagorinsky_constant: number;
  wale_constant: number;
  vreman_constant: number;
  y_plus_target: number;
  transition_model: TransitionModel;
  intermittency: number;
  transition_onset_reynolds: number;
  synthetic_method: SyntheticTurbulence;
  eddy_count: number;
  eddy_lifetime: number;
  
  constructor(id: number, name: string, model: TurbulenceModel, les_model: LESModel, rans_model: RANSModel, wall_function: WallFunction, c_mu: number, c1: number, c2: number, k_min: number, omega_min: number, length_scale: number, filter_width: number, wall_damping: number, smagorinsky_constant: number, wale_constant: number, vreman_constant: number, y_plus_target: number, transition_model: TransitionModel, intermittency: number, transition_onset_reynolds: number, synthetic_method: SyntheticTurbulence, eddy_count: number, eddy_lifetime: number) {
    this.id = id;
    this.name = name;
    this.model = model;
    this.les_model = les_model;
    this.rans_model = rans_model;
    this.wall_function = wall_function;
    this.c_mu = c_mu;
    this.c1 = c1;
    this.c2 = c2;
    this.k_min = k_min;
    this.omega_min = omega_min;
    this.length_scale = length_scale;
    this.filter_width = filter_width;
    this.wall_damping = wall_damping;
    this.smagorinsky_constant = smagorinsky_constant;
    this.wale_constant = wale_constant;
    this.vreman_constant = vreman_constant;
    this.y_plus_target = y_plus_target;
    this.transition_model = transition_model;
    this.intermittency = intermittency;
    this.transition_onset_reynolds = transition_onset_reynolds;
    this.synthetic_method = synthetic_method;
    this.eddy_count = eddy_count;
    this.eddy_lifetime = eddy_lifetime;
  }
}

export interface CouplingProfileShape {
  id: number;
  name: string;
  field: CouplingField;
  strategy: CouplingStrategy;
  strength: number;
  diffusion: number;
  reaction_rate: number;
  source_term: number;
  sink_term: number;
  boundary_exchange: number;
  cross_field_coeff: number;
  coupling_timestep_ratio: number;
  coupling_tolerance: number;
  coupling_max_iterations: number;
}
export class CouplingProfile implements CouplingProfileShape {
  id: number;
  name: string;
  field: CouplingField;
  strategy: CouplingStrategy;
  strength: number;
  diffusion: number;
  reaction_rate: number;
  source_term: number;
  sink_term: number;
  boundary_exchange: number;
  cross_field_coeff: number;
  coupling_timestep_ratio: number;
  coupling_tolerance: number;
  coupling_max_iterations: number;
  
  constructor(id: number, name: string, field: CouplingField, strategy: CouplingStrategy, strength: number, diffusion: number, reaction_rate: number, source_term: number, sink_term: number, boundary_exchange: number, cross_field_coeff: number, coupling_timestep_ratio: number, coupling_tolerance: number, coupling_max_iterations: number) {
    this.id = id;
    this.name = name;
    this.field = field;
    this.strategy = strategy;
    this.strength = strength;
    this.diffusion = diffusion;
    this.reaction_rate = reaction_rate;
    this.source_term = source_term;
    this.sink_term = sink_term;
    this.boundary_exchange = boundary_exchange;
    this.cross_field_coeff = cross_field_coeff;
    this.coupling_timestep_ratio = coupling_timestep_ratio;
    this.coupling_tolerance = coupling_tolerance;
    this.coupling_max_iterations = coupling_max_iterations;
  }
}

export interface VisualizationPresetShape {
  id: number;
  name: string;
  mode: VisualizationMode;
  exposure: number;
  contrast: number;
  saturation: number;
  line_thickness: number;
  sample_count: number;
  step_size: number;
  color_a: [number, number, number];
  color_b: [number, number, number];
  color_c: [number, number, number];
  foam_emissive: number;
  bubble_emissive: number;
  shock_gain: number;
  holography_phase_gain: number;
}
export class VisualizationPreset implements VisualizationPresetShape {
  id: number;
  name: string;
  mode: VisualizationMode;
  exposure: number;
  contrast: number;
  saturation: number;
  line_thickness: number;
  sample_count: number;
  step_size: number;
  color_a: [number, number, number];
  color_b: [number, number, number];
  color_c: [number, number, number];
  foam_emissive: number;
  bubble_emissive: number;
  shock_gain: number;
  holography_phase_gain: number;
  
  constructor(id: number, name: string, mode: VisualizationMode, exposure: number, contrast: number, saturation: number, line_thickness: number, sample_count: number, step_size: number, color_a: [number, number, number], color_b: [number, number, number], color_c: [number, number, number], foam_emissive: number, bubble_emissive: number, shock_gain: number, holography_phase_gain: number) {
    this.id = id;
    this.name = name;
    this.mode = mode;
    this.exposure = exposure;
    this.contrast = contrast;
    this.saturation = saturation;
    this.line_thickness = line_thickness;
    this.sample_count = sample_count;
    this.step_size = step_size;
    this.color_a = color_a;
    this.color_b = color_b;
    this.color_c = color_c;
    this.foam_emissive = foam_emissive;
    this.bubble_emissive = bubble_emissive;
    this.shock_gain = shock_gain;
    this.holography_phase_gain = holography_phase_gain;
  }
}

export interface ValidationCaseShape {
  id: number;
  name: string;
  case_type: ValidationCaseType;
  reference_solution: string;
  tolerance: number;
  expected_convergence_rate: number;
  grid_resolution: [number, number, number];
  time_steps: number;
  physical_time: number;
}
export class ValidationCase implements ValidationCaseShape {
  id: number;
  name: string;
  case_type: ValidationCaseType;
  reference_solution: string;
  tolerance: number;
  expected_convergence_rate: number;
  grid_resolution: [number, number, number];
  time_steps: number;
  physical_time: number;
  
  constructor(id: number, name: string, case_type: ValidationCaseType, reference_solution: string, tolerance: number, expected_convergence_rate: number, grid_resolution: [number, number, number], time_steps: number, physical_time: number) {
    this.id = id;
    this.name = name;
    this.case_type = case_type;
    this.reference_solution = reference_solution;
    this.tolerance = tolerance;
    this.expected_convergence_rate = expected_convergence_rate;
    this.grid_resolution = grid_resolution;
    this.time_steps = time_steps;
    this.physical_time = physical_time;
  }
}

export interface GridResolutionComponentShape {
  grid_dim: [number, number, number];
  cell_size: [number, number, number];
  adaptive: AdaptiveStrategy;
  refine_threshold: number;
  coarsen_threshold: number;
  max_refine_level: number;
  min_cell_size: number;
}
export class GridResolutionComponent implements GridResolutionComponentShape {
  grid_dim: [number, number, number];
  cell_size: [number, number, number];
  adaptive: AdaptiveStrategy;
  refine_threshold: number;
  coarsen_threshold: number;
  max_refine_level: number;
  min_cell_size: number;
  
  constructor(grid_dim: [number, number, number], cell_size: [number, number, number], adaptive: AdaptiveStrategy, refine_threshold: number, coarsen_threshold: number, max_refine_level: number, min_cell_size: number) {
    this.grid_dim = grid_dim;
    this.cell_size = cell_size;
    this.adaptive = adaptive;
    this.refine_threshold = refine_threshold;
    this.coarsen_threshold = coarsen_threshold;
    this.max_refine_level = max_refine_level;
    this.min_cell_size = min_cell_size;
  }
}

export interface TimeIntegrationComponentShape {
  dt: number;
  time_integrator: TimeIntegrator;
  cfl: number;
  substeps: number;
  real_time_sync: boolean;
  clamp_dt: boolean;
  max_dt: number;
  min_dt: number;
}
export class TimeIntegrationComponent implements TimeIntegrationComponentShape {
  dt: number;
  time_integrator: TimeIntegrator;
  cfl: number;
  substeps: number;
  real_time_sync: boolean;
  clamp_dt: boolean;
  max_dt: number;
  min_dt: number;
  
  constructor(dt: number, time_integrator: TimeIntegrator, cfl: number, substeps: number, real_time_sync: boolean, clamp_dt: boolean, max_dt: number, min_dt: number) {
    this.dt = dt;
    this.time_integrator = time_integrator;
    this.cfl = cfl;
    this.substeps = substeps;
    this.real_time_sync = real_time_sync;
    this.clamp_dt = clamp_dt;
    this.max_dt = max_dt;
    this.min_dt = min_dt;
  }
}

export interface PhysicalPropertiesComponentShape {
  fluid_class: FluidClass;
  solver_family: SolverFamily;
  hybrid_solver: HybridSolver;
  pressure_solver: PressureSolver;
  advection_scheme: AdvectionScheme;
  turbulence_model: TurbulenceModel;
  boundary_type: BoundaryType;
  coupling_fields: Array<CouplingField>;
  quality: QualityTier;
  backend: GPUBackend;
  viscosity: number;
  density: number;
  surface_tension: number;
  compressibility: number;
  conductivity: number;
  permittivity: number;
  permeability: number;
  reactivity: number;
  radiation_absorption: number;
  gravity_scale: number;
  anisotropy: number;
  cavitation_threshold: number;
  yield_stress: number;
  foam_threshold: number;
  spray_threshold: number;
  bubble_coalescence: number;
}
export class PhysicalPropertiesComponent implements PhysicalPropertiesComponentShape {
  fluid_class: FluidClass;
  solver_family: SolverFamily;
  hybrid_solver: HybridSolver;
  pressure_solver: PressureSolver;
  advection_scheme: AdvectionScheme;
  turbulence_model: TurbulenceModel;
  boundary_type: BoundaryType;
  coupling_fields: Array<CouplingField>;
  quality: QualityTier;
  backend: GPUBackend;
  viscosity: number;
  density: number;
  surface_tension: number;
  compressibility: number;
  conductivity: number;
  permittivity: number;
  permeability: number;
  reactivity: number;
  radiation_absorption: number;
  gravity_scale: number;
  anisotropy: number;
  cavitation_threshold: number;
  yield_stress: number;
  foam_threshold: number;
  spray_threshold: number;
  bubble_coalescence: number;
  
  constructor(fluid_class: FluidClass, solver_family: SolverFamily, hybrid_solver: HybridSolver, pressure_solver: PressureSolver, advection_scheme: AdvectionScheme, turbulence_model: TurbulenceModel, boundary_type: BoundaryType, coupling_fields: Array<CouplingField>, quality: QualityTier, backend: GPUBackend, viscosity: number, density: number, surface_tension: number, compressibility: number, conductivity: number, permittivity: number, permeability: number, reactivity: number, radiation_absorption: number, gravity_scale: number, anisotropy: number, cavitation_threshold: number, yield_stress: number, foam_threshold: number, spray_threshold: number, bubble_coalescence: number) {
    this.fluid_class = fluid_class;
    this.solver_family = solver_family;
    this.hybrid_solver = hybrid_solver;
    this.pressure_solver = pressure_solver;
    this.advection_scheme = advection_scheme;
    this.turbulence_model = turbulence_model;
    this.boundary_type = boundary_type;
    this.coupling_fields = coupling_fields;
    this.quality = quality;
    this.backend = backend;
    this.viscosity = viscosity;
    this.density = density;
    this.surface_tension = surface_tension;
    this.compressibility = compressibility;
    this.conductivity = conductivity;
    this.permittivity = permittivity;
    this.permeability = permeability;
    this.reactivity = reactivity;
    this.radiation_absorption = radiation_absorption;
    this.gravity_scale = gravity_scale;
    this.anisotropy = anisotropy;
    this.cavitation_threshold = cavitation_threshold;
    this.yield_stress = yield_stress;
    this.foam_threshold = foam_threshold;
    this.spray_threshold = spray_threshold;
    this.bubble_coalescence = bubble_coalescence;
  }
}

export interface TurbulenceComponentShape {
  intensity: number;
  vortex_confinement: number;
  energy_injection: number;
  dissipation: number;
  length_scale: number;
  noise_seed: number;
}
export class TurbulenceComponent implements TurbulenceComponentShape {
  intensity: number;
  vortex_confinement: number;
  energy_injection: number;
  dissipation: number;
  length_scale: number;
  noise_seed: number;
  
  constructor(intensity: number, vortex_confinement: number, energy_injection: number, dissipation: number, length_scale: number, noise_seed: number) {
    this.intensity = intensity;
    this.vortex_confinement = vortex_confinement;
    this.energy_injection = energy_injection;
    this.dissipation = dissipation;
    this.length_scale = length_scale;
    this.noise_seed = noise_seed;
  }
}

export interface TurbulenceAdvancedComponentShape {
  les_model: LESModel;
  rans_model: RANSModel;
  wall_function: WallFunction;
  smagorinsky_constant: number;
  wale_constant: number;
  vreman_constant: number;
  k_epsilon_c_mu: number;
  k_epsilon_c1: number;
  k_epsilon_c2: number;
  k_omega_beta_star: number;
  k_omega_sigma_k: number;
  k_omega_sigma_omega: number;
  y_plus_target: number;
  wall_damping: boolean;
  transition_model: TransitionModel;
  intermittency: number;
  transition_onset_reynolds: number;
  synthetic_method: SyntheticTurbulence;
  eddy_count: number;
  eddy_lifetime: number;
  reynolds_stress_model: ReynoldsStressModel;
  anisotropy_tensor: Array<number>;
}
export class TurbulenceAdvancedComponent implements TurbulenceAdvancedComponentShape {
  les_model: LESModel;
  rans_model: RANSModel;
  wall_function: WallFunction;
  smagorinsky_constant: number;
  wale_constant: number;
  vreman_constant: number;
  k_epsilon_c_mu: number;
  k_epsilon_c1: number;
  k_epsilon_c2: number;
  k_omega_beta_star: number;
  k_omega_sigma_k: number;
  k_omega_sigma_omega: number;
  y_plus_target: number;
  wall_damping: boolean;
  transition_model: TransitionModel;
  intermittency: number;
  transition_onset_reynolds: number;
  synthetic_method: SyntheticTurbulence;
  eddy_count: number;
  eddy_lifetime: number;
  reynolds_stress_model: ReynoldsStressModel;
  anisotropy_tensor: Array<number>;
  
  constructor(les_model: LESModel, rans_model: RANSModel, wall_function: WallFunction, smagorinsky_constant: number, wale_constant: number, vreman_constant: number, k_epsilon_c_mu: number, k_epsilon_c1: number, k_epsilon_c2: number, k_omega_beta_star: number, k_omega_sigma_k: number, k_omega_sigma_omega: number, y_plus_target: number, wall_damping: boolean, transition_model: TransitionModel, intermittency: number, transition_onset_reynolds: number, synthetic_method: SyntheticTurbulence, eddy_count: number, eddy_lifetime: number, reynolds_stress_model: ReynoldsStressModel, anisotropy_tensor: Array<number>) {
    this.les_model = les_model;
    this.rans_model = rans_model;
    this.wall_function = wall_function;
    this.smagorinsky_constant = smagorinsky_constant;
    this.wale_constant = wale_constant;
    this.vreman_constant = vreman_constant;
    this.k_epsilon_c_mu = k_epsilon_c_mu;
    this.k_epsilon_c1 = k_epsilon_c1;
    this.k_epsilon_c2 = k_epsilon_c2;
    this.k_omega_beta_star = k_omega_beta_star;
    this.k_omega_sigma_k = k_omega_sigma_k;
    this.k_omega_sigma_omega = k_omega_sigma_omega;
    this.y_plus_target = y_plus_target;
    this.wall_damping = wall_damping;
    this.transition_model = transition_model;
    this.intermittency = intermittency;
    this.transition_onset_reynolds = transition_onset_reynolds;
    this.synthetic_method = synthetic_method;
    this.eddy_count = eddy_count;
    this.eddy_lifetime = eddy_lifetime;
    this.reynolds_stress_model = reynolds_stress_model;
    this.anisotropy_tensor = anisotropy_tensor;
  }
}

export interface MultiphaseComponentShape {
  phases: number;
  phase_field_mobility: number;
  interface_thickness: number;
  surface_tension_coupling: number;
  contact_angle: number;
  bubble_spawn_rate: number;
  droplet_spawn_rate: number;
}
export class MultiphaseComponent implements MultiphaseComponentShape {
  phases: number;
  phase_field_mobility: number;
  interface_thickness: number;
  surface_tension_coupling: number;
  contact_angle: number;
  bubble_spawn_rate: number;
  droplet_spawn_rate: number;
  
  constructor(phases: number, phase_field_mobility: number, interface_thickness: number, surface_tension_coupling: number, contact_angle: number, bubble_spawn_rate: number, droplet_spawn_rate: number) {
    this.phases = phases;
    this.phase_field_mobility = phase_field_mobility;
    this.interface_thickness = interface_thickness;
    this.surface_tension_coupling = surface_tension_coupling;
    this.contact_angle = contact_angle;
    this.bubble_spawn_rate = bubble_spawn_rate;
    this.droplet_spawn_rate = droplet_spawn_rate;
  }
}

export interface ThermalComponentShape {
  temperature: number;
  thermal_diffusivity: number;
  buoyancy_alpha: number;
  buoyancy_beta: number;
  radiation_gain: number;
  radiation_model: RadiationModel;
  heat_sources: Array<number>;
}
export class ThermalComponent implements ThermalComponentShape {
  temperature: number;
  thermal_diffusivity: number;
  buoyancy_alpha: number;
  buoyancy_beta: number;
  radiation_gain: number;
  radiation_model: RadiationModel;
  heat_sources: Array<number>;
  
  constructor(temperature: number, thermal_diffusivity: number, buoyancy_alpha: number, buoyancy_beta: number, radiation_gain: number, radiation_model: RadiationModel, heat_sources: Array<number>) {
    this.temperature = temperature;
    this.thermal_diffusivity = thermal_diffusivity;
    this.buoyancy_alpha = buoyancy_alpha;
    this.buoyancy_beta = buoyancy_beta;
    this.radiation_gain = radiation_gain;
    this.radiation_model = radiation_model;
    this.heat_sources = heat_sources;
  }
}

export interface ElectroMagneticComponentShape {
  charge_density: number;
  electric_field: [number, number, number];
  magnetic_field: [number, number, number];
  lorentz_force_gain: number;
  resistivity: number;
  hall_parameter: number;
  ambipolar_diffusion: number;
}
export class ElectroMagneticComponent implements ElectroMagneticComponentShape {
  charge_density: number;
  electric_field: [number, number, number];
  magnetic_field: [number, number, number];
  lorentz_force_gain: number;
  resistivity: number;
  hall_parameter: number;
  ambipolar_diffusion: number;
  
  constructor(charge_density: number, electric_field: [number, number, number], magnetic_field: [number, number, number], lorentz_force_gain: number, resistivity: number, hall_parameter: number, ambipolar_diffusion: number) {
    this.charge_density = charge_density;
    this.electric_field = electric_field;
    this.magnetic_field = magnetic_field;
    this.lorentz_force_gain = lorentz_force_gain;
    this.resistivity = resistivity;
    this.hall_parameter = hall_parameter;
    this.ambipolar_diffusion = ambipolar_diffusion;
  }
}

export interface QuantumComponentShape {
  coherence_length: number;
  healing_length: number;
  vortex_core_size: number;
  phase_wrapping: number;
  dispersion_gain: number;
  superfluid_fraction: number;
  condensate_density: number;
}
export class QuantumComponent implements QuantumComponentShape {
  coherence_length: number;
  healing_length: number;
  vortex_core_size: number;
  phase_wrapping: number;
  dispersion_gain: number;
  superfluid_fraction: number;
  condensate_density: number;
  
  constructor(coherence_length: number, healing_length: number, vortex_core_size: number, phase_wrapping: number, dispersion_gain: number, superfluid_fraction: number, condensate_density: number) {
    this.coherence_length = coherence_length;
    this.healing_length = healing_length;
    this.vortex_core_size = vortex_core_size;
    this.phase_wrapping = phase_wrapping;
    this.dispersion_gain = dispersion_gain;
    this.superfluid_fraction = superfluid_fraction;
    this.condensate_density = condensate_density;
  }
}

export interface ParticulateComponentShape {
  particle_count: number;
  particle_radius: number;
  drag_coefficient: number;
  cohesion: number;
  restitution: number;
  friction: number;
  adhesion: number;
  granular_compaction: number;
}
export class ParticulateComponent implements ParticulateComponentShape {
  particle_count: number;
  particle_radius: number;
  drag_coefficient: number;
  cohesion: number;
  restitution: number;
  friction: number;
  adhesion: number;
  granular_compaction: number;
  
  constructor(particle_count: number, particle_radius: number, drag_coefficient: number, cohesion: number, restitution: number, friction: number, adhesion: number, granular_compaction: number) {
    this.particle_count = particle_count;
    this.particle_radius = particle_radius;
    this.drag_coefficient = drag_coefficient;
    this.cohesion = cohesion;
    this.restitution = restitution;
    this.friction = friction;
    this.adhesion = adhesion;
    this.granular_compaction = granular_compaction;
  }
}

export interface HyperFluidParticleSystemComponentShape {
  particle_type: ParticleType;
  particle_count: number;
  particle_diameter: number;
  particle_density: number;
  particle_shape_factor: number;
  drag_model: DragModel;
  drag_coefficient: number;
  collision_model: CollisionModel;
  restitution_coefficient: number;
  friction_coefficient: number;
  cohesion_energy: number;
  breakup_model: BreakupModel;
  coalescence_model: CoalescenceModel;
  weber_number_critical: number;
  evaporation_model: EvaporationModel;
  latent_heat: number;
  vapor_pressure: number;
  tracking_scheme: TrackingScheme;
  interpolation_order: number;
  two_way_coupling: boolean;
  four_way_coupling: boolean;
}
export class HyperFluidParticleSystemComponent implements HyperFluidParticleSystemComponentShape {
  particle_type: ParticleType;
  particle_count: number;
  particle_diameter: number;
  particle_density: number;
  particle_shape_factor: number;
  drag_model: DragModel;
  drag_coefficient: number;
  collision_model: CollisionModel;
  restitution_coefficient: number;
  friction_coefficient: number;
  cohesion_energy: number;
  breakup_model: BreakupModel;
  coalescence_model: CoalescenceModel;
  weber_number_critical: number;
  evaporation_model: EvaporationModel;
  latent_heat: number;
  vapor_pressure: number;
  tracking_scheme: TrackingScheme;
  interpolation_order: number;
  two_way_coupling: boolean;
  four_way_coupling: boolean;
  
  constructor(particle_type: ParticleType, particle_count: number, particle_diameter: number, particle_density: number, particle_shape_factor: number, drag_model: DragModel, drag_coefficient: number, collision_model: CollisionModel, restitution_coefficient: number, friction_coefficient: number, cohesion_energy: number, breakup_model: BreakupModel, coalescence_model: CoalescenceModel, weber_number_critical: number, evaporation_model: EvaporationModel, latent_heat: number, vapor_pressure: number, tracking_scheme: TrackingScheme, interpolation_order: number, two_way_coupling: boolean, four_way_coupling: boolean) {
    this.particle_type = particle_type;
    this.particle_count = particle_count;
    this.particle_diameter = particle_diameter;
    this.particle_density = particle_density;
    this.particle_shape_factor = particle_shape_factor;
    this.drag_model = drag_model;
    this.drag_coefficient = drag_coefficient;
    this.collision_model = collision_model;
    this.restitution_coefficient = restitution_coefficient;
    this.friction_coefficient = friction_coefficient;
    this.cohesion_energy = cohesion_energy;
    this.breakup_model = breakup_model;
    this.coalescence_model = coalescence_model;
    this.weber_number_critical = weber_number_critical;
    this.evaporation_model = evaporation_model;
    this.latent_heat = latent_heat;
    this.vapor_pressure = vapor_pressure;
    this.tracking_scheme = tracking_scheme;
    this.interpolation_order = interpolation_order;
    this.two_way_coupling = two_way_coupling;
    this.four_way_coupling = four_way_coupling;
  }
}

export interface AdaptiveMeshComponentShape {
  strategy: AdaptiveStrategy;
  mesh_quality_threshold: number;
  error_indicator_gain: number;
  max_blocks: number;
  min_blocks: number;
}
export class AdaptiveMeshComponent implements AdaptiveMeshComponentShape {
  strategy: AdaptiveStrategy;
  mesh_quality_threshold: number;
  error_indicator_gain: number;
  max_blocks: number;
  min_blocks: number;
  
  constructor(strategy: AdaptiveStrategy, mesh_quality_threshold: number, error_indicator_gain: number, max_blocks: number, min_blocks: number) {
    this.strategy = strategy;
    this.mesh_quality_threshold = mesh_quality_threshold;
    this.error_indicator_gain = error_indicator_gain;
    this.max_blocks = max_blocks;
    this.min_blocks = min_blocks;
  }
}

export interface BoundaryConditionComponentShape {
  primary_type: BoundaryType;
  velocity_profile: VelocityProfile;
  temperature_profile: TemperatureProfile;
  pressure_profile: PressureProfile;
  turbulence_intensity_inlet: number;
  turbulence_length_scale_inlet: number;
  wall_roughness: number;
  wall_temperature: number;
  wall_heat_flux: number;
  slip_length: number;
  contact_angle_advancing: number;
  contact_angle_receding: number;
  contact_angle_hysteresis: number;
  porous_permeability: number;
  porous_porosity: number;
  sponge_layer_thickness: number;
  sponge_damping_coefficient: number;
  moving_wall_velocity: [number, number, number];
  moving_wall_angular_velocity: [number, number, number];
  inflow_turbulence_seed: number;
  outflow_convective_velocity: number;
}
export class BoundaryConditionComponent implements BoundaryConditionComponentShape {
  primary_type: BoundaryType;
  velocity_profile: VelocityProfile;
  temperature_profile: TemperatureProfile;
  pressure_profile: PressureProfile;
  turbulence_intensity_inlet: number;
  turbulence_length_scale_inlet: number;
  wall_roughness: number;
  wall_temperature: number;
  wall_heat_flux: number;
  slip_length: number;
  contact_angle_advancing: number;
  contact_angle_receding: number;
  contact_angle_hysteresis: number;
  porous_permeability: number;
  porous_porosity: number;
  sponge_layer_thickness: number;
  sponge_damping_coefficient: number;
  moving_wall_velocity: [number, number, number];
  moving_wall_angular_velocity: [number, number, number];
  inflow_turbulence_seed: number;
  outflow_convective_velocity: number;
  
  constructor(primary_type: BoundaryType, velocity_profile: VelocityProfile, temperature_profile: TemperatureProfile, pressure_profile: PressureProfile, turbulence_intensity_inlet: number, turbulence_length_scale_inlet: number, wall_roughness: number, wall_temperature: number, wall_heat_flux: number, slip_length: number, contact_angle_advancing: number, contact_angle_receding: number, contact_angle_hysteresis: number, porous_permeability: number, porous_porosity: number, sponge_layer_thickness: number, sponge_damping_coefficient: number, moving_wall_velocity: [number, number, number], moving_wall_angular_velocity: [number, number, number], inflow_turbulence_seed: number, outflow_convective_velocity: number) {
    this.primary_type = primary_type;
    this.velocity_profile = velocity_profile;
    this.temperature_profile = temperature_profile;
    this.pressure_profile = pressure_profile;
    this.turbulence_intensity_inlet = turbulence_intensity_inlet;
    this.turbulence_length_scale_inlet = turbulence_length_scale_inlet;
    this.wall_roughness = wall_roughness;
    this.wall_temperature = wall_temperature;
    this.wall_heat_flux = wall_heat_flux;
    this.slip_length = slip_length;
    this.contact_angle_advancing = contact_angle_advancing;
    this.contact_angle_receding = contact_angle_receding;
    this.contact_angle_hysteresis = contact_angle_hysteresis;
    this.porous_permeability = porous_permeability;
    this.porous_porosity = porous_porosity;
    this.sponge_layer_thickness = sponge_layer_thickness;
    this.sponge_damping_coefficient = sponge_damping_coefficient;
    this.moving_wall_velocity = moving_wall_velocity;
    this.moving_wall_angular_velocity = moving_wall_angular_velocity;
    this.inflow_turbulence_seed = inflow_turbulence_seed;
    this.outflow_convective_velocity = outflow_convective_velocity;
  }
}

export interface CollisionComponentShape {
  enabled: boolean;
  restitution: number;
  friction: number;
  sdf_threshold: number;
  use_global_distance_field: boolean;
}
export class CollisionComponent implements CollisionComponentShape {
  enabled: boolean;
  restitution: number;
  friction: number;
  sdf_threshold: number;
  use_global_distance_field: boolean;
  
  constructor(enabled: boolean, restitution: number, friction: number, sdf_threshold: number, use_global_distance_field: boolean) {
    this.enabled = enabled;
    this.restitution = restitution;
    this.friction = friction;
    this.sdf_threshold = sdf_threshold;
    this.use_global_distance_field = use_global_distance_field;
  }
}

export interface CouplingComponentShape {
  coupling_strategy: CouplingStrategy;
  coupling_fields: Array<CouplingField>;
  coupling_timestep_ratio: number;
  coupling_tolerance: number;
  coupling_max_iterations: number;
  boussinesq_approximation: boolean;
  natural_convection_gain: number;
  forced_convection_gain: number;
  radiation_model: RadiationModel;
  fsi_method: FSIMethod;
  structural_damping: number;
  added_mass_effect: boolean;
  electrokinetic_mobility: number;
  zeta_potential: number;
  debye_length: number;
  magnetic_reynolds_number: number;
  hartmann_number: number;
  interaction_parameter: number;
  reaction_mechanism: ReactionMechanism;
  species_count: number;
  arrhenius_a: Array<number>;
  arrhenius_ea: Array<number>;
  acoustic_coupling: boolean;
  speed_of_sound: number;
  acoustic_impedance: number;
}
export class CouplingComponent implements CouplingComponentShape {
  coupling_strategy: CouplingStrategy;
  coupling_fields: Array<CouplingField>;
  coupling_timestep_ratio: number;
  coupling_tolerance: number;
  coupling_max_iterations: number;
  boussinesq_approximation: boolean;
  natural_convection_gain: number;
  forced_convection_gain: number;
  radiation_model: RadiationModel;
  fsi_method: FSIMethod;
  structural_damping: number;
  added_mass_effect: boolean;
  electrokinetic_mobility: number;
  zeta_potential: number;
  debye_length: number;
  magnetic_reynolds_number: number;
  hartmann_number: number;
  interaction_parameter: number;
  reaction_mechanism: ReactionMechanism;
  species_count: number;
  arrhenius_a: Array<number>;
  arrhenius_ea: Array<number>;
  acoustic_coupling: boolean;
  speed_of_sound: number;
  acoustic_impedance: number;
  
  constructor(coupling_strategy: CouplingStrategy, coupling_fields: Array<CouplingField>, coupling_timestep_ratio: number, coupling_tolerance: number, coupling_max_iterations: number, boussinesq_approximation: boolean, natural_convection_gain: number, forced_convection_gain: number, radiation_model: RadiationModel, fsi_method: FSIMethod, structural_damping: number, added_mass_effect: boolean, electrokinetic_mobility: number, zeta_potential: number, debye_length: number, magnetic_reynolds_number: number, hartmann_number: number, interaction_parameter: number, reaction_mechanism: ReactionMechanism, species_count: number, arrhenius_a: Array<number>, arrhenius_ea: Array<number>, acoustic_coupling: boolean, speed_of_sound: number, acoustic_impedance: number) {
    this.coupling_strategy = coupling_strategy;
    this.coupling_fields = coupling_fields;
    this.coupling_timestep_ratio = coupling_timestep_ratio;
    this.coupling_tolerance = coupling_tolerance;
    this.coupling_max_iterations = coupling_max_iterations;
    this.boussinesq_approximation = boussinesq_approximation;
    this.natural_convection_gain = natural_convection_gain;
    this.forced_convection_gain = forced_convection_gain;
    this.radiation_model = radiation_model;
    this.fsi_method = fsi_method;
    this.structural_damping = structural_damping;
    this.added_mass_effect = added_mass_effect;
    this.electrokinetic_mobility = electrokinetic_mobility;
    this.zeta_potential = zeta_potential;
    this.debye_length = debye_length;
    this.magnetic_reynolds_number = magnetic_reynolds_number;
    this.hartmann_number = hartmann_number;
    this.interaction_parameter = interaction_parameter;
    this.reaction_mechanism = reaction_mechanism;
    this.species_count = species_count;
    this.arrhenius_a = arrhenius_a;
    this.arrhenius_ea = arrhenius_ea;
    this.acoustic_coupling = acoustic_coupling;
    this.speed_of_sound = speed_of_sound;
    this.acoustic_impedance = acoustic_impedance;
  }
}

export interface PerformanceComponentShape {
  enable_profiling: boolean;
  enable_telemetry: boolean;
  telemetry_sample_rate: number;
  gpu_memory_budget_mb: number;
  cpu_thread_count: number;
  async_compute_enabled: boolean;
  load_balancing: LoadBalancingStrategy;
  domain_decomposition: DomainDecomposition;
  cache_strategy: CacheStrategy;
  cache_size_mb: number;
  precision_mode: PrecisionMode;
  mixed_precision: boolean;
  convergence_criteria: ConvergenceCriteria;
  residual_tolerance: number;
  max_iterations: number;
}
export class PerformanceComponent implements PerformanceComponentShape {
  enable_profiling: boolean;
  enable_telemetry: boolean;
  telemetry_sample_rate: number;
  gpu_memory_budget_mb: number;
  cpu_thread_count: number;
  async_compute_enabled: boolean;
  load_balancing: LoadBalancingStrategy;
  domain_decomposition: DomainDecomposition;
  cache_strategy: CacheStrategy;
  cache_size_mb: number;
  precision_mode: PrecisionMode;
  mixed_precision: boolean;
  convergence_criteria: ConvergenceCriteria;
  residual_tolerance: number;
  max_iterations: number;
  
  constructor(enable_profiling: boolean, enable_telemetry: boolean, telemetry_sample_rate: number, gpu_memory_budget_mb: number, cpu_thread_count: number, async_compute_enabled: boolean, load_balancing: LoadBalancingStrategy, domain_decomposition: DomainDecomposition, cache_strategy: CacheStrategy, cache_size_mb: number, precision_mode: PrecisionMode, mixed_precision: boolean, convergence_criteria: ConvergenceCriteria, residual_tolerance: number, max_iterations: number) {
    this.enable_profiling = enable_profiling;
    this.enable_telemetry = enable_telemetry;
    this.telemetry_sample_rate = telemetry_sample_rate;
    this.gpu_memory_budget_mb = gpu_memory_budget_mb;
    this.cpu_thread_count = cpu_thread_count;
    this.async_compute_enabled = async_compute_enabled;
    this.load_balancing = load_balancing;
    this.domain_decomposition = domain_decomposition;
    this.cache_strategy = cache_strategy;
    this.cache_size_mb = cache_size_mb;
    this.precision_mode = precision_mode;
    this.mixed_precision = mixed_precision;
    this.convergence_criteria = convergence_criteria;
    this.residual_tolerance = residual_tolerance;
    this.max_iterations = max_iterations;
  }
}

export interface DiagnosticsComponentShape {
  enable_diagnostics: boolean;
  diagnostic_interval: number;
  check_mass_conservation: boolean;
  check_momentum_conservation: boolean;
  check_energy_conservation: boolean;
  check_cfl_condition: boolean;
  check_divergence: boolean;
  check_nan_inf: boolean;
  compute_mesh_quality: boolean;
  compute_timestep_stats: boolean;
  compute_solver_stats: boolean;
  log_residuals: boolean;
  log_performance_metrics: boolean;
}
export class DiagnosticsComponent implements DiagnosticsComponentShape {
  enable_diagnostics: boolean;
  diagnostic_interval: number;
  check_mass_conservation: boolean;
  check_momentum_conservation: boolean;
  check_energy_conservation: boolean;
  check_cfl_condition: boolean;
  check_divergence: boolean;
  check_nan_inf: boolean;
  compute_mesh_quality: boolean;
  compute_timestep_stats: boolean;
  compute_solver_stats: boolean;
  log_residuals: boolean;
  log_performance_metrics: boolean;
  
  constructor(enable_diagnostics: boolean, diagnostic_interval: number, check_mass_conservation: boolean, check_momentum_conservation: boolean, check_energy_conservation: boolean, check_cfl_condition: boolean, check_divergence: boolean, check_nan_inf: boolean, compute_mesh_quality: boolean, compute_timestep_stats: boolean, compute_solver_stats: boolean, log_residuals: boolean, log_performance_metrics: boolean) {
    this.enable_diagnostics = enable_diagnostics;
    this.diagnostic_interval = diagnostic_interval;
    this.check_mass_conservation = check_mass_conservation;
    this.check_momentum_conservation = check_momentum_conservation;
    this.check_energy_conservation = check_energy_conservation;
    this.check_cfl_condition = check_cfl_condition;
    this.check_divergence = check_divergence;
    this.check_nan_inf = check_nan_inf;
    this.compute_mesh_quality = compute_mesh_quality;
    this.compute_timestep_stats = compute_timestep_stats;
    this.compute_solver_stats = compute_solver_stats;
    this.log_residuals = log_residuals;
    this.log_performance_metrics = log_performance_metrics;
  }
}

export interface VisualizationComponentShape {
  visualization: VisualizationMode;
  exposure: number;
  contrast: number;
  saturation: number;
  line_thickness: number;
  sample_count: number;
  step_size: number;
  color_a: [number, number, number];
  color_b: [number, number, number];
  color_c: [number, number, number];
}
export class VisualizationComponent implements VisualizationComponentShape {
  visualization: VisualizationMode;
  exposure: number;
  contrast: number;
  saturation: number;
  line_thickness: number;
  sample_count: number;
  step_size: number;
  color_a: [number, number, number];
  color_b: [number, number, number];
  color_c: [number, number, number];
  
  constructor(visualization: VisualizationMode, exposure: number, contrast: number, saturation: number, line_thickness: number, sample_count: number, step_size: number, color_a: [number, number, number], color_b: [number, number, number], color_c: [number, number, number]) {
    this.visualization = visualization;
    this.exposure = exposure;
    this.contrast = contrast;
    this.saturation = saturation;
    this.line_thickness = line_thickness;
    this.sample_count = sample_count;
    this.step_size = step_size;
    this.color_a = color_a;
    this.color_b = color_b;
    this.color_c = color_c;
  }
}

export interface HyperFluidSimulationCoreShape {
  grid: GridResolutionComponent;
  time: TimeIntegrationComponent;
  physics: PhysicalPropertiesComponent;
  turbulence: TurbulenceComponent;
  turbulence_advanced: TurbulenceAdvancedComponent;
  multiphase: MultiphaseComponent;
  thermal: ThermalComponent;
  em: ElectroMagneticComponent;
  quantum: QuantumComponent;
  particles: ParticulateComponent;
  particle_system: HyperFluidParticleSystemComponent;
  adaptive: AdaptiveMeshComponent;
  boundary: BoundaryConditionComponent;
  collision: CollisionComponent;
  coupling: CouplingComponent;
  performance: PerformanceComponent;
  diagnostics: DiagnosticsComponent;
  viz: VisualizationComponent;
  active_presets: Array<number>;
  simulation_time: number;
  frame_count: number;
}
export class HyperFluidSimulationCore implements HyperFluidSimulationCoreShape {
  grid: GridResolutionComponent;
  time: TimeIntegrationComponent;
  physics: PhysicalPropertiesComponent;
  turbulence: TurbulenceComponent;
  turbulence_advanced: TurbulenceAdvancedComponent;
  multiphase: MultiphaseComponent;
  thermal: ThermalComponent;
  em: ElectroMagneticComponent;
  quantum: QuantumComponent;
  particles: ParticulateComponent;
  particle_system: HyperFluidParticleSystemComponent;
  adaptive: AdaptiveMeshComponent;
  boundary: BoundaryConditionComponent;
  collision: CollisionComponent;
  coupling: CouplingComponent;
  performance: PerformanceComponent;
  diagnostics: DiagnosticsComponent;
  viz: VisualizationComponent;
  active_presets: Array<number>;
  simulation_time: number;
  frame_count: number;
  
  constructor(grid: GridResolutionComponent, time: TimeIntegrationComponent, physics: PhysicalPropertiesComponent, turbulence: TurbulenceComponent, turbulence_advanced: TurbulenceAdvancedComponent, multiphase: MultiphaseComponent, thermal: ThermalComponent, em: ElectroMagneticComponent, quantum: QuantumComponent, particles: ParticulateComponent, particle_system: HyperFluidParticleSystemComponent, adaptive: AdaptiveMeshComponent, boundary: BoundaryConditionComponent, collision: CollisionComponent, coupling: CouplingComponent, performance: PerformanceComponent, diagnostics: DiagnosticsComponent, viz: VisualizationComponent, active_presets: Array<number>, simulation_time: number, frame_count: number) {
    this.grid = grid;
    this.time = time;
    this.physics = physics;
    this.turbulence = turbulence;
    this.turbulence_advanced = turbulence_advanced;
    this.multiphase = multiphase;
    this.thermal = thermal;
    this.em = em;
    this.quantum = quantum;
    this.particles = particles;
    this.particle_system = particle_system;
    this.adaptive = adaptive;
    this.boundary = boundary;
    this.collision = collision;
    this.coupling = coupling;
    this.performance = performance;
    this.diagnostics = diagnostics;
    this.viz = viz;
    this.active_presets = active_presets;
    this.simulation_time = simulation_time;
    this.frame_count = frame_count;
  }
}



export type EmissionShape =
  | { type: 'EmissionShape'; tag: 'Point' }
  | { type: 'EmissionShape'; tag: 'Sphere' }
  | { type: 'EmissionShape'; tag: 'Box' }
  | { type: 'EmissionShape'; tag: 'Cone' }
  | { type: 'EmissionShape'; tag: 'Cylinder' }
  | { type: 'EmissionShape'; tag: 'EmissionShape_MAX' };
export const EmissionShape = {
  Point: (): EmissionShape => ({ type: 'EmissionShape', tag: 'Point' }),
  Sphere: (): EmissionShape => ({ type: 'EmissionShape', tag: 'Sphere' }),
  Box: (): EmissionShape => ({ type: 'EmissionShape', tag: 'Box' }),
  Cone: (): EmissionShape => ({ type: 'EmissionShape', tag: 'Cone' }),
  Cylinder: (): EmissionShape => ({ type: 'EmissionShape', tag: 'Cylinder' }),
  EmissionShape_MAX: (): EmissionShape => ({ type: 'EmissionShape', tag: 'EmissionShape_MAX' }),
} as const;



export function apply_fluid_preset(world: HyperFluidSimulationCore, preset_id: number): void {
world.Initialize([preset_id])  ;
}

export function set_visualization(world: HyperFluidSimulationCore, mode: VisualizationMode): void {
world.viz.visualization = mode  ;
world.UpdateVisualization()  ;
}

export function sample_field(world: HyperFluidSimulationCore, position: [number, number, number], radius: number): Array<number> {
return hyperfluid_sample_field(world, position, radius)  ;
}

export function hyperfluid_sample_field(world: HyperFluidSimulationCore, position: [number, number, number], radius: number): Array<number> {
let base = (((position.x + position.y) + position.z) + radius)  ;
return [base, (base * 0.5), (base * 0.25)]  ;
}

export function hyperfluid_sample_velocity(world: HyperFluidSimulationCore, position: [number, number, number]): [number, number, number] {
return vec3((position.x * 0.1), (position.y * 0.1), (position.z * 0.1))  ;
}

export function hyperfluid_sample_pressure(world: HyperFluidSimulationCore, position: [number, number, number]): number {
return ((position.z * world.physics.density) * 9.81)  ;
}

// NOTE: These functions have incomplete KAIN transpilation - not used in WebGPU implementation
// export function hyperfluid_sample_temperature(world: HyperFluidSimulationCore, position: [number, number, number]): number {
// return (world.thermal.temperature + /* unsupported expr */)  ;
// }

// export function hyperfluid_compute_reynolds_number(world: HyperFluidSimulationCore, velocity: number, length: number): number {
// return (/* unsupported expr */ / world.physics.viscosity)  ;
// }

export function hyperfluid_compute_mach_number(world: HyperFluidSimulationCore, velocity: number): number {
let speed_of_sound = sqrt((world.physics.compressibility * world.physics.density))  ;
return (velocity / speed_of_sound)  ;
}

// export function hyperfluid_compute_weber_number(world: HyperFluidSimulationCore, velocity: number, length: number): number {
// return (/* unsupported expr */ / world.physics.surface_tension)  ;
// }

export function hyperfluid_compute_froude_number(velocity: number, length: number, gravity: number): number {
return (velocity / sqrt((gravity * length)))  ;
}

export interface PhysicsShaderParamsShape {
  viscosity: number;
  density: number;
  surface_tension: number;
  compressibility: number;
  conductivity: number;
  permittivity: number;
  permeability: number;
  reactivity: number;
  radiation_absorption: number;
  gravity_scale: number;
  anisotropy: number;
  cavitation_threshold: number;
  yield_stress: number;
  foam_threshold: number;
  spray_threshold: number;
  bubble_coalescence: number;
}
export class PhysicsShaderParams implements PhysicsShaderParamsShape {
  viscosity: number;
  density: number;
  surface_tension: number;
  compressibility: number;
  conductivity: number;
  permittivity: number;
  permeability: number;
  reactivity: number;
  radiation_absorption: number;
  gravity_scale: number;
  anisotropy: number;
  cavitation_threshold: number;
  yield_stress: number;
  foam_threshold: number;
  spray_threshold: number;
  bubble_coalescence: number;
  
  constructor(viscosity: number, density: number, surface_tension: number, compressibility: number, conductivity: number, permittivity: number, permeability: number, reactivity: number, radiation_absorption: number, gravity_scale: number, anisotropy: number, cavitation_threshold: number, yield_stress: number, foam_threshold: number, spray_threshold: number, bubble_coalescence: number) {
    this.viscosity = viscosity;
    this.density = density;
    this.surface_tension = surface_tension;
    this.compressibility = compressibility;
    this.conductivity = conductivity;
    this.permittivity = permittivity;
    this.permeability = permeability;
    this.reactivity = reactivity;
    this.radiation_absorption = radiation_absorption;
    this.gravity_scale = gravity_scale;
    this.anisotropy = anisotropy;
    this.cavitation_threshold = cavitation_threshold;
    this.yield_stress = yield_stress;
    this.foam_threshold = foam_threshold;
    this.spray_threshold = spray_threshold;
    this.bubble_coalescence = bubble_coalescence;
  }
}

export interface TurbulenceShaderParamsShape {
  intensity: number;
  vortex_confinement: number;
  energy_injection: number;
  dissipation: number;
  length_scale: number;
  noise_seed: number;
  padding1: number;
  padding2: number;
}
export class TurbulenceShaderParams implements TurbulenceShaderParamsShape {
  intensity: number;
  vortex_confinement: number;
  energy_injection: number;
  dissipation: number;
  length_scale: number;
  noise_seed: number;
  padding1: number;
  padding2: number;
  
  constructor(intensity: number, vortex_confinement: number, energy_injection: number, dissipation: number, length_scale: number, noise_seed: number, padding1: number, padding2: number) {
    this.intensity = intensity;
    this.vortex_confinement = vortex_confinement;
    this.energy_injection = energy_injection;
    this.dissipation = dissipation;
    this.length_scale = length_scale;
    this.noise_seed = noise_seed;
    this.padding1 = padding1;
    this.padding2 = padding2;
  }
}

export interface CollisionShaderParamsShape {
  restitution: number;
  friction: number;
  sdf_threshold: number;
  enabled: number;
}
export class CollisionShaderParams implements CollisionShaderParamsShape {
  restitution: number;
  friction: number;
  sdf_threshold: number;
  enabled: number;
  
  constructor(restitution: number, friction: number, sdf_threshold: number, enabled: number) {
    this.restitution = restitution;
    this.friction = friction;
    this.sdf_threshold = sdf_threshold;
    this.enabled = enabled;
  }
}

export interface VisualizationShaderParamsShape {
  exposure: number;
  contrast: number;
  saturation: number;
  line_thickness: number;
  sample_count: number;
  step_size: number;
  padding1: number;
  padding2: number;
  color_a: [number, number, number];
  padding3: number;
  color_b: [number, number, number];
  padding4: number;
  color_c: [number, number, number];
  padding5: number;
}
export class VisualizationShaderParams implements VisualizationShaderParamsShape {
  exposure: number;
  contrast: number;
  saturation: number;
  line_thickness: number;
  sample_count: number;
  step_size: number;
  padding1: number;
  padding2: number;
  color_a: [number, number, number];
  padding3: number;
  color_b: [number, number, number];
  padding4: number;
  color_c: [number, number, number];
  padding5: number;
  
  constructor(exposure: number, contrast: number, saturation: number, line_thickness: number, sample_count: number, step_size: number, padding1: number, padding2: number, color_a: [number, number, number], padding3: number, color_b: [number, number, number], padding4: number, color_c: [number, number, number], padding5: number) {
    this.exposure = exposure;
    this.contrast = contrast;
    this.saturation = saturation;
    this.line_thickness = line_thickness;
    this.sample_count = sample_count;
    this.step_size = step_size;
    this.padding1 = padding1;
    this.padding2 = padding2;
    this.color_a = color_a;
    this.padding3 = padding3;
    this.color_b = color_b;
    this.padding4 = padding4;
    this.color_c = color_c;
    this.padding5 = padding5;
  }
}

export interface ThermalShaderParamsShape {
  temperature: number;
  thermal_diffusivity: number;
  buoyancy_alpha: number;
  buoyancy_beta: number;
  radiation_gain: number;
  padding1: number;
  padding2: number;
  padding3: number;
}
export class ThermalShaderParams implements ThermalShaderParamsShape {
  temperature: number;
  thermal_diffusivity: number;
  buoyancy_alpha: number;
  buoyancy_beta: number;
  radiation_gain: number;
  padding1: number;
  padding2: number;
  padding3: number;
  
  constructor(temperature: number, thermal_diffusivity: number, buoyancy_alpha: number, buoyancy_beta: number, radiation_gain: number, padding1: number, padding2: number, padding3: number) {
    this.temperature = temperature;
    this.thermal_diffusivity = thermal_diffusivity;
    this.buoyancy_alpha = buoyancy_alpha;
    this.buoyancy_beta = buoyancy_beta;
    this.radiation_gain = radiation_gain;
    this.padding1 = padding1;
    this.padding2 = padding2;
    this.padding3 = padding3;
  }
}

export interface ElectroMagneticShaderParamsShape {
  charge_density: number;
  lorentz_force_gain: number;
  resistivity: number;
  hall_parameter: number;
  ambipolar_diffusion: number;
  padding1: number;
  padding2: number;
  padding3: number;
  electric_field: [number, number, number];
  padding4: number;
  magnetic_field: [number, number, number];
  padding5: number;
}
export class ElectroMagneticShaderParams implements ElectroMagneticShaderParamsShape {
  charge_density: number;
  lorentz_force_gain: number;
  resistivity: number;
  hall_parameter: number;
  ambipolar_diffusion: number;
  padding1: number;
  padding2: number;
  padding3: number;
  electric_field: [number, number, number];
  padding4: number;
  magnetic_field: [number, number, number];
  padding5: number;
  
  constructor(charge_density: number, lorentz_force_gain: number, resistivity: number, hall_parameter: number, ambipolar_diffusion: number, padding1: number, padding2: number, padding3: number, electric_field: [number, number, number], padding4: number, magnetic_field: [number, number, number], padding5: number) {
    this.charge_density = charge_density;
    this.lorentz_force_gain = lorentz_force_gain;
    this.resistivity = resistivity;
    this.hall_parameter = hall_parameter;
    this.ambipolar_diffusion = ambipolar_diffusion;
    this.padding1 = padding1;
    this.padding2 = padding2;
    this.padding3 = padding3;
    this.electric_field = electric_field;
    this.padding4 = padding4;
    this.magnetic_field = magnetic_field;
    this.padding5 = padding5;
  }
}

export interface QuantumShaderParamsShape {
  coherence_length: number;
  healing_length: number;
  vortex_core_size: number;
  phase_wrapping: number;
  dispersion_gain: number;
  superfluid_fraction: number;
  condensate_density: number;
  padding1: number;
}
export class QuantumShaderParams implements QuantumShaderParamsShape {
  coherence_length: number;
  healing_length: number;
  vortex_core_size: number;
  phase_wrapping: number;
  dispersion_gain: number;
  superfluid_fraction: number;
  condensate_density: number;
  padding1: number;
  
  constructor(coherence_length: number, healing_length: number, vortex_core_size: number, phase_wrapping: number, dispersion_gain: number, superfluid_fraction: number, condensate_density: number, padding1: number) {
    this.coherence_length = coherence_length;
    this.healing_length = healing_length;
    this.vortex_core_size = vortex_core_size;
    this.phase_wrapping = phase_wrapping;
    this.dispersion_gain = dispersion_gain;
    this.superfluid_fraction = superfluid_fraction;
    this.condensate_density = condensate_density;
    this.padding1 = padding1;
  }
}

export interface ParticulateShaderParamsShape {
  particle_count: number;
  particle_radius: number;
  drag_coefficient: number;
  cohesion: number;
  restitution: number;
  friction: number;
  adhesion: number;
  granular_compaction: number;
}
export class ParticulateShaderParams implements ParticulateShaderParamsShape {
  particle_count: number;
  particle_radius: number;
  drag_coefficient: number;
  cohesion: number;
  restitution: number;
  friction: number;
  adhesion: number;
  granular_compaction: number;
  
  constructor(particle_count: number, particle_radius: number, drag_coefficient: number, cohesion: number, restitution: number, friction: number, adhesion: number, granular_compaction: number) {
    this.particle_count = particle_count;
    this.particle_radius = particle_radius;
    this.drag_coefficient = drag_coefficient;
    this.cohesion = cohesion;
    this.restitution = restitution;
    this.friction = friction;
    this.adhesion = adhesion;
    this.granular_compaction = granular_compaction;
  }
}

export interface MultiphaseShaderParamsShape {
  phases: number;
  phase_field_mobility: number;
  interface_thickness: number;
  surface_tension_coupling: number;
  contact_angle: number;
  bubble_spawn_rate: number;
  droplet_spawn_rate: number;
  padding1: number;
}
export class MultiphaseShaderParams implements MultiphaseShaderParamsShape {
  phases: number;
  phase_field_mobility: number;
  interface_thickness: number;
  surface_tension_coupling: number;
  contact_angle: number;
  bubble_spawn_rate: number;
  droplet_spawn_rate: number;
  padding1: number;
  
  constructor(phases: number, phase_field_mobility: number, interface_thickness: number, surface_tension_coupling: number, contact_angle: number, bubble_spawn_rate: number, droplet_spawn_rate: number, padding1: number) {
    this.phases = phases;
    this.phase_field_mobility = phase_field_mobility;
    this.interface_thickness = interface_thickness;
    this.surface_tension_coupling = surface_tension_coupling;
    this.contact_angle = contact_angle;
    this.bubble_spawn_rate = bubble_spawn_rate;
    this.droplet_spawn_rate = droplet_spawn_rate;
    this.padding1 = padding1;
  }
}

export interface TimeIntegrationShaderParamsShape {
  dt: number;
  current_time: number;
  cfl_number: number;
  padding1: number;
}
export class TimeIntegrationShaderParams implements TimeIntegrationShaderParamsShape {
  dt: number;
  current_time: number;
  cfl_number: number;
  padding1: number;
  
  constructor(dt: number, current_time: number, cfl_number: number, padding1: number) {
    this.dt = dt;
    this.current_time = current_time;
    this.cfl_number = cfl_number;
    this.padding1 = padding1;
  }
}

export interface TurbulenceAdvancedShaderParamsShape {
  smagorinsky_constant: number;
  wale_constant: number;
  vreman_constant: number;
  k_epsilon_c_mu: number;
  k_epsilon_c1: number;
  k_epsilon_c2: number;
  k_omega_beta_star: number;
  k_omega_sigma_k: number;
  k_omega_sigma_omega: number;
  y_plus_target: number;
  intermittency: number;
  transition_onset_reynolds: number;
  eddy_count: number;
  eddy_lifetime: number;
  padding1: number;
  padding2: number;
}
export class TurbulenceAdvancedShaderParams implements TurbulenceAdvancedShaderParamsShape {
  smagorinsky_constant: number;
  wale_constant: number;
  vreman_constant: number;
  k_epsilon_c_mu: number;
  k_epsilon_c1: number;
  k_epsilon_c2: number;
  k_omega_beta_star: number;
  k_omega_sigma_k: number;
  k_omega_sigma_omega: number;
  y_plus_target: number;
  intermittency: number;
  transition_onset_reynolds: number;
  eddy_count: number;
  eddy_lifetime: number;
  padding1: number;
  padding2: number;
  
  constructor(smagorinsky_constant: number, wale_constant: number, vreman_constant: number, k_epsilon_c_mu: number, k_epsilon_c1: number, k_epsilon_c2: number, k_omega_beta_star: number, k_omega_sigma_k: number, k_omega_sigma_omega: number, y_plus_target: number, intermittency: number, transition_onset_reynolds: number, eddy_count: number, eddy_lifetime: number, padding1: number, padding2: number) {
    this.smagorinsky_constant = smagorinsky_constant;
    this.wale_constant = wale_constant;
    this.vreman_constant = vreman_constant;
    this.k_epsilon_c_mu = k_epsilon_c_mu;
    this.k_epsilon_c1 = k_epsilon_c1;
    this.k_epsilon_c2 = k_epsilon_c2;
    this.k_omega_beta_star = k_omega_beta_star;
    this.k_omega_sigma_k = k_omega_sigma_k;
    this.k_omega_sigma_omega = k_omega_sigma_omega;
    this.y_plus_target = y_plus_target;
    this.intermittency = intermittency;
    this.transition_onset_reynolds = transition_onset_reynolds;
    this.eddy_count = eddy_count;
    this.eddy_lifetime = eddy_lifetime;
    this.padding1 = padding1;
    this.padding2 = padding2;
  }
}

export interface ParticleSystemShaderParamsShape {
  particle_count: number;
  particle_diameter: number;
  particle_density: number;
  particle_shape_factor: number;
  drag_coefficient: number;
  restitution_coefficient: number;
  friction_coefficient: number;
  cohesion_energy: number;
  weber_number_critical: number;
  latent_heat: number;
  vapor_pressure: number;
  padding1: number;
}
export class ParticleSystemShaderParams implements ParticleSystemShaderParamsShape {
  particle_count: number;
  particle_diameter: number;
  particle_density: number;
  particle_shape_factor: number;
  drag_coefficient: number;
  restitution_coefficient: number;
  friction_coefficient: number;
  cohesion_energy: number;
  weber_number_critical: number;
  latent_heat: number;
  vapor_pressure: number;
  padding1: number;
  
  constructor(particle_count: number, particle_diameter: number, particle_density: number, particle_shape_factor: number, drag_coefficient: number, restitution_coefficient: number, friction_coefficient: number, cohesion_energy: number, weber_number_critical: number, latent_heat: number, vapor_pressure: number, padding1: number) {
    this.particle_count = particle_count;
    this.particle_diameter = particle_diameter;
    this.particle_density = particle_density;
    this.particle_shape_factor = particle_shape_factor;
    this.drag_coefficient = drag_coefficient;
    this.restitution_coefficient = restitution_coefficient;
    this.friction_coefficient = friction_coefficient;
    this.cohesion_energy = cohesion_energy;
    this.weber_number_critical = weber_number_critical;
    this.latent_heat = latent_heat;
    this.vapor_pressure = vapor_pressure;
    this.padding1 = padding1;
  }
}

export interface CouplingShaderParamsShape {
  coupling_timestep_ratio: number;
  coupling_tolerance: number;
  coupling_max_iterations: number;
  natural_convection_gain: number;
  forced_convection_gain: number;
  structural_damping: number;
  electrokinetic_mobility: number;
  zeta_potential: number;
  debye_length: number;
  magnetic_reynolds_number: number;
  hartmann_number: number;
  interaction_parameter: number;
  speed_of_sound: number;
  acoustic_impedance: number;
  padding1: number;
  padding2: number;
}
export class CouplingShaderParams implements CouplingShaderParamsShape {
  coupling_timestep_ratio: number;
  coupling_tolerance: number;
  coupling_max_iterations: number;
  natural_convection_gain: number;
  forced_convection_gain: number;
  structural_damping: number;
  electrokinetic_mobility: number;
  zeta_potential: number;
  debye_length: number;
  magnetic_reynolds_number: number;
  hartmann_number: number;
  interaction_parameter: number;
  speed_of_sound: number;
  acoustic_impedance: number;
  padding1: number;
  padding2: number;
  
  constructor(coupling_timestep_ratio: number, coupling_tolerance: number, coupling_max_iterations: number, natural_convection_gain: number, forced_convection_gain: number, structural_damping: number, electrokinetic_mobility: number, zeta_potential: number, debye_length: number, magnetic_reynolds_number: number, hartmann_number: number, interaction_parameter: number, speed_of_sound: number, acoustic_impedance: number, padding1: number, padding2: number) {
    this.coupling_timestep_ratio = coupling_timestep_ratio;
    this.coupling_tolerance = coupling_tolerance;
    this.coupling_max_iterations = coupling_max_iterations;
    this.natural_convection_gain = natural_convection_gain;
    this.forced_convection_gain = forced_convection_gain;
    this.structural_damping = structural_damping;
    this.electrokinetic_mobility = electrokinetic_mobility;
    this.zeta_potential = zeta_potential;
    this.debye_length = debye_length;
    this.magnetic_reynolds_number = magnetic_reynolds_number;
    this.hartmann_number = hartmann_number;
    this.interaction_parameter = interaction_parameter;
    this.speed_of_sound = speed_of_sound;
    this.acoustic_impedance = acoustic_impedance;
    this.padding1 = padding1;
    this.padding2 = padding2;
  }
}

export interface BoundaryShaderParamsShape {
  turbulence_intensity_inlet: number;
  turbulence_length_scale_inlet: number;
  wall_roughness: number;
  wall_temperature: number;
  wall_heat_flux: number;
  slip_length: number;
  contact_angle_advancing: number;
  contact_angle_receding: number;
  contact_angle_hysteresis: number;
  porous_permeability: number;
  porous_porosity: number;
  sponge_layer_thickness: number;
  sponge_damping_coefficient: number;
  outflow_convective_velocity: number;
  inflow_turbulence_seed: number;
  padding1: number;
}
export class BoundaryShaderParams implements BoundaryShaderParamsShape {
  turbulence_intensity_inlet: number;
  turbulence_length_scale_inlet: number;
  wall_roughness: number;
  wall_temperature: number;
  wall_heat_flux: number;
  slip_length: number;
  contact_angle_advancing: number;
  contact_angle_receding: number;
  contact_angle_hysteresis: number;
  porous_permeability: number;
  porous_porosity: number;
  sponge_layer_thickness: number;
  sponge_damping_coefficient: number;
  outflow_convective_velocity: number;
  inflow_turbulence_seed: number;
  padding1: number;
  
  constructor(turbulence_intensity_inlet: number, turbulence_length_scale_inlet: number, wall_roughness: number, wall_temperature: number, wall_heat_flux: number, slip_length: number, contact_angle_advancing: number, contact_angle_receding: number, contact_angle_hysteresis: number, porous_permeability: number, porous_porosity: number, sponge_layer_thickness: number, sponge_damping_coefficient: number, outflow_convective_velocity: number, inflow_turbulence_seed: number, padding1: number) {
    this.turbulence_intensity_inlet = turbulence_intensity_inlet;
    this.turbulence_length_scale_inlet = turbulence_length_scale_inlet;
    this.wall_roughness = wall_roughness;
    this.wall_temperature = wall_temperature;
    this.wall_heat_flux = wall_heat_flux;
    this.slip_length = slip_length;
    this.contact_angle_advancing = contact_angle_advancing;
    this.contact_angle_receding = contact_angle_receding;
    this.contact_angle_hysteresis = contact_angle_hysteresis;
    this.porous_permeability = porous_permeability;
    this.porous_porosity = porous_porosity;
    this.sponge_layer_thickness = sponge_layer_thickness;
    this.sponge_damping_coefficient = sponge_damping_coefficient;
    this.outflow_convective_velocity = outflow_convective_velocity;
    this.inflow_turbulence_seed = inflow_turbulence_seed;
    this.padding1 = padding1;
  }
}




































































export interface HyperFluidDetailsShape {
}
export class HyperFluidDetails implements HyperFluidDetailsShape {
  
  constructor() {
  }
}

export interface HyperFluidViewportShape {
}
export class HyperFluidViewport implements HyperFluidViewportShape {
  
  constructor() {
  }
}








export interface RenderTargetConfigShape {
  width: number;
  height: number;
  depth: number;
  format: string;
  enable_uav: boolean;
  enable_srv: boolean;
  clear_color: Vec4;
}
export class RenderTargetConfig implements RenderTargetConfigShape {
  width: number;
  height: number;
  depth: number;
  format: string;
  enable_uav: boolean;
  enable_srv: boolean;
  clear_color: Vec4;
  
  constructor(width: number, height: number, depth: number, format: string, enable_uav: boolean, enable_srv: boolean, clear_color: Vec4) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.format = format;
    this.enable_uav = enable_uav;
    this.enable_srv = enable_srv;
    this.clear_color = clear_color;
  }
}

export function CreateSimulationRenderTargets(world: HyperFluidWorld): void {
println("Render target bootstrap handled by generated shader pipeline")  ;
}

export interface SFluidSimulationDashboardShape {
  title: Text;
  simulation_running: boolean;
  current_fps: number;
  particle_count: number;
  grid_resolution: [number, number, number];
  on_start_simulation: OnButtonClicked;
  on_stop_simulation: OnButtonClicked;
  on_reset_simulation: OnButtonClicked;
  on_quality_changed: OnSelectionChanged;
}
export class SFluidSimulationDashboard implements SFluidSimulationDashboardShape {
  title: Text;
  simulation_running: boolean;
  current_fps: number;
  particle_count: number;
  grid_resolution: [number, number, number];
  on_start_simulation: OnButtonClicked;
  on_stop_simulation: OnButtonClicked;
  on_reset_simulation: OnButtonClicked;
  on_quality_changed: OnSelectionChanged;
  
  constructor(title: Text, simulation_running: boolean, current_fps: number, particle_count: number, grid_resolution: [number, number, number], on_start_simulation: OnButtonClicked, on_stop_simulation: OnButtonClicked, on_reset_simulation: OnButtonClicked, on_quality_changed: OnSelectionChanged) {
    this.title = title;
    this.simulation_running = simulation_running;
    this.current_fps = current_fps;
    this.particle_count = particle_count;
    this.grid_resolution = grid_resolution;
    this.on_start_simulation = on_start_simulation;
    this.on_stop_simulation = on_stop_simulation;
    this.on_reset_simulation = on_reset_simulation;
    this.on_quality_changed = on_quality_changed;
  }
}

export interface SSimulationControlsShape {
  world: HyperFluidWorld;
  time_step: number;
  viscosity: number;
  gravity_scale: number;
  turbulence_intensity: number;
  on_timestep_changed: OnValueChanged;
  on_viscosity_changed: OnValueChanged;
  on_gravity_changed: OnValueChanged;
  on_turbulence_changed: OnValueChanged;
}
export class SSimulationControls implements SSimulationControlsShape {
  world: HyperFluidWorld;
  time_step: number;
  viscosity: number;
  gravity_scale: number;
  turbulence_intensity: number;
  on_timestep_changed: OnValueChanged;
  on_viscosity_changed: OnValueChanged;
  on_gravity_changed: OnValueChanged;
  on_turbulence_changed: OnValueChanged;
  
  constructor(world: HyperFluidWorld, time_step: number, viscosity: number, gravity_scale: number, turbulence_intensity: number, on_timestep_changed: OnValueChanged, on_viscosity_changed: OnValueChanged, on_gravity_changed: OnValueChanged, on_turbulence_changed: OnValueChanged) {
    this.world = world;
    this.time_step = time_step;
    this.viscosity = viscosity;
    this.gravity_scale = gravity_scale;
    this.turbulence_intensity = turbulence_intensity;
    this.on_timestep_changed = on_timestep_changed;
    this.on_viscosity_changed = on_viscosity_changed;
    this.on_gravity_changed = on_gravity_changed;
    this.on_turbulence_changed = on_turbulence_changed;
  }
}

export interface SVisualizationControlsShape {
  viz_mode: EVisualizationMode;
  exposure: number;
  contrast: number;
  color_a: [number, number, number];
  color_b: [number, number, number];
  on_mode_changed: OnSelectionChanged;
  on_exposure_changed: OnValueChanged;
  on_contrast_changed: OnValueChanged;
  on_color_a_changed: OnColorChanged;
  on_color_b_changed: OnColorChanged;
}
export class SVisualizationControls implements SVisualizationControlsShape {
  viz_mode: EVisualizationMode;
  exposure: number;
  contrast: number;
  color_a: [number, number, number];
  color_b: [number, number, number];
  on_mode_changed: OnSelectionChanged;
  on_exposure_changed: OnValueChanged;
  on_contrast_changed: OnValueChanged;
  on_color_a_changed: OnColorChanged;
  on_color_b_changed: OnColorChanged;
  
  constructor(viz_mode: EVisualizationMode, exposure: number, contrast: number, color_a: [number, number, number], color_b: [number, number, number], on_mode_changed: OnSelectionChanged, on_exposure_changed: OnValueChanged, on_contrast_changed: OnValueChanged, on_color_a_changed: OnColorChanged, on_color_b_changed: OnColorChanged) {
    this.viz_mode = viz_mode;
    this.exposure = exposure;
    this.contrast = contrast;
    this.color_a = color_a;
    this.color_b = color_b;
    this.on_mode_changed = on_mode_changed;
    this.on_exposure_changed = on_exposure_changed;
    this.on_contrast_changed = on_contrast_changed;
    this.on_color_a_changed = on_color_a_changed;
    this.on_color_b_changed = on_color_b_changed;
  }
}

export interface FluidSimulationViewportShape {
  fluid_world: HyperFluidWorld;
  camera: EditorCamera;
  viewport_mode: EVisualizationMode;
  show_grid: boolean;
  show_bounds: boolean;
  show_particles: boolean;
}
export class FluidSimulationViewport implements FluidSimulationViewportShape {
  fluid_world: HyperFluidWorld;
  camera: EditorCamera;
  viewport_mode: EVisualizationMode;
  show_grid: boolean;
  show_bounds: boolean;
  show_particles: boolean;
  
  constructor(fluid_world: HyperFluidWorld, camera: EditorCamera, viewport_mode: EVisualizationMode, show_grid: boolean, show_bounds: boolean, show_particles: boolean) {
    this.fluid_world = fluid_world;
    this.camera = camera;
    this.viewport_mode = viewport_mode;
    this.show_grid = show_grid;
    this.show_bounds = show_bounds;
    this.show_particles = show_particles;
  }
}

export interface FluidWorldDetailsShape {
  grid_resolution_x: number;
  grid_resolution_y: number;
  grid_resolution_z: number;
  time_step: number;
  cfl_number: number;
  substeps: number;
  viscosity: number;
  density: number;
  gravity_scale: number;
  turbulence_intensity: number;
  vortex_confinement: number;
  visualization_mode: EVisualizationMode;
  exposure: number;
  contrast: number;
  color_primary: [number, number, number];
  color_secondary: [number, number, number];
  gpu_memory_budget_mb: number;
  cpu_thread_count: number;
  async_compute_enabled: boolean;
  enable_diagnostics: boolean;
  check_mass_conservation: boolean;
  check_momentum_conservation: boolean;
  check_energy_conservation: boolean;
}
export class FluidWorldDetails implements FluidWorldDetailsShape {
  grid_resolution_x: number;
  grid_resolution_y: number;
  grid_resolution_z: number;
  time_step: number;
  cfl_number: number;
  substeps: number;
  viscosity: number;
  density: number;
  gravity_scale: number;
  turbulence_intensity: number;
  vortex_confinement: number;
  visualization_mode: EVisualizationMode;
  exposure: number;
  contrast: number;
  color_primary: [number, number, number];
  color_secondary: [number, number, number];
  gpu_memory_budget_mb: number;
  cpu_thread_count: number;
  async_compute_enabled: boolean;
  enable_diagnostics: boolean;
  check_mass_conservation: boolean;
  check_momentum_conservation: boolean;
  check_energy_conservation: boolean;
  
  constructor(grid_resolution_x: number, grid_resolution_y: number, grid_resolution_z: number, time_step: number, cfl_number: number, substeps: number, viscosity: number, density: number, gravity_scale: number, turbulence_intensity: number, vortex_confinement: number, visualization_mode: EVisualizationMode, exposure: number, contrast: number, color_primary: [number, number, number], color_secondary: [number, number, number], gpu_memory_budget_mb: number, cpu_thread_count: number, async_compute_enabled: boolean, enable_diagnostics: boolean, check_mass_conservation: boolean, check_momentum_conservation: boolean, check_energy_conservation: boolean) {
    this.grid_resolution_x = grid_resolution_x;
    this.grid_resolution_y = grid_resolution_y;
    this.grid_resolution_z = grid_resolution_z;
    this.time_step = time_step;
    this.cfl_number = cfl_number;
    this.substeps = substeps;
    this.viscosity = viscosity;
    this.density = density;
    this.gravity_scale = gravity_scale;
    this.turbulence_intensity = turbulence_intensity;
    this.vortex_confinement = vortex_confinement;
    this.visualization_mode = visualization_mode;
    this.exposure = exposure;
    this.contrast = contrast;
    this.color_primary = color_primary;
    this.color_secondary = color_secondary;
    this.gpu_memory_budget_mb = gpu_memory_budget_mb;
    this.cpu_thread_count = cpu_thread_count;
    this.async_compute_enabled = async_compute_enabled;
    this.enable_diagnostics = enable_diagnostics;
    this.check_mass_conservation = check_mass_conservation;
    this.check_momentum_conservation = check_momentum_conservation;
    this.check_energy_conservation = check_energy_conservation;
  }
}

export interface FluidSimulationToolbarShape {
  show_grid: boolean;
  show_bounds: boolean;
  show_particles: boolean;
  quality_preset: string;
  solver_type: string;
}
export class FluidSimulationToolbar implements FluidSimulationToolbarShape {
  show_grid: boolean;
  show_bounds: boolean;
  show_particles: boolean;
  quality_preset: string;
  solver_type: string;
  
  constructor(show_grid: boolean, show_bounds: boolean, show_particles: boolean, quality_preset: string, solver_type: string) {
    this.show_grid = show_grid;
    this.show_bounds = show_bounds;
    this.show_particles = show_particles;
    this.quality_preset = quality_preset;
    this.solver_type = solver_type;
  }
}

export interface FluidSimulationEditorShape {
  fluid_world: HyperFluidWorld;
  preview_viewport: FluidSimulationViewport;
  properties: FluidWorldDetails;
  toolbar: FluidSimulationToolbar;
  dashboard: SFluidSimulationDashboard;
  sim_controls: SSimulationControls;
  viz_controls: SVisualizationControls;
}
export class FluidSimulationEditor implements FluidSimulationEditorShape {
  fluid_world: HyperFluidWorld;
  preview_viewport: FluidSimulationViewport;
  properties: FluidWorldDetails;
  toolbar: FluidSimulationToolbar;
  dashboard: SFluidSimulationDashboard;
  sim_controls: SSimulationControls;
  viz_controls: SVisualizationControls;
  
  constructor(fluid_world: HyperFluidWorld, preview_viewport: FluidSimulationViewport, properties: FluidWorldDetails, toolbar: FluidSimulationToolbar, dashboard: SFluidSimulationDashboard, sim_controls: SSimulationControls, viz_controls: SVisualizationControls) {
    this.fluid_world = fluid_world;
    this.preview_viewport = preview_viewport;
    this.properties = properties;
    this.toolbar = toolbar;
    this.dashboard = dashboard;
    this.sim_controls = sim_controls;
    this.viz_controls = viz_controls;
  }
}

// @ts-nocheck
