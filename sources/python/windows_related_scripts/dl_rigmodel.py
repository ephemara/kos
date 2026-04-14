"""
dl_rigmodel.py - RigModels.com Downloader for K_OS
Downloads rigged 3D models from rigmodels.com
Supports OBJ download with auto-conversion to GLB!
"""

import sys
import os
import re
import urllib.request
import urllib.parse
import zipfile
import io
import tkinter as tk
from tkinter import simpledialog, messagebox, ttk
import winsound
import threading
import queue

# RigModels.com base URL
RIGMODELS_BASE = "https://rigmodels.com"

# Default safe download location
DEFAULT_FOLDER = r"C:\Users\Admin\Desktop\RIGMODELDOWNLOADS"

def fetch_html(url):
    """Helper to fetch HTML from URL"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode('utf-8', errors='ignore')

def search_models(query, limit=20):
    """Search RigModels.com by query"""
    encoded_query = urllib.parse.quote_plus(query)
    search_url = f"{RIGMODELS_BASE}?searchkeyword={encoded_query}"
    
    html = fetch_html(search_url)
    
    # Parse model links from search results
    # Pattern: model.php?view=MODEL_NAME-3d-model__MODEL_ID
    pattern = r'model\.php\?view=([^"\'&]+)-3d-model__([A-Za-z0-9]+)'
    matches = re.findall(pattern, html)
    
    results = []
    seen_ids = set()
    
    for name, model_id in matches:
        if model_id not in seen_ids:
            seen_ids.add(model_id)
            # Clean up name
            clean_name = name.replace('_', ' ').replace('-', ' ').title()
            results.append({
                'id': model_id,
                'name': clean_name,
                'raw_name': name
            })
    
    return results[:limit]

def download_model_obj(model_id, target_folder):
    """Download the OBJ + MTL files for a model"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    # Create model subfolder
    model_folder = os.path.join(target_folder, model_id)
    os.makedirs(model_folder, exist_ok=True)
    
    # Download OBJ
    obj_url = f"{RIGMODELS_BASE}/3dmodels/{model_id}/Prev/{model_id}.obj"
    mtl_url = f"{RIGMODELS_BASE}/3dmodels/{model_id}/Prev/{model_id}.mtl"
    
    files_downloaded = []
    
    try:
        # Download OBJ
        req = urllib.request.Request(obj_url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as response:
            obj_path = os.path.join(model_folder, f"{model_id}.obj")
            with open(obj_path, 'wb') as f:
                while True:
                    chunk = response.read(16384)
                    if not chunk:
                        break
                    f.write(chunk)
            files_downloaded.append(obj_path)
    except Exception as e:
        print(f"OBJ download failed: {e}")
        return False, str(e)
    
    try:
        # Download MTL
        req = urllib.request.Request(mtl_url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as response:
            mtl_content = response.read().decode('utf-8', errors='ignore')
            mtl_path = os.path.join(model_folder, f"{model_id}.mtl")
            
            # Parse MTL for texture files
            texture_pattern = r'map_\w+\s+(\S+)'
            textures = re.findall(texture_pattern, mtl_content)
            
            with open(mtl_path, 'w') as f:
                f.write(mtl_content)
            files_downloaded.append(mtl_path)
            
            # Download textures
            for tex in textures:
                try:
                    tex_url = f"{RIGMODELS_BASE}/3dmodels/{model_id}/Prev/{tex}"
                    tex_req = urllib.request.Request(tex_url, headers=headers)
                    with urllib.request.urlopen(tex_req, timeout=30) as tex_response:
                        tex_path = os.path.join(model_folder, tex)
                        with open(tex_path, 'wb') as f:
                            f.write(tex_response.read())
                        files_downloaded.append(tex_path)
                except:
                    pass  # Texture download failed, continue
                    
    except Exception as e:
        print(f"MTL download failed: {e}")
        # OBJ still downloaded, continue
    
    return True, model_folder

def try_convert_to_glb(model_folder, model_id):
    """Try to convert OBJ to GLB using trimesh if available"""
    try:
        import trimesh
        
        obj_path = os.path.join(model_folder, f"{model_id}.obj")
        glb_path = os.path.join(model_folder, f"{model_id}.glb")
        
        # Load the OBJ
        mesh = trimesh.load(obj_path, force='scene')
        
        # Export as GLB
        mesh.export(glb_path, file_type='glb')
        
        return True, glb_path
    except ImportError:
        return False, "trimesh not installed (pip install trimesh)"
    except Exception as e:
        return False, str(e)

class RigModelPickerDialog:
    """Multi-select dialog for choosing rigged models"""
    
    def __init__(self, parent, results, target_folder):
        self.selected = []
        self.target_folder = target_folder
        self.msg_queue = queue.Queue()
        self.downloading = False
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("🦴 K_OS RigModel Downloader")
        self.dialog.geometry("550x520")
        self.dialog.attributes("-topmost", True)
        self.dialog.configure(bg="#1a1a2e")
        
        # Header
        header = tk.Label(
            self.dialog, 
            text=f"🎮 Found {len(results)} rigged models",
            font=("Segoe UI", 12, "bold"),
            fg="#ffa500",
            bg="#1a1a2e"
        )
        header.pack(pady=10)
        
        # Source info
        source_label = tk.Label(
            self.dialog,
            text="Source: RigModels.com - Free rigged 3D models",
            fg="#666",
            bg="#1a1a2e",
            font=("Segoe UI", 9)
        )
        source_label.pack()
        
        # Listbox with scrollbar
        frame = tk.Frame(self.dialog, bg="#1a1a2e")
        frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        scrollbar = tk.Scrollbar(frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.listbox = tk.Listbox(
            frame,
            selectmode=tk.MULTIPLE,
            font=("Consolas", 10),
            bg="#16213e",
            fg="#e0e0e0",
            selectbackground="#0f3460",
            selectforeground="#ffa500",
            yscrollcommand=scrollbar.set,
            height=15
        )
        self.listbox.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.listbox.yview)
        
        self.results = results
        for mdl in results:
            self.listbox.insert(tk.END, f"{mdl['name']}  [{mdl['id'][:8]}...]")
        
        if len(results) <= 5:
            self.listbox.select_set(0, tk.END)
        
        # Options frame
        opts_frame = tk.Frame(self.dialog, bg="#1a1a2e")
        opts_frame.pack(pady=5)
        
        # Convert to GLB checkbox
        self.convert_glb = tk.BooleanVar(value=True)
        convert_check = tk.Checkbutton(
            opts_frame,
            text="Convert to GLB (requires trimesh)",
            variable=self.convert_glb,
            fg="#aaa",
            bg="#1a1a2e",
            selectcolor="#16213e",
            activebackground="#1a1a2e",
            activeforeground="#ffa500"
        )
        convert_check.pack()
        
        info_label = tk.Label(
            self.dialog,
            text="💡 Downloads OBJ + textures. GLB conversion optional.",
            fg="#666",
            bg="#1a1a2e",
            font=("Segoe UI", 8)
        )
        info_label.pack(pady=2)
        
        # Buttons
        btn_frame = tk.Frame(self.dialog, bg="#1a1a2e")
        btn_frame.pack(pady=10)
        
        self.download_btn = tk.Button(
            btn_frame,
            text="⬇️ Download Selected",
            command=self.on_download,
            font=("Segoe UI", 10, "bold"),
            bg="#ffa500",
            fg="#000",
            padx=20,
            pady=5
        )
        self.download_btn.pack(side=tk.LEFT, padx=5)
        
        cancel_btn = tk.Button(
            btn_frame,
            text="Cancel",
            command=self.dialog.destroy,
            font=("Segoe UI", 10),
            bg="#444",
            fg="#fff",
            padx=20,
            pady=5
        )
        cancel_btn.pack(side=tk.LEFT, padx=5)
        
        # Progress label
        self.progress_label = tk.Label(
            self.dialog,
            text="",
            fg="#ffa500",
            bg="#1a1a2e",
            font=("Segoe UI", 9)
        )
        self.progress_label.pack(pady=5)
        
        self.dialog.wait_window()
    
    def check_queue(self):
        """Poll the queue for updates from background thread"""
        try:
            while True:
                msg = self.msg_queue.get_nowait()
                if msg['type'] == 'progress':
                    self.progress_label.config(text=msg['text'])
                elif msg['type'] == 'done':
                    self.progress_label.config(text=msg['text'])
                    winsound.MessageBeep()
                    self.dialog.after(1500, self.dialog.destroy)
                    return
        except queue.Empty:
            pass
        
        if self.downloading:
            self.dialog.after(100, self.check_queue)
    
    def on_download(self):
        selection = self.listbox.curselection()
        if not selection:
            messagebox.showwarning("No Selection", "Please select at least one model!")
            return
        
        selected_models = [self.results[i] for i in selection]
        do_convert = self.convert_glb.get()
        
        self.download_btn.config(state=tk.DISABLED)
        self.downloading = True
        
        def download_all():
            total = len(selected_models)
            success_count = 0
            
            for i, mdl in enumerate(selected_models):
                self.msg_queue.put({
                    'type': 'progress',
                    'text': f"Downloading {i+1}/{total}: {mdl['name']}..."
                })
                
                try:
                    success, result = download_model_obj(mdl['id'], self.target_folder)
                    if success:
                        success_count += 1
                        
                        # Try to convert to GLB
                        if do_convert:
                            self.msg_queue.put({
                                'type': 'progress',
                                'text': f"Converting {i+1}/{total}: {mdl['name']} to GLB..."
                            })
                            try_convert_to_glb(result, mdl['id'])
                            
                except Exception as e:
                    print(f"Error downloading {mdl['id']}: {e}")
            
            self.selected = selected_models
            self.msg_queue.put({
                'type': 'done',
                'text': f"✅ Downloaded {success_count}/{total} models!"
            })
        
        threading.Thread(target=download_all, daemon=True).start()
        self.dialog.after(100, self.check_queue)

def main():
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    if len(sys.argv) < 2:
        target_folder = DEFAULT_FOLDER
    else:
        target_folder = sys.argv[1]
    
    os.makedirs(target_folder, exist_ok=True)
    os.chdir(target_folder)

    display_path = (target_folder[:40] + '...') if len(target_folder) > 40 else target_folder
    
    query = simpledialog.askstring(
        "K_OS RigModel Downloader", 
        f"📂 {display_path}\n\n"
        f"🌐 Source: RigModels.com (free rigged models)\n\n"
        f"Search (e.g. 'soldier', 'zombie', 'character', 'animal'):"
    )

    if not query or not query.strip(): 
        return

    try:
        results = search_models(query.strip())
        
        if not results:
            messagebox.showinfo(
                "No Results", 
                f"No models found for '{query}'.\n\n"
                f"Try terms like:\n"
                f"• character, soldier, zombie\n"
                f"• animal, dog, cat, horse\n"
                f"• car, tank, plane\n"
                f"• girl, man, people"
            )
            return
        
        RigModelPickerDialog(root, results, target_folder)
        
    except Exception as e:
        messagebox.showerror("Error", f"Failed to search models:\n{str(e)}")

if __name__ == "__main__":
    main()
