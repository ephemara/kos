# BEVY 0.17 REFERENCE

> **FOR AI AGENTS** | K_OS Engine | v0.17.3 | Compact format for token efficiency

```
AI TRAINING DATA = 0.14-0.15 | THIS PROJECT = 0.17
READ THIS BEFORE GENERATING BEVY CODE
```

---

## ARCHITECTURE

```
PARADIGM: Data-Driven (NOT OOP)
  OOP: Player.move()           → Bevy: Player component + movement_system()
  OOP: Inheritance             → Bevy: Component composition  
  OOP: Object owns logic       → Bevy: State (Components) ≠ Behavior (Systems)

WHY:
  - CPU cache coherence (contiguous arrays)
  - Automatic parallelization
  - Thread safety at compile time (Rust ownership)
```

---

## ECS CORE

```
ENTITY:
  - Lightweight ID (generational index)
  - O(1) lookup, generation prevents use-after-free
  - Holds NO data or logic

COMPONENT:
  - Plain Rust struct: #[derive(Component)]
  - Stored in Archetypes (unique component set combos)
  - Table storage (fast iter) vs Sparse Set (fast add/remove)

SYSTEM:
  - Plain Rust function with SystemParam arguments
  - Scheduler auto-parallelizes based on signature
  - Cannot directly modify ECS structure (use Commands)
```

---

## SYSTEM PARAMETERS

```
VALID FUNCTION ARGUMENTS (SystemParam trait):

Query<D, F>           Component iteration, O(n)
Res<T>                Resource read (shared), O(1)
ResMut<T>             Resource write (exclusive), O(1)
Commands              Deferred spawn/despawn/insert, O(1) queue
Local<T>              System-private persistent state, O(1)
EventReader<T>        Consume buffered events, O(events)
EventWriter<T>        Emit events, O(1)
Single<D, F>          ⚠️ NEW 0.17 - Exactly one entity, O(1)
Option<Single<D,F>>   Zero or one entity, O(1)
ParamSet<T>           Handle conflicting borrows
World                 Exclusive access (exclusive systems only)
```

---

## QUERY API

```
SYNTAX: Query<Data, Filter>

DATA (what to retrieve):
  &T              Read-only
  &mut T          Mutable
  Entity          Entity ID
  Option<&T>      None if missing (doesn't exclude)
  Ref<T>          Read + change detection

FILTER (conditions):
  With<T>         Must have T
  Without<T>      Must NOT have T
  Changed<T>      Modified since last run
  Added<T>        Added since last run
  Or<(F1, F2)>    Logical OR

ITERATION:
  iter()              Sequential read, O(n)
  iter_mut()          Sequential write, O(n)
  par_iter()          Parallel, O(n/threads)
  iter_many(list)     Sparse lookup, O(k)
  get(entity)         Single lookup, O(1)
  iter_combinations() All pairs, O(n^2)

DISJOINT QUERIES:
  ❌ fn bad(q1: Query<&mut T>, q2: Query<&mut T>)
  ✅ fn good(q1: Query<&mut T, With<A>>, q2: Query<&mut T, Without<A>>)
  ✅ fn conflict(mut p: ParamSet<(Query<&mut T>, Query<&mut T>)>)
```

---

## 0.17 CHANGES (CRITICAL)

```
RENAMED:
  EventReader/Writer  → MessageReader/Writer (buffered events)
  query.single()      → Single<T> parameter (compile-time validation)
  query.get_single()  → query.single() (returns Result, not panic)
  timer.paused()      → timer.is_paused()
  timer.finished()    → timer.is_finished()
  
DEPRECATED:
  query.single()      → Use Single<T> param, or query.single() (returns Result)
  query.single_mut()  → Use Single<T> param, or query.single_mut() (returns Result)
  Event derive        → Split into Event (observers) and Message (buffered)

SPAWN PATTERN:
  OLD: commands.spawn(PbrBundle { mesh, material, ..default() })
  NEW: commands.spawn((Mesh3d(mesh), MeshMaterial3d(mat), Transform::...))
```

---

## MESSAGES VS EVENTS (0.17)

```
⚠️ THIS IS DIFFERENT FROM PREVIOUS BEVY VERSIONS

MESSAGE (buffered, inter-system):
  #[derive(Event)] 
  struct MyMessage { data: T }
  impl bevy::prelude::Message for MyMessage {}
  
  Write:  MessageWriter<MyMessage>
  Read:   MessageReader<MyMessage>
  Reg:    app.add_message::<MyMessage>()
  
  - Double-buffered (2 frames)
  - "Pull-based" - systems poll for messages
  - Best for: high-frequency events (collisions, mouse moves)

EVENT (observable, immediate):
  #[derive(Event)]
  struct MyEvent { data: T }
  
  Trigger: world.trigger(MyEvent{..}) or commands.trigger(..)
  Observe:  Observer::new(|trigger: Trigger<MyEvent>| { .. })
  
  - Executes immediately when triggered
  - "Push-based" - observers react instantly
  - Best for: rare events, entity-specific reactions

ENTITYEVENT (targeted):
  #[derive(EntityEvent)]
  #[entity_event(propagate)]  // optional bubbling
  struct HitEvent { target: Entity, damage: u32 }
  
  - Targets specific entity
  - Can bubble up hierarchy (like DOM events)
  - Best for: combat, UI interactions
```

---

## BEVY_EGUI 0.38 (CRITICAL)

```
⚠️ EGUI SYSTEMS MUST USE EguiPrimaryContextPass SCHEDULE

WRONG (will panic or have broken input):
  .add_systems(Update, my_egui_system)  // ❌ DON'T DO THIS

RIGHT (works correctly):
  use bevy_egui::EguiPrimaryContextPass;
  .add_systems(EguiPrimaryContextPass, my_egui_system)  // ✅

SYSTEM SIGNATURE (returns Result!):
  fn my_egui_system(mut contexts: EguiContexts) -> Result {
      let ctx = contexts.ctx_mut()?;  // Returns Result, use ?
      egui::Window::new("Title").show(ctx, |ui| { .. });
      Ok(())
  }

WHY EguiPrimaryContextPass:
  - bevy_egui 0.38 uses multi-pass mode by default
  - Context NOT ready until EguiPrimaryContextPass runs first
  - Using Update schedule = "Called available_rect() before Context::run()" panic
  - Multi-pass allows multiple egui passes per frame (rendering to textures etc)
```

### EGUI INPUT ABSORPTION

```
CHECK IF EGUI WANTS INPUT (use these in game systems):

  ctx.is_pointer_over_area()    → true if mouse over ANY egui element
  ctx.wants_pointer_input()     → true if egui is actively using pointer
  ctx.wants_keyboard_input()    → true if egui has keyboard focus (text field)

DIFFERENCE:
  is_pointer_over_area()   = mouse hovering over egui (passive)
  wants_pointer_input()    = egui is dragging/interacting (active)
  
  Use wants_pointer_input() for most cases - more precise!

ABSORB INPUT PATTERN (prevent game from reacting when egui active):
  
  // In your game input system:
  fn my_game_input(
      ctx: Res<EguiContext>,  // or get from EguiContexts
      mouse: Res<ButtonInput<MouseButton>>,
  ) {
      // Skip if egui wants the input
      if ctx.get().wants_pointer_input() {
          return;
      }
      // Now safe to handle game input
      if mouse.just_pressed(MouseButton::Left) { .. }
  }

GLOBAL ABSORB SETTING (bevy_egui built-in):
  use bevy_egui::EguiGlobalSettings;
  
  fn ui_system(mut settings: ResMut<EguiGlobalSettings>) {
      // Toggle to absorb ALL bevy input messages when egui active
      settings.enable_absorb_bevy_input_system = true;
  }
  
  When enabled:
  - KeyboardInput messages absorbed when egui has keyboard focus
  - MouseButtonInput absorbed when pointer over egui area
  - MouseWheel absorbed when pointer over egui area
```

### EGUI CONTEXT ACCESS

```
CONTEXT TYPES:
  EguiContexts              → SystemParam, easiest way to get context
  EguiContext (component)   → Per-window/entity egui context
  PrimaryEguiContext        → Marker for primary window context

GETTING THE CONTEXT:
  fn sys(mut contexts: EguiContexts) -> Result {
      let ctx = contexts.ctx_mut()?;          // Primary window
      // OR for specific entity:
      let ctx = contexts.ctx_for_entity_mut(entity)?;
      Ok(())
  }

FIRST FRAME ISSUES:
  - Context may not exist on frame 0-1
  - Always use ctx_mut()? with Result return type
  - OR skip first N frames: 
    if time.elapsed_secs() < 0.1 { return; }

MULTI-WINDOW:
  contexts.ctx_for_entity_mut(window_entity)  → Get context for specific window
```

---

## RAYCASTING (0.17)

```
CAMERA TO WORLD RAY:

  fn raycast_system(
      camera_q: Query<(&Camera, &GlobalTransform)>,
      windows: Query<&Window>,
  ) {
      let (camera, cam_transform) = camera_q.single();
      let window = windows.single();
      
      // Get cursor position in window
      let Some(cursor_pos) = window.cursor_position() else { return };
      
      // Convert to world ray
      let Ok(ray) = camera.viewport_to_world(cam_transform, cursor_pos) else { return };
      
      // ray.origin = Vec3 (camera position or near plane)
      // ray.direction = Dir3 (ray direction, use *ray.direction for Vec3)
  }

RAY3D METHODS:
  ray.origin              → Vec3 start point
  *ray.direction          → Vec3 direction (deref Dir3)
  ray.get_point(t)        → Vec3 point at distance t along ray
  ray.intersect_plane()   → Option<f32> distance to plane intersection

MESH INTERSECTION (manual Möller-Trumbore):
  // For each triangle in mesh:
  let v0, v1, v2 = triangle vertices;
  let edge1 = v1 - v0;
  let edge2 = v2 - v0;
  let h = ray_dir.cross(edge2);
  let a = edge1.dot(h);
  if a.abs() < 1e-5 { continue; }  // parallel
  let f = 1.0 / a;
  let s = ray_origin - v0;
  let u = f * s.dot(h);
  if u < 0.0 || u > 1.0 { continue; }
  let q = s.cross(edge1);
  let v = f * ray_dir.dot(q);
  if v < 0.0 || u + v > 1.0 { continue; }
  let t = f * edge2.dot(q);
  if t > 0.001 {
      // HIT! t = distance, compute hit_point = ray_origin + ray_dir * t
  }

BEVY PICKING (built-in 0.17):
  // Built-in, no plugin needed!
  use bevy::picking::*;
  
  // Add Pickable to entities you want to pick:
  commands.spawn((Mesh3d(..), Pickable::default()));
  
  // React to events:
  commands.spawn((..)).observe(|trigger: Trigger<Pointer<Click>>| {
      let entity = trigger.target();
      let hit = trigger.event();
  });

bevy_mod_picking (external, more features):
  - GPU-based picking shader
  - Multi-touch, gamepad support
  - More robust for complex scenes
```

---

## COMPONENT BUNDLES (0.17)

```
OLD BUNDLES → NEW TUPLE SYNTAX:

PbrBundle {                    (
  mesh: Handle<Mesh>,     →      Mesh3d(handle),
  material: Handle<M>,    →      MeshMaterial3d(handle),
  transform: T,           →      Transform::from_xyz(..),
  ..default()             →    )
}

Camera3dBundle {              (
  camera: Camera,         →      Camera::default(),
  transform: T,           →      Transform::from_xyz(..),
                          →      Camera3d::default(),  // if needed
}

SpriteBundle {                (
  texture: Handle<Image>, →      Sprite::from_image(handle),
  transform: T,           →      Transform::from_xyz(..),
}
```

---

## K_OS PLUGINS

```
bevy_panorbit_camera  0.33  Orbit camera (button_orbit = Middle for sculpt)
bevy_egui             0.38  egui integration (USE EguiPrimaryContextPass!)
bevy_hanabi           0.17  GPU particles
bevy_tweening         0.14  Animations
bevy-inspector-egui   0.35  Entity inspector
```

---

## LLM RULES

```
ECS:
  ✅ Only use valid SystemParam types
  ✅ Disjoint queries only (use filters or ParamSet)
  ✅ Use Commands for structural changes
  ✅ Use Single<T> for singletons (NOT query.single())
  ✅ Declare ordering explicitly (.before/.after/.chain)
  ✅ Use 0.17 spawn pattern (tuples, NOT bundles)

EVENTS:
  ✅ Use MessageReader/Writer for buffered events (NOT EventReader)
  ✅ impl Message for buffered event structs
  ✅ Use Observer + Trigger for immediate events
  ✅ Use EntityEvent for targeted events with bubbling

EGUI:
  ✅ Use EguiPrimaryContextPass for egui systems (NOT Update)
  ✅ Egui systems return Result, use ctx_mut()?
  ✅ Skip first 2-3 frames if not using EguiPrimaryContextPass
  ✅ Check ctx.wants_pointer_input() before handling game input
  ✅ Use EguiGlobalSettings.enable_absorb_bevy_input_system for auto-absorption

RAYCASTING:
  ✅ Use camera.viewport_to_world(transform, cursor_pos) for screen→ray
  ✅ Ray3d.direction is Dir3, use *ray.direction for Vec3
  ✅ Built-in bevy::picking available in 0.17 (no plugin needed)
  ✅ For custom: Möller-Trumbore triangle intersection

COMMON MISTAKES:
  ❌ DON'T use EventReader/EventWriter (renamed to Message*)
  ❌ DON'T put egui systems in Update schedule
  ❌ DON'T use query.single() - use Single<T> param instead  
  ❌ DON'T use PbrBundle/SpriteBundle/etc - use tuple components
  ❌ DON'T forget to check egui wants input before game raycast
```

---

## LINKS

```
https://bevyengine.org/learn/book/introduction/
https://bevy-cheatbook.github.io/
https://docs.rs/bevy/latest/bevy/
https://bevyengine.org/learn/migration-guides/
https://docs.rs/bevy_egui/0.38.0/bevy_egui/
https://github.com/vladbat00/bevy_egui/tree/v0.38.0/examples
```
