"""
dl_model.py - GODLY 3D Model Downloader for K_OS
Downloads high-quality 3D models from Polyhaven (CC0, free for any use)
Supports GLB, FBX, GLTF + batch downloads!
"""

import sys
import os
import urllib.request
import json
import tkinter as tk
from tkinter import simpledialog, messagebox, ttk
import winsound
import threading
import queue

# Polyhaven API - Free, CC0, high quality 3D models
POLYHAVEN_API = "https://api.polyhaven.com"

# Default safe download location
DEFAULT_FOLDER = r"C:\Users\Admin\Desktop\MODELDOWNLOADS"

def fetch_json(url):
    """Helper to fetch JSON from URL"""
    headers = {"User-Agent": "K_OS-ModelDownloader/1.0"}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode('utf-8'))

def search_models(query, limit=20):
    """Search Polyhaven models by query"""
    all_models = fetch_json(f"{POLYHAVEN_API}/assets?t=models")
    
    query_lower = query.lower()
    results = []
    
    for model_id, model_info in all_models.items():
        name_match = query_lower in model_id.lower()
        cat_match = any(query_lower in cat.lower() for cat in model_info.get('categories', []))
        tag_match = any(query_lower in tag.lower() for tag in model_info.get('tags', []))
        
        if name_match or cat_match or tag_match:
            results.append({
                'id': model_id,
                'name': model_id.replace('_', ' ').title(),
                'categories': model_info.get('categories', []),
                'download_count': model_info.get('download_count', 0)
            })
    
    results.sort(key=lambda x: x['download_count'], reverse=True)
    return results[:limit]

def get_model_download_url(model_id, format_type="gltf", resolution="2k"):
    """Get the direct download URL for a model"""
    files_info = fetch_json(f"{POLYHAVEN_API}/files/{model_id}")
    
    format_map = {'gltf': 'gltf', 'glb': 'gltf', 'fbx': 'fbx', 'blend': 'blend'}
    format_key = format_map.get(format_type.lower(), 'gltf')
    
    if format_key not in files_info:
        available = [k for k in files_info.keys() if k in ['gltf', 'fbx', 'blend']]
        if available:
            format_key = available[0]
        else:
            return None, None
    
    format_info = files_info[format_key]
    res_options = list(format_info.keys())
    
    if resolution in format_info:
        chosen_res = resolution
    elif '2k' in format_info:
        chosen_res = '2k'
    elif '1k' in format_info:
        chosen_res = '1k'
    elif '4k' in format_info:
        chosen_res = '4k'
    else:
        chosen_res = res_options[0] if res_options else None
    
    if not chosen_res:
        return None, None
    
    res_info = format_info[chosen_res]
    
    if format_key == 'gltf':
        if 'glb' in res_info:
            url = res_info['glb']['url']
            ext = '.glb'
        else:
            sub_key = list(res_info.keys())[0]
            url = res_info[sub_key]['url']
            ext = f'.{sub_key}'
    else:
        url = res_info.get('url', res_info.get(list(res_info.keys())[0], {}).get('url'))
        ext = f'.{format_key}'
    
    return url, ext

def download_model(model_id, target_folder, format_type="gltf", resolution="2k"):
    """Download a single model to target folder"""
    url, ext = get_model_download_url(model_id, format_type, resolution)
    if not url:
        return False, f"No download URL found for {model_id}"
    
    filename = os.path.join(target_folder, f"{model_id}{ext}")
    headers = {"User-Agent": "K_OS-ModelDownloader/1.0"}
    req = urllib.request.Request(url, headers=headers)
    
    with urllib.request.urlopen(req, timeout=120) as response:
        with open(filename, 'wb') as f:
            while True:
                chunk = response.read(16384)
                if not chunk:
                    break
                f.write(chunk)
    
    return True, filename

class ModelPickerDialog:
    """Multi-select dialog for choosing 3D models"""
    
    def __init__(self, parent, results, target_folder):
        self.selected = []
        self.target_folder = target_folder
        self.msg_queue = queue.Queue()
        self.downloading = False
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("🎮 K_OS Model Downloader")
        self.dialog.geometry("520x500")
        self.dialog.attributes("-topmost", True)
        self.dialog.configure(bg="#1a1a2e")
        
        # Header
        header = tk.Label(
            self.dialog, 
            text=f"📦 Found {len(results)} 3D models",
            font=("Segoe UI", 12, "bold"),
            fg="#ff6b6b",
            bg="#1a1a2e"
        )
        header.pack(pady=10)
        
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
            selectforeground="#ff6b6b",
            yscrollcommand=scrollbar.set,
            height=15
        )
        self.listbox.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.listbox.yview)
        
        self.results = results
        for mdl in results:
            cats = ', '.join(mdl['categories'][:2]) if mdl['categories'] else 'model'
            self.listbox.insert(tk.END, f"{mdl['name']}  [{cats}]")
        
        if len(results) <= 5:
            self.listbox.select_set(0, tk.END)
        
        # Options frame
        opts_frame = tk.Frame(self.dialog, bg="#1a1a2e")
        opts_frame.pack(pady=5)
        
        tk.Label(opts_frame, text="Format:", fg="#aaa", bg="#1a1a2e").pack(side=tk.LEFT)
        self.format_type = tk.StringVar(value="gltf")
        format_dropdown = ttk.Combobox(
            opts_frame, 
            textvariable=self.format_type,
            values=["gltf", "fbx", "blend"],
            width=8,
            state="readonly"
        )
        format_dropdown.pack(side=tk.LEFT, padx=5)
        
        tk.Label(opts_frame, text="  Res:", fg="#aaa", bg="#1a1a2e").pack(side=tk.LEFT)
        self.resolution = tk.StringVar(value="2k")
        res_dropdown = ttk.Combobox(
            opts_frame, 
            textvariable=self.resolution,
            values=["1k", "2k", "4k"],
            width=6,
            state="readonly"
        )
        res_dropdown.pack(side=tk.LEFT, padx=5)
        
        info_label = tk.Label(
            self.dialog,
            text="💡 GLTF = GLB files (best for web/Three.js) | FBX = rigging",
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
            bg="#ff6b6b",
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
            fg="#ff6b6b",
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
        format_type = self.format_type.get()
        resolution = self.resolution.get()
        
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
                    success, _ = download_model(mdl['id'], self.target_folder, format_type, resolution)
                    if success:
                        success_count += 1
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
        "K_OS Model Downloader", 
        f"📂 {display_path}\n\n"
        f"🌐 Source: Polyhaven (CC0, GLB/FBX/GLTF)\n\n"
        f"Search for models (e.g. 'tree', 'rock', 'furniture'):"
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
                f"• tree, plant, grass\n"
                f"• rock, stone, boulder\n"
                f"• furniture, chair, table\n"
                f"• food, fruit, vegetable"
            )
            return
        
        ModelPickerDialog(root, results, target_folder)
        
    except Exception as e:
        messagebox.showerror("Error", f"Failed to fetch models:\n{str(e)}")

if __name__ == "__main__":
    main()
