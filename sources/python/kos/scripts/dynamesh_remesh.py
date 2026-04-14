import sys
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Register decorator lives in main.py (see existing scripts pattern)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from main import register


def _as_np_f32(x: Any) -> np.ndarray:
    arr = np.asarray(x, dtype=np.float32)
    return arr


def _as_np_u32(x: Any) -> np.ndarray:
    arr = np.asarray(x, dtype=np.uint32)
    return arr


def _compute_aabb(pos: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    p = pos.reshape(-1, 3)
    return p.min(axis=0), p.max(axis=0)


def _try_import_pymeshlab():
    try:
        import pymeshlab  # type: ignore
        return pymeshlab
    except Exception as e:
        return None


def _try_import_open3d():
    try:
        import open3d as o3d  # type: ignore
        return o3d
    except Exception:
        return None


def _try_import_trimesh():
    try:
        import trimesh  # type: ignore
        return trimesh
    except Exception:
        return None


@register("dynamesh.remesh")
def dynamesh_remesh(
    positions: List[float],
    indices: List[int],
    target_edge_len: float = 0.02,
    adaptivity: float = 0.0,
    iterations: int = 6,
    preserve_boundary: bool = True,
    smooth: int = 2,
) -> Dict[str, Any]:
    """High-quality remesh via best-available Python backend.

    Strategy:
    - Prefer PyMeshLab (MeshLab filters) for robust isotropic remeshing.
    - Fallback to Open3D (simplify + smooth) if available.
    - Fallback to Trimesh (basic cleanup) as last resort.

    Returns:
    - positions: flat float list
    - indices: flat uint32 list
    - stats: timings + tool used

    Notes:
    - This file is created but not wired yet.
    - Logs go to stderr.
    """
    pos = _as_np_f32(positions)
    ind = _as_np_u32(indices)

    if pos.size == 0 or ind.size == 0:
        return {
            "positions": positions,
            "indices": indices,
            "stats": {"backend": "none", "reason": "empty"},
        }

    pymeshlab = _try_import_pymeshlab()
    if pymeshlab is not None:
        try:
            ms = pymeshlab.MeshSet()
            v = pos.reshape(-1, 3)
            f = ind.reshape(-1, 3)
            mesh = pymeshlab.Mesh(vertex_matrix=v, face_matrix=f)
            ms.add_mesh(mesh, "input")

            # Clean
            ms.apply_filter("remove_duplicate_vertices")
            ms.apply_filter("remove_duplicate_faces")
            ms.apply_filter("remove_unreferenced_vertices")

            # Isotropic explicit remeshing (MeshLab)
            # Parameters vary across versions; keep it simple.
            ms.apply_filter(
                "meshing_isotropic_explicit_remeshing",
                targetlen=pymeshlab.PercentageValue(target_edge_len * 100.0)
                if target_edge_len <= 1.0
                else target_edge_len,
                iterations=int(iterations),
                adaptivity=float(adaptivity),
                preserveboundary=bool(preserve_boundary),
            )

            # Optional smoothing
            if smooth > 0:
                ms.apply_filter("taubin_smooth", stepsmoothnum=int(smooth))

            out = ms.current_mesh()
            out_v = np.asarray(out.vertex_matrix(), dtype=np.float32)
            out_f = np.asarray(out.face_matrix(), dtype=np.uint32)

            return {
                "positions": out_v.reshape(-1).tolist(),
                "indices": out_f.reshape(-1).tolist(),
                "stats": {
                    "backend": "pymeshlab",
                    "in_v": int(v.shape[0]),
                    "in_f": int(f.shape[0]),
                    "out_v": int(out_v.shape[0]),
                    "out_f": int(out_f.shape[0]),
                },
            }
        except Exception as e:
            print(f"[dynamesh_remesh.py] PyMeshLab failed: {e}", file=sys.stderr)

    o3d = _try_import_open3d()
    if o3d is not None:
        try:
            v = pos.reshape(-1, 3)
            f = ind.reshape(-1, 3)
            mesh = o3d.geometry.TriangleMesh(
                o3d.utility.Vector3dVector(v.astype(np.float64)),
                o3d.utility.Vector3iVector(f.astype(np.int32)),
            )
            mesh.remove_duplicated_vertices()
            mesh.remove_duplicated_triangles()
            mesh.remove_degenerate_triangles()
            mesh.remove_unreferenced_vertices()

            # Open3D doesn't have true ZBrush dynamesh. This is a fallback.
            # Do a mild simplification + smooth.
            tri_target = int(mesh.triangles.__len__() * 0.75)
            if tri_target > 1000:
                mesh = mesh.simplify_quadric_decimation(tri_target)

            if smooth > 0:
                mesh = mesh.filter_smooth_taubin(number_of_iterations=int(smooth))

            out_v = np.asarray(mesh.vertices, dtype=np.float32)
            out_f = np.asarray(mesh.triangles, dtype=np.uint32)

            return {
                "positions": out_v.reshape(-1).tolist(),
                "indices": out_f.reshape(-1).tolist(),
                "stats": {
                    "backend": "open3d",
                    "out_v": int(out_v.shape[0]),
                    "out_f": int(out_f.shape[0]),
                },
            }
        except Exception as e:
            print(f"[dynamesh_remesh.py] Open3D failed: {e}", file=sys.stderr)

    trimesh = _try_import_trimesh()
    if trimesh is not None:
        try:
            v = pos.reshape(-1, 3)
            f = ind.reshape(-1, 3)
            m = trimesh.Trimesh(vertices=v, faces=f, process=True)
            m.remove_unreferenced_vertices()

            out_v = np.asarray(m.vertices, dtype=np.float32)
            out_f = np.asarray(m.faces, dtype=np.uint32)

            return {
                "positions": out_v.reshape(-1).tolist(),
                "indices": out_f.reshape(-1).tolist(),
                "stats": {
                    "backend": "trimesh",
                    "out_v": int(out_v.shape[0]),
                    "out_f": int(out_f.shape[0]),
                },
            }
        except Exception as e:
            print(f"[dynamesh_remesh.py] Trimesh failed: {e}", file=sys.stderr)

    return {
        "positions": positions,
        "indices": indices,
        "stats": {"backend": "none", "reason": "no_backend_available"},
    }


print("[dynamesh_remesh.py] Loaded dynamesh remesh script", file=sys.stderr)
