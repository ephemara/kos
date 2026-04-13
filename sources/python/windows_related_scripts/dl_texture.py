"""
dl_texture.py - GODLY Texture Downloader for K_OS
Downloads high-quality seamless textures from Polyhaven (CC0, free for any use)
Supports batch downloads and 2K+ resolutions!
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

# Polyhaven API - Free, CC0, high quality seamless textures
POLYHAVEN_API = "https://api.polyhaven.com"

# Default safe download location
DEFAULT_FOLDER = r"C:\Users\Admin\Desktop\TEXTUREDOWNLOADS"

def fetch_json(url):
    """Helper to fetch JSON from URL"""
    headers = {"User-Agent": "K_OS-TextureDownloader/1.0"}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode('utf-8'))

def search_textures(query, limit=20):
    """Search Polyhaven textures by query"""
    all_textures = fetch_json(f"{POLYHAVEN_API}/assets?t=textures")
    
    query_lower = query.lower()
    results = []
    
    for tex_id, tex_info in all_textures.items():
        name_match = query_lower in tex_id.lower()
        cat_match = any(query_lower in cat.lower() for cat in tex_info.get('categories', []))
        tag_match = any(query_lower in tag.lower() for tag in tex_info.get('tags', []))
        
        if name_match or cat_match or tag_match:
            results.append({
                'id': tex_id,
                'name': tex_id.replace('_', ' ').title(),
                'categories': tex_info.get('categories', []),
                'download_count': tex_info.get('download_count', 0)
            })
    
    results.sort(key=lambda x: x['download_count'], reverse=True)
    return results[:limit]

def get_texture_download_url(texture_id, resolution="2k"):
    """Get the direct download URL for a texture's diffuse/albedo map"""
    files_info = fetch_json(f"{POLYHAVEN_API}/files/{texture_id}")
    
    if 'Diffuse' in files_info:
        diff_info = files_info['Diffuse']
    elif 'diffuse' in files_info:
        diff_info = files_info['diffuse']
    else:
        diff_info = list(files_info.values())[0] if files_info else None
    
    if not diff_info:
        return None, None
    
    res_options = list(diff_info.keys())
    
    if resolution in diff_info:
        chosen_res = resolution
    elif '2k' in diff_info:
        chosen_res = '2k'
    elif '4k' in diff_info:
        chosen_res = '4k'  
    elif '1k' in diff_info:
        chosen_res = '1k'
    else:
        chosen_res = res_options[0] if res_options else None
    
    if not chosen_res:
        return None, None
    
    format_info = diff_info[chosen_res]
    if 'png' in format_info:
        url = format_info['png']['url']
        ext = '.png'
    elif 'jpg' in format_info:
        url = format_info['jpg']['url']
        ext = '.jpg'
    else:
        fmt = list(format_info.keys())[0]
        url = format_info[fmt]['url']
        ext = f'.{fmt}'
    
    return url, ext

def download_texture(texture_id, target_folder, resolution="2k"):
    """Download a single texture to target folder"""
    url, ext = get_texture_download_url(texture_id, resolution)
    if not url:
        return False, f"No download URL found for {texture_id}"
    
    filename = os.path.join(target_folder, f"{texture_id}{ext}")
    headers = {"User-Agent": "K_OS-TextureDownloader/1.0"}
    req = urllib.request.Request(url, headers=headers)
    
    with urllib.request.urlopen(req, timeout=60) as response:
        with open(filename, 'wb') as f:
            while True:
                chunk = response.read(8192)
                if not chunk:
                    break
                f.write(chunk)
    
    return True, filename

class TexturePickerDialog:
    """Multi-select dialog for choosing textures"""
    
    def __init__(self, parent, results, target_folder):
        self.selected = []
        self.target_folder = target_folder
        self.msg_queue = queue.Queue()
        self.downloading = False
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("🎨 K_OS Texture Picker")
        self.dialog.geometry("500x450")
        self.dialog.attributes("-topmost", True)
        self.dialog.configure(bg="#1a1a2e")
        
        # Header
        header = tk.Label(
            self.dialog, 
            text=f"📦 Found {len(results)} textures",
            font=("Segoe UI", 12, "bold"),
            fg="#00d4ff",
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
            selectforeground="#00ff88",
            yscrollcommand=scrollbar.set,
            height=15
        )
        self.listbox.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.listbox.yview)
        
        self.results = results
        for tex in results:
            cats = ', '.join(tex['categories'][:2]) if tex['categories'] else 'texture'
            self.listbox.insert(tk.END, f"{tex['name']}  [{cats}]")
        
        if len(results) <= 5:
            self.listbox.select_set(0, tk.END)
        
        # Resolution dropdown
        res_frame = tk.Frame(self.dialog, bg="#1a1a2e")
        res_frame.pack(pady=5)
        
        tk.Label(res_frame, text="Resolution:", fg="#aaa", bg="#1a1a2e").pack(side=tk.LEFT)
        self.resolution = tk.StringVar(value="2k")
        res_dropdown = ttk.Combobox(
            res_frame, 
            textvariable=self.resolution,
            values=["1k", "2k", "4k", "8k"],
            width=8,
            state="readonly"
        )
        res_dropdown.pack(side=tk.LEFT, padx=5)
        
        # Buttons
        btn_frame = tk.Frame(self.dialog, bg="#1a1a2e")
        btn_frame.pack(pady=10)
        
        self.download_btn = tk.Button(
            btn_frame,
            text="⬇️ Download Selected",
            command=self.on_download,
            font=("Segoe UI", 10, "bold"),
            bg="#00ff88",
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
            fg="#00d4ff",
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
            messagebox.showwarning("No Selection", "Please select at least one texture!")
            return
        
        selected_textures = [self.results[i] for i in selection]
        resolution = self.resolution.get()
        
        self.download_btn.config(state=tk.DISABLED)
        self.downloading = True
        
        def download_all():
            total = len(selected_textures)
            success_count = 0
            
            for i, tex in enumerate(selected_textures):
                self.msg_queue.put({
                    'type': 'progress',
                    'text': f"Downloading {i+1}/{total}: {tex['name']}..."
                })
                
                try:
                    success, _ = download_texture(tex['id'], self.target_folder, resolution)
                    if success:
                        success_count += 1
                except Exception as e:
                    print(f"Error downloading {tex['id']}: {e}")
            
            self.selected = selected_textures
            self.msg_queue.put({
                'type': 'done',
                'text': f"✅ Downloaded {success_count}/{total} textures!"
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
        "K_OS Texture Downloader", 
        f"📂 {display_path}\n\n"
        f"🌐 Source: Polyhaven (CC0, 2K+ seamless)\n\n"
        f"Search for textures (e.g. 'brick', 'wood', 'metal'):"
    )

    if not query or not query.strip(): 
        return

    try:
        results = search_textures(query.strip())
        
        if not results:
            messagebox.showinfo(
                "No Results", 
                f"No textures found for '{query}'.\n\n"
                f"Try broader terms like:\n"
                f"• brick, stone, concrete\n"
                f"• wood, bark, plank\n"
                f"• metal, rust, copper\n"
                f"• fabric, leather, cloth"
            )
            return
        
        TexturePickerDialog(root, results, target_folder)
        
    except Exception as e:
        messagebox.showerror("Error", f"Failed to fetch textures:\n{str(e)}")

if __name__ == "__main__":
    main()